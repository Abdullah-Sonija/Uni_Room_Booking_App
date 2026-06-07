"""
bookings.py  —  /api/bookings

POST   /api/bookings           → submit booking request  [student | faculty]
GET    /api/bookings/mine      → own booking history      [student | faculty]
DELETE /api/bookings/<id>      → cancel booking           [student | faculty]
"""
from datetime import datetime, date, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from extensions import db
from models import Booking, Room
from decorators import role_required
from sheets_sync import get_sheet_blocked_rooms, WEEKDAY_NAMES
import threading

bookings_bp = Blueprint('bookings', __name__)
booking_lock = threading.Lock()


def _parse_time(s):
    try:
        return datetime.strptime(s, '%H:%M').time()
    except (ValueError, TypeError):
        return None


def _parse_date(s):
    try:
        return datetime.strptime(s, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None


def _has_approved_conflict(room_id, booking_date, start_time, end_time, exclude_id=None):
    """
    Returns True if there's an already-APPROVED booking conflicting with the slot.
    Used to block submission when slot is already firmly booked.
    """
    q = Booking.query.filter(
        Booking.room_id      == room_id,
        Booking.booking_date == booking_date,
        Booking.status       == 'approved',
        Booking.start_time   <  end_time,
        Booking.end_time     >  start_time,
    )
    if exclude_id:
        q = q.filter(Booking.booking_id != exclude_id)
    return q.first() is not None


def _has_faculty_pending_conflict(room_id, booking_date, start_time, end_time, exclude_id=None):
    """
    Returns True if there's a PENDING faculty (priority_access=True) booking that conflicts.
    Faculty pending requests lock the slot for everyone else.
    """
    q = Booking.query.filter(
        Booking.room_id        == room_id,
        Booking.booking_date   == booking_date,
        Booking.status         == 'pending',
        Booking.priority_access == True,
        Booking.start_time     <  end_time,
        Booking.end_time       >  start_time,
    )
    if exclude_id:
        q = q.filter(Booking.booking_id != exclude_id)
    return q.first() is not None


def _has_pending_conflict(room_id, booking_date, start_time, end_time, exclude_id=None):
    """
    Returns (has_conflict: bool, conflict_booking or None).
    Used to warn the user that there are already pending requests.
    """
    q = Booking.query.filter(
        Booking.room_id      == room_id,
        Booking.booking_date == booking_date,
        Booking.status.in_(['pending', 'approved']),
        Booking.start_time   <  end_time,
        Booking.end_time     >  start_time,
    )
    if exclude_id:
        q = q.filter(Booking.booking_id != exclude_id)
    return q.first()


# ── POST /api/bookings ────────────────────────────────────────────────────────
@bookings_bp.route('/api/bookings', methods=['POST'])
@role_required('student', 'faculty')
def submit_booking():
    with booking_lock:
        data    = request.get_json(silent=True) or {}
        user_id = int(get_jwt_identity())
        claims  = get_jwt()
        role    = claims.get('role')

        room_id      = data.get('room_id')
        date_str     = (data.get('booking_date') or '').strip()
        start_str    = (data.get('start_time')   or '').strip()
        end_str      = (data.get('end_time')     or '').strip()
        purpose      = (data.get('purpose')      or '').strip()

        # ── Validation ────────────────────────────────────────────────────────────
        errors = []
        if not room_id or not isinstance(room_id, int):
            errors.append('room_id is required and must be an integer.')

        booking_date = _parse_date(date_str)
        if not booking_date:
            errors.append('booking_date must be YYYY-MM-DD.')
        elif booking_date < datetime.now(timezone.utc).date():
            errors.append('booking_date must not be in the past.')

        start_time = _parse_time(start_str)
        end_time   = _parse_time(end_str)
        if not start_time:
            errors.append('start_time must be HH:MM.')
        if not end_time:
            errors.append('end_time must be HH:MM.')
        if start_time and end_time:
            diff = (datetime.combine(date.today(), end_time) -
                    datetime.combine(date.today(), start_time)).total_seconds()
            if diff < 1800:
                errors.append('end_time must be at least 30 minutes after start_time.')

        if not purpose or len(purpose) < 10 or len(purpose) > 500:
            errors.append('purpose must be between 10 and 500 characters.')

        if errors:
            return jsonify({'error': ' | '.join(errors)}), 400

        # ── Room existence check ──────────────────────────────────────────────────
        room = Room.query.filter_by(room_id=room_id, is_active=True).first()
        if not room:
            return jsonify({'error': 'Room not found or is inactive.'}), 404

        # ── Approved conflict check (hard block) ──────────────────────────────────
        if _has_approved_conflict(room_id, booking_date, start_time, end_time):
            return jsonify({
                'error': (
                    f'Room {room.room_number} is already booked (approved) for this time period. '
                    f'Please choose a different time or room.'
                )
            }), 409

        # ── Faculty priority lock: if a faculty request is pending, block everyone ─
        if _has_faculty_pending_conflict(room_id, booking_date, start_time, end_time):
            return jsonify({
                'error': (
                    f'Room {room.room_number} has a pending faculty priority request for this '
                    f'time period and is temporarily unavailable. '
                    f'Please check back after the admin has reviewed the faculty request.'
                )
            }), 409

        # ── Sheet conflict check (external timetable) ─────────────────────────────
        day_name = WEEKDAY_NAMES.get(booking_date.weekday())
        if day_name:
            sheet_blocked = get_sheet_blocked_rooms(booking_date, start_time, end_time)
            if room.room_number in sheet_blocked:
                return jsonify({
                    'error': (
                        f'{room.room_number} is occupied in the university timetable '
                        f'during {start_str}–{end_str}. '
                        f'Please choose a time window that fits within a single free slot.'
                    )
                }), 409

        # ── Check for existing pending requests from the same user ────────────────
        existing_own = Booking.query.filter(
            Booking.user_id      == user_id,
            Booking.room_id      == room_id,
            Booking.booking_date == booking_date,
            Booking.status       == 'pending',
            Booking.start_time   <  end_time,
            Booking.end_time     >  start_time,
        ).first()
        if existing_own:
            return jsonify({
                'error': 'You already have a pending request for this room and time.'
            }), 409

        # ── Handle Overlapping Pending Requests (Priority Logic) ───────────────────
        if role == 'faculty':
            # Faculty bumps any PENDING student requests
            conflicting_student_pending = Booking.query.filter(
                Booking.room_id      == room_id,
                Booking.booking_date == booking_date,
                Booking.status       == 'pending',
                Booking.start_time   <  end_time,
                Booking.end_time     >  start_time,
                Booking.priority_access == False # Student requests
            ).all()
            for csp in conflicting_student_pending:
                csp.status = 'rejected'
                csp.admin_remarks = 'Automatically rejected: A faculty member has requested this slot with priority access.'
                csp.updated_at = datetime.now(timezone.utc)
            if conflicting_student_pending:
                db.session.flush() # Stage the rejections

        elif role == 'student':
            # Students are blocked by ANY existing pending request (hard block)
            conflict = Booking.query.filter(
                Booking.room_id      == room_id,
                Booking.booking_date == booking_date,
                Booking.status       == 'pending',
                Booking.start_time   <  end_time,
                Booking.end_time     >  start_time,
                Booking.user_id      != user_id,
            ).first()
            if conflict:
                return jsonify({
                    'error': 'This room already has a pending request for this time. Please wait for admin approval or choose another time.'
                }), 409

        # ── Create booking (slot is locked as PENDING) ────────────────────────────
        booking = Booking(
            user_id        = user_id,
            room_id        = room_id,
            booking_date   = booking_date,
            start_time     = start_time,
            end_time       = end_time,
            purpose        = purpose,
            status         = 'pending',
            priority_access= (role == 'faculty'),
        )
        try:
            db.session.add(booking)
            db.session.commit()
        except Exception:
            db.session.rollback()
            return jsonify({'error': 'This time slot was just taken. Please choose another.'}), 409

        response = {
            'message':    'Booking request submitted successfully.',
            'booking_id': booking.booking_id,
            'status':     booking.status
        }
        return jsonify(response), 201


# ── GET /api/bookings/mine ────────────────────────────────────────────────────
@bookings_bp.route('/api/bookings/mine', methods=['GET'])
@role_required('student', 'faculty')
def my_bookings():
    user_id  = int(get_jwt_identity())
    bookings = (Booking.query
                .filter_by(user_id=user_id)
                .order_by(Booking.created_at.desc())
                .all())
    return jsonify([b.to_dict(include_room=True) for b in bookings]), 200


# ── DELETE /api/bookings/<id> ─────────────────────────────────────────────────
@bookings_bp.route('/api/bookings/<int:booking_id>', methods=['DELETE'])
@role_required('student', 'faculty')
def cancel_booking(booking_id):
    user_id = int(get_jwt_identity())
    booking = Booking.query.filter_by(
        booking_id=booking_id, user_id=user_id
    ).first()

    if not booking:
        return jsonify({'error': 'Booking not found or does not belong to you.'}), 404

    if booking.status not in ('pending', 'approved'):
        return jsonify({
            'error': f'Cannot cancel a booking with status "{booking.status}".'
        }), 400

    booking.status     = 'cancelled'
    booking.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({'message': 'Booking cancelled successfully.'}), 200
