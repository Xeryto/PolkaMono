"""Notification creation and delivery service."""

from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from models import Notification
from sqlalchemy.orm import Session

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

NOTIFICATION_TTL_DAYS = 7
MAX_NOTIFICATIONS_RETURNED = 20


def create_notification(
    db: Session,
    recipient_type: str,  # "brand" or "user"
    recipient_id: str,
    notif_type: str,
    message: str,
    order_id: Optional[str] = None,
) -> Notification:
    notif = Notification(
        recipient_type=recipient_type,
        recipient_id=str(recipient_id),
        type=notif_type,
        message=message,
        order_id=str(order_id) if order_id else None,
        is_read=False,
        expires_at=datetime.now(timezone.utc) + timedelta(days=NOTIFICATION_TTL_DAYS),
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def send_brand_new_order_notification(
    db: Session, brand_id: str, order_id: str
) -> None:
    """Fire 'new_order' notification to the brand that just received an order."""
    create_notification(
        db=db,
        recipient_type="brand",
        recipient_id=str(brand_id),
        notif_type="new_order",
        message="Получен новый заказ",
        order_id=order_id,
    )


def send_return_logged_notification(db: Session, brand_id: str, order_id: str) -> None:
    """Fire 'return_logged' notification to brand when admin logs a return."""
    create_notification(
        db=db,
        recipient_type="brand",
        recipient_id=str(brand_id),
        notif_type="return_logged",
        message="Оформлен возврат по вашему заказу",
        order_id=order_id,
    )


def send_expo_push_notification(
    push_token: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> None:
    """Send a push notification via Expo Push API. Fire-and-forget — errors are logged not raised."""
    if not push_token or not push_token.startswith("ExponentPushToken"):
        print(f"notification_service - skipping push: invalid token '{push_token}'")
        return
    payload = {
        "to": push_token,
        "title": title,
        "body": body,
        "sound": "default",
        "data": data or {},
    }
    print(f"notification_service - sending push to {push_token[:30]}... title='{title}' data={data}")
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(
                EXPO_PUSH_URL, json=payload, headers={"Accept": "application/json"}
            )
        print(f"notification_service - Expo response {resp.status_code}: {resp.text}")
    except Exception as exc:
        print(f"notification_service - push failed: {exc}")


def send_buyer_shipped_notification(
    db: Session, order_id: str, brand_name: str, user_id: str
) -> None:
    """Send Expo push to the buyer when their order is shipped."""
    from models import User, UserPreferences

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        print(f"notification_service - shipped: user {user_id} not found")
        return
    if not user.expo_push_token:
        print(f"notification_service - shipped: user {user_id} has no push token")
        return
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
    if prefs and not prefs.order_notifications:
        print(f"notification_service - shipped: user {user_id} disabled order notifications")
        return
    print(f"notification_service - shipped: sending to user {user_id}, token={user.expo_push_token[:30]}...")
    send_expo_push_notification(
        push_token=user.expo_push_token,
        title="Заказ отправлен",
        body=f"Ваш заказ от {brand_name} отправлен",
        data={"order_id": order_id},
    )


def send_admin_broadcast_to_brands(db: Session, message: str) -> None:
    """Create an in-app notification for every active brand.

    Brands are web portal users and have no Expo push tokens — delivery is
    in-app only (bell dropdown). Admin-to-buyer push broadcast is out of scope
    for Phase 8 and handled by ADMIN-04 in Phase 9.
    """
    from models import Brand

    brands = db.query(Brand).filter(Brand.is_inactive == False).all()
    for brand in brands:
        create_notification(
            db=db,
            recipient_type="brand",
            recipient_id=str(brand.id),
            notif_type="admin_custom",
            message=message,
        )
