import csv
import os
import json
from datetime import date, datetime

from celery import Celery
from celery.schedules import crontab

import config

# ---------------------------------------------------------------------------
# Celery app setup
# ---------------------------------------------------------------------------
celery_app = Celery(
    'placement_portal',
    broker=config.CELERY_BROKER_URL,
    backend=config.CELERY_RESULT_BACKEND
)

celery_app.conf.update(
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    timezone='Asia/Kolkata',
    enable_utc=False,
    beat_schedule={
        'send-daily-reminders': {
            'task': 'tasks.celery_tasks.send_daily_reminders',
            'schedule': crontab(hour=8, minute=0),
        },
        'send-monthly-report': {
            'task': 'tasks.celery_tasks.send_monthly_report',
            'schedule': crontab(day_of_month=1, hour=9, minute=0),
        },
    }
)


def _get_flask_app():
    """Lazy import to avoid circular imports."""
    import sys
    parent = os.path.join(os.path.dirname(__file__), '..')
    sys.path.insert(0, parent)
    from app import create_app
    return create_app()


# ---------------------------------------------------------------------------
# Task: Daily Reminders
# ---------------------------------------------------------------------------

@celery_app.task(name='tasks.celery_tasks.send_daily_reminders')
def send_daily_reminders():
    """Daily: notify students about upcoming placement deadlines."""
    flask_app = _get_flask_app()
    with flask_app.app_context():
        from models import PlacementDrive, Application, StudentProfile, User
        from models import db
        from sqlalchemy.orm import Session

        today = date.today()
        upcoming = PlacementDrive.query.filter(
            PlacementDrive.status == 'approved',
            PlacementDrive.application_deadline >= today
        ).all()

        reminders_sent = 0
        for drive in upcoming:
            delta = (drive.application_deadline - today).days
            if delta in [1, 3, 7]:
                # In a real system, send email. Here we log.
                students = db.session.query(StudentProfile, User).join(
                    User, StudentProfile.user_id == User.id
                ).filter(User.is_active == True).all()
                for sp, u in students:
                    print(f"[Reminder] Student: {u.email} | Drive: {drive.job_title} | Deadline in {delta} day(s)")
                    reminders_sent += 1

        return {'reminders_sent': reminders_sent, 'date': str(today)}


# ---------------------------------------------------------------------------
# Task: Monthly Report
# ---------------------------------------------------------------------------

@celery_app.task(name='tasks.celery_tasks.send_monthly_report')
def send_monthly_report():
    """Monthly (1st): email admin with HTML placement report."""
    flask_app = _get_flask_app()
    with flask_app.app_context():
        from models import User, PlacementDrive, Application, StudentProfile, CompanyProfile

        students = User.query.filter_by(role='student').count()
        companies = User.query.filter_by(role='company').count()
        drives = PlacementDrive.query.count()
        applications = Application.query.count()
        selected = Application.query.filter_by(status='selected').count()

        html_report = f"""
        <html><body>
        <h1>Monthly Placement Report — {datetime.now().strftime('%B %Y')}</h1>
        <table border="1">
          <tr><td>Total Students</td><td>{students}</td></tr>
          <tr><td>Total Companies</td><td>{companies}</td></tr>
          <tr><td>Total Drives</td><td>{drives}</td></tr>
          <tr><td>Total Applications</td><td>{applications}</td></tr>
          <tr><td>Total Selected</td><td>{selected}</td></tr>
        </table>
        </body></html>
        """
        # In a real system, send via SMTP. Here we log/save.
        report_path = os.path.join(os.path.dirname(__file__), '..', '..', 'monthly_report.html')
        with open(report_path, 'w') as f:
            f.write(html_report)
        print(f"[Monthly Report] Generated: {report_path}")
        return {'status': 'report_generated', 'path': report_path}


# ---------------------------------------------------------------------------
# Task: Async CSV Export
# ---------------------------------------------------------------------------

@celery_app.task(name='tasks.celery_tasks.export_csv_async')
def export_csv_async(user_id):
    """Async CSV generation for student's application history."""
    flask_app = _get_flask_app()
    with flask_app.app_context():
        from models import Application, PlacementDrive, CompanyProfile, StudentProfile
        from models import db

        sp = StudentProfile.query.filter_by(user_id=user_id).first()
        if not sp:
            return {'error': 'Student not found'}

        rows = db.session.query(Application, PlacementDrive, CompanyProfile).join(
            PlacementDrive, Application.drive_id == PlacementDrive.id
        ).join(
            CompanyProfile, PlacementDrive.company_id == CompanyProfile.id
        ).filter(Application.student_id == sp.id).all()

        export_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'exports')
        os.makedirs(export_dir, exist_ok=True)
        file_path = os.path.join(export_dir, f'student_{user_id}_applications.csv')

        with open(file_path, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['Company', 'Job Title', 'Status', 'Application Date'])
            for app, d, cp in rows:
                writer.writerow([cp.company_name, d.job_title, app.status, str(app.application_date)])

        print(f"[CSV Export] Generated for student {user_id}: {file_path}")
        return {'status': 'csv_generated', 'path': file_path}
