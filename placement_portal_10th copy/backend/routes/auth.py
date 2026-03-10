from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token
from models import db, User, StudentProfile, CompanyProfile

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register/student', methods=['POST'])
def register_student():
    data = request.get_json()
    required = ['name', 'email', 'password', 'branch', 'cgpa', 'graduation_year']
    for f in required:
        if not data.get(f):
            return jsonify({'error': f'{f} is required'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409

    user = User(
        name=data['name'],
        email=data['email'],
        password=generate_password_hash(data['password']),
        role='student'
    )
    db.session.add(user)
    db.session.flush()

    profile = StudentProfile(
        user_id=user.id,
        branch=data['branch'],
        cgpa=float(data['cgpa']),
        graduation_year=int(data['graduation_year']),
        phone=data.get('phone', '')
    )
    db.session.add(profile)
    db.session.commit()
    return jsonify({'message': 'Student registered successfully'}), 201


@auth_bp.route('/register/company', methods=['POST'])
def register_company():
    data = request.get_json()
    required = ['name', 'email', 'password', 'company_name']
    for f in required:
        if not data.get(f):
            return jsonify({'error': f'{f} is required'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409

    user = User(
        name=data['name'],
        email=data['email'],
        password=generate_password_hash(data['password']),
        role='company'
    )
    db.session.add(user)
    db.session.flush()

    profile = CompanyProfile(
        user_id=user.id,
        company_name=data['company_name'],
        hr_contact=data.get('hr_contact', ''),
        website=data.get('website', ''),
        approval_status='pending'
    )
    db.session.add(profile)
    db.session.commit()
    return jsonify({'message': 'Company registered. Awaiting admin approval.'}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password, password):
        return jsonify({'error': 'Invalid email or password'}), 401

    if not user.is_active:
        return jsonify({'error': 'Your account has been deactivated. Contact admin.'}), 403

    # Extra check for companies: must be approved
    if user.role == 'company':
        cp = CompanyProfile.query.filter_by(user_id=user.id).first()
        if cp and cp.approval_status != 'approved':
            return jsonify({'error': 'Company account not yet approved by admin.'}), 403

    token = create_access_token(identity=str(user.id), additional_claims={'role': user.role})
    return jsonify({
        'access_token': token,
        'role': user.role,
        'name': user.name,
        'user_id': user.id
    }), 200
