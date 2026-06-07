import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

import LoginPage          from './pages/LoginPage';
import RegisterPage       from './pages/RegisterPage';
import DashboardPage      from './pages/DashboardPage';
import RoomSearchPage     from './pages/RoomSearchPage';
import BookingFormPage    from './pages/BookingFormPage';
import BookingHistoryPage from './pages/BookingHistoryPage';
import AdminDashboardPage          from './pages/AdminDashboardPage';
import AdminApprovalsPage          from './pages/AdminApprovalsPage';
import AdminRoomsPage              from './pages/AdminRoomsPage';
import AdminBookingsPage           from './pages/AdminBookingsPage';
import AdminRoomUtilizationPage    from './pages/AdminRoomUtilizationPage';

function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center p-8 card max-w-sm">
        <p className="text-6xl mb-4">🚫</p>
        <h1 className="font-display font-bold text-2xl text-navy mb-2">Access Denied</h1>
        <p className="text-slate-500 font-body mb-6 text-sm">You don't have permission to view this page. Your role may be restricted.</p>
        <div className="flex flex-col gap-3">
          <a href="/dashboard" className="btn-primary">Go to Dashboard</a>
          <a href="/login" className="text-sm text-navy/60 font-medium hover:text-navy transition-colors">Switch Account</a>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center p-8 card max-w-sm">
        <p className="text-6xl mb-4">🛸</p>
        <h1 className="font-display font-bold text-2xl text-navy mb-2">404 - Not Found</h1>
        <p className="text-slate-500 font-body mb-6 text-sm">The page you're looking for has drifted into deep space.</p>
        <a href="/" className="btn-primary inline-block">Return Home</a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"        element={<LoginPage />} />
          <Route path="/register"     element={<RegisterPage />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route path="/dashboard" element={<PrivateRoute roles={['student','faculty']}><DashboardPage /></PrivateRoute>} />
          <Route path="/rooms"     element={<PrivateRoute roles={['student','faculty']}><RoomSearchPage /></PrivateRoute>} />
          <Route path="/book"      element={<PrivateRoute roles={['student','faculty']}><BookingFormPage /></PrivateRoute>} />
          <Route path="/my-bookings" element={<PrivateRoute roles={['student','faculty']}><BookingHistoryPage /></PrivateRoute>} />

          <Route path="/admin"               element={<PrivateRoute roles={['admin']}><AdminDashboardPage /></PrivateRoute>} />
          <Route path="/admin/approvals"     element={<PrivateRoute roles={['admin']}><AdminApprovalsPage /></PrivateRoute>} />
          <Route path="/admin/rooms"         element={<PrivateRoute roles={['admin']}><AdminRoomsPage /></PrivateRoute>} />
          <Route path="/admin/bookings"      element={<PrivateRoute roles={['admin']}><AdminBookingsPage /></PrivateRoute>} />
          <Route path="/admin/utilization"   element={<PrivateRoute roles={['admin']}><AdminRoomUtilizationPage /></PrivateRoute>} />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
