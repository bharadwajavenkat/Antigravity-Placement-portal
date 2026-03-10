import json
from datetime import datetime
from functools import wraps

import redis
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt

from models import db, User, StudentProfile, CompanyProfile, PlacementDrive, Application
import config

admin_bp = Blueprint('admin', __name__)

# Redis client (graceful fallback if unavailable)
try:
    _redis = redis.from_url(config.REDIS_URL, decode_responses=True)
    _redis.ping()
    REDIS_OK = True
except Exception:
    _redis = None
    REDIS_OK = False


def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return fn(*args, **kwargs)
    return wrapper


def _cache_get(key):
    if REDIS_OK:
        val = _redis.get(key)
        if val:
            return json.loads(val)
    return None


def _cache_set(key, data, ex=300):
    if REDIS_OK:
        _redis.set(key, json.dumps(data), ex=ex)


def _cache_delete_pattern(pattern):
    if REDIS_OK:
        for k in _redis.scan_iter(pattern):
            _redis.delete(k)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@admin_bp.route('/admin/dashboard', methods=['GET'])
@admin_required
def dashboard():
    cached = _cache_get('dashboard_stats')
    if cached:
        return jsonify(cached)

    students = User.query.filter_by(role='student').count()
    companies = User.query.filter_by(role='company').count()
    drives = PlacementDrive.query.count()
    applications = Application.query.count()
    selected = Application.query.filter_by(status='selected').count()
    pending_companies = CompanyProfile.query.filter_by(approval_status='pending').count()
    pending_drives = PlacementDrive.query.filter_by(status='pending').count()

    data = {
        'students': students,
        'companies': companies,
        'drives': drives,
        'applications': applications,
        'selected': selected,
        'pending_companies': pending_companies,
        'pending_drives': pending_drives
    }
    _cache_set('dashboard_stats', data, ex=300)
    return jsonify(data)


# ---------------------------------------------------------------------------
# Companies
# ---------------------------------------------------------------------------

@admin_bp.route('/admin/companies', methods=['GET'])
@admin_required
def get_companies():
    companies = db.session.query(CompanyProfile, User).join(User, CompanyProfile.user_id == User.id).all()
    result = []
    for cp, u in companies:
        result.append({
            'id': cp.id,
            'user_id': u.id,
            'company_name': cp.company_name,
            'name': u.name,
            'email': u.email,
            'hr_contact': cp.hr_contact,
            'website': cp.website,
            'approval_status': cp.approval_status,
            'is_active': u.is_active
        })
    return jsonify(result)


@admin_bp.route('/admin/company/approve', methods=['POST'])
@admin_required
def approve_company():
    data = request.get_json()
    cp = CompanyProfile.query.get(data.get('company_id'))
    if not cp:
        return jsonify({'error': 'Company not found'}), 404
    cp.approval_status = 'approved'
    db.session.commit()
    _cache_delete_pattern('dashboard_stats')
    return jsonify({'message': 'Company approved'})


@admin_bp.route('/admin/company/reject', methods=['POST'])
@admin_required
def reject_company():
    data = request.get_json()
    cp = CompanyProfile.query.get(data.get('company_id'))
    if not cp:
        return jsonify({'error': 'Company not found'}), 404
    cp.approval_status = 'rejected'
    db.session.commit()
    _cache_delete_pattern('dashboard_stats')
    return jsonify({'message': 'Company rejected'})


# ---------------------------------------------------------------------------
# Drives
# ---------------------------------------------------------------------------

@admin_bp.route('/admin/drives', methods=['GET'])
@admin_required
def get_drives():
    drives = db.session.query(PlacementDrive, CompanyProfile).join(
        CompanyProfile, PlacementDrive.company_id == CompanyProfile.id
    ).all()
    result = []
    for d, cp in drives:
        result.append({
            'id': d.id,
            'job_title': d.job_title,
            'description': d.description,
            'company_name': cp.company_name,
            'eligibility_branch': d.eligibility_branch,
            'eligibility_cgpa': d.eligibility_cgpa,
            'eligibility_year': d.eligibility_year,
            'application_deadline': str(d.application_deadline),
            'status': d.status
        })
    return jsonify(result)


@admin_bp.route('/admin/drive/approve', methods=['POST'])
@admin_required
def approve_drive():
    data = request.get_json()
    drive = PlacementDrive.query.get(data.get('drive_id'))
    if not drive:
        return jsonify({'error': 'Drive not found'}), 404
    drive.status = 'approved'
    db.session.commit()
    _cache_delete_pattern('dashboard_stats')
    _cache_delete_pattern('drives_list')
    _cache_delete_pattern('student_drives_*')
    return jsonify({'message': 'Drive approved'})


# ---------------------------------------------------------------------------
# Students
# ---------------------------------------------------------------------------

@admin_bp.route('/admin/students', methods=['GET'])
@admin_required
def get_students():
    students = db.session.query(StudentProfile, User).join(User, StudentProfile.user_id == User.id).all()
    result = []
    for sp, u in students:
        result.append({
            'id': sp.id,
            'user_id': u.id,
            'name': u.name,
            'email': u.email,
            'branch': sp.branch,
            'cgpa': sp.cgpa,
            'graduation_year': sp.graduation_year,
            'phone': sp.phone,
            'is_active': u.is_active
        })
    return jsonify(result)


@admin_bp.route('/admin/blacklist', methods=['POST'])
@admin_required
def toggle_blacklist():
    data = request.get_json()
    user_id = data.get('user_id')
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    user.is_active = not user.is_active
    db.session.commit()
    _cache_delete_pattern('dashboard_stats')
    return jsonify({'message': f"User {'activated' if user.is_active else 'deactivated'}", 'is_active': user.is_active})


# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------

@admin_bp.route('/admin/applications', methods=['GET'])
@admin_required
def get_applications():
    rows = db.session.query(Application, StudentProfile, User, PlacementDrive, CompanyProfile).join(
        StudentProfile, Application.student_id == StudentProfile.id
    ).join(
        User, StudentProfile.user_id == User.id
    ).join(
        PlacementDrive, Application.drive_id == PlacementDrive.id
    ).join(
        CompanyProfile, PlacementDrive.company_id == CompanyProfile.id
    ).all()
    result = []
    for app, sp, u, d, cp in rows:
        result.append({
            'id': app.id,
            'student_name': u.name,
            'student_email': u.email,
            'company_name': cp.company_name,
            'job_title': d.job_title,
            'status': app.status,
            'application_date': str(app.application_date)
        })
    return jsonify(result)


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

@admin_bp.route('/admin/search_students', methods=['GET'])
@admin_required
def search_students():
    q = request.args.get('q', '').strip().lower()
    rows = db.session.query(StudentProfile, User).join(User, StudentProfile.user_id == User.id).all()
    result = []
    for sp, u in rows:
        if q in u.name.lower() or q in u.email.lower() or q in sp.branch.lower():
            result.append({
                'id': sp.id,
                'user_id': u.id,
                'name': u.name,
                'email': u.email,
                'branch': sp.branch,
                'cgpa': sp.cgpa,
                'graduation_year': sp.graduation_year,
                'is_active': u.is_active
            })
    return jsonify(result)


@admin_bp.route('/admin/search_companies', methods=['GET'])
@admin_required
def search_companies():
    q = request.args.get('q', '').strip().lower()
    rows = db.session.query(CompanyProfile, User).join(User, CompanyProfile.user_id == User.id).all()
    result = []
    for cp, u in rows:
        if q in cp.company_name.lower() or q in u.email.lower():
            result.append({
                'id': cp.id,
                'user_id': u.id,
                'company_name': cp.company_name,
                'email': u.email,
                'approval_status': cp.approval_status,
                'is_active': u.is_active
            })
    return jsonify(result)
