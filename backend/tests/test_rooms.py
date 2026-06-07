import pytest
from datetime import date
from unittest.mock import patch

def test_tc03_search_on_sunday(client, student_token):
    """Search for a room on a Sunday. Result: Success (empty list or graceful handle)."""
    headers = {'Authorization': f'Bearer {student_token}'}
    # Mocking date to a Sunday (e.g., 2027-01-03 is a Sunday)
    sunday = '2027-01-03'
    resp = client.get(f'/api/rooms/available?date={sunday}&slots=1', headers=headers)
    assert resp.status_code == 200
    # Should return rooms since no timetable blocks them on Sunday
    assert len(resp.get_json()['rooms']) > 0

def test_security_xss_injection(client, student_token):
    """Submit a booking purpose containing XSS. Result: Admin dashboard should escape it (visual check needed, but here we check storage)."""
    headers = {'Authorization': f'Bearer {student_token}'}
    
    # Need a room ID first
    rooms_resp = client.get('/api/rooms/available?date=2027-01-03&slots=1', headers=headers)
    room_id = rooms_resp.get_json()['rooms'][0]['room_id']
    
    xss_payload = "<script>alert('XSS')</script>"
    resp = client.post('/api/bookings', headers=headers, json={
        'room_id': room_id,
        'booking_date': '2027-01-03',
        'start_time': '14:00',
        'end_time': '15:00',
        'purpose': f'Study session {xss_payload}'
    })
    assert resp.status_code == 201
    
    # Check if stored correctly
    booking_id = resp.get_json()['booking_id']
    mine_resp = client.get('/api/bookings/mine', headers=headers)
    booking = next(b for b in mine_resp.get_json() if b['booking_id'] == booking_id)
    assert xss_payload in booking['purpose']
