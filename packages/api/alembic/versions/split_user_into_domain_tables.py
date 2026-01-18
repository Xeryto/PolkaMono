"""split user into domain tables

Revision ID: split_user_domains
Revises: add_address_fields
Create Date: 2026-01-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM


# revision identifiers, used by Alembic.
revision = 'split_user_domains'
down_revision = 'add_address_fields'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    
    # Create enum type for PrivacyOption if it doesn't exist
    privacy_enum = PG_ENUM('nobody', 'friends', 'everyone', name='privacyoption')
    privacy_enum.create(conn, checkfirst=True)
    
    # Ensure gender enum exists (it should already exist from previous migrations)
    # Use raw SQL check to avoid duplicate creation issues
    conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender') THEN
                CREATE TYPE gender AS ENUM ('MALE', 'FEMALE');
            END IF;
        END $$;
    """))
    
    # Create tables only if they don't exist (they may already exist from initial migration)
    if 'user_profiles' not in tables:
        # Create user_profiles table without gender column first to avoid enum creation issues
        op.create_table(
            'user_profiles',
            sa.Column('id', sa.String(), nullable=False),
            sa.Column('user_id', sa.String(), nullable=False),
            sa.Column('full_name', sa.String(255), nullable=True),
            sa.Column('selected_size', sa.String(10), nullable=True),
            sa.Column('avatar_url', sa.String(500), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
        )
        
        # Add gender column using raw SQL to reference the existing enum type
        op.execute(text("ALTER TABLE user_profiles ADD COLUMN gender gender"))
        
        op.create_index('ix_user_profiles_user_id', 'user_profiles', ['user_id'], unique=True)
    else:
        # Check if gender column exists, if not add it
        columns = [col['name'] for col in inspector.get_columns('user_profiles')]
        if 'gender' not in columns:
            op.execute(text("ALTER TABLE user_profiles ADD COLUMN gender gender"))
    
    if 'user_shipping_info' not in tables:
        # Create user_shipping_info table
        op.create_table(
            'user_shipping_info',
            sa.Column('id', sa.String(), nullable=False),
            sa.Column('user_id', sa.String(), nullable=False),
            sa.Column('delivery_email', sa.String(255), nullable=True),
            sa.Column('phone', sa.String(20), nullable=True),
            sa.Column('street', sa.String(255), nullable=True),
            sa.Column('house_number', sa.String(50), nullable=True),
            sa.Column('apartment_number', sa.String(50), nullable=True),
            sa.Column('city', sa.String(100), nullable=True),
            sa.Column('postal_code', sa.String(20), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
        )
        op.create_index('ix_user_shipping_info_user_id', 'user_shipping_info', ['user_id'], unique=True)
    
    if 'user_preferences' not in tables:
        # Create user_preferences table
        op.create_table(
            'user_preferences',
            sa.Column('id', sa.String(), nullable=False),
            sa.Column('user_id', sa.String(), nullable=False),
            sa.Column('size_privacy', privacy_enum, nullable=True, server_default='friends'),
            sa.Column('recommendations_privacy', privacy_enum, nullable=True, server_default='friends'),
            sa.Column('likes_privacy', privacy_enum, nullable=True, server_default='friends'),
            sa.Column('order_notifications', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('marketing_notifications', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
        )
        op.create_index('ix_user_preferences_user_id', 'user_preferences', ['user_id'], unique=True)
    
    # Migrate data from users table to new tables (only if old columns exist)
    users_columns = [col['name'] for col in inspector.get_columns('users')]
    columns_to_migrate = [
        'full_name', 'gender', 'selected_size', 'avatar_url',
        'delivery_email', 'phone', 'street', 'house_number', 
        'apartment_number', 'city', 'postal_code'
    ]
    
    # Filter to only columns that actually exist
    existing_columns = [col for col in columns_to_migrate if col in users_columns]
    
    # Only migrate if old columns exist on users table
    if existing_columns:
        # Build SELECT query with only existing columns
        select_cols = ['id'] + existing_columns + ['created_at', 'updated_at']
        select_query = f"SELECT {', '.join(select_cols)} FROM users"
        
        # Get all users with data to migrate
        users_result = conn.execute(text(select_query))
        
        # Create a mapping of column names to indices
        col_map = {col: idx for idx, col in enumerate(select_cols)}
        
        for user_row in users_result:
            user_id = user_row[col_map['id']]
            created_at = user_row[col_map['created_at']] if 'created_at' in col_map else None
            updated_at = user_row[col_map['updated_at']] if 'updated_at' in col_map else None
            
            # Get profile data values (only if columns exist)
            full_name = user_row[col_map['full_name']] if 'full_name' in col_map else None
            gender = user_row[col_map['gender']] if 'gender' in col_map else None
            selected_size = user_row[col_map['selected_size']] if 'selected_size' in col_map else None
            avatar_url = user_row[col_map['avatar_url']] if 'avatar_url' in col_map else None
            
            # Check if profile already exists for this user
            profile_exists = conn.execute(text("""
                SELECT 1 FROM user_profiles WHERE user_id = :user_id
            """), {'user_id': user_id}).fetchone()
            
            # Insert into user_profiles if any profile data exists and profile doesn't exist
            if not profile_exists and any([full_name, gender, selected_size, avatar_url]):
                conn.execute(text("""
                    INSERT INTO user_profiles (id, user_id, full_name, gender, selected_size, avatar_url, created_at, updated_at)
                    VALUES (gen_random_uuid()::text, :user_id, :full_name, :gender, :selected_size, :avatar_url, :created_at, :updated_at)
                """), {
                    'user_id': user_id,
                    'full_name': full_name,
                    'gender': gender,
                    'selected_size': selected_size,
                    'avatar_url': avatar_url,
                    'created_at': created_at,
                    'updated_at': updated_at
                })
            
            # Get shipping data values (only if columns exist)
            delivery_email = user_row[col_map['delivery_email']] if 'delivery_email' in col_map else None
            phone = user_row[col_map['phone']] if 'phone' in col_map else None
            street = user_row[col_map['street']] if 'street' in col_map else None
            house_number = user_row[col_map['house_number']] if 'house_number' in col_map else None
            apartment_number = user_row[col_map['apartment_number']] if 'apartment_number' in col_map else None
            city = user_row[col_map['city']] if 'city' in col_map else None
            postal_code = user_row[col_map['postal_code']] if 'postal_code' in col_map else None
            
            # Check if shipping info already exists for this user
            shipping_exists = conn.execute(text("""
                SELECT 1 FROM user_shipping_info WHERE user_id = :user_id
            """), {'user_id': user_id}).fetchone()
            
            # Insert into user_shipping_info if any shipping data exists and shipping doesn't exist
            if not shipping_exists and any([delivery_email, phone, street, house_number, apartment_number, city, postal_code]):
                conn.execute(text("""
                    INSERT INTO user_shipping_info (id, user_id, delivery_email, phone, street, house_number, apartment_number, city, postal_code, created_at, updated_at)
                    VALUES (gen_random_uuid()::text, :user_id, :delivery_email, :phone, :street, :house_number, :apartment_number, :city, :postal_code, :created_at, :updated_at)
                """), {
                    'user_id': user_id,
                    'delivery_email': delivery_email,
                    'phone': phone,
                    'street': street,
                    'house_number': house_number,
                    'apartment_number': apartment_number,
                    'city': city,
                    'postal_code': postal_code,
                    'created_at': created_at,
                    'updated_at': updated_at
                })
            
            # Check if preferences already exists for this user
            preferences_exists = conn.execute(text("""
                SELECT 1 FROM user_preferences WHERE user_id = :user_id
            """), {'user_id': user_id}).fetchone()
            
            # Insert into user_preferences for all users (with defaults) if doesn't exist
            if not preferences_exists:
                conn.execute(text("""
                    INSERT INTO user_preferences (id, user_id, size_privacy, recommendations_privacy, likes_privacy, order_notifications, marketing_notifications, created_at, updated_at)
                    VALUES (gen_random_uuid()::text, :user_id, 'friends', 'friends', 'friends', true, true, :created_at, :updated_at)
                """), {
                    'user_id': user_id,
                    'created_at': created_at,
                    'updated_at': updated_at
                })
        
        # After data migration, drop old columns from users table
        columns_to_drop = [
            'gender', 'selected_size', 'avatar_url',
            'full_name', 'delivery_email', 'phone',
            'street', 'house_number', 'apartment_number', 'city', 'postal_code'
        ]
        
        for col_name in columns_to_drop:
            if col_name in users_columns:
                op.drop_column('users', col_name)


def downgrade():
    conn = op.get_bind()
    
    # Drop tables (data loss - this will delete migrated data)
    op.drop_index('ix_user_preferences_user_id', table_name='user_preferences')
    op.drop_table('user_preferences')
    
    op.drop_index('ix_user_shipping_info_user_id', table_name='user_shipping_info')
    op.drop_table('user_shipping_info')
    
    op.drop_index('ix_user_profiles_user_id', table_name='user_profiles')
    op.drop_table('user_profiles')
    
    # Drop enum type
    privacy_enum = PG_ENUM(name='privacyoption')
    privacy_enum.drop(conn, checkfirst=True)
