"""
SQLAlchemy — Blog / CMS
Incolla questo file nel tab "SQLAlchemy" dell'import da ORM.
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id           = Column(Integer, primary_key=True)
    username     = Column(String, nullable=False, unique=True)
    email        = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    display_name = Column(String)
    bio          = Column(Text)
    avatar_url   = Column(String)
    role         = Column(String, nullable=False, default="author")
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime)


class Tag(Base):
    __tablename__ = "tags"

    id   = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    slug = Column(String, nullable=False, unique=True)


class Post(Base):
    __tablename__ = "posts"

    id           = Column(Integer, primary_key=True)
    author_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    title        = Column(String, nullable=False)
    slug         = Column(String, nullable=False, unique=True)
    excerpt      = Column(Text)
    body         = Column(Text, nullable=False)
    status       = Column(String, nullable=False, default="draft")
    published_at = Column(DateTime)
    created_at   = Column(DateTime)
    updated_at   = Column(DateTime)


class PostTag(Base):
    __tablename__ = "post_tags"

    id      = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    tag_id  = Column(Integer, ForeignKey("tags.id"), nullable=False)


class Comment(Base):
    __tablename__ = "comments"

    id         = Column(Integer, primary_key=True)
    post_id    = Column(Integer, ForeignKey("posts.id"), nullable=False)
    author_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    parent_id  = Column(Integer, ForeignKey("comments.id"))
    body       = Column(Text, nullable=False)
    is_approved = Column(Boolean, default=False)
    created_at = Column(DateTime)


class Media(Base):
    __tablename__ = "media"

    id          = Column(Integer, primary_key=True)
    uploader_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id     = Column(Integer, ForeignKey("posts.id"))
    filename    = Column(String, nullable=False)
    mime_type   = Column(String, nullable=False)
    size_bytes  = Column(Integer)
    url         = Column(String, nullable=False)
    uploaded_at = Column(DateTime)
