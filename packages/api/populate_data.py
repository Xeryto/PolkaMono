from sqlalchemy.orm import Session
from database import SessionLocal
from models import Brand, Style, Product, ProductStyle, Category, ProductVariant
import uuid
from auth_service import auth_service # NEW

def populate_initial_data():
    
    db: Session = SessionLocal()
    try:
        # Populate Brands
        # Hash a default password for all brands
        default_password_hash = auth_service.hash_password("brandpassword123")

        brands_data = [
            {"name": "Nike", "email": "nike@example.com", "password_hash": default_password_hash, "slug": "nike", "logo": "https://example.com/logos/nike.png", "description": "Global leader in athletic footwear, apparel, equipment, accessories, and services.", "return_policy": "30-day free returns.", "min_free_shipping": 100, "shipping_price": "5.00", "shipping_provider": "FedEx"},
            {"name": "Adidas", "email": "adidas@example.com", "password_hash": default_password_hash, "slug": "adidas", "logo": "https://example.com/logos/adidas.png", "description": "German multinational corporation, designs and manufactures shoes, clothing and accessories.", "return_policy": "20-day returns, customer pays shipping.", "min_free_shipping": 150, "shipping_price": "7.50", "shipping_provider": "UPS"},
            {"name": "Zara", "email": "zara@example.com", "password_hash": default_password_hash, "slug": "zara", "logo": "https://example.com/logos/zara.png", "description": "Spanish apparel retailer based in Arteixo, Galicia, Spain.", "return_policy": "14-day exchange only.", "min_free_shipping": 50, "shipping_price": "3.00", "shipping_provider": "DHL"},
            {"name": "H&M", "email": "hm@example.com", "password_hash": default_password_hash, "slug": "h&m", "logo": "https://example.com/logos/h&m.png", "description": "Swedish multinational clothing-retail company known for its fast-fashion clothing for men, women, teenagers and children.", "return_policy": "No returns on sale items.", "min_free_shipping": 75, "shipping_price": "4.50", "shipping_provider": "USPS"}
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
                "price": "150.00 р",
                "images": ["https://example.com/products/nike_airmax_1.jpg", "https://example.com/products/nike_airmax_2.jpg"],
                "sizes": ["S", "M", "L"],
                "brand": nike_brand,
                "category": sneakers_category,
                "styles": [sporty_style, casual_style],
                "color": "White",
                "material": "Mesh",
                "return_policy": "30-day free returns.",
                "sku": "NIKEAM270",
                "honest_sign": "HS-NIKEAM270"
            },
            {
                "name": "Adidas Ultraboost 22",
                "description": "Responsive running shoes for daily miles.",
                "price": "180.00 р",
                "images": ["https://example.com/products/adidas_ultraboost_1.jpg", "https://example.com/products/adidas_ultraboost_2.jpg"],
                "sizes": ["XS", "S", "M"],
                "brand": adidas_brand,
                "category": sneakers_category,
                "styles": [sporty_style],
                "color": "Black",
                "material": "Primeknit",
                "return_policy": "20-day returns, customer pays shipping.",
                "sku": "ADIDASUB22",
                "honest_sign": "HS-ADIDASUB22"
            },
            {
                "name": "Zara Flowy Midi Dress",
                "description": "Lightweight and elegant dress for any occasion.",
                "price": "79.99 р",
                "images": ["https://example.com/products/zara_dress_1.jpg", "https://example.com/products/zara_dress_2.jpg"],
                "sizes": ["M", "L", "XL"],
                "brand": zara_brand,
                "category": dresses_category,
                "styles": [elegant_style, casual_style],
                "color": "Floral Print",
                "material": "Viscose",
                "return_policy": "14-day exchange only.",
                "sku": "ZARAFMD",
                "honest_sign": "HS-ZARAFMD"
            },
            {
                "name": "H&M Oversized Hoodie",
                "description": "Cozy and trendy oversized hoodie.",
                "price": "35.00 р",
                "images": ["https://example.com/products/hm_hoodie_1.jpg", "https://example.com/products/hm_hoodie_2.jpg"],
                "sizes": ["XS", "S"],
                "brand": hm_brand,
                "category": hoodies_category,
                "styles": [casual_style, streetwear_style],
                "color": "Grey Melange",
                "material": "Cotton Blend",
                "return_policy": "No returns on sale items.",
                "sku": "HMOH",
                "honest_sign": "HS-HMOH"
            },
            {
                "name": "Nike Sportswear Tech Fleece",
                "description": "Premium fleece for warmth without the weight.",
                "price": "110.00 р",
                "images": ["https://example.com/products/nike_techfleece_1.jpg", "https://example.com/products/nike_techfleece_2.jpg"],
                "sizes": ["S", "M", "L", "XL"],
                "brand": nike_brand,
                "category": hoodies_category,
                "styles": [sporty_style, casual_style, streetwear_style],
                "color": "Black",
                "material": "Tech Fleece",
                "return_policy": "30-day free returns.",
                "sku": "NIKESWTF",
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
                    sku=p_data["sku"], # NEW
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
    except Exception as e:
        db.rollback()
        print(f"Error populating data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("Populating initial data (Brands, Styles, Products)...")
    populate_initial_data()
    print("Initial data population complete.")
