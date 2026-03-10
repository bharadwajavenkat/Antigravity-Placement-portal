import json
from datetime import datetime
from functools import wraps

import redis
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity

from models import db, User, CompanyProfile, PlacementDrive, Application, StudentProfile
import config

company_bp = Blueprint('company', __name__)

try:
    _redis = redis.from_url(config.REDIS_URL, decode_responses=True)
    _redis.ping()
    REDIS_OK = True
except Exception:
    _redis = None
    REDIS_OK = False


def _cache_get(key):
    if REDIS_OK:
        val = _redis.get(key)
        if val:
            return json.loads(val)
    return None


def _cache_set(key, data, ex=300):
    if REDIS_OK:
        _redis.set(key, json.dumps(data), ex=ex)


def _cache_delete(key):
    if REDIS_OK:
        _redis.delete(key)


def company_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get('role') != 'company':
            return jsonify({'error': 'Company access required'}), 403
        return fn(*args, **kwargs)
    return wrapper


def _get_company_profile():
    user_id = int(get_jwt_identity())
    return CompanyProfile.query.filter_by(user_id=user_id).first()


@company_bp.route('/company/create_drive', methods=['POST'])
@company_required
def create_drive():
    cp = _get_company_profile()
    if not cp or cp.approval_status != 'approved':
        return jsonify({'error': 'Company not approved to create drives'}), 403

    data = request.get_json()
    required = ['job_title', 'application_deadline']
    for f in required:
        if not data.get(f):
            return jsonify({'error': f'{f} is required'}), 400

    try:
        deadline = datetime.strptime(data['application_deadline'], '%Y-%m-%d').date()
    except (ValueError, KeyError):
        return jsonify({'error': 'Invalid deadline format. Use YYYY-MM-DD'}), 400

    drive = PlacementDrive(
        company_id=cp.id,
        job_title=data['job_title'],
        description=data.get('description', ''),
        eligibility_branch=data.get('eligibility_branch', 'ALL'),
        eligibility_cgpa=float(data.get('eligibility_cgpa', 0.0)),
        eligibility_year=int(data.get('eligibility_year', 0)) if data.get('eligibility_year') else None,
        application_deadline=deadline,
        status='pending'
    )
    db.session.add(drive)
    db.session.commit()
    _cache_delete(f'company_drives_{cp.id}')
    return jsonify({'message': 'Drive created. Awaiting admin approval.'}), 201


@company_bp.route('/company/drives', methods=['GET'])
@company_required
def company_drives():
    cp = _get_company_profile()
    if not cp:
        return jsonify({'error': 'Profile not found'}), 404

    key = f'company_drives_{cp.id}'
    cached = _cache_get(key)
    if cached:
        return jsonify(cached)

    drives = PlacementDrive.query.filter_by(company_id=cp.id).all()
    result = []
    for d in drives:
        applications_count = Application.query.filter_by(drive_id=d.id).count()
        result.append({
            'id': d.id,
            'job_title': d.job_title,
            'description': d.description,
            'eligibility_branch': d.eligibility_branch,
            'eligibility_cgpa': d.eligibility_cgpa,
            'eligibility_year': d.eligibility_year,
            'application_deadline': str(d.application_deadline),
            'status': d.status,
            'applications_count': applications_count
        })
    _cache_set(key, result, ex=300)
    return jsonify(result)


@company_bp.route('/company/applications', methods=['GET'])
@company_required
def company_applications():
    cp = _get_company_profile()
    if not cp:
        return jsonify({'error': 'Profile not found'}), 404

    drive_id = request.args.get('drive_id')
    query = db.session.query(Application, StudentProfile, User, PlacementDrive).join(
        StudentProfile, Application.student_id == StudentProfile.id
    ).join(
        User, StudentProfile.user_id == User.id
    ).join(
        PlacementDrive, Application.drive_id == PlacementDrive.id
    ).filter(PlacementDrive.company_id == cp.id)

    if drive_id:
        query = query.filter(Application.drive_id == drive_id)

    rows = query.all()
    result = []
    for app, sp, u, d in rows:
        result.append({
            'id': app.id,
            'student_name': u.name,
            'student_email': u.email,
            'branch': sp.branch,
            'cgpa': sp.cgpa,
            'graduation_year': sp.graduation_year,
            'drive_id': d.id,
            'job_title': d.job_title,
            'status': app.status,
            'application_date': str(app.application_date)
        })
    return jsonify(result)


@company_bp.route('/company/update_application_status', methods=['POST'])
@company_required
def update_application_status():
    cp = _get_company_profile()
    data = request.get_json()
    app_id = data.get('application_id')
    new_status = data.get('status')

    valid_statuses = ['shortlisted', 'selected', 'rejected', 'applied']
    if new_status not in valid_statuses:
        return jsonify({'error': f'Invalid status. Choose from: {valid_statuses}'}), 400

    # Make sure the application belongs to one of this company's drives
    application = db.session.query(Application).join(
        PlacementDrive, Application.drive_id == PlacementDrive.id
    ).filter(Application.id == app_id, PlacementDrive.company_id == cp.id).first()

    if not application:
        return jsonify({'error': 'Application not found'}), 404

    application.status = new_status
    db.session.commit()
    return jsonify({'message': f'Application status updated to {new_status}'})
