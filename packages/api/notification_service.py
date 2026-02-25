"""Notification creation and delivery service."""
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from models import Notification

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
        expires_at=datetime.utcnow() + timedelta(days=NOTIFICATION_TTL_DAYS),
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def send_brand_new_order_notification(db: Session, brand_id: int, order_id: str) -> None:
    """Fire 'new_order' notification to the brand that just received an order."""
    create_notification(
        db=db,
        recipient_type="brand",
        recipient_id=str(brand_id),
        notif_type="new_order",
        message="Получен новый заказ",
        order_id=order_id,
    )


def send_return_logged_notification(db: Session, brand_id: int, order_id: str) -> None:
    """Fire 'return_logged' notification to brand when admin logs a return."""
    create_notification(
        db=db,
        recipient_type="brand",
        recipient_id=str(brand_id),
        notif_type="return_logged",
        message="Оформлен возврат по вашему заказу",
        order_id=order_id,
    )
