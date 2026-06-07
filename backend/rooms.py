"""
rooms.py  —  /api/rooms  (public list + availability search)
             /api/admin/rooms  (admin CRUD)

GET  /api/rooms                     → list all active rooms
GET  /api/rooms/available           → availability search (merges Sheet + DB)
POST /api/admin/rooms               → add room        [admin]
PUT  /api/admin/rooms/<id>          → edit room       [admin]
DELETE /api/admin/rooms/<id>        → soft-delete     [admin]
"""
from datetime import datetime, date, time as dt_time
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from extensions import db
from models import Room, Booking
from decorators import role_required
from sheets_sync import get_sheet_blocked_rooms, get_room_free_windows, get_slot_times, WEEKDAY_NAMES

rooms_bp = Blueprint('rooms', __name__)

VALID_TYPES = {'classroom', 'lab', 'lecture_hall', 'seminar_room', 'conference_room'}


# ── Slot auto-release helper ──────────────────────────────────────────────────
def _auto_release_expired():
    """
    Mark APPROVED bookings whose (booking_date + end_time) < NOW as COMPLETED.
    Called before every availability query so stale locks are freed first.
    """
    now        = datetime.utcnow()
    today      = now.date()
    now_time   = now.time()

    expired = Booking.query.filter(
        Booking.status == 'approved',
        Booking.booking_date <= today
    ).all()

    released = 0
    for b in expired:
        # booking is in the past if: date < today  OR  (date == today AND end_time <= now)
        if b.booking_date < today or (b.booking_date == today and b.end_time <= now_time):
            b.status     = 'completed'
            b.updated_at = datetime.utcnow()
            released += 1

    if released:
        db.session.commit()


# ── GET /api/rooms ─────────────────────────────────────────────────────────────
@rooms_bp.route('/api/rooms', methods=['GET'])
@jwt_required()
def list_rooms():
    rooms = Room.query.filter_by(is_active=True).order_by(Room.room_number).all()
    return jsonify([r.to_dict() for r in rooms]), 200


# ── GET /api/rooms/available ───────────────────────────────────────────────────
@rooms_bp.route('/api/rooms/available', methods=['GET'])
@jwt_required()
def available_rooms():
    # ── Step 1: auto-release expired slots ───────────────────────────────────
    _auto_release_expired()

    # ── Parse query params ────────────────────────────────────────────────────
    date_str    = request.args.get('date')
    start_str   = request.args.get('start_time')
    end_str     = request.args.get('end_time')
    room_type   = request.args.get('room_type', '').strip().lower() or None
    min_cap     = request.args.get('min_capacity', type=int)
    slot_filter = request.args.get('slot', type=int)   # specific slot number filter
    num_slots   = request.args.get('num_slots', type=int, default=1)  # consecutive slots

    # Validate required params
    errors = []
    query_date  = None
    query_start = None
    query_end   = None

    if date_str:
        try:
            query_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            if query_date < datetime.utcnow().date():
                errors.append('date must not be in the past.')
        except ValueError:
            errors.append('date must be YYYY-MM-DD.')

    if start_str:
        try:
            query_start = datetime.strptime(start_str, '%H:%M').time()
        except ValueError:
            errors.append('start_time must be HH:MM.')

    if end_str:
        try:
            query_end = datetime.strptime(end_str, '%H:%M').time()
        except ValueError:
            errors.append('end_time must be HH:MM.')

    if query_start and query_end and query_end <= query_start:
        errors.append('end_time must be after start_time.')

    if errors:
        return jsonify({'error': ' | '.join(errors)}), 400

    # ── Step 2: fetch Sheet-blocked rooms (only if time filters given) ────────
    sheet_blocked = set()
    if query_date and query_start and query_end:
        sheet_blocked = get_sheet_blocked_rooms(query_date, query_start, query_end)

    # ── Step 3: query DB for conflicting bookings ─────────────────────────────
    # Collect ALL active (pending+approved) bookings for the date
    db_bookings_by_room = {}
    db_blocked_ids = set()       # rooms blocked by approved bookings (for specific time search)
    faculty_locked_ids = set()   # rooms locked by pending faculty requests (for specific time search)

    if query_date:
        all_day_conflicts = Booking.query.filter(
            Booking.booking_date == query_date,
            Booking.status.in_(['pending', 'approved'])
        ).all()
        
        for c in all_day_conflicts:
            db_bookings_by_room.setdefault(c.room_id, []).append(c)
            
            # If doing a specific time search, calculate db_blocked_ids and faculty_locked_ids
            if query_start and query_end:
                if c.start_time < query_end and c.end_time > query_start:
                    if c.status == 'approved':
                        db_blocked_ids.add(c.room_id)
                    elif c.status == 'pending' and c.priority_access:
                        faculty_locked_ids.add(c.room_id)

    # ── Step 4: build room list ───────────────────────────────────────────────
    query = Room.query.filter_by(is_active=True)
    if room_type and room_type in VALID_TYPES:
        query = query.filter_by(room_type=room_type)
    if min_cap:
        query = query.filter(Room.capacity >= min_cap)

    rooms = query.order_by(Room.room_number).all()

    # Derive day name for free-slot lookup
    day_name = WEEKDAY_NAMES.get(query_date.weekday()) if query_date else None

    # Full slot schedule for the day (for frontend slot-picker)
    slot_schedule = get_slot_times(day_name) if day_name else []

    result = []
    for r in rooms:
        in_db_blocked    = r.room_id in db_blocked_ids
        faculty_locked   = r.room_id in faculty_locked_ids
        in_sheet_blocked = r.room_number in sheet_blocked
        is_available     = not in_db_blocked and not in_sheet_blocked and not faculty_locked

        # When time filters are active, skip unavailable rooms
        if (query_date and query_start and query_end) and not is_available:
            continue

        if in_db_blocked:
            source = 'urbs_booking'
        elif faculty_locked:
            source = 'faculty_priority'
        elif in_sheet_blocked:
            source = 'external_schedule'
        else:
            source = 'free'

        d = r.to_dict()
        d['is_available']        = is_available
        d['availability_source'] = source
        d['faculty_locked']      = faculty_locked

        # Attach the room's full free-slot list for the queried day
        if day_name:
            raw_free_slots = get_room_free_windows(day_name, r.room_number)
            filtered_free_slots = []
            room_db_bookings = db_bookings_by_room.get(r.room_id, [])
            
            for slot in raw_free_slots:
                s_start = datetime.strptime(slot['start'], '%H:%M').time()
                s_end   = datetime.strptime(slot['end'],   '%H:%M').time()
                
                is_slot_blocked = False
                for b in room_db_bookings:
                    if b.start_time < s_end and b.end_time > s_start:
                        is_slot_blocked = True
                        break
                        
                if not is_slot_blocked:
                    filtered_free_slots.append(slot)
                    
            d['free_slots'] = filtered_free_slots
            
            # If no specific time was queried, availability is purely based on having free slots
            if not query_start and not query_end:
                d['is_available'] = len(filtered_free_slots) > 0
                if not d['is_available']:
                    d['availability_source'] = 'urbs_booking'
        else:
            d['free_slots'] = []

        # ── Consecutive slot filter ───────────────────────────────────────────
        # If slot_filter is given, ensure the room has ALL consecutive slots
        # from slot_filter to slot_filter + num_slots - 1 free.
        if slot_filter:
            free_slot_nums = {s['slot'] for s in d['free_slots']}
            required_slots = set(range(slot_filter, slot_filter + max(num_slots, 1)))
            # Check all required consecutive slots are free
            if not required_slots.issubset(free_slot_nums):
                continue

        result.append(d)

    return jsonify({'rooms': result, 'slot_schedule': slot_schedule}), 200


# ── POST /api/admin/rooms ──────────────────────────────────────────────────────
@rooms_bp.route('/api/admin/rooms', methods=['POST'])
@role_required('admin')
def add_room():
    data        = request.get_json(silent=True) or {}
    room_number = (data.get('room_number') or '').strip()
    room_type   = (data.get('room_type')   or '').strip().lower()
    capacity    = data.get('capacity')
    location    = (data.get('location')    or '').strip()

    errors = []
    if not room_number:
        errors.append('room_number is required.')
    if room_type not in VALID_TYPES:
        errors.append(f'room_type must be one of: {", ".join(VALID_TYPES)}.')
    if capacity is None or not isinstance(capacity, int) or capacity < 1:
        errors.append('capacity must be a positive integer.')
    if errors:
        return jsonify({'error': ' | '.join(errors)}), 400

    if Room.query.filter_by(room_number=room_number).first():
        return jsonify({'error': f'Room number "{room_number}" already exists.'}), 409

    room = Room(room_number=room_number, room_type=room_type,
                capacity=capacity, location=location)
    db.session.add(room)
    db.session.commit()
    return jsonify({'message': 'Room added successfully.', 'room_id': room.room_id}), 201


# ── PUT /api/admin/rooms/<id> ──────────────────────────────────────────────────
@rooms_bp.route('/api/admin/rooms/<int:room_id>', methods=['PUT'])
@role_required('admin')
def edit_room(room_id):
    room = db.get_or_404(Room, room_id)
    data = request.get_json(silent=True) or {}

    if 'room_number' in data:
        rn = str(data['room_number']).strip()
        if not rn:
            return jsonify({'error': 'room_number cannot be empty.'}), 400
        existing = Room.query.filter_by(room_number=rn).first()
        if existing and existing.room_id != room_id:
            return jsonify({'error': f'Room number "{rn}" already in use.'}), 409
        room.room_number = rn

    if 'room_type' in data:
        rt = str(data['room_type']).strip().lower()
        if rt not in VALID_TYPES:
            return jsonify({'error': f'room_type must be one of: {", ".join(VALID_TYPES)}.'}), 400
        room.room_type = rt

    if 'capacity' in data:
        cap = data['capacity']
        if not isinstance(cap, int) or cap < 1:
            return jsonify({'error': 'capacity must be a positive integer.'}), 400
        room.capacity = cap

    if 'location' in data:
        room.location = str(data['location']).strip()

    if 'is_active' in data:
        room.is_active = bool(data['is_active'])

    db.session.commit()
    return jsonify({'message': 'Room updated.', 'room': room.to_dict()}), 200


# ── DELETE /api/admin/rooms/<id>  (soft-delete) ────────────────────────────────
@rooms_bp.route('/api/admin/rooms/<int:room_id>', methods=['DELETE'])
@role_required('admin')
def deactivate_room(room_id):
    room = db.get_or_404(Room, room_id)
    room.is_active = False
    db.session.commit()
    return jsonify({'message': f'Room {room.room_number} deactivated.'}), 200


# ── GET /api/rooms/slots  ──────────────────────────────────────────────────────
@rooms_bp.route('/api/rooms/slots', methods=['GET'])
@jwt_required()
def room_slots():
    """Return the slot schedule for a given weekday (for frontend slot-picker)."""
    day_name = (request.args.get('day') or '').strip().upper()
    if day_name not in ('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'):
        return jsonify({'error': 'day must be a weekday name (MONDAY…FRIDAY).'}), 400
    return jsonify(get_slot_times(day_name)), 200