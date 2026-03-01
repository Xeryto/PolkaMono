import ipaddress
import os
import random
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import models
import schemas
from config import settings
from dotenv import load_dotenv
from models import (
    Brand,
    Checkout,
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusEvent,
    ProductVariant,
    User,
    UserProfile,
    UserShippingInfo,
)
from models import (
    Payment as PaymentModel,
)
from sqlalchemy.orm import Session
from yookassa import Configuration, Payment

load_dotenv()

Configuration.account_id = os.getenv("YOOKASSA_SHOP_ID")
Configuration.secret_key = os.getenv("YOOKASSA_SECRET_KEY")

YOOKASSA_IP_ADDRESSES = [
    ipaddress.ip_network("185.71.76.0/27"),
    ipaddress.ip_network("185.71.77.0/27"),
    ipaddress.ip_network("77.75.153.0/25"),
    ipaddress.ip_network("77.75.154.128/25"),
    ipaddress.ip_network("77.75.156.11"),
    ipaddress.ip_network("77.75.156.35"),
    ipaddress.ip_network("2a02:5180::/32"),
]


def verify_webhook_ip(ip: str) -> bool:
    ip_address = ipaddress.ip_address(ip)
    for network in YOOKASSA_IP_ADDRESSES:
        if ip_address in network:
            return True
    return False


def record_status_event(
    db: Session,
    order: Order,
    to_status: OrderStatus,
    actor_type: str,  # "system" | "user" | "brand" | "admin"
    actor_id: Optional[str] = None,
    note: Optional[str] = None,
) -> None:
    """Append an audit row to order_status_events. Caller must commit."""
    from_val = order.status.value if order.status else None
    event = OrderStatusEvent(
        order_id=order.id,
        from_status=from_val,
        to_status=to_status.value,
        actor_type=actor_type,
        actor_id=str(actor_id) if actor_id is not None else None,
        note=note,
    )
    db.add(event)


DEFAULT_SHIPPING_PRICE = 350.0


def generate_order_number(db: Session, suffix: str = "") -> str:
    """Generate unique order number. Use suffix for sub-orders (e.g. '-1', '-2')."""
    while True:
        base = "".join(random.choices(string.digits, k=5))
        order_number = f"{base}{suffix}" if suffix else base
        if not db.query(Order).filter(Order.order_number == order_number).first():
            return order_number


def _compute_shipping_for_brand(db: Session, brand_id: str, subtotal: float) -> float:
    """Compute shipping cost for a brand from profile. Free if subtotal >= min_free_shipping."""
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        return DEFAULT_SHIPPING_PRICE
    min_free = brand.min_free_shipping
    shipping_price = brand.shipping_price or DEFAULT_SHIPPING_PRICE
    if min_free is not None and subtotal >= min_free:
        return 0.0
    return float(shipping_price)


def create_payment(
    db: Session,
    user_id: str,
    amount: float,
    currency: str,
    description: str,
    return_url: str,
    items: List[schemas.CartItem],
):
    idempotence_key = str(uuid.uuid4())

    order_number = generate_order_number(db)

    # Fetch user's current delivery information to store with the order
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise Exception(f"User with id {user_id} not found")

    order = Order(
        user_id=user_id,
        order_number=order_number,
        total_amount=str(amount),
        currency=currency,
        status=OrderStatus.CREATED,
        expires_at=datetime.now(timezone.utc)        + timedelta(hours=settings.ORDER_PENDING_EXPIRY_HOURS),
        # Store delivery information at order creation time
        delivery_full_name=user.full_name,
        delivery_email=user.delivery_email,
        delivery_phone=user.phone,
        delivery_address=user.address,
        delivery_city=user.city,
        delivery_postal_code=user.postal_code,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    for item in items:
        variant = (
            db.query(ProductVariant)
            .with_for_update()
            .filter(ProductVariant.id == item.product_variant_id)
            .first()
        )
        if not variant:
            raise Exception(
                f"Product variant with id {item.product_variant_id} not found"
            )
        product = variant.product
        if not product:
            raise Exception(f"Product not found for variant {item.product_variant_id}")

        if variant.stock_quantity < item.quantity:
            raise Exception(
                f"Insufficient stock for product {product.name} in size {variant.size}. Available: {variant.stock_quantity}, Requested: {item.quantity}"
            )

        variant.stock_quantity -= item.quantity

        order_item = OrderItem(
            order_id=order.id,
            product_variant_id=variant.id,
            quantity=item.quantity,
            price=product.price,
        )
        db.add(order_item)

    db.commit()

    payment = Payment.create(
        {
            "amount": {"value": "{:.2f}".format(amount), "currency": currency},
            "confirmation": {
                "type": "redirect",
                "return_url": f"{return_url}?payment_id={order.id}",
            },
            "capture": True,
            "description": description,
            "metadata": {"order_id": order.id},
        },
        idempotence_key,
    )

    payment_model = PaymentModel(
        id=payment.id,
        order_id=order.id,
        amount=payment.amount.value if payment.amount else 0.0,
        currency=payment.amount.currency if payment.amount else currency,
        status=payment.status,
    )
    db.add(payment_model)
    db.commit()

    return payment.confirmation.confirmation_url if payment.confirmation else ""


def _build_delivery_address(shipping_info) -> Optional[str]:
    """Build delivery address string from UserShippingInfo."""
    if not shipping_info:
        return None
    parts = []
    if shipping_info.street:
        parts.append(shipping_info.street)
    if shipping_info.house_number:
        parts.append(f"д. {shipping_info.house_number}")
    if shipping_info.apartment_number:
        parts.append(f"кв. {shipping_info.apartment_number}")
    return ", ".join(parts) if parts else None


def _validate_delivery_info(profile, shipping_info, user) -> None:
    """
    Raise if required delivery information is missing.
    Required: full_name (profile), phone, street, city, delivery_email (shipping or auth email).
    """
    missing = []
    if not (profile and profile.full_name and str(profile.full_name).strip()):
        missing.append("полное имя")
    if not (shipping_info and shipping_info.phone and str(shipping_info.phone).strip()):
        missing.append("телефон")
    if not (
        shipping_info and shipping_info.street and str(shipping_info.street).strip()
    ):
        missing.append("улица")
    if not (shipping_info and shipping_info.city and str(shipping_info.city).strip()):
        missing.append("город")
    email = None
    if shipping_info and shipping_info.delivery_email:
        email = str(shipping_info.delivery_email).strip()
    if not email and user and user.auth_account and user.auth_account.email:
        email = str(user.auth_account.email).strip()
    if not email:
        missing.append("email для доставки")
    if missing:
        raise Exception(
            "Для оформления заказа необходимо заполнить информацию о доставке: "
            + ", ".join(missing)
            + ". Пожалуйста, перейдите в настройки профиля."
        )


def create_order_test(
    db: Session,
    user_id: str,
    amount: float,
    currency: str,
    description: str,
    items: List[schemas.CartItem],
) -> str:
    """
    Create checkout + orders (Ozon-style: one Order per brand) without payment gateway (test mode).
    Persists Checkout, Orders, OrderItems, deducts stock, creates Payment, sets all orders PAID.
    Returns checkout_id (primary identifier for the purchase).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise Exception(f"User with id {user_id} not found")

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    shipping_info = (
        db.query(UserShippingInfo).filter(UserShippingInfo.user_id == user_id).first()
    )
    _validate_delivery_info(profile, shipping_info, user)

    delivery_address = _build_delivery_address(shipping_info)

    # Group items by brand and validate stock
    brand_items: dict[str, list[tuple[ProductVariant, int, float]]] = {}
    for item in items:
        variant = (
            db.query(ProductVariant)
            .with_for_update()
            .filter(ProductVariant.id == item.product_variant_id)
            .first()
        )
        if not variant:
            raise Exception(
                f"Product variant with id {item.product_variant_id} not found"
            )
        product = variant.product
        if not product:
            raise Exception(f"Product not found for variant {item.product_variant_id}")
        if variant.stock_quantity < item.quantity:
            raise Exception(
                f"Insufficient stock for product {product.name} in size {variant.size}. "
                f"Available: {variant.stock_quantity}, Requested: {item.quantity}"
            )
        bid = product.brand_id
        if bid not in brand_items:
            brand_items[bid] = []
        brand_items[bid].append((variant, item.quantity, product.price))

    # Build delivery values once (already validated)
    delivery_full_name = (
        (profile.full_name and profile.full_name.strip()) if profile else None
    )
    delivery_email = (
        (shipping_info.delivery_email and shipping_info.delivery_email.strip())
        if shipping_info
        else None
    )
    if not delivery_email and user.auth_account and user.auth_account.email:
        delivery_email = user.auth_account.email.strip()
    delivery_phone = (
        (shipping_info.phone and shipping_info.phone.strip()) if shipping_info else None
    )
    delivery_city = (
        (shipping_info.city and shipping_info.city.strip()) if shipping_info else None
    )
    delivery_postal_code = (
        (shipping_info.postal_code and shipping_info.postal_code.strip())
        if shipping_info
        else None
    )

    # Create Checkout (and denormalize delivery onto Orders so brand view shows it)
    checkout = Checkout(
        user_id=user_id,
        total_amount=float(amount),
        delivery_full_name=delivery_full_name,
        delivery_email=delivery_email,
        delivery_phone=delivery_phone,
        delivery_address=delivery_address,
        delivery_city=delivery_city,
        delivery_postal_code=delivery_postal_code,
    )
    db.add(checkout)
    db.flush()  # Get checkout.id without committing

    base_order_number = generate_order_number(db)
    total_checkout = 0.0
    first_order_id = None

    for idx, (brand_id, brand_item_list) in enumerate(brand_items.items()):
        subtotal = sum(qty * price for _, qty, price in brand_item_list)
        shipping_cost = _compute_shipping_for_brand(db, brand_id, subtotal)
        order_total = subtotal + shipping_cost
        total_checkout += order_total

        order_number = (
            f"{base_order_number}-{idx + 1}"
            if len(brand_items) > 1
            else base_order_number
        )
        order = Order(
            checkout_id=checkout.id,
            brand_id=brand_id,
            order_number=order_number,
            user_id=user_id,
            subtotal=subtotal,
            shipping_cost=shipping_cost,
            total_amount=order_total,
            status=OrderStatus.CREATED,
            expires_at=datetime.now(timezone.utc)            + timedelta(hours=settings.ORDER_PENDING_EXPIRY_HOURS),
            delivery_full_name=delivery_full_name,
            delivery_email=delivery_email,
            delivery_phone=delivery_phone,
            delivery_address=delivery_address,
            delivery_city=delivery_city,
            delivery_postal_code=delivery_postal_code,
        )
        db.add(order)
        db.flush()  # Get order.id without committing
        if first_order_id is None:
            first_order_id = order.id

        for variant, qty, price in brand_item_list:
            variant.stock_quantity -= qty
            order_item = OrderItem(
                order_id=order.id,
                product_variant_id=variant.id,
                quantity=qty,
                price=price,
            )
            db.add(order_item)

        update_order_status(db, order.id, OrderStatus.PAID)

    payment_model = PaymentModel(
        id=str(uuid.uuid4()),
        checkout_id=checkout.id,
        amount=float(amount),
        currency=currency,
        status="succeeded",
    )
    db.add(payment_model)

    # Commit all changes in a single transaction
    db.commit()

    return checkout.id


def get_payment(payment_id: str):
    return Payment.find_one(payment_id)


def get_yookassa_payment_status(payment_id: str):
    try:
        yookassa_payment = Payment.find_one(payment_id)
        return yookassa_payment.status
    except Exception as e:
        print(f"Error fetching YooKassa payment status for {payment_id}: {e}")
        return None


def update_order_status(
    db: Session,
    order_id: str,
    status: OrderStatus,
    actor_type: str = "system",
    actor_id: Optional[str] = None,
    note: Optional[str] = None,
):
    print(f"Attempting to update order {order_id} to status {status.value}")
    order = db.query(Order).with_for_update().filter(Order.id == order_id).first()
    if order:
        print(
            f"Found order {order_id}. Current status: {order.status.value}. New status: {status.value}"
        )
        old_status = order.status

        # Batch-lock all variants for this order to prevent N+1 and race conditions
        variant_ids = [item.product_variant_id for item in order.items]
        variants = (
            db.query(ProductVariant)
            .with_for_update()
            .filter(ProductVariant.id.in_(variant_ids))
            .all()
        ) if variant_ids else []
        variant_map = {v.id: v for v in variants}

        # Update purchase_count when order status changes to/from PAID
        if old_status != status:
            if status == OrderStatus.PAID and old_status != OrderStatus.PAID:
                # Order is being marked as PAID - increment purchase_count for all products in this order
                print(
                    f"Incrementing purchase_count for products in paid order {order_id}"
                )
                for item in order.items:
                    variant = variant_map.get(item.product_variant_id)
                    if variant:
                        product = variant.product
                        if product:
                            quantity = getattr(item, "quantity", 1)
                            product.purchase_count += quantity
                            print(
                                f"Incremented purchase_count for product {product.id} by {quantity} (new count: {product.purchase_count})"
                            )

            elif old_status == OrderStatus.PAID and status != OrderStatus.PAID:
                # Order was PAID but is now being changed to non-PAID (canceled, etc.) - decrement purchase_count
                print(
                    f"Decrementing purchase_count for products in order {order_id} (was PAID, now {status.value})"
                )
                for item in order.items:
                    variant = variant_map.get(item.product_variant_id)
                    if variant:
                        product = variant.product
                        if product:
                            quantity = getattr(item, "quantity", 1)
                            product.purchase_count = max(
                                0, product.purchase_count - quantity
                            )
                            print(
                                f"Decremented purchase_count for product {product.id} by {quantity} (new count: {product.purchase_count})"
                            )

        # If order is being cancelled or returned, restore stock quantities
        if status in (
            OrderStatus.CANCELED,
            OrderStatus.RETURNED,
        ) and old_status not in (OrderStatus.CANCELED, OrderStatus.RETURNED):
            action = "cancelled" if status == OrderStatus.CANCELED else "returned"
            print(f"Restoring stock for {action} order {order_id}")
            for item in order.items:
                variant = variant_map.get(item.product_variant_id)
                if variant:
                    quantity = getattr(item, "quantity", 1)
                    variant.stock_quantity += quantity
                    print(f"Restored {quantity} units to product variant {variant.id}")

        record_status_event(db, order, status, actor_type, actor_id, note)
        order.status = status
        # db.commit() # Removed commit from here - commit is done by caller
        print(f"Order {order_id} status updated to {order.status.value}")
    else:
        print(f"Order {order_id} not found in database.")


def expire_pending_orders(db: Session) -> int:
    """Cancel CREATED orders whose expires_at has passed. Returns count of orders expired."""
    now = datetime.now(timezone.utc)
    expired = (
        db.query(Order)
        .filter(
            Order.status == OrderStatus.CREATED,
            Order.expires_at is not None,
            Order.expires_at < now,
        )
        .all()
    )
    count = 0
    for order in expired:
        update_order_status(
            db, order.id, OrderStatus.CANCELED, actor_type="system", note="auto-expired"
        )
        count += 1
    if count:
        db.commit()
    return count
