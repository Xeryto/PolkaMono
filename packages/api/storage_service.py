"""
S3 storage service for image uploads (avatars, product images).
Uses presigned URLs so clients upload directly to S3.
"""
import uuid
import boto3
from typing import Optional, Tuple

from config import settings


def _s3_client():
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY or not settings.S3_BUCKET_NAME:
        raise RuntimeError(
            "S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET_NAME."
        )
    # Use regional endpoint so browser OPTIONS/PUT go to same host (CORS works reliably)
    endpoint = f"https://s3.{settings.AWS_REGION}.amazonaws.com"
    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        endpoint_url=endpoint,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def generate_key(folder: str, extension: str, prefix: Optional[str] = None) -> str:
    """Generate a unique S3 object key. Extension should include dot, e.g. '.jpg'."""
    ext = extension if extension.startswith(".") else f".{extension}"
    name = f"{uuid.uuid4().hex}{ext}"
    if prefix:
        return f"{folder}/{prefix}/{name}"
    return f"{folder}/{name}"


def get_public_url(key: str) -> str:
    """Return the public URL for an S3 object (bucket URL or custom base)."""
    if settings.S3_PUBLIC_BASE_URL:
        base = settings.S3_PUBLIC_BASE_URL.rstrip("/")
        return f"{base}/{key}"
    return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"


def generate_presigned_upload_url(
    key: str,
    content_type: str,
    expires_in: int = 3600,
) -> Tuple[str, str]:
    """
    Generate a presigned PUT URL for direct client upload.
    Returns (upload_url, public_url).
    """
    client = _s3_client()
    upload_url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )
    public_url = get_public_url(key)
    return upload_url, public_url


def is_configured() -> bool:
    return bool(
        settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
        and settings.S3_BUCKET_NAME
    )
