from sqlalchemy.orm import Session
from database import SessionLocal
from models import Brand, Style, Product, ProductStyle, Category, ProductVariant, User, Order, OrderItem, OrderStatus, Payment
import uuid
import re
from auth_service import auth_service # NEW

def generate_sku(product_name: str) -> str:
    # Convert to uppercase, replace spaces with hyphens, remove non-alphanumeric
    sku_base = re.sub(r'[^a-zA-Z0-9]', '', product_name.upper().replace(' ', '-'))
    # Append a short unique identifier
    unique_id = str(uuid.uuid4())[:8].replace('-', '') # Use first 8 chars of UUID
    return f"{sku_base}-{unique_id}"

def populate_initial_data():
    
    db: Session = SessionLocal()
    try:
        # Populate Brands
        # Hash a default password for all brands
        default_password_hash = auth_service.hash_password("brandpassword123")

        brands_data = [
            {"name": "Nike", "email": "nike@example.com", "password_hash": default_password_hash, "slug": "nike", "description": "Global leader in athletic footwear, apparel, equipment, accessories, and services.", "return_policy": "30-day free returns.", "min_free_shipping": 100, "shipping_price": "5.00", "shipping_provider": "FedEx", "amount_withdrawn": 0.0},
            {"name": "Adidas", "email": "adidas@example.com", "password_hash": default_password_hash, "slug": "adidas", "description": "German multinational corporation, designs and manufactures shoes, clothing and accessories.", "return_policy": "20-day returns, customer pays shipping.", "min_free_shipping": 150, "shipping_price": "7.50", "shipping_provider": "UPS", "amount_withdrawn": 0.0},
            {"name": "Zara", "email": "zara@example.com", "password_hash": default_password_hash, "slug": "zara", "description": "Spanish apparel retailer based in Arteixo, Galicia, Spain.", "return_policy": "14-day exchange only.", "min_free_shipping": 50, "shipping_price": "3.00", "shipping_provider": "DHL", "amount_withdrawn": 0.0},
            {"name": "H&M", "email": "hm@example.com", "password_hash": default_password_hash, "slug": "h&m", "description": "Swedish multinational clothing-retail company known for its fast-fashion clothing for men, women, teenagers and children.", "return_policy": "No returns on sale items.", "min_free_shipping": 75, "shipping_price": "4.50", "shipping_provider": "USPS", "amount_withdrawn": 0.0}
        ]
        for b_data in brands_data:
            if not db.query(Brand).filter(Brand.name == b_data["name"]).first():
                db.add(Brand(**b_data))
        db.commit()
        print("Brands populated.")

        # Populate Styles
        styles_data = [
            {"id": "casual", "name": "Casual", "description": "Relaxed, comfortable, and suitable for everyday wear."},
            {"id": "sporty", "name": "Sporty", "description": "Athletic-inspired, comfortable, and functional."},
            {"id": "elegant", "name": "Elegant", "description": "Sophisticated, graceful, and refined."},
            {"id": "streetwear", "name": "Streetwear", "description": "Comfortable, casual clothing inspired by hip-hop and skate culture."}
        ]
        for s_data in styles_data:
            if not db.query(Style).filter(Style.id == s_data["id"]).first():
                db.add(Style(**s_data))
        db.commit()
        print("Styles populated.")

        # Populate Categories
        categories_data = [
            {"id": "tshirts", "name": "T-Shirts", "description": "Casual tops for everyday wear."},
            {"id": "jeans", "name": "Jeans", "description": "Durable denim trousers."},
            {"id": "dresses", "name": "Dresses", "description": "One-piece garments for various occasions."},
            {"id": "sneakers", "name": "Sneakers", "description": "Athletic and casual footwear."},
            {"id": "hoodies", "name": "Hoodies", "description": "Comfortable hooded sweatshirts."}
        ]
        for c_data in categories_data:
            if not db.query(Category).filter(Category.id == c_data["id"]).first():
                db.add(Category(**c_data))
        db.commit()
        print("Categories populated.")

        # Retrieve populated brands, styles, and categories
        nike_brand = db.query(Brand).filter(Brand.name == "Nike").first()
        adidas_brand = db.query(Brand).filter(Brand.name == "Adidas").first()
        zara_brand = db.query(Brand).filter(Brand.name == "Zara").first()
        hm_brand = db.query(Brand).filter(Brand.name == "H&M").first()

        casual_style = db.query(Style).filter(Style.id == "casual").first()
        sporty_style = db.query(Style).filter(Style.id == "sporty").first()
        elegant_style = db.query(Style).filter(Style.id == "elegant").first()
        streetwear_style = db.query(Style).filter(Style.id == "streetwear").first()

        
        dresses_category = db.query(Category).filter(Category.id == "dresses").first()
        sneakers_category = db.query(Category).filter(Category.id == "sneakers").first()
        hoodies_category = db.query(Category).filter(Category.id == "hoodies").first()

        # Populate Products and ProductStyles
        products_data = [
            {
                "name": "Nike Air Max 270",
                "description": "Comfortable and stylish everyday sneakers.",
                "price": 150.00,
                "images": [],
                "sizes": ["S", "M", "L"],
                "brand": nike_brand,
                "category": sneakers_category,
                "styles": [sporty_style, casual_style],
                "color": "White",
                "material": "polyester",
                "return_policy": "30-day free returns.",
                "honest_sign": "HS-NIKEAM270"
            },
            {
                "name": "Adidas Ultraboost 22",
                "description": "Responsive running shoes for daily miles.",
                "price": 180.00,
                "images": [],
                "sizes": ["XS", "S", "M"],
                "brand": adidas_brand,
                "category": sneakers_category,
                "styles": [sporty_style],
                "color": "Black",
                "material": "polyester",
                "return_policy": "20-day returns, customer pays shipping.",
                "honest_sign": "HS-ADIDASUB22"
            },
            {
                "name": "Zara Flowy Midi Dress",
                "description": "Lightweight and elegant dress for any occasion.",
                "price": 79.99,
                "images": [],
                "sizes": ["M", "L", "XL"],
                "brand": zara_brand,
                "category": dresses_category,
                "styles": [elegant_style, casual_style],
                "color": "Multi-Color",
                "material": "cotton",
                "return_policy": "14-day exchange only.",
                "honest_sign": "HS-ZARAFMD"
            },
            {
                "name": "H&M Oversized Hoodie",
                "description": "Cozy and trendy oversized hoodie.",
                "price": 35.00,
                "images": [],
                "sizes": ["XS", "S"],
                "brand": hm_brand,
                "category": hoodies_category,
                "styles": [casual_style, streetwear_style],
                "color": "Grey",
                "material": "cotton",
                "return_policy": "No returns on sale items.",
                "honest_sign": "HS-HMOH"
            },
            {
                "name": "Nike Sportswear Tech Fleece",
                "description": "Premium fleece for warmth without the weight.",
                "price": 110.00,
                "images": [],
                "sizes": ["S", "M", "L", "XL"],
                "brand": nike_brand,
                "category": hoodies_category,
                "styles": [sporty_style, casual_style, streetwear_style],
                "color": "Black",
                "material": "fleece",
                "return_policy": "30-day free returns.",
                "honest_sign": "HS-NIKESWTF"
            }
        ]

        for p_data in products_data:
            if not db.query(Product).filter(Product.name == p_data["name"]).first():
                product = Product(
                    id=str(uuid.uuid4()),
                    name=p_data["name"],
                    description=p_data["description"],
                    price=p_data["price"],
                    images=p_data["images"],
                    brand_id=p_data["brand"].id,
                    category_id=p_data["category"].id,
                    color=p_data["color"], # NEW
                    material=p_data["material"], # NEW
                    sku=generate_sku(p_data["name"]), # Auto-generated SKU
                )
                db.add(product)
                db.flush() # Flush to get product.id

                for size in p_data["sizes"]:
                    product_variant = ProductVariant(
                        product_id=product.id,
                        size=size,
                        stock_quantity=10 # Default stock quantity
                    )
                    db.add(product_variant)

                for style in p_data["styles"]:
                    product_style = ProductStyle(product_id=product.id, style_id=style.id)
                    db.add(product_style)
                print(f"Added product: {product.name}")
            else:
                print(f"Product already exists: {p_data['name']}")
        
        db.commit()
        print("Products populated.")

        # Create test user account
        test_user_password_hash = auth_service.hash_password("123abc")
        test_user_data = {
            "username": "test",
            "email": "test@example.com",
            "password_hash": test_user_password_hash,
            "full_name": "Test User",
            "delivery_email": "test@example.com",
            "phone": "+1234567890",
            "address": "123 Test Street",
            "city": "Test City",
            "postal_code": "12345",
            "is_email_verified": True
        }
        
        test_user = db.query(User).filter(User.username == "test").first()
        if not test_user:
            test_user = User(**test_user_data)
            db.add(test_user)
            db.commit()
            print("Test user created.")
        else:
            print("Test user already exists.")

        # Create fake orders
        if test_user:
            # Get some products and their variants for orders
            nike_product = db.query(Product).filter(Product.name == "Nike Air Max 270").first()
            adidas_product = db.query(Product).filter(Product.name == "Adidas Ultraboost 22").first()
            zara_product = db.query(Product).filter(Product.name == "Zara Flowy Midi Dress").first()
            
            if nike_product and adidas_product and zara_product:
                # Get product variants
                nike_variant_m = db.query(ProductVariant).filter(
                    ProductVariant.product_id == nike_product.id,
                    ProductVariant.size == "M"
                ).first()
                adidas_variant_s = db.query(ProductVariant).filter(
                    ProductVariant.product_id == adidas_product.id,
                    ProductVariant.size == "S"
                ).first()
                zara_variant_l = db.query(ProductVariant).filter(
                    ProductVariant.product_id == zara_product.id,
                    ProductVariant.size == "L"
                ).first()

                # Create Order 1: Nike sneakers
                if nike_variant_m:
                    order1 = Order(
                        order_number="ORD-001",
                        user_id=test_user.id,
                        total_amount=150.00,
                        status=OrderStatus.PAID,
                        tracking_number="TN123456789",
                        tracking_link="https://track.example.com/TN123456789",
                        # Store delivery information at order creation time
                        delivery_full_name=test_user.full_name,
                        delivery_email=test_user.delivery_email,
                        delivery_phone=test_user.phone,
                        delivery_address=test_user.address,
                        delivery_city=test_user.city,
                        delivery_postal_code=test_user.postal_code
                    )
                    db.add(order1)
                    db.flush()

                    order_item1 = OrderItem(
                        order_id=order1.id,
                        product_variant_id=nike_variant_m.id,
                        price=150.00,
                        honest_sign="HS-NIKEAM270-M-001"
                    )
                    db.add(order_item1)

                    payment1 = Payment(
                        id=str(uuid.uuid4()),
                        order_id=order1.id,
                        amount=150.00,
                        currency="RUB",
                        status="completed"
                    )
                    db.add(payment1)
                    print("Created Order 1: Nike Air Max 270")

                # Create Order 2: Adidas sneakers
                if adidas_variant_s:
                    order2 = Order(
                        order_number="ORD-002",
                        user_id=test_user.id,
                        total_amount=180.00,
                        status=OrderStatus.PENDING,
                        tracking_number=None,
                        tracking_link=None,
                        # Store delivery information at order creation time
                        delivery_full_name=test_user.full_name,
                        delivery_email=test_user.delivery_email,
                        delivery_phone=test_user.phone,
                        delivery_address=test_user.address,
                        delivery_city=test_user.city,
                        delivery_postal_code=test_user.postal_code
                    )
                    db.add(order2)
                    db.flush()

                    order_item2 = OrderItem(
                        order_id=order2.id,
                        product_variant_id=adidas_variant_s.id,
                        price=180.00,
                        honest_sign="HS-ADIDASUB22-S-002"
                    )
                    db.add(order_item2)

                    payment2 = Payment(
                        id=str(uuid.uuid4()),
                        order_id=order2.id,
                        amount=180.00,
                        currency="RUB",
                        status="pending"
                    )
                    db.add(payment2)
                    print("Created Order 2: Adidas Ultraboost 22")

                # Create Order 3: Zara dress
                if zara_variant_l:
                    order3 = Order(
                        order_number="ORD-003",
                        user_id=test_user.id,
                        total_amount=79.99,
                        status=OrderStatus.PAID,
                        tracking_number="TN987654321",
                        tracking_link="https://track.example.com/TN987654321",
                        # Store delivery information at order creation time
                        delivery_full_name=test_user.full_name,
                        delivery_email=test_user.delivery_email,
                        delivery_phone=test_user.phone,
                        delivery_address=test_user.address,
                        delivery_city=test_user.city,
                        delivery_postal_code=test_user.postal_code
                    )
                    db.add(order3)
                    db.flush()

                    order_item3 = OrderItem(
                        order_id=order3.id,
                        product_variant_id=zara_variant_l.id,
                        price=79.99,
                        honest_sign="HS-ZARAFMD-L-003"
                    )
                    db.add(order_item3)

                    payment3 = Payment(
                        id=str(uuid.uuid4()),
                        order_id=order3.id,
                        amount=79.99,
                        currency="RUB",
                        status="completed"
                    )
                    db.add(payment3)
                    print("Created Order 3: Zara Flowy Midi Dress")

                db.commit()
                print("Fake orders created successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error populating data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("Populating initial data (Brands, Styles, Products, Test User, Orders)...")
    populate_initial_data()
    print("Initial data population complete.")
