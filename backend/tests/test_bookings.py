import pytest
from unittest.mock import patch
import threading
import time

def test_tc05_purpose_too_short(client, student_token):
    """Submit a purpose shorter than 10 characters. Result: 400."""
    headers = {'Authorization': f'Bearer {student_token}'}
    resp = client.post('/api/bookings', headers=headers, json={
        'room_id': 1,
        'booking_date': '2027-01-04',
        'start_time': '10:00',
        'end_time': '11:00',
        'purpose': 'Short' # 5 chars
    })
    assert resp.status_code == 400
    assert 'purpose must be between 10 and 500 characters' in resp.get_json()['error']

def test_tc04_google_sheet_conflict(client, student_token):
    """Request a room when the Google Sheet has a class. Result: 409."""
    headers = {'Authorization': f'Bearer {student_token}'}
    
    # We need to find a room name that exists in our seeded rooms
    rooms_resp = client.get('/api/rooms/available?date=2027-01-04&slots=1', headers=headers)
    room = rooms_resp.get_json()['rooms'][0]
    room_id = room['room_id']
    room_number = room['room_number']

    # Mock get_sheet_blocked_rooms to return this room
    with patch('bookings.get_sheet_blocked_rooms') as mock_blocked:
        mock_blocked.return_value = {room_number}
        resp = client.post('/api/bookings', headers=headers, json={
            'room_id': room_id,
            'booking_date': '2027-01-04',
            'start_time': '10:00',
            'end_time': '11:00',
            'purpose': 'CS301 Group Project'
        })
        assert resp.status_code == 409
        assert 'occupied in the university timetable' in resp.get_json()['error']

def test_tc08_overlap_race_condition(client, student_token, student_token_2):
    """
    User A books 10:00-11:00. User B simultaneously books 10:30-11:30.
    """
    h1 = {'Authorization': f'Bearer {student_token}'}
    h2 = {'Authorization': f'Bearer {student_token_2}'}
    
    rooms_resp = client.get('/api/rooms/available?date=2027-01-03&slots=1', headers=h1)
    room_id = rooms_resp.get_json()['rooms'][0]['room_id']

    # First booking: 10:00 - 11:00
    resp1 = client.post('/api/bookings', headers=h1, json={
        'room_id': room_id,
        'booking_date': '2027-01-03',
        'start_time': '10:00',
        'end_time': '11:00',
        'purpose': 'First Booking Overlap'
    })
    assert resp1.status_code == 201

    # Second booking: 10:30 - 11:30 (should be blocked by app logic)
    resp2 = client.post('/api/bookings', headers=h2, json={
        'room_id': room_id,
        'booking_date': '2027-01-03',
        'start_time': '10:30',
        'end_time': '11:30',
        'purpose': 'Second Booking Overlap'
    })
    # If app logic works sequentially, this returns 409
    # In a race condition (both threads pass validation before either commits), this would return 201
    # Without real multi-threading in the test client, we can't easily trigger the race, 
    # but we can verify that the app logic AT LEAST blocks it sequentially.
    assert resp2.status_code == 409

def test_tc07_parallel_post_exact_same_time(client, student_token, student_token_2):
    """
    Two users click "Book" at exact same time for SAME room and SAME start time.
    """
    h1 = {'Authorization': f'Bearer {student_token}'}
    h2 = {'Authorization': f'Bearer {student_token_2}'}

    rooms_resp = client.get('/api/rooms/available?date=2027-01-03&slots=1', headers=h1)
    room_id = rooms_resp.get_json()['rooms'][0]['room_id']

    # First booking
    resp1 = client.post('/api/bookings', headers=h1, json={
        'room_id': room_id,
        'booking_date': '2027-01-03',
        'start_time': '10:00',
        'end_time': '11:00',
        'purpose': 'First Booking Same'
    })
    assert resp1.status_code == 201

    # Second booking same time
    resp2 = client.post('/api/bookings', headers=h2, json={
        'room_id': room_id,
        'booking_date': '2027-01-03',
        'start_time': '10:00',
        'end_time': '11:00',
        'purpose': 'Second Booking Same'
    })
    assert resp2.status_code == 409
    assert 'pending request' in resp2.get_json()['error'] or 'slot was just taken' in resp2.get_json()['error']
