import os
import time
import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Read DATABASE_URL from environment variable
# Falls back to a local default for development
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@db:5432/studentdb"
)
# Render provides postgres:// which SQLAlchemy 2.0 requires as postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Retry logic: wait for PostgreSQL to be ready before connecting
def create_engine_with_retry(url: str, retries: int = 10, delay: int = 3):
    """Try to create a database engine, retrying on failure."""
    for attempt in range(1, retries + 1):
        try:
            engine = create_engine(url, pool_pre_ping=True)
            # Test the connection
            with engine.connect() as conn:
                logger.info("✅ Successfully connected to the database!")
            return engine
        except OperationalError as e:
            if attempt < retries:
                logger.warning(
                    f"⚠️  Database not ready (attempt {attempt}/{retries}). "
                    f"Retrying in {delay}s... Error: {e}"
                )
                time.sleep(delay)
            else:
                logger.error("❌ Could not connect to database after multiple retries.")
                raise

# Create the SQLAlchemy engine
engine = create_engine_with_retry(DATABASE_URL)

# Create a session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for ORM models
Base = declarative_base()


def get_db():
    """Dependency that provides a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
