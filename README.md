# Uni Room Booking App (URBS)

A comprehensive University Room Booking System designed to streamline the reservation of rooms, halls, and resources within a university campus.

## Overview

The URBS (University Room Booking System) provides a complete full-stack solution for managing room scheduling. It features a React-based frontend styled with TailwindCSS and a Python Flask backend powered by SQLAlchemy and JWT for secure authentication. 

## Tech Stack

### Frontend
- **React.js** (v18)
- **React Router** for navigation
- **Tailwind CSS** for modern, responsive styling
- **Axios** for API communication

### Backend
- **Python / Flask**
- **Flask-SQLAlchemy** for database ORM
- **Flask-JWT-Extended** & **Flask-Bcrypt** for secure user authentication
- **Pandas & OpenPyXL** for spreadsheet data handling and syncing

## Features
- **User Authentication**: Secure login and registration for students, staff, and administrators.
- **Room Search & Filtering**: Discover available rooms based on capacity, date, and time.
- **Booking Management**: Submit, view, and cancel booking requests.
- **Admin Dashboard**: Approvals workflow, utilization metrics, and overall system management.
- **Spreadsheet Sync**: Import/Export capabilities for syncing data seamlessly.

## Getting Started

### Prerequisites
- Node.js (v16+)
- Python (v3.8+)

### Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the Flask development server:
   ```bash
   flask run
   ```

### Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

## Documentation

Additional project documentation, including System Design (SRS), Architecture Diagrams, and ERDs, can be found in the `/documents` folder.
