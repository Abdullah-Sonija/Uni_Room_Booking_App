"""
auth.py  —  /api/auth/register  and  /api/auth/login
"""
import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from extensions import db, bcrypt
from models import User

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
VALID_ROLES = {'student', 'faculty'}


def _validate_register(data):
    errors = []
    name = (data.get('full_name') or '').strip()
    if not name or len(name) < 2 or len(name) > 100:
        errors.append('full_name must be 2–100 characters.')
    email = (data.get('email') or '').strip().lower()
    if not email or not EMAIL_RE.match(email):
        errors.append('A valid email address is required.')
    password = data.get('password') or ''
    if len(password) < 8:
        errors.append('Password must be at least 8 characters.')
    if not re.search(r'[A-Za-z]', password) or not re.search(r'\d', password):
        errors.append('Password must contain at least one letter and one digit.')
    role = (data.get('role') or '').strip().lower()
    if role not in VALID_ROLES:
        # If someone tries to register as admin, we reject it
        if role == 'admin':
            errors.append('Admin accounts cannot be created via public registration.')
        else:
            errors.append(f'Role must be one of: {", ".join(VALID_ROLES)}.')
    return errors, name, email, password, role


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    errors, name, email, password, role = _validate_register(data)
    if errors:
        return jsonify({'error': ' | '.join(errors)}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'An account with this email already exists.'}), 409

    hashed = bcrypt.generate_password_hash(password).decode('utf-8')
    user = User(full_name=name, email=email, password_hash=hashed, role=role)
    db.session.add(user)
    db.session.commit()

    return jsonify({'message': 'Registration successful.', 'user_id': user.user_id}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data  = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    pw    = data.get('password') or ''

    if not email or not pw:
        return jsonify({'error': 'Email and password are required.'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, pw):
        return jsonify({'error': 'Invalid email or password.'}), 401

    token = create_access_token(
        identity=str(user.user_id),
        additional_claims={'role': user.role, 'name': user.full_name}
    )
    return jsonify({
        'token':     token,
        'role':      user.role,
        'user_id':   user.user_id,
        'full_name': user.full_name
    }), 200
