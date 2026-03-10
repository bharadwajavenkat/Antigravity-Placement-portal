import csv
import io
import json
import os
from datetime import date, datetime
from functools import wraps

import redis
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from werkzeug.utils import secure_filename

from models import db, User, StudentProfile, PlacementDrive, Application, CompanyProfile
import config

student_bp = Blueprint('student', __name__)

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


def student_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get('role') != 'student':
            return jsonify({'error': 'Student access required'}), 403
        return fn(*args, **kwargs)
    return wrapper


def _get_student_profile():
    user_id = int(get_jwt_identity())
    return StudentProfile.query.filter_by(user_id=user_id).first()


def _allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in config.ALLOWED_EXTENSIONS


# ---------------------------------------------------------------------------
# Drives (eligible)
# ---------------------------------------------------------------------------

@student_bp.route('/student/drives', methods=['GET'])
@student_required
def eligible_drives():
    sp = _get_student_profile()
    if not sp:
        return jsonify({'error': 'Profile not found'}), 404

    key = f'student_drives_{sp.id}'
    cached = _cache_get(key)
    if cached:
        return jsonify(cached)

    today = date.today()
    drives = PlacementDrive.query.filter_by(status='approved').all()
    result = []
    for d in drives:
        if d.application_deadline < today:
            continue
        # Eligibility: branch
        if d.eligibility_branch and d.eligibility_branch.upper() != 'ALL':
            allowed_branches = [b.strip().lower() for b in d.eligibility_branch.split(',')]
            if sp.branch.lower() not in allowed_branches:
                continue
        # Eligibility: cgpa
        if d.eligibility_cgpa and sp.cgpa < d.eligibility_cgpa:
            continue
        # Eligibility: year
        if d.eligibility_year and sp.graduation_year != d.eligibility_year:
            continue

        # Check if already applied
        already_applied = Application.query.filter_by(student_id=sp.id, drive_id=d.id).first()
        cp = CompanyProfile.query.get(d.company_id)
        result.append({
            'id': d.id,
            'job_title': d.job_title,
            'description': d.description,
            'company_name': cp.company_name if cp else 'N/A',
            'eligibility_branch': d.eligibility_branch,
            'eligibility_cgpa': d.eligibility_cgpa,
            'eligibility_year': d.eligibility_year,
            'application_deadline': str(d.application_deadline),
            'already_applied': already_applied is not None
        })

    _cache_set(key, result, ex=300)
    return jsonify(result)


# ---------------------------------------------------------------------------
# Apply
# ---------------------------------------------------------------------------

@student_bp.route('/student/apply', methods=['POST'])
@student_required
def apply():
    sp = _get_student_profile()
    if not sp:
        return jsonify({'error': 'Profile not found'}), 404

    data = request.get_json()
    drive_id = data.get('drive_id')
    drive = PlacementDrive.query.filter_by(id=drive_id, status='approved').first()
    if not drive:
        return jsonify({'error': 'Drive not found or not active'}), 404

    today = date.today()
    # Deadline check
    if today > drive.application_deadline:
        return jsonify({'error': 'Application deadline has passed'}), 400

    # Eligibility checks
    if drive.eligibility_branch and drive.eligibility_branch.upper() != 'ALL':
        allowed = [b.strip().lower() for b in drive.eligibility_branch.split(',')]
        if sp.branch.lower() not in allowed:
            return jsonify({'error': 'You are not eligible (branch mismatch)'}), 400

    if drive.eligibility_cgpa and sp.cgpa < drive.eligibility_cgpa:
        return jsonify({'error': f'Minimum CGPA required: {drive.eligibility_cgpa}'}), 400

    if drive.eligibility_year and sp.graduation_year != drive.eligibility_year:
        return jsonify({'error': 'You are not eligible (graduation year mismatch)'}), 400

    # Duplicate check
    existing = Application.query.filter_by(student_id=sp.id, drive_id=drive_id).first()
    if existing:
        return jsonify({'error': 'Already applied to this drive'}), 409

    application = Application(student_id=sp.id, drive_id=drive_id, status='applied')
    db.session.add(application)
    db.session.commit()
    _cache_delete(f'student_drives_{sp.id}')
    return jsonify({'message': 'Application submitted successfully'}), 201


# ---------------------------------------------------------------------------
# My Applications & History
# ---------------------------------------------------------------------------

@student_bp.route('/student/applications', methods=['GET'])
@student_required
def my_applications():
    sp = _get_student_profile()
    if not sp:
        return jsonify({'error': 'Profile not found'}), 404

    rows = db.session.query(Application, PlacementDrive, CompanyProfile).join(
        PlacementDrive, Application.drive_id == PlacementDrive.id
    ).join(
        CompanyProfile, PlacementDrive.company_id == CompanyProfile.id
    ).filter(Application.student_id == sp.id).all()

    result = []
    for app, d, cp in rows:
        result.append({
            'id': app.id,
            'job_title': d.job_title,
            'company_name': cp.company_name,
            'status': app.status,
            'application_date': str(app.application_date)
        })
    return jsonify(result)


@student_bp.route('/student/history', methods=['GET'])
@student_required
def history():
    sp = _get_student_profile()
    if not sp:
        return jsonify({'error': 'Profile not found'}), 404

    rows = db.session.query(Application, PlacementDrive, CompanyProfile).join(
        PlacementDrive, Application.drive_id == PlacementDrive.id
    ).join(
        CompanyProfile, PlacementDrive.company_id == CompanyProfile.id
    ).filter(Application.student_id == sp.id).all()

    result = [
        {
            'company': cp.company_name,
            'job_title': d.job_title,
            'status': app.status,
            'date': str(app.application_date)
        }
        for app, d, cp in rows
    ]
    return jsonify(result)


# ---------------------------------------------------------------------------
# Profile & Resume
# ---------------------------------------------------------------------------

@student_bp.route('/student/profile', methods=['PUT'])
@student_required
def update_profile():
    sp = _get_student_profile()
    if not sp:
        return jsonify({'error': 'Profile not found'}), 404

    data = request.get_json()
    if 'phone' in data:
        sp.phone = data['phone']
    if 'cgpa' in data:
        sp.cgpa = float(data['cgpa'])
    if 'branch' in data:
        sp.branch = data['branch']
    if 'graduation_year' in data:
        sp.graduation_year = int(data['graduation_year'])

    db.session.commit()
    _cache_delete(f'student_drives_{sp.id}')
    return jsonify({'message': 'Profile updated successfully'})


@student_bp.route('/student/upload_resume', methods=['POST'])
@student_required
def upload_resume():
    sp = _get_student_profile()
    if not sp:
        return jsonify({'error': 'Profile not found'}), 404

    if 'resume' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['resume']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not _allowed_file(file.filename):
        return jsonify({'error': 'Only PDF, DOC, DOCX allowed'}), 400

    filename = secure_filename(f"student_{sp.id}_{file.filename}")
    upload_dir = os.path.abspath(config.UPLOAD_FOLDER)
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)
    file.save(file_path)

    sp.resume_path = filename
    db.session.commit()
    return jsonify({'message': 'Resume uploaded successfully', 'filename': filename})


# ---------------------------------------------------------------------------
# CSV Export (sync fallback + async trigger)
# ---------------------------------------------------------------------------

@student_bp.route('/student/export_csv', methods=['GET'])
@student_required
def export_csv():
    sp = _get_student_profile()
    user_id = int(get_jwt_identity())
    if not sp:
        return jsonify({'error': 'Profile not found'}), 404

    # Try async with Celery
    try:
        from tasks.celery_tasks import export_csv_async
        result = export_csv_async.delay(user_id)
        return jsonify({'message': 'CSV export triggered. File will be ready shortly.', 'task_id': result.id})
    except Exception:
        pass

    # Synchronous fallback
    rows = db.session.query(Application, PlacementDrive, CompanyProfile).join(
        PlacementDrive, Application.drive_id == PlacementDrive.id
    ).join(
        CompanyProfile, PlacementDrive.company_id == CompanyProfile.id
    ).filter(Application.student_id == sp.id).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Company', 'Job Title', 'Status', 'Application Date'])
    for app, d, cp in rows:
        writer.writerow([cp.company_name, d.job_title, app.status, str(app.application_date)])
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode()),
        mimetype='text/csv',
        as_attachment=True,
        download_name='my_applications.csv'
    )


# ---------------------------------------------------------------------------
# Drive Search
# ---------------------------------------------------------------------------

@student_bp.route('/student/search_drives', methods=['GET'])
@student_required
def search_drives():
    q = request.args.get('q', '').strip().lower()
    drives = db.session.query(PlacementDrive, CompanyProfile).join(
        CompanyProfile, PlacementDrive.company_id == CompanyProfile.id
    ).filter(PlacementDrive.status == 'approved').all()

    sp = _get_student_profile()
    result = []
    for d, cp in drives:
        if q in d.job_title.lower() or q in cp.company_name.lower():
            already_applied = Application.query.filter_by(student_id=sp.id, drive_id=d.id).first() if sp else None
            result.append({
                'id': d.id,
                'job_title': d.job_title,
                'company_name': cp.company_name,
                'eligibility_branch': d.eligibility_branch,
                'eligibility_cgpa': d.eligibility_cgpa,
                'eligibility_year': d.eligibility_year,
                'application_deadline': str(d.application_deadline),
                'already_applied': already_applied is not None
            })
    return jsonify(result)
