
import hmac
import hashlib
import random
import string
import uuid
from typing import List
from yookassa import Configuration, Payment
from dotenv import load_dotenv
import os
from sqlalchemy.orm import Session
from models import Order, OrderItem, Payment as PaymentModel, OrderStatus, Product, ProductVariant, User, UserProfile, UserShippingInfo
import models
import ipaddress

import schemas

load_dotenv()

Configuration.account_id = os.getenv("YOOKASSA_SHOP_ID")
Configuration.secret_key = os.getenv("YOOKASSA_SECRET_KEY")

YOOKASSA_IP_ADDRESSES = [
    ipaddress.ip_network('185.71.76.0/27'),
    ipaddress.ip_network('185.71.77.0/27'),
    ipaddress.ip_network('77.75.153.0/25'),
    ipaddress.ip_network('77.75.154.128/25'),
    ipaddress.ip_network('77.75.156.11'),
    ipaddress.ip_network('77.75.156.35'),
    ipaddress.ip_network('2a02:5180::/32'),
]

def verify_webhook_ip(ip: str) -> bool:
    ip_address = ipaddress.ip_address(ip)
    for network in YOOKASSA_IP_ADDRESSES:
        if ip_address in network:
            return True
    return False

def generate_order_number(db: Session) -> str:
    while True:
        order_number = ''.join(random.choices(string.digits, k=5))
        if not db.query(Order).filter(Order.order_number == order_number).first():
            return order_number

def create_payment(db: Session, user_id: str, amount: float, currency: str, description: str, return_url: str, items: List[schemas.CartItem]):
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
        variant = db.query(ProductVariant).filter(ProductVariant.id == item.product_variant_id).first()
        if not variant:
            raise Exception(f"Product variant with id {item.product_variant_id} not found")
        product = variant.product
        if not product:
            raise Exception(f"Product not found for variant {item.product_variant_id}")

        if variant.stock_quantity < item.quantity:
            raise Exception(f"Insufficient stock for product {product.name} in size {variant.size}. Available: {variant.stock_quantity}, Requested: {item.quantity}")

        variant.stock_quantity -= item.quantity

        order_item = OrderItem(
            order_id=order.id,
            product_variant_id=variant.id,
            quantity=item.quantity,
            price=product.price
        )
        db.add(order_item)

    db.commit()

    payment = Payment.create({
        "amount": {
            "value": "{:.2f}".format(amount),
            "currency": currency
        },
        "confirmation": {
            "type": "redirect",
            "return_url": f"{return_url}?payment_id={order.id}"
        },
        "capture": True,
        "description": description,
        "metadata": {
            "order_id": order.id
        }
    }, idempotence_key)

    payment_model = PaymentModel(
        id=payment.id,
        order_id=order.id,
        amount=payment.amount.value,
        currency=payment.amount.currency,
        status=payment.status
    )
    db.add(payment_model)
    db.commit()

    return payment.confirmation.confirmation_url


def _build_delivery_address(shipping_info) -> str | None:
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


def create_order_test(db: Session, user_id: str, amount: float, currency: str, description: str, items: List[schemas.CartItem]) -> str:
    """
    Create an order without payment gateway (test mode). Persists order, order items,
    deducts stock, creates Payment with status 'succeeded', sets order to PAID.
    Returns order id.
    """
    order_number = generate_order_number(db)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise Exception(f"User with id {user_id} not found")

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    shipping_info = db.query(UserShippingInfo).filter(UserShippingInfo.user_id == user_id).first()
    delivery_address = _build_delivery_address(shipping_info)

    order = Order(
        user_id=user_id,
        order_number=order_number,
        total_amount=float(amount),
        status=OrderStatus.PENDING,
        delivery_full_name=profile.full_name if profile else None,
        delivery_email=shipping_info.delivery_email if shipping_info else (user.auth_account.email if user.auth_account else None),
        delivery_phone=shipping_info.phone if shipping_info else None,
        delivery_address=delivery_address,
        delivery_city=shipping_info.city if shipping_info else None,
        delivery_postal_code=shipping_info.postal_code if shipping_info else None,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    for idx, item in enumerate(items):
        variant = db.query(ProductVariant).filter(ProductVariant.id == item.product_variant_id).first()
        if not variant:
            raise Exception(f"Product variant with id {item.product_variant_id} not found")
        product = variant.product
        if not product:
            raise Exception(f"Product not found for variant {item.product_variant_id}")

        if variant.stock_quantity < item.quantity:
            raise Exception(
                f"Insufficient stock for product {product.name} in size {variant.size}. "
                f"Available: {variant.stock_quantity}, Requested: {item.quantity}"
            )

        variant.stock_quantity -= item.quantity
        # SKU left null - brands submit via dashboard

        order_item = OrderItem(
            order_id=order.id,
            product_variant_id=variant.id,
            quantity=item.quantity,
            price=product.price,
        )
        db.add(order_item)

    db.commit()

    payment_model = PaymentModel(
        id=str(uuid.uuid4()),
        order_id=order.id,
        amount=float(amount),
        currency=currency,
        status="succeeded",
    )
    db.add(payment_model)
    db.commit()

    update_order_status(db, order.id, OrderStatus.PAID)
    db.commit()

    return order.id


def get_payment(payment_id: str):
    return Payment.find_one(payment_id)

def get_yookassa_payment_status(payment_id: str):
    try:
        yookassa_payment = Payment.find_one(payment_id)
        return yookassa_payment.status
    except Exception as e:
        print(f"Error fetching YooKassa payment status for {payment_id}: {e}")
        return None

def update_order_status(db: Session, order_id: str, status: OrderStatus):
    print(f"Attempting to update order {order_id} to status {status.value}")
    order = db.query(Order).filter(Order.id == order_id).first()
    if order:
        print(f"Found order {order_id}. Current status: {order.status.value}. New status: {status.value}")
        old_status = order.status
        
        # Update purchase_count when order status changes to/from PAID
        if old_status != status:
            if status == OrderStatus.PAID and old_status != OrderStatus.PAID:
                # Order is being marked as PAID - increment purchase_count for all products in this order
                print(f"Incrementing purchase_count for products in paid order {order_id}")
                purchase_count_changed = False
                for item in order.items:
                    variant = db.query(ProductVariant).filter(ProductVariant.id == item.product_variant_id).first()
                    if variant:
                        product = variant.product
                        if product:
                            # Use getattr to handle missing quantity field gracefully (defaults to 1)
                            quantity = getattr(item, 'quantity', 1)
                            product.purchase_count += quantity
                            purchase_count_changed = True
                            print(f"Incremented purchase_count for product {product.id} by {quantity} (new count: {product.purchase_count})")
                # Note: Popular items cache will refresh via TTL (5 minutes)
                # Cache invalidation on purchase count change would require avoiding circular imports
            
            elif old_status == OrderStatus.PAID and status != OrderStatus.PAID:
                # Order was PAID but is now being changed to non-PAID (canceled, etc.) - decrement purchase_count
                print(f"Decrementing purchase_count for products in order {order_id} (was PAID, now {status.value})")
                for item in order.items:
                    variant = db.query(ProductVariant).filter(ProductVariant.id == item.product_variant_id).first()
                    if variant:
                        product = variant.product
                        if product:
                            # Use getattr to handle missing quantity field gracefully (defaults to 1)
                            quantity = getattr(item, 'quantity', 1)
                            product.purchase_count = max(0, product.purchase_count - quantity)  # Don't go below 0
                            print(f"Decremented purchase_count for product {product.id} by {quantity} (new count: {product.purchase_count})")
                # Note: Popular items cache will refresh via TTL (5 minutes)
        
        # If order is being cancelled or returned, restore stock quantities
        if status in (OrderStatus.CANCELED, OrderStatus.RETURNED) and old_status not in (OrderStatus.CANCELED, OrderStatus.RETURNED):
            action = "cancelled" if status == OrderStatus.CANCELED else "returned"
            print(f"Restoring stock for {action} order {order_id}")
            for item in order.items:
                variant = db.query(ProductVariant).filter(ProductVariant.id == item.product_variant_id).first()
                if variant:
                    quantity = getattr(item, 'quantity', 1)
                    variant.stock_quantity += quantity
                    print(f"Restored {quantity} units to product variant {variant.id}")

        order.status = status
        # db.commit() # Removed commit from here - commit is done by caller
        print(f"Order {order_id} status updated to {order.status.value}")
    else:
        print(f"Order {order_id} not found in database.")

