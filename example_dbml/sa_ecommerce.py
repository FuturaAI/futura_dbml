"""
SQLAlchemy — E-commerce
Incolla questo file nel tab "SQLAlchemy" dell'import da ORM.
"""
from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True)
    email         = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    first_name    = Column(String)
    last_name     = Column(String)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime)


class Address(Base):
    __tablename__ = "addresses"

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    street      = Column(String, nullable=False)
    city        = Column(String, nullable=False)
    country     = Column(String, nullable=False)
    postal_code = Column(String)
    is_default  = Column(Boolean, default=False)


class Category(Base):
    __tablename__ = "categories"

    id        = Column(Integer, primary_key=True)
    parent_id = Column(Integer, ForeignKey("categories.id"))
    name      = Column(String, nullable=False)
    slug      = Column(String, nullable=False, unique=True)


class Product(Base):
    __tablename__ = "products"

    id          = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    name        = Column(String, nullable=False)
    slug        = Column(String, nullable=False, unique=True)
    description = Column(Text)
    price       = Column(Numeric, nullable=False)
    stock_qty   = Column(Integer, default=0)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime)


class Order(Base):
    __tablename__ = "orders"

    id              = Column(Integer, primary_key=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False)
    address_id      = Column(Integer, ForeignKey("addresses.id"))
    status          = Column(String, nullable=False, default="pending")
    total_amount    = Column(Numeric, nullable=False)
    payment_method  = Column(String)
    placed_at       = Column(DateTime)
    shipped_at      = Column(DateTime)


class OrderItem(Base):
    __tablename__ = "order_items"

    id         = Column(Integer, primary_key=True)
    order_id   = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity   = Column(Integer, nullable=False)
    unit_price = Column(Numeric, nullable=False)


class Review(Base):
    __tablename__ = "reviews"

    id         = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating     = Column(Integer, nullable=False)
    title      = Column(String)
    body       = Column(Text)
    created_at = Column(DateTime)
