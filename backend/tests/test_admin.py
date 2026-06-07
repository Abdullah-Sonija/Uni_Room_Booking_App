import pytest

def test_tc06_admin_approve_and_check_history(client, admin_token, student_token):
    """Approve a booking, then check student's history. Result: Status changes to Approved."""
    # 1. Student makes a booking
    s_headers = {'Authorization': f'Bearer {student_token}'}
    rooms_resp = client.get('/api/rooms/available?date=2027-01-03&slots=1', headers=s_headers)
    room_id = rooms_resp.get_json()['rooms'][0]['room_id']
    
    b_resp = client.post('/api/bookings', headers=s_headers, json={
        'room_id': room_id,
        'booking_date': '2027-01-03',
        'start_time': '10:00',
        'end_time': '11:00',
        'purpose': 'Group Study TC-06'
    })
    booking_id = b_resp.get_json()['booking_id']

    # 2. Admin approves
    a_headers = {'Authorization': f'Bearer {admin_token}'}
    appr_resp = client.put(f'/api/admin/bookings/{booking_id}/approve', headers=a_headers, json={'confirmed': True})
    assert appr_resp.status_code == 200
    assert appr_resp.get_json()['status'] == 'approved'

    # 3. Check student history
    hist_resp = client.get('/api/bookings/mine', headers=s_headers)
    booking = next(b for b in hist_resp.get_json() if b['booking_id'] == booking_id)
    assert booking['status'] == 'approved'

def test_scenario_c_admin_workflow(client, admin_token, student_token, student_token_2):
    """Scenario C: Process pending requests, reject one with remarks, approve one."""
    a_headers = {'Authorization': f'Bearer {admin_token}'}
    s1_headers = {'Authorization': f'Bearer {student_token}'}
    s2_headers = {'Authorization': f'Bearer {student_token_2}'}

    # Setup: 2 bookings from DIFFERENT users
    rooms_resp = client.get('/api/rooms/available?date=2027-01-03&slots=1', headers=s1_headers)
    room_id = rooms_resp.get_json()['rooms'][0]['room_id']

    b1 = client.post('/api/bookings', headers=s1_headers, json={
        'room_id': room_id, 'booking_date': '2027-01-03', 'start_time': '09:00', 'end_time': '10:00', 'purpose': 'Study Session for CS301'
    }).get_json()['booking_id']
    
    b2 = client.post('/api/bookings', headers=s2_headers, json={
        'room_id': room_id, 'booking_date': '2027-01-03', 'start_time': '10:00', 'end_time': '11:00', 'purpose': 'Group Discussion for CS302'
    }).get_json()['booking_id']

    # 1. Reject b1 with remarks
    rej_resp = client.put(f'/api/admin/bookings/{b1}/reject', headers=a_headers, json={
        'admin_remarks': 'Insufficient purpose provided for this slot.'
    })
    assert rej_resp.status_code == 200

    # 2. Approve b2
    app_resp = client.put(f'/api/admin/bookings/{b2}/approve', headers=a_headers, json={'confirmed': True})
    assert app_resp.status_code == 200

    # 3. Check Dashboard KPI
    dash_resp = client.get('/api/admin/dashboard', headers=a_headers)
    assert dash_resp.status_code == 200
    # total_bookings should include both the rejected and approved ones
    assert dash_resp.get_json()['total_bookings'] >= 2
