"""
app.py  —  University Room Booking System (URBS)
           Flask application entry point

Run:
    python app.py

The app starts on http://localhost:5000
Default admin seed account:
    email:    admin@urbs.edu
    password: Admin1234
"""
import os
from datetime import timedelta
from flask import Flask, jsonify
from extensions import db, jwt, bcrypt, cors


def create_app():
    app = Flask(__name__)

    # ── Configuration ─────────────────────────────────────────────────────────
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL', 'sqlite:///urbs.db'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = os.environ.get(
        'JWT_SECRET_KEY', 'urbs-super-secret-key-change-in-production'
    )
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

    # ── Extensions ────────────────────────────────────────────────────────────
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})

    # ── Blueprints ────────────────────────────────────────────────────────────
    from auth     import auth_bp
    from rooms    import rooms_bp
    from bookings import bookings_bp
    from admin    import admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(rooms_bp)
    app.register_blueprint(bookings_bp)
    app.register_blueprint(admin_bp)

    # ── JWT error handlers ────────────────────────────────────────────────────
    @jwt.unauthorized_loader
    def missing_token(reason):
        return jsonify({'error': 'Authentication required. Please log in.'}), 401

    @jwt.expired_token_loader
    def expired_token(jwt_header, jwt_payload):
        return jsonify({'error': 'Session expired. Please log in again.'}), 401

    @jwt.invalid_token_loader
    def invalid_token(reason):
        return jsonify({'error': 'Invalid token.'}), 401

    # ── Create tables + seed admin ────────────────────────────────────────────
    with app.app_context():
        db.create_all()
        _seed_admin(app)
        _seed_sample_rooms(app)

    # Pre-warm sheet cache for all 5 weekdays in background
    from sheets_sync import prefetch_all_days
    prefetch_all_days()
    print("⏳  Prefetching timetable for all weekdays in background...")

    return app


def _seed_admin(app):
    """Create a default admin account if none exists."""
    from models import User
    from extensions import bcrypt as _bcrypt
    if not User.query.filter_by(role='admin').first():
        hashed = _bcrypt.generate_password_hash('Admin1234').decode('utf-8')
        admin  = User(
            full_name     = 'System Administrator',
            email         = 'admin@urbs.edu',
            password_hash = hashed,
            role          = 'admin',
        )
        db.session.add(admin)
        db.session.commit()
        print("✅  Default admin created  →  admin@urbs.edu  /  Admin1234")


def _seed_sample_rooms(app):
    """Seed rooms from the live Google Sheet timetable on first boot."""
    from models import Room
    from sheets_sync import get_all_sheet_rooms
    if Room.query.count() != 0:
        return
    print("⏳  Fetching room list from Google Sheet...")
    sheet_rooms = get_all_sheet_rooms()
    if sheet_rooms:
        objects = [
            Room(
                room_number=r['room_number'],
                room_type=r['room_type'],
                capacity=r['capacity'],
                location=r['location'],
            )
            for r in sheet_rooms
        ]
        db.session.bulk_save_objects(objects)
        db.session.commit()
        print(f"✅  {len(objects)} rooms seeded from Google Sheet.")

        pass
    else:
        # Fallback: a minimal set so the app still works offline
        fallback = [
            Room(room_number='Classroom (fallback)', room_type='classroom', capacity=30, location=''),
        ]
        db.session.bulk_save_objects(fallback)
        db.session.commit()
        print("⚠️   Sheet unavailable — 1 fallback room seeded.")


# ── Health-check endpoint ──────────────────────────────────────────────────────
def register_misc(app):
    @app.route('/api/health', methods=['GET'])
    def health():
        return jsonify({'status': 'ok', 'service': 'URBS API'}), 200


if __name__ == '__main__':
    application = create_app()
    register_misc(application)
    application.run(debug=True, port=5000)
