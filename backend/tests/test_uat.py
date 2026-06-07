import pytest

def test_scenario_a_proactive_student(client, student_token):
    """Scenario A: Student books a group study for next Tuesday."""
    headers = {'Authorization': f'Bearer {student_token}'}
    
    # 1. Browse Rooms (2027-01-03 is a Sunday, always free)
    resp = client.get('/api/rooms/available?date=2027-01-03&slots=3', headers=headers)
    assert resp.status_code == 200
    rooms = resp.get_json()['rooms']
    assert len(rooms) > 0
    
    # Find a room with 10+ capacity
    room = next((r for r in rooms if r['capacity'] >= 10), rooms[0])
    room_id = room['room_id']
    
    # 2. Submit booking
    book_resp = client.post('/api/bookings', headers=headers, json={
        'room_id': room_id,
        'booking_date': '2027-01-03',
        'start_time': '14:00',
        'end_time': '16:30', # 150 mins = 3 slots (approx)
        'purpose': 'CS301 Group Project Finalization'
    })
    assert book_resp.status_code == 201
    assert book_resp.get_json()['status'] == 'pending'

def test_scenario_b_urgent_faculty(client, faculty_token, admin_token):
    """Scenario B: Faculty secures Seminar Hall with priority."""
    f_headers = {'Authorization': f'Bearer {faculty_token}'}
    a_headers = {'Authorization': f'Bearer {admin_token}'}

    # 1. Search for Seminar Hall (or any room)
    resp = client.get('/api/rooms/available?date=2027-01-03&slots=1', headers=f_headers)
    room_id = resp.get_json()['rooms'][0]['room_id']

    # 2. Submit request
    book_resp = client.post('/api/bookings', headers=f_headers, json={
        'room_id': room_id,
        'booking_date': '2027-01-03',
        'start_time': '09:00',
        'end_time': '10:00',
        'purpose': 'Guest Lecture on AI Safety'
    })
    assert book_resp.status_code == 201
    
    # 3. Verify it appears at the TOP of the Admin Approval Queue (priority_access=True)
    queue_resp = client.get('/api/admin/bookings?status=pending', headers=a_headers)
    first_booking = queue_resp.get_json()[0]
    assert first_booking['priority_access'] is True
    assert first_booking['booking_id'] == book_resp.get_json()['booking_id']
