from datetime import datetime, timezone
from extensions import db


class User(db.Model):
    __tablename__ = 'users'

    user_id       = db.Column(db.Integer, primary_key=True, autoincrement=True)
    full_name     = db.Column(db.String(100), nullable=False)
    email         = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role          = db.Column(db.String(20),  nullable=False)   # student | faculty | admin
    created_at    = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    bookings = db.relationship('Booking', backref='user', lazy=True)

    def to_dict(self):
        return {
            'user_id':    self.user_id,
            'full_name':  self.full_name,
            'email':      self.email,
            'role':       self.role,
            'created_at': self.created_at.isoformat()
        }


class Room(db.Model):
    __tablename__ = 'rooms'

    room_id     = db.Column(db.Integer, primary_key=True, autoincrement=True)
    room_number = db.Column(db.String(20),  nullable=False, unique=True)
    room_type   = db.Column(db.String(30),  nullable=False)   # lecture_hall | lab | seminar_room | conference_room
    capacity    = db.Column(db.Integer,     nullable=False)
    location    = db.Column(db.String(200), nullable=True)
    is_active   = db.Column(db.Boolean, default=True, nullable=False)
    created_at  = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    bookings = db.relationship('Booking', backref='room', lazy=True)

    def to_dict(self):
        return {
            'room_id':     self.room_id,
            'room_number': self.room_number,
            'room_type':   self.room_type,
            'capacity':    self.capacity,
            'location':    self.location or '',
            'is_active':   self.is_active,
            'created_at':  self.created_at.isoformat()
        }


class Booking(db.Model):
    __tablename__ = 'bookings'
    __table_args__ = (
        # DB-level double-booking guard (last line of defence vs race conditions)
        db.UniqueConstraint('room_id', 'booking_date', 'start_time',
                            name='uq_room_date_start'),
    )

    booking_id     = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id        = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    room_id        = db.Column(db.Integer, db.ForeignKey('rooms.room_id'), nullable=False)
    booking_date   = db.Column(db.Date,    nullable=False)
    start_time     = db.Column(db.Time,    nullable=False)
    end_time       = db.Column(db.Time,    nullable=False)
    purpose        = db.Column(db.Text,    nullable=False)
    status         = db.Column(db.String(20), nullable=False, default='pending')
    # pending | approved | rejected | cancelled | completed
    admin_remarks  = db.Column(db.Text,    nullable=True)
    priority_access= db.Column(db.Boolean, default=False, nullable=False)
    created_at     = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at     = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                               onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self, include_user=False, include_room=False):
        data = {
            'booking_id':      self.booking_id,
            'user_id':         self.user_id,
            'room_id':         self.room_id,
            'booking_date':    self.booking_date.isoformat(),
            'start_time':      self.start_time.strftime('%H:%M'),
            'end_time':        self.end_time.strftime('%H:%M'),
            'purpose':         self.purpose,
            'status':          self.status,
            'admin_remarks':   self.admin_remarks,
            'priority_access': self.priority_access,
            'created_at':      self.created_at.isoformat(),
            'updated_at':      self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_user and self.user:
            data['user'] = {
                'user_id':   self.user.user_id,
                'full_name': self.user.full_name,
                'email':     self.user.email,
                'role':      self.user.role
            }
        if include_room and self.room:
            data['room'] = {
                'room_id':     self.room.room_id,
                'room_number': self.room.room_number,
                'room_type':   self.room.room_type,
                'capacity':    self.room.capacity,
                'location':    self.room.location or ''
            }
        return data
