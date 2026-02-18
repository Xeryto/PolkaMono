"""Add Checkout table and Ozon-style Order refactor

Revision ID: add_checkout_ozon
Revises: e2c0fd65616b
Create Date: 2026-02-18

"""
import uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


revision = "add_checkout_ozon"
down_revision = "e2c0fd65616b"
branch_labels = None
depends_on = None


def _table_exists(conn, name):
    insp = inspect(conn)
    for schema in ("public", None):
        try:
            tables = insp.get_table_names(schema=schema) if schema else insp.get_table_names()
            return name in (tables or [])
        except Exception:
            pass
    return False


def _column_exists(conn, table, column):
    try:
        insp = inspect(conn)
        for schema in ("public", None):
            try:
                cols = insp.get_columns(table, schema=schema) if schema else insp.get_columns(table)
                return column in [c["name"] for c in (cols or [])]
            except Exception:
                pass
    except Exception:
        pass
    return False


def _fk_exists(conn, table, fk_name):
    try:
        insp = inspect(conn)
        for schema in ("public", None):
            try:
                fks = insp.get_foreign_keys(table, schema=schema) if schema else insp.get_foreign_keys(table)
                return any(fk.get("name") == fk_name for fk in (fks or []))
            except Exception:
                pass
    except Exception:
        pass
    return False


def upgrade():
    conn = op.get_bind()

    # 1. Create checkouts table (idempotent)
    if not _table_exists(conn, "checkouts"):
        op.create_table(
            "checkouts",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("total_amount", sa.Float(), nullable=False),
            sa.Column("delivery_full_name", sa.String(255), nullable=True),
            sa.Column("delivery_email", sa.String(255), nullable=True),
            sa.Column("delivery_phone", sa.String(20), nullable=True),
            sa.Column("delivery_address", sa.Text(), nullable=True),
            sa.Column("delivery_city", sa.String(100), nullable=True),
            sa.Column("delivery_postal_code", sa.String(20), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("id"),
        )

    # Steps 2-6 require orders table
    if not _table_exists(conn, "orders"):
        return  # Fresh or minimal DB; checkout schema will be created by models/init_db

    # 2. Add new columns to orders (nullable, idempotent)
    if not _column_exists(conn, "orders", "checkout_id"):
        op.add_column("orders", sa.Column("checkout_id", sa.String(), nullable=True))
    if not _column_exists(conn, "orders", "brand_id"):
        op.add_column("orders", sa.Column("brand_id", sa.Integer(), nullable=True))
    if not _column_exists(conn, "orders", "subtotal"):
        op.add_column("orders", sa.Column("subtotal", sa.Float(), nullable=True))
    if not _column_exists(conn, "orders", "shipping_cost"):
        op.add_column("orders", sa.Column("shipping_cost", sa.Float(), nullable=True))
    if not _fk_exists(conn, "orders", "fk_orders_checkout"):
        op.create_foreign_key("fk_orders_checkout", "orders", "checkouts", ["checkout_id"], ["id"], ondelete="CASCADE")
    if not _fk_exists(conn, "orders", "fk_orders_brand"):
        op.create_foreign_key("fk_orders_brand", "orders", "brands", ["brand_id"], ["id"], ondelete="RESTRICT")

    # 3. Make user_id nullable on orders (for future checkouts; legacy keeps it)
    op.alter_column("orders", "user_id", nullable=True)

    # 4. Add checkout_id to payments (nullable, idempotent)
    if _table_exists(conn, "payments") and not _column_exists(conn, "payments", "checkout_id"):
        op.add_column("payments", sa.Column("checkout_id", sa.String(), nullable=True))
    if _table_exists(conn, "payments") and not _fk_exists(conn, "payments", "fk_payments_checkout"):
        op.create_foreign_key("fk_payments_checkout", "payments", "checkouts", ["checkout_id"], ["id"], ondelete="CASCADE")

    # 5. Add status to order_items (idempotent)
    if _table_exists(conn, "order_items") and not _column_exists(conn, "order_items", "status"):
        op.add_column("order_items", sa.Column("status", sa.String(20), nullable=True))
        conn.execute(text("UPDATE order_items SET status = 'fulfilled' WHERE status IS NULL"))
        op.alter_column("order_items", "status", nullable=False, server_default="fulfilled")

    # 6. Migrate existing data: for each order without checkout_id, create checkout and link
    result = conn.execute(text(
        "SELECT id, user_id, total_amount, delivery_full_name, delivery_email, delivery_phone, "
        "delivery_address, delivery_city, delivery_postal_code, created_at, updated_at "
        "FROM orders WHERE checkout_id IS NULL"
    ))
    orders = result.fetchall()
    for row in orders:
        order_id, user_id, total, fn, em, ph, addr, city, pc, created, updated = row
        checkout_id = str(uuid.uuid4())
        conn.execute(text(
            "INSERT INTO checkouts (id, user_id, total_amount, delivery_full_name, delivery_email, "
            "delivery_phone, delivery_address, delivery_city, delivery_postal_code, created_at, updated_at) "
            "VALUES (:cid, :uid, :tot, :fn, :em, :ph, :addr, :city, :pc, :created, :updated)"
        ), {
            "cid": checkout_id, "uid": user_id, "tot": total,
            "fn": fn, "em": em, "ph": ph, "addr": addr, "city": city, "pc": pc,
            "created": created, "updated": updated
        })
        conn.execute(text(
            "UPDATE orders SET checkout_id = :cid, subtotal = :tot, shipping_cost = 0 WHERE id = :oid"
        ), {"cid": checkout_id, "tot": total, "oid": order_id})
        brand_result = conn.execute(text(
            "SELECT p.brand_id FROM order_items oi "
            "JOIN product_variants pv ON oi.product_variant_id = pv.id "
            "JOIN product_color_variants pcv ON pv.product_color_variant_id = pcv.id "
            "JOIN products p ON pcv.product_id = p.id WHERE oi.order_id = :oid LIMIT 1"
        ), {"oid": order_id})
        brand_row = brand_result.fetchone()
        if brand_row:
            conn.execute(text("UPDATE orders SET brand_id = :bid WHERE id = :oid"), {"bid": brand_row[0], "oid": order_id})
        conn.execute(text("UPDATE payments SET checkout_id = :cid WHERE order_id = :oid"), {"cid": checkout_id, "oid": order_id})


def downgrade():
    op.drop_constraint("fk_payments_checkout", "payments", type_="foreignkey")
    op.drop_column("payments", "checkout_id")
    op.alter_column("orders", "user_id", nullable=False)
    op.drop_constraint("fk_orders_brand", "orders", type_="foreignkey")
    op.drop_constraint("fk_orders_checkout", "orders", type_="foreignkey")
    op.drop_column("orders", "shipping_cost")
    op.drop_column("orders", "subtotal")
    op.drop_column("orders", "brand_id")
    op.drop_column("orders", "checkout_id")
    op.drop_column("order_items", "status")
    op.drop_table("checkouts")
