import os

# Base directory
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, '..', 'uploads')

# SQLite database
SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'placement_portal.db')}"
SQLALCHEMY_TRACK_MODIFICATIONS = False

# JWT
JWT_SECRET_KEY = 'placement_portal_super_secret_key_2024'
JWT_ACCESS_TOKEN_EXPIRES = 86400  # 24 hours in seconds

# Redis
REDIS_URL = 'redis://localhost:6379/0'
CACHE_EXPIRY = 300  # 5 minutes in seconds

# Celery
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'

# File Upload
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx'}

# Admin credentials (seeded at startup)
ADMIN_EMAIL = 'admin@institute.edu'
ADMIN_PASSWORD = 'admin123'
ADMIN_NAME = 'Admin'
