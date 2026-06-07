# URBS Backend — Setup & Run Guide

## Prerequisites
- Python 3.9+

## 1. Install dependencies
```bash
pip install -r requirements.txt
```

## 2. Run the server
```bash
python app.py
```
Server starts at: **http://localhost:5000**

## 3. Default credentials (auto-seeded on first run)
| Role    | Email              | Password   |
|---------|--------------------|------------|
| Admin   | admin@urbs.edu     | Admin1234  |

Register new Student/Faculty accounts via `POST /api/auth/register`

## 4. API Base URL
All endpoints are prefixed with `/api/`

## 5. Authentication
All protected endpoints require:
```
Authorization: Bearer <JWT_TOKEN>
```
Get the token from `POST /api/auth/login`

## 6. Endpoints Quick Reference
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | No | Register user |
| POST | /api/auth/login | No | Login, get JWT |
| GET | /api/rooms | Yes | List all rooms |
| GET | /api/rooms/available | Yes | Search available rooms |
| POST | /api/admin/rooms | Admin | Add room |
| PUT | /api/admin/rooms/:id | Admin | Edit room |
| DELETE | /api/admin/rooms/:id | Admin | Deactivate room |
| POST | /api/bookings | Student/Faculty | Submit booking |
| GET | /api/bookings/mine | Student/Faculty | My bookings |
| DELETE | /api/bookings/:id | Student/Faculty | Cancel booking |
| GET | /api/admin/bookings | Admin | Pending queue |
| GET | /api/admin/bookings/all | Admin | All bookings |
| PUT | /api/admin/bookings/:id/approve | Admin | Approve booking |
| PUT | /api/admin/bookings/:id/reject | Admin | Reject booking |
| GET | /api/admin/dashboard | Admin | KPI dashboard |
| GET | /api/health | No | Health check |

## 7. Google Sheets Integration
Room availability is automatically merged with live data from:
```
https://docs.google.com/spreadsheets/d/1sivXTIf9JvaqP2k6B7-468SyZXTcOAvKyyVW4HJRxeQ/export?format=xlsx
```
- Empty cell in sheet = room is free from that source
- URBS DB bookings always take precedence
- Expired slots (past end_time) are auto-released to COMPLETED on each availability query
