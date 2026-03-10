import os
import sys
import json
from datetime import timedelta

from flask import Flask, send_from_directory, Response
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from werkzeug.security import generate_password_hash

# Add parent directory to path if needed
sys.path.insert(0, os.path.dirname(__file__))

import config
from models import db, User

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

def create_app():
    app = Flask(
        __name__,
        static_folder=os.path.join(os.path.dirname(__file__), '..', 'frontend'),
        static_url_path='/static'
    )

    # Config
    app.config['SQLALCHEMY_DATABASE_URI'] = config.SQLALCHEMY_DATABASE_URI
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = config.SQLALCHEMY_TRACK_MODIFICATIONS
    app.config['JWT_SECRET_KEY'] = config.JWT_SECRET_KEY
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(seconds=config.JWT_ACCESS_TOKEN_EXPIRES)
    app.config['MAX_CONTENT_LENGTH'] = config.MAX_CONTENT_LENGTH
    app.config['UPLOAD_FOLDER'] = config.UPLOAD_FOLDER

    # Extensions
    db.init_app(app)
    JWTManager(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Register blueprints
    from routes.auth import auth_bp
    from routes.admin import admin_bp
    from routes.company import company_bp
    from routes.student import student_bp

    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api')
    app.register_blueprint(company_bp, url_prefix='/api')
    app.register_blueprint(student_bp, url_prefix='/api')

    # Create upload folder
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Initialize DB + seed admin
    with app.app_context():
        db.create_all()
        _seed_admin()

    # Serve the SPA — Flask uses Jinja2 only as the entry template.
    # All UI rendering is handled by Vue.js.
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def catch_all(path):
        frontend_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), '..', 'frontend')
        )
        # Serve JS / CSS / image assets directly
        target = os.path.join(frontend_dir, path)
        if path and os.path.exists(target) and os.path.isfile(target):
            return send_from_directory(frontend_dir, path)
        # Serve the SPA entry point (index.html acts as Jinja2 template entry)
        return send_from_directory(frontend_dir, 'index.html')

    return app


def _seed_admin():
    """
    During database initialization (db.create_all), a default admin user
    (admin@institute.edu / admin123) is automatically created if it does not exist.
    Admin registration is not allowed.
    """
    admin = User.query.filter_by(email=config.ADMIN_EMAIL).first()
    if not admin:
        admin = User(
            name=config.ADMIN_NAME,
            email=config.ADMIN_EMAIL,
            password=generate_password_hash(config.ADMIN_PASSWORD),
            role='admin',
            is_active=True
        )
        db.session.add(admin)
        db.session.commit()
        print(f"[Seed] Admin user created: {config.ADMIN_EMAIL} / {config.ADMIN_PASSWORD}")
    else:
        print(f"[Seed] Admin user already exists: {config.ADMIN_EMAIL}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5001, host='0.0.0.0')
