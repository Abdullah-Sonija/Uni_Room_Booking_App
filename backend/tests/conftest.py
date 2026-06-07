import pytest
import os
import tempfile
from app import create_app
from extensions import db
from models import User, Room, Booking

@pytest.fixture
def app():
    # Create a temporary file for the database
    db_fd, db_path = tempfile.mkstemp()
    
    # Set environment variable BEFORE creating app so it's picked up by config
    os.environ['DATABASE_URL'] = f'sqlite:///{db_path}'
    
    app = create_app()
    app.config.update({
        'TESTING': True,
        'JWT_ACCESS_TOKEN_EXPIRES': False, # For easy testing
    })

    with app.app_context():
        # Ensure rooms are seeded in this fresh DB
        # create_app() already does db.create_all() and _seed_sample_rooms()
        yield app

    os.close(db_fd)
    try:
        if os.path.exists(db_path):
            os.unlink(db_path)
    except PermissionError:
        pass # Windows file lock issue, OS will clean up temp file later

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def runner(app):
    return app.test_cli_runner()

@pytest.fixture
def admin_token(client):
    # Login as admin
    resp = client.post('/api/auth/login', json={
        'email': 'admin@urbs.edu',
        'password': 'Admin1234'
    })
    return resp.get_json()['token']

@pytest.fixture
def student_token(client):
    # Register and login as student 1
    client.post('/api/auth/register', json={
        'full_name': 'Test Student 1',
        'email': 'student1@urbs.edu',
        'password': 'Password123',
        'role': 'student'
    })
    resp = client.post('/api/auth/login', json={
        'email': 'student1@urbs.edu',
        'password': 'Password123'
    })
    return resp.get_json()['token']

@pytest.fixture
def student_token_2(client):
    # Register and login as student 2
    client.post('/api/auth/register', json={
        'full_name': 'Test Student 2',
        'email': 'student2@urbs.edu',
        'password': 'Password123',
        'role': 'student'
    })
    resp = client.post('/api/auth/login', json={
        'email': 'student2@urbs.edu',
        'password': 'Password123'
    })
    return resp.get_json()['token']

@pytest.fixture
def faculty_token(client):
    # Register and login as faculty
    client.post('/api/auth/register', json={
        'full_name': 'Test Faculty',
        'email': 'faculty@urbs.edu',
        'password': 'Password123',
        'role': 'faculty'
    })
    resp = client.post('/api/auth/login', json={
        'email': 'faculty@urbs.edu',
        'password': 'Password123'
    })
    return resp.get_json()['token']
