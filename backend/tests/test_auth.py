import pytest

def test_tc01_student_access_admin_dashboard(client, student_token):
    """Register as a Student, then attempt to access /api/admin/dashboard. Result: 403."""
    headers = {'Authorization': f'Bearer {student_token}'}
    resp = client.get('/api/admin/dashboard', headers=headers)
    assert resp.status_code == 403
    assert 'insufficient role' in resp.get_json()['error'].lower()

def test_tc02_password_validation_no_digits(client):
    """Attempt to register with a password that has no digits. Result: 400."""
    resp = client.post('/api/auth/register', json={
        'full_name': 'No Digit User',
        'email': 'nodigit@urbs.edu',
        'password': 'Password', # No digit
        'role': 'student'
    })
    assert resp.status_code == 400
    assert 'must contain at least one letter and one digit' in resp.get_json()['error']

def test_security_role_escalation(client):
    """Attempt to register as an admin via public endpoint. Result: Blocked (400)."""
    resp = client.post('/api/auth/register', json={
        'full_name': 'Fake Admin',
        'email': 'fakeadmin@urbs.edu',
        'password': 'Admin1234',
        'role': 'admin'
    })
    assert resp.status_code == 400
    assert 'Admin accounts cannot be created' in resp.get_json()['error']
    
    # Verify login fails because user was not created
    login_resp = client.post('/api/auth/login', json={
        'email': 'fakeadmin@urbs.edu',
        'password': 'Admin1234'
    })
    assert login_resp.status_code == 401
