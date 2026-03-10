#!/bin/bash
# Placement Portal - Local Run Script

echo "=== Placement Portal Startup ==="

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install requirements
echo "Installing requirements..."
pip install -r requirements.txt -q

# Check Redis
if ! command -v redis-server &> /dev/null; then
    echo "WARNING: Redis not found. Caching and Celery won't work."
    echo "Install Redis: brew install redis"
else
    echo "Starting Redis..."
    redis-server --daemonize yes
fi

# Start Celery worker in background
echo "Starting Celery worker..."
cd backend
celery -A tasks.celery_tasks:celery_app worker --loglevel=info --detach --logfile=../celery.log --pidfile=../celery.pid 2>/dev/null || true

# Start Flask app
echo "Starting Flask server at http://localhost:5000 ..."
python app.py
