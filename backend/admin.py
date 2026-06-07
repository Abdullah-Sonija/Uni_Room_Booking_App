"""
admin.py  —  /api/admin/*  (all routes require role=admin)

GET  /api/admin/bookings              → pending queue (filter ?status=pending)
GET  /api/admin/bookings/all          → all bookings across all users
PUT  /api/admin/bookings/<id>/approve → approve a pending booking (auto-rejects conflicts)
PUT  /api/admin/bookings/<id>/reject  → reject a pending booking with remarks
GET  /api/admin/dashboard             → KPI summary
GET  /api/admin/utilization           → room utilization statistics
"""
from datetime import datetime, date, timezone
from calendar import monthrange
from flask import Blueprint, request, jsonify
from extensions import db
from models import Booking, Room, User
from decorators import role_required

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


# ── GET /api/admin/bookings ────────────────────────────────────────────────────
@admin_bp.route('/bookings', methods=['GET'])
@role_required('admin')
def list_bookings():
    """
    Returns bookings filtered by ?status=  (default: pending).
    Pass status=all to get every booking.
    """
    status_filter = request.args.get('status', 'pending').lower()

    q = Booking.query.order_by(
        Booking.priority_access.desc(),   # faculty priority first
        Booking.created_at.asc()
    )
    if status_filter != 'all':
        q = q.filter_by(status=status_filter)

    bookings = q.all()
    return jsonify([b.to_dict(include_user=True, include_room=True) for b in bookings]), 200


# ── GET /api/admin/bookings/all ────────────────────────────────────────────────
@admin_bp.route('/bookings/all', methods=['GET'])
@role_required('admin')
def all_bookings():
    bookings = (Booking.query
                .order_by(Booking.created_at.desc())
                .all())
    return jsonify([b.to_dict(include_user=True, include_room=True) for b in bookings]), 200


# ── PUT /api/admin/bookings/<id>/approve ──────────────────────────────────────
@admin_bp.route('/bookings/<int:booking_id>/approve', methods=['PUT'])
@role_required('admin')
def approve_booking(booking_id):
    booking = db.get_or_404(Booking, booking_id)

    if booking.status != 'pending':
        return jsonify({
            'error': f'Only pending bookings can be approved (current: {booking.status}).'
        }), 400

    # Re-run conflict check to guard against a race where another booking
    # was approved for the same slot while this one was pending
    already_approved = (Booking.query
                .filter(
                    Booking.room_id      == booking.room_id,
                    Booking.booking_date == booking.booking_date,
                    Booking.status       == 'approved',
                    Booking.start_time   <  booking.end_time,
                    Booking.end_time     >  booking.start_time,
                    Booking.booking_id   != booking.booking_id,
                ).first())
    if already_approved:
        return jsonify({
            'error': (
                'Cannot approve: another booking was just approved '
                f'for the same slot (Booking #{already_approved.booking_id}).'
            )
        }), 409

    # ── Check if request body asks for confirmation ───────────────────────────
    data = request.get_json(silent=True) or {}
    confirmed = data.get('confirmed', False)

    # Find all conflicting PENDING bookings (excluding the one being approved)
    conflicting_pending = Booking.query.filter(
        Booking.room_id      == booking.room_id,
        Booking.booking_date == booking.booking_date,
        Booking.status       == 'pending',
        Booking.start_time   <  booking.end_time,
        Booking.end_time     >  booking.start_time,
        Booking.booking_id   != booking.booking_id,
    ).all()

    if conflicting_pending and not confirmed:
        # Return a confirmation prompt to the frontend
        return jsonify({
            'requires_confirmation': True,
            'conflict_count': len(conflicting_pending),
            'message': (
                f'Approving this request will automatically reject '
                f'{len(conflicting_pending)} other pending request(s) for the same room '
                f'and time period. Do you want to proceed?'
            ),
        }), 200

    # ── Approve the selected booking ──────────────────────────────────────────
    booking.status     = 'approved'
    booking.updated_at = datetime.now(timezone.utc)

    # ── Auto-reject all conflicting pending bookings ──────────────────────────
    auto_rejected_count = 0
    for conflict in conflicting_pending:
        conflict.status        = 'rejected'
        conflict.admin_remarks = (
            f'Automatically rejected: Booking #{booking.booking_id} was approved '
            f'for the same room and time period.'
        )
        conflict.updated_at = datetime.now(timezone.utc)
        auto_rejected_count += 1

    db.session.commit()

    return jsonify({
        'message':            'Booking approved.',
        'booking_id':         booking.booking_id,
        'status':             booking.status,
        'auto_rejected_count': auto_rejected_count,
    }), 200


# ── PUT /api/admin/bookings/<id>/reject ───────────────────────────────────────
@admin_bp.route('/bookings/<int:booking_id>/reject', methods=['PUT'])
@role_required('admin')
def reject_booking(booking_id):
    booking = db.get_or_404(Booking, booking_id)

    if booking.status != 'pending':
        return jsonify({
            'error': f'Only pending bookings can be rejected (current: {booking.status}).'
        }), 400

    data    = request.get_json(silent=True) or {}
    remarks = (data.get('admin_remarks') or '').strip()

    if not remarks or len(remarks) < 10:
        return jsonify({
            'error': 'admin_remarks is required and must be at least 10 characters.'
        }), 400
    if len(remarks) > 500:
        return jsonify({'error': 'admin_remarks must not exceed 500 characters.'}), 400

    booking.status        = 'rejected'
    booking.admin_remarks = remarks
    booking.updated_at    = datetime.now(timezone.utc)
    db.session.commit()

    # Slot is now released — no longer counted as pending/approved in conflict queries

    return jsonify({
        'message':    'Booking rejected.',
        'booking_id': booking.booking_id,
        'status':     booking.status,
    }), 200


# ── PUT /api/admin/bookings/<id>/cancel ───────────────────────────────────────
@admin_bp.route('/bookings/<int:booking_id>/cancel', methods=['PUT'])
@role_required('admin')
def cancel_booking(booking_id):
    """Admin-only: revoke an approved booking or force-cancel a pending one."""
    booking = db.get_or_404(Booking, booking_id)

    if booking.status not in ['pending', 'approved']:
        return jsonify({
            'error': f'Only pending or approved bookings can be cancelled (current: {booking.status}).'
        }), 400

    data    = request.get_json(silent=True) or {}
    remarks = (data.get('admin_remarks') or '').strip()

    if not remarks or len(remarks) < 10:
        return jsonify({
            'error': 'admin_remarks is required (min 10 chars) to explain the administrative cancellation.'
        }), 400

    old_status = booking.status
    booking.status        = 'cancelled'
    booking.admin_remarks = f"[ADMIN CANCEL] {remarks}"
    booking.updated_at    = datetime.now(timezone.utc)
    db.session.commit()

    return jsonify({
        'message':    f'Booking {old_status} revoked/cancelled by admin.',
        'booking_id': booking.booking_id,
        'status':     booking.status,
    }), 200


# ── GET /api/admin/dashboard ───────────────────────────────────────────────────
@admin_bp.route('/dashboard', methods=['GET'])
@role_required('admin')
def dashboard():
    today = date.today()
    year, month = today.year, today.month
    month_start = date(year, month, 1)
    month_end   = date(year, month, monthrange(year, month)[1])

    total_rooms    = Room.query.filter_by(is_active=True).count()
    pending_count  = Booking.query.filter_by(status='pending').count()
    approved_month = Booking.query.filter(
        Booking.status == 'approved',
        Booking.booking_date >= month_start,
        Booking.booking_date <= month_end,
    ).count()
    total_users    = User.query.count()
    total_bookings = Booking.query.count()

    # Last 10 actions for activity feed
    recent = (Booking.query
              .order_by(Booking.updated_at.desc())
              .limit(10)
              .all())
    activity = []
    for b in recent:
        activity.append({
            'booking_id': b.booking_id,
            'action':     b.status,
            'room':       b.room.room_number if b.room else '—',
            'user':       b.user.full_name   if b.user else '—',
            'timestamp':  b.updated_at.isoformat() if b.updated_at else b.created_at.isoformat(),
        })

    return jsonify({
        'total_rooms':      total_rooms,
        'pending_count':    pending_count,
        'approved_month':   approved_month,
        'total_users':      total_users,
        'total_bookings':   total_bookings,
        'recent_activity':  activity,
    }), 200


# ── GET /api/admin/utilization ─────────────────────────────────────────────────
@admin_bp.route('/utilization', methods=['GET'])
@role_required('admin')
def room_utilization():
    """
    Returns room utilization statistics including:
    - booking counts per room (approved & pending)
    - usage percentage relative to the most-used room
    - top/least used rooms
    - booking counts by day of week
    - booking counts by slot hour
    """
    rooms    = Room.query.filter_by(is_active=True).order_by(Room.room_number).all()
    bookings = Booking.query.filter(Booking.status.in_(['approved', 'pending', 'completed'])).all()

    # ── Per-room stats ────────────────────────────────────────────────────────
    room_map = {r.room_id: r for r in rooms}

    counts       = {r.room_id: {'approved': 0, 'pending': 0, 'completed': 0, 'total': 0} for r in rooms}
    day_counts   = {}   # day_of_week (0=Mon..6=Sun) → count
    hour_counts  = {}   # start hour (0-23) → count

    for b in bookings:
        if b.room_id not in counts:
            continue
        counts[b.room_id][b.status] += 1
        counts[b.room_id]['total']  += 1

        # Day breakdown
        dow = b.booking_date.weekday()   # 0=Mon
        day_counts[dow] = day_counts.get(dow, 0) + 1

        # Slot/hour breakdown
        hr = b.start_time.hour
        hour_counts[hr] = hour_counts.get(hr, 0) + 1

    max_total = max((c['total'] for c in counts.values()), default=1) or 1

    room_stats = []
    for r in rooms:
        c    = counts[r.room_id]
        pct  = round(c['total'] / max_total * 100, 1)
        room_stats.append({
            'room_id':    r.room_id,
            'room_number': r.room_number,
            'room_type':  r.room_type,
            'capacity':   r.capacity,
            'location':   r.location or '',
            'approved':   c['approved'],
            'pending':    c['pending'],
            'completed':  c['completed'],
            'total':      c['total'],
            'usage_pct':  pct,
        })

    # Sort by total desc for top-rooms list
    room_stats_sorted = sorted(room_stats, key=lambda x: x['total'], reverse=True)

    # Day of week breakdown  (0=Mon…4=Fri)
    DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    day_breakdown = [
        {'day': DAY_NAMES[d], 'count': day_counts.get(d, 0)}
        for d in range(5)   # Mon–Fri only
    ]

    # Hour breakdown
    hour_breakdown = [
        {'hour': f'{h:02d}:00', 'count': hour_counts.get(h, 0)}
        for h in sorted(hour_counts.keys())
    ]

    return jsonify({
        'rooms':           room_stats_sorted,
        'day_breakdown':   day_breakdown,
        'hour_breakdown':  hour_breakdown,
        'total_bookings':  sum(c['total'] for c in counts.values()),
    }), 200
