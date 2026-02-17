from sqlalchemy.orm import Session
from database import SessionLocal
from models import Brand, Style, Product, ProductStyle, Category, ProductVariant, ProductColorVariant, User, Order, OrderItem, OrderStatus, Payment, UserProfile, UserShippingInfo, UserPreferences, Gender, PrivacyOption, AuthAccount
import uuid
import re
import random
from auth_service import auth_service # NEW

def generate_article_number(brand_name: str, product_name: str) -> str:
    """
    Generate article number for a product (Option 5: Brand + Abbreviation + Random)
    Format: BRAND-ABBREV-RANDOM (e.g., NIKE-AM270-A3B7, ZARA-FMD-X9K2)
    Total length: ~12-18 characters (designed to be easily typeable)
    
    Abbreviation logic:
    1. Remove brand name from product name if present (case-insensitive)
    2. Extract first letter of each significant word (skip stop words)
    3. If abbreviation is too short, take first 3-5 letters from cleaned product name
    4. Cap abbreviation at 5 characters
    """
    # Brand prefix: First 4-6 uppercase letters (remove spaces, special chars)
    brand_clean = re.sub(r'[^A-Z0-9]', '', brand_name.upper())
    brand_prefix = brand_clean[:6]  # Max 6 chars (NIKE, ADIDAS, ZARA, etc.)
    
    # Product abbreviation: Remove brand name from product name if present
    product_clean = product_name
    # Case-insensitive removal of brand name (with word boundaries)
    brand_pattern = r'\b' + re.escape(brand_name) + r'\b'
    product_clean = re.sub(brand_pattern, '', product_clean, flags=re.IGNORECASE).strip()
    
    # If product name still starts with brand after removal, take from second word
    words = product_clean.split()
    if not words:
        # Fallback: use first 4 chars of original product name
        product_clean = re.sub(r'[^A-Z0-9]', '', product_name.upper())[:4]
    else:
        # Abbreviation strategy: Take first letter of first 3-4 significant words
        # Skip common stop words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with'}
        significant_words = [w for w in words[:5] if w.lower() not in stop_words]
        
        if significant_words:
            # Separate words with numbers from words without
            words_with_numbers = []
            words_without_numbers = []
            
            for word in significant_words[:4]:
                if re.search(r'\d', word):
                    words_with_numbers.append(word)
                else:
                    words_without_numbers.append(word)
            
            abbrev_parts = []
            
            # Take first letter of words WITHOUT numbers (up to 3 words)
            for word in words_without_numbers[:3]:
                first_char = re.sub(r'[^A-Z]', '', word.upper())[0:1]
                if first_char:
                    abbrev_parts.append(first_char)
            
            # Extract numbers from words WITH numbers (preserve full number if possible)
            if words_with_numbers:
                for word in words_with_numbers[:2]:  # Check first 2 words with numbers
                    number_match = re.search(r'\d+', word)
                    if number_match:
                        number_str = number_match.group(0)[:3]  # Max 3 digits
                        abbrev_parts.append(number_str)
                        break  # Only use first number found
            
            product_abbrev = ''.join(abbrev_parts)[:5]  # Cap at 5 characters total
            
            # If abbreviation is too short (< 3 chars), supplement with first letters
            if len(product_abbrev) < 3:
                first_chars = re.sub(r'[^A-Z0-9]', '', ' '.join(significant_words[:2]).upper())[:5]
                product_abbrev = (product_abbrev + first_chars)[:5]
        else:
            # Fallback: Take first 4-5 alphanumeric characters from product name
            product_abbrev = re.sub(r'[^A-Z0-9]', '', product_clean.upper())[:5]
    
    # Ensure abbreviation is at least 2 characters
    if len(product_abbrev) < 2:
        product_abbrev = re.sub(r'[^A-Z0-9]', '', product_name.upper())[:5]
        if len(product_abbrev) < 2:
            product_abbrev = "PRD"  # Fallback
    
    # Random suffix: 4 characters (excludes ambiguous chars: 0, O, 1, I, L)
    # Use uppercase letters and numbers only
    random_chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # No 0, O, 1, I, L
    random_suffix = ''.join(random.choices(random_chars, k=4))
    
    # Format: BRAND-ABBREV-RANDOM
    article_number = f"{brand_prefix}-{product_abbrev}-{random_suffix}"
    
    return article_number

# Canonical color name -> hex (match frontend/mobile)
COLOR_HEX = {
    "Black": "#000000",
    "Blue": "#0000FF",
    "Brown": "#964B00",
    "Green": "#008000",
    "Grey": "#808080",
    "Multi-Color": "#808080",
    "Orange": "#FFA500",
    "Pink": "#FFC0CB",
    "Purple": "#800080",
    "Red": "#FF0000",
    "White": "#FFFFFF",
    "Yellow": "#FFFF00",
    "Beige": "#F5F5DC",
    "Navy": "#000080",
}

def generate_order_item_sku(product_name: str, size: str, order_counter: int) -> str:
    """Generate SKU for an OrderItem (specific instance of a product variant in an order)"""
    # Convert to uppercase, replace spaces, remove non-alphanumeric
    sku_base = re.sub(r'[^a-zA-Z0-9]', '', product_name.upper().replace(' ', '').replace('-', ''))
    # Format: PRODUCTNAME-SIZE-ORDERCOUNTER (e.g., NIKEAIRMAX270-M-001)
    return f"{sku_base}-{size}-{order_counter:03d}"

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
                auth_account = AuthAccount(
                    id=str(uuid.uuid4()),
                    email=b_data["email"],
                    password_hash=b_data["password_hash"],
                    is_email_verified=True,
                )
                db.add(auth_account)
                db.flush()
                db.add(Brand(
                    name=b_data["name"],
                    auth_account_id=auth_account.id,
                    slug=b_data["slug"],
                    description=b_data["description"],
                    return_policy=b_data["return_policy"],
                    min_free_shipping=b_data["min_free_shipping"],
                    shipping_price=float(b_data["shipping_price"]) if b_data.get("shipping_price") else None,
                    shipping_provider=b_data["shipping_provider"],
                    amount_withdrawn=b_data["amount_withdrawn"],
                ))
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

        
        tshirts_category = db.query(Category).filter(Category.id == "tshirts").first()
        jeans_category = db.query(Category).filter(Category.id == "jeans").first()
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
                "return_policy": "30-day free returns."
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
            },
            # Additional Nike products (ensuring Nike brand has 16+ products)
            {
                "name": "Nike Dunk Low",
                "description": "Classic basketball-inspired sneakers with retro appeal.",
                "price": 100.00,
                "images": [],
                "sizes": ["XS", "S", "M", "L"],
                "brand": nike_brand,
                "category": sneakers_category,
                "styles": [sporty_style, casual_style, streetwear_style],
                "color": "White",
                "material": "leather",
                "return_policy": "30-day free returns.",
            },
            {
                "name": "Nike Air Force 1",
                "description": "Iconic basketball shoes with clean design.",
                "price": 90.00,
                "images": [],
                "sizes": ["S", "M", "L", "XL"],
                "brand": nike_brand,
                "category": sneakers_category,
                "styles": [sporty_style, casual_style],
                "color": "White",
                "material": "leather",
                "return_policy": "30-day free returns.",
            },
            {
                "name": "Nike React Element 55",
                "description": "Lightweight running shoes with React cushioning.",
                "price": 130.00,
                "images": [],
                "sizes": ["XS", "S", "M"],
                "brand": nike_brand,
                "category": sneakers_category,
                "styles": [sporty_style],
                "color": "Black",
                "material": "synthetic",
                "return_policy": "30-day free returns.",
            },
            {
                "name": "Nike Dri-FIT T-Shirt",
                "description": "Moisture-wicking athletic t-shirt for workouts.",
                "price": 30.00,
                "images": [],
                "sizes": ["XS", "S", "M", "L", "XL"],
                "brand": nike_brand,
                "category": tshirts_category,
                "styles": [sporty_style, casual_style],
                "color": "Black",
                "material": "polyester",
                "return_policy": "30-day free returns.",
            },
            {
                "name": "Nike Essential Hoodie",
                "description": "Comfortable everyday hoodie with classic fit.",
                "price": 65.00,
                "images": [],
                "sizes": ["S", "M", "L", "XL"],
                "brand": nike_brand,
                "category": hoodies_category,
                "styles": [casual_style, streetwear_style],
                "color": "Grey",
                "material": "cotton",
                "return_policy": "30-day free returns.",
            },
            {
                "name": "Nike Waffle One",
                "description": "Heritage-inspired running shoes with modern comfort.",
                "price": 85.00,
                "images": [],
                "sizes": ["S", "M", "L"],
                "brand": nike_brand,
                "category": sneakers_category,
                "styles": [sporty_style, casual_style],
                "color": "White",
                "material": "synthetic",
                "return_policy": "30-day free returns.",
            },
            {
                "name": "Nike Air Max 90",
                "description": "Classic running shoes with visible Air cushioning.",
                "price": 120.00,
                "images": [],
                "sizes": ["XS", "S", "M", "L", "XL"],
                "brand": nike_brand,
                "category": sneakers_category,
                "styles": [sporty_style, casual_style, streetwear_style],
                "color": "Black",
                "material": "leather",
                "return_policy": "30-day free returns.",
            },
            {
                "name": "Nike Pro T-Shirt",
                "description": "Performance t-shirt for intense training sessions.",
                "price": 35.00,
                "images": [],
                "sizes": ["M", "L", "XL"],
                "brand": nike_brand,
                "category": tshirts_category,
                "styles": [sporty_style],
                "color": "White",
                "material": "polyester",
                "return_policy": "30-day free returns.",
            },
            # Additional Adidas products
            {
                "name": "Adidas Samba",
                "description": "Classic indoor soccer shoes with timeless design.",
                "price": 80.00,
                "images": [],
                "sizes": ["XS", "S", "M", "L"],
                "brand": adidas_brand,
                "category": sneakers_category,
                "styles": [sporty_style, casual_style],
                "color": "White",
                "material": "leather",
                "return_policy": "20-day returns, customer pays shipping.",
            },
            {
                "name": "Adidas Stan Smith",
                "description": "Iconic tennis shoes with minimalist style.",
                "price": 75.00,
                "images": [],
                "sizes": ["S", "M", "L", "XL"],
                "brand": adidas_brand,
                "category": sneakers_category,
                "styles": [casual_style, elegant_style],
                "color": "White",
                "material": "leather",
                "return_policy": "20-day returns, customer pays shipping.",
            },
            {
                "name": "Adidas NMD R1",
                "description": "Modern running shoes with Boost cushioning.",
                "price": 130.00,
                "images": [],
                "sizes": ["XS", "S", "M"],
                "brand": adidas_brand,
                "category": sneakers_category,
                "styles": [sporty_style, streetwear_style],
                "color": "Black",
                "material": "synthetic",
                "return_policy": "20-day returns, customer pays shipping.",
            },
            {
                "name": "Adidas Originals T-Shirt",
                "description": "Classic three-stripe t-shirt for everyday wear.",
                "price": 28.00,
                "images": [],
                "sizes": ["XS", "S", "M", "L", "XL"],
                "brand": adidas_brand,
                "category": tshirts_category,
                "styles": [casual_style, sporty_style],
                "color": "White",
                "material": "cotton",
                "return_policy": "20-day returns, customer pays shipping.",
            },
            {
                "name": "Adidas Trefoil Hoodie",
                "description": "Comfortable hoodie with iconic trefoil logo.",
                "price": 70.00,
                "images": [],
                "sizes": ["S", "M", "L", "XL"],
                "brand": adidas_brand,
                "category": hoodies_category,
                "styles": [casual_style, streetwear_style],
                "color": "Grey",
                "material": "cotton",
                "return_policy": "20-day returns, customer pays shipping.",
            },
            {
                "name": "Adidas Gazelle",
                "description": "Retro-inspired training shoes with suede upper.",
                "price": 85.00,
                "images": [],
                "sizes": ["M", "L", "XL"],
                "brand": adidas_brand,
                "category": sneakers_category,
                "styles": [casual_style, streetwear_style],
                "color": "Blue",
                "material": "suede",
                "return_policy": "20-day returns, customer pays shipping.",
            },
            # Additional Zara products (ensuring Zara has multiple products)
            {
                "name": "Zara Basic T-Shirt",
                "description": "Essential cotton t-shirt for everyday wear.",
                "price": 15.99,
                "images": [],
                "sizes": ["XS", "S", "M", "L", "XL"],
                "brand": zara_brand,
                "category": tshirts_category,
                "styles": [casual_style],
                "color": "White",
                "material": "cotton",
                "return_policy": "14-day exchange only.",
            },
            {
                "name": "Zara Midi Dress Floral",
                "description": "Floral print midi dress perfect for summer.",
                "price": 49.99,
                "images": [],
                "sizes": ["XS", "S", "M", "L"],
                "brand": zara_brand,
                "category": dresses_category,
                "styles": [elegant_style, casual_style],
                "color": "Multi-Color",
                "material": "cotton",
                "return_policy": "14-day exchange only.",
            },
            {
                "name": "Zara Maxi Dress",
                "description": "Elegant long dress for special occasions.",
                "price": 59.99,
                "images": [],
                "sizes": ["S", "M", "L", "XL"],
                "brand": zara_brand,
                "category": dresses_category,
                "styles": [elegant_style],
                "color": "Black",
                "material": "polyester",
                "return_policy": "14-day exchange only.",
            },
            {
                "name": "Zara Skinny Jeans",
                "description": "Classic skinny fit jeans in dark wash.",
                "price": 39.99,
                "images": [],
                "sizes": ["XS", "S", "M", "L"],
                "brand": zara_brand,
                "category": jeans_category,
                "styles": [casual_style, elegant_style],
                "color": "Blue",
                "material": "denim",
                "return_policy": "14-day exchange only.",
            },
            {
                "name": "Zara Casual Dress",
                "description": "Comfortable everyday dress with relaxed fit.",
                "price": 35.99,
                "images": [],
                "sizes": ["S", "M", "L", "XL"],
                "brand": zara_brand,
                "category": dresses_category,
                "styles": [casual_style],
                "color": "Beige",
                "material": "cotton",
                "return_policy": "14-day exchange only.",
            },
            {
                "name": "Zara Striped Dress",
                "description": "Chic striped dress with modern silhouette.",
                "price": 44.99,
                "images": [],
                "sizes": ["XS", "S", "M", "L"],
                "brand": zara_brand,
                "category": dresses_category,
                "styles": [casual_style, elegant_style],
                "color": "Navy",
                "material": "cotton",
                "return_policy": "14-day exchange only.",
            },
            {
                "name": "Zara Oversized T-Shirt",
                "description": "Trendy oversized t-shirt for street style.",
                "price": 19.99,
                "images": [],
                "sizes": ["S", "M", "L", "XL"],
                "brand": zara_brand,
                "category": tshirts_category,
                "styles": [casual_style, streetwear_style],
                "color": "Black",
                "material": "cotton",
                "return_policy": "14-day exchange only.",
            },
            {
                "name": "Zara Wrap Dress",
                "description": "Flattering wrap dress for any occasion.",
                "price": 54.99,
                "images": [],
                "sizes": ["S", "M", "L"],
                "brand": zara_brand,
                "category": dresses_category,
                "styles": [elegant_style, casual_style],
                "color": "Red",
                "material": "polyester",
                "return_policy": "14-day exchange only.",
            },
            # Additional H&M products
            {
                "name": "H&M Basic T-Shirt",
                "description": "Affordable essential t-shirt in multiple colors.",
                "price": 9.99,
                "images": [],
                "sizes": ["XS", "S", "M", "L", "XL"],
                "brand": hm_brand,
                "category": tshirts_category,
                "styles": [casual_style],
                "color": "White",
                "material": "cotton",
                "return_policy": "No returns on sale items.",
            },
            {
                "name": "H&M Slim Jeans",
                "description": "Slim fit jeans with stretch for comfort.",
                "price": 24.99,
                "images": [],
                "sizes": ["XS", "S", "M", "L"],
                "brand": hm_brand,
                "category": jeans_category,
                "styles": [casual_style],
                "color": "Blue",
                "material": "denim",
                "return_policy": "No returns on sale items.",
            },
            {
                "name": "H&M Summer Dress",
                "description": "Lightweight summer dress perfect for warm weather.",
                "price": 19.99,
                "images": [],
                "sizes": ["S", "M", "L", "XL"],
                "brand": hm_brand,
                "category": dresses_category,
                "styles": [casual_style],
                "color": "Yellow",
                "material": "cotton",
                "return_policy": "No returns on sale items.",
            },
            {
                "name": "H&M Cotton Hoodie",
                "description": "Soft cotton hoodie for casual days.",
                "price": 29.99,
                "images": [],
                "sizes": ["XS", "S", "M", "L", "XL"],
                "brand": hm_brand,
                "category": hoodies_category,
                "styles": [casual_style, streetwear_style],
                "color": "Navy",
                "material": "cotton",
                "return_policy": "No returns on sale items.",
            },
            {
                "name": "H&M Denim Jacket",
                "description": "Classic denim jacket for layering.",
                "price": 34.99,
                "images": [],
                "sizes": ["S", "M", "L"],
                "brand": hm_brand,
                "category": hoodies_category,
                "styles": [casual_style, streetwear_style],
                "color": "Blue",
                "material": "denim",
                "return_policy": "No returns on sale items.",
            },
            {
                "name": "H&M Printed T-Shirt",
                "description": "Graphic print t-shirt with modern design.",
                "price": 12.99,
                "images": [],
                "sizes": ["M", "L", "XL"],
                "brand": hm_brand,
                "category": tshirts_category,
                "styles": [casual_style, streetwear_style],
                "color": "Black",
                "material": "cotton",
                "return_policy": "No returns on sale items.",
            },
            {
                "name": "H&M A-Line Dress",
                "description": "Flattering A-line dress with elegant cut.",
                "price": 24.99,
                "images": [],
                "sizes": ["XS", "S", "M", "L"],
                "brand": hm_brand,
                "category": dresses_category,
                "styles": [casual_style, elegant_style],
                "color": "Green",
                "material": "polyester",
                "return_policy": "No returns on sale items.",
            },
            # More Nike products to ensure we have 16+ for Nike filter
            {
                "name": "Nike Court Vintage",
                "description": "Tennis-inspired shoes with retro styling.",
                "price": 75.00,
                "images": [],
                "sizes": ["XS", "S", "M", "L"],
                "brand": nike_brand,
                "category": sneakers_category,
                "styles": [sporty_style, casual_style],
                "color": "White",
                "material": "leather",
                "return_policy": "30-day free returns.",
            },
            {
                "name": "Nike Blazer Mid",
                "description": "Classic basketball-inspired high-top sneakers.",
                "price": 95.00,
                "images": [],
                "sizes": ["S", "M", "L", "XL"],
                "brand": nike_brand,
                "category": sneakers_category,
                "styles": [sporty_style, streetwear_style],
                "color": "Black",
                "material": "leather",
                "return_policy": "30-day free returns.",
            },
            {
                "name": "Nike Sportswear Hoodie",
                "description": "Classic pullover hoodie with Nike branding.",
                "price": 75.00,
                "images": [],
                "sizes": ["XS", "S", "M", "L", "XL"],
                "brand": nike_brand,
                "category": hoodies_category,
                "styles": [sporty_style, casual_style],
                "color": "Navy",
                "material": "cotton",
                "return_policy": "30-day free returns.",
            },
            {
                "name": "Nike Classic Cortez",
                "description": "Iconic running shoes with heritage design.",
                "price": 70.00,
                "images": [],
                "sizes": ["M", "L", "XL"],
                "brand": nike_brand,
                "category": sneakers_category,
                "styles": [sporty_style, casual_style],
                "color": "Red",
                "material": "leather",
                "return_policy": "30-day free returns.",
            }
        ]

        for p_data in products_data:
            existing_product = db.query(Product).filter(Product.name == p_data["name"]).first()
            if not existing_product:
                # Create new product with article number
                # Generate unique article number for the product (handle collisions)
                article_number = None
                max_attempts = 10
                for attempt in range(max_attempts):
                    candidate_article = generate_article_number(p_data["brand"].name, p_data["name"])
                    existing = db.query(Product).filter(Product.article_number == candidate_article).first()
                    if not existing:
                        article_number = candidate_article
                        break
                    # On collision, regenerate with new random suffix
                    if attempt < max_attempts - 1:
                        # Just regenerate - the function has random component
                        pass  # Will regenerate on next iteration
                
                if not article_number:
                    # Fallback: use UUID-based (extremely unlikely with 10 attempts)
                    product_id_preview = str(uuid.uuid4())[:8].upper()
                    random_chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
                    brand_prefix = re.sub(r'[^A-Z0-9]', '', p_data["brand"].name.upper())[:6]
                    article_number = f"{brand_prefix}-{product_id_preview[:4]}-{''.join(random.choices(random_chars, k=4))}"
                
                product = Product(
                    id=str(uuid.uuid4()),
                    name=p_data["name"],
                    description=p_data["description"],
                    price=p_data["price"],
                    brand_id=p_data["brand"].id,
                    category_id=p_data["category"].id,
                    material=p_data["material"],
                    article_number=article_number,
                )
                db.add(product)
                db.flush()

                color_name = p_data.get("color", "Black")
                color_hex = COLOR_HEX.get(color_name, "#808080")
                color_variant = ProductColorVariant(
                    product_id=product.id,
                    color_name=color_name,
                    color_hex=color_hex,
                    images=p_data.get("images") or [],
                    display_order=0,
                )
                db.add(color_variant)
                db.flush()

                for size in p_data["sizes"]:
                    pv = ProductVariant(
                        product_color_variant_id=color_variant.id,
                        size=size,
                        stock_quantity=10,
                    )
                    db.add(pv)

                for style in p_data["styles"]:
                    product_style = ProductStyle(product_id=product.id, style_id=style.id)
                    db.add(product_style)
                print(f"Added product: {product.name} (Article: {product.article_number})")
            else:
                # Update existing product with article_number if it doesn't have one
                if not existing_product.article_number:
                    article_number = None
                    max_attempts = 10
                    for attempt in range(max_attempts):
                        candidate_article = generate_article_number(p_data["brand"].name, p_data["name"])
                        existing = db.query(Product).filter(Product.article_number == candidate_article).first()
                        if not existing:
                            article_number = candidate_article
                            break
                    
                    if article_number:
                        existing_product.article_number = article_number
                        print(f"Generated article number for existing product: {existing_product.name} -> {article_number}")
                    else:
                        # Fallback
                        product_id_preview = str(uuid.uuid4())[:8].upper()
                        random_chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
                        brand_prefix = re.sub(r'[^A-Z0-9]', '', p_data["brand"].name.upper())[:6]
                        existing_product.article_number = f"{brand_prefix}-{product_id_preview[:4]}-{''.join(random.choices(random_chars, k=4))}"
                        print(f"Generated fallback article number for existing product: {existing_product.name} -> {existing_product.article_number}")
                else:
                    print(f"Product already exists: {p_data['name']} (Article: {existing_product.article_number})")
        
        db.commit()
        print("Products populated.")
        
        # Create test user account with domain-specific data
        test_user_password_hash = auth_service.hash_password("123abc")
        test_user_data = {
            "username": "test",
            "email": "test@example.com",
            "password_hash": test_user_password_hash,
            "is_email_verified": True
        }
        
        test_user = db.query(User).filter(User.username == "test").first()
        if not test_user:
            test_user = User(**test_user_data)
            db.add(test_user)
            db.flush()  # Flush to get user.id
            
            # Create profile
            test_profile = UserProfile(
                user_id=test_user.id,
                full_name="Test User",
                gender=Gender.MALE,
                selected_size="M",
                avatar_url=None
            )
            db.add(test_profile)
            
            # Create shipping info
            test_shipping = UserShippingInfo(
                user_id=test_user.id,
                delivery_email="test@example.com",
                phone="+1234567890",
                street="123 Test Street",
                house_number="1",
                apartment_number=None,
                city="Test City",
                postal_code="12345"
            )
            db.add(test_shipping)
            
            # Create preferences
            test_preferences = UserPreferences(
                user_id=test_user.id,
                size_privacy=PrivacyOption.FRIENDS,
                recommendations_privacy=PrivacyOption.FRIENDS,
                likes_privacy=PrivacyOption.FRIENDS,
                order_notifications=True,
                marketing_notifications=True
            )
            db.add(test_preferences)
            
            db.commit()
            print("Test user created with domain-specific data.")
        else:
            print("Test user already exists.")

        # Create fake orders
        if test_user:
            # Get some products and their variants for orders
            nike_product = db.query(Product).filter(Product.name == "Nike Air Max 270").first()
            adidas_product = db.query(Product).filter(Product.name == "Adidas Ultraboost 22").first()
            zara_product = db.query(Product).filter(Product.name == "Zara Flowy Midi Dress").first()
            
            if nike_product and adidas_product and zara_product:
                # Get product variants via color variant
                def get_variant_for_product(product, size):
                    cv = db.query(ProductColorVariant).filter(
                        ProductColorVariant.product_id == product.id
                    ).first()
                    if not cv:
                        return None
                    return db.query(ProductVariant).filter(
                        ProductVariant.product_color_variant_id == cv.id,
                        ProductVariant.size == size,
                    ).first()

                nike_variant_m = get_variant_for_product(nike_product, "M")
                adidas_variant_s = get_variant_for_product(adidas_product, "S")
                zara_variant_l = get_variant_for_product(zara_product, "L")

                # Get user profile and shipping info for orders
                test_profile = db.query(UserProfile).filter(UserProfile.user_id == test_user.id).first()
                test_shipping = db.query(UserShippingInfo).filter(UserShippingInfo.user_id == test_user.id).first()
                
                # Build delivery address string from shipping info
                delivery_address_parts = []
                if test_shipping and test_shipping.street:
                    delivery_address_parts.append(test_shipping.street)
                if test_shipping and test_shipping.house_number:
                    delivery_address_parts.append(f"д. {test_shipping.house_number}")
                if test_shipping and test_shipping.apartment_number:
                    delivery_address_parts.append(f"кв. {test_shipping.apartment_number}")
                delivery_address = ", ".join(delivery_address_parts) if delivery_address_parts else None
                
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
                        delivery_full_name=test_profile.full_name if test_profile else None,
                        delivery_email=test_shipping.delivery_email if test_shipping else None,
                        delivery_phone=test_shipping.phone if test_shipping else None,
                        delivery_address=delivery_address,
                        delivery_city=test_shipping.city if test_shipping else None,
                        delivery_postal_code=test_shipping.postal_code if test_shipping else None
                    )
                    db.add(order1)
                    db.flush()

                    order_item1 = OrderItem(
                        order_id=order1.id,
                        product_variant_id=nike_variant_m.id,
                        quantity=1,
                        price=150.00,
                        sku=generate_order_item_sku("Nike Air Max 270", "M", 1)
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
                        delivery_full_name=test_profile.full_name if test_profile else None,
                        delivery_email=test_shipping.delivery_email if test_shipping else None,
                        delivery_phone=test_shipping.phone if test_shipping else None,
                        delivery_address=delivery_address,
                        delivery_city=test_shipping.city if test_shipping else None,
                        delivery_postal_code=test_shipping.postal_code if test_shipping else None
                    )
                    db.add(order2)
                    db.flush()

                    order_item2 = OrderItem(
                        order_id=order2.id,
                        product_variant_id=adidas_variant_s.id,
                        quantity=1,
                        price=180.00,
                        sku=generate_order_item_sku("Adidas Ultraboost 22", "S", 2)
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
                        delivery_full_name=test_profile.full_name if test_profile else None,
                        delivery_email=test_shipping.delivery_email if test_shipping else None,
                        delivery_phone=test_shipping.phone if test_shipping else None,
                        delivery_address=delivery_address,
                        delivery_city=test_shipping.city if test_shipping else None,
                        delivery_postal_code=test_shipping.postal_code if test_shipping else None
                    )
                    db.add(order3)
                    db.flush()

                    order_item3 = OrderItem(
                        order_id=order3.id,
                        product_variant_id=zara_variant_l.id,
                        quantity=1,
                        price=79.99,
                        sku=generate_order_item_sku("Zara Flowy Midi Dress", "L", 3)
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
                
                # Add more PAID orders for various products to populate purchase_count for popular items
                # Query additional products for orders (after initial orders are committed)
                additional_orders_data = [
                    {"product_name": "Nike Dunk Low", "size": "M", "price": 100.00, "order_num": "ORD-004"},
                    {"product_name": "Nike Air Force 1", "size": "L", "price": 90.00, "order_num": "ORD-005"},
                    {"product_name": "Nike React Element 55", "size": "S", "price": 130.00, "order_num": "ORD-006"},
                    {"product_name": "Nike Air Max 90", "size": "M", "price": 120.00, "order_num": "ORD-007"},
                    {"product_name": "Nike Sportswear Tech Fleece", "size": "M", "price": 110.00, "order_num": "ORD-008"},
                    {"product_name": "Adidas Samba", "size": "L", "price": 80.00, "order_num": "ORD-009"},
                    {"product_name": "Adidas Stan Smith", "size": "M", "price": 75.00, "order_num": "ORD-010"},
                    {"product_name": "Adidas NMD R1", "size": "S", "price": 130.00, "order_num": "ORD-011"},
                    {"product_name": "Zara Basic T-Shirt", "size": "L", "price": 15.99, "order_num": "ORD-012"},
                    {"product_name": "Zara Midi Dress Floral", "size": "M", "price": 49.99, "order_num": "ORD-013"},
                    {"product_name": "H&M Cotton Hoodie", "size": "L", "price": 29.99, "order_num": "ORD-014"},
                    # More orders for popular items variety (duplicate purchases to increase purchase_count)
                    {"product_name": "Nike Dunk Low", "size": "S", "price": 100.00, "order_num": "ORD-015"},  # Second purchase
                    {"product_name": "Nike Air Force 1", "size": "M", "price": 90.00, "order_num": "ORD-016"},  # Second purchase
                    {"product_name": "Nike Air Max 270", "size": "L", "price": 150.00, "order_num": "ORD-017"},  # Second purchase
                    {"product_name": "Zara Flowy Midi Dress", "size": "M", "price": 79.99, "order_num": "ORD-018"},  # Second purchase
                ]
                
                order_num_counter = 4
                for order_data in additional_orders_data:
                    product = db.query(Product).filter(Product.name == order_data["product_name"]).first()
                    if product:
                        variant = get_variant_for_product(product, order_data["size"])
                        
                        if variant:
                            # Check if order with this order_number already exists to avoid duplicates on re-run
                            existing_order = db.query(Order).filter(Order.order_number == order_data["order_num"]).first()
                            if not existing_order:
                                order = Order(
                                    order_number=order_data["order_num"],
                                    user_id=test_user.id,
                                    total_amount=order_data["price"],
                                    status=OrderStatus.PAID,
                                    tracking_number=f"TN{order_num_counter:09d}",
                                    tracking_link=f"https://track.example.com/TN{order_num_counter:09d}",
                                    delivery_full_name=test_profile.full_name if test_profile else None,
                                    delivery_email=test_shipping.delivery_email if test_shipping else None,
                                    delivery_phone=test_shipping.phone if test_shipping else None,
                                    delivery_address=delivery_address,
                                    delivery_city=test_shipping.city if test_shipping else None,
                                    delivery_postal_code=test_shipping.postal_code if test_shipping else None
                                )
                                db.add(order)
                                db.flush()
                                
                                order_item = OrderItem(
                                    order_id=order.id,
                                    product_variant_id=variant.id,
                                    quantity=1,
                                    price=order_data["price"],
                                    sku=generate_order_item_sku(product.name, order_data["size"], order_num_counter)
                                )
                                db.add(order_item)
                                
                                payment = Payment(
                                    id=str(uuid.uuid4()),
                                    order_id=order.id,
                                    amount=order_data["price"],
                                    currency="RUB",
                                    status="completed"
                                )
                                db.add(payment)
                                print(f"Created Order {order_data['order_num']}: {product.name}")
                            else:
                                print(f"Order {order_data['order_num']} already exists, skipping")
                    
                    order_num_counter += 1

                db.commit()
                print("Additional orders created successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error populating data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("Populating initial data (Brands, Styles, Products, Test User, Orders)...")
    populate_initial_data()
    print("Initial data population complete.")
