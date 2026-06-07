import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import api from '../api/axios';

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected', 'cancelled', 'completed'];

function ConfirmModal({ onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-hover p-6 w-full max-w-sm mx-4 animate-fade-up">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-coral" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h3 className="font-display font-bold text-navy text-lg text-center mb-1">Cancel Booking?</h3>
        <p className="text-slate-500 text-sm text-center font-body mb-6">
          This will release the time slot and cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-outline flex-1" disabled={loading}>Keep It</button>
          <button onClick={onConfirm} disabled={loading}
                  className="flex-1 btn-danger flex items-center justify-center gap-2">
            {loading ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : null}
            Yes, Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BookingHistoryPage() {
  const navigate = useNavigate();
  const [bookings,    setBookings]    = useState([]);
  const [filter,      setFilter]      = useState('all');
  const [loading,     setLoading]     = useState(true);
  const [cancelId,    setCancelId]    = useState(null);
  const [cancelling,  setCancelling]  = useState(false);
  const [toast,       setToast]       = useState('');

  const load = () => {
    setLoading(true);
    api.get('/bookings/mine')
       .then(r => setBookings(r.data))
       .catch(() => {})
       .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const doCancel = async () => {
    setCancelling(true);
    try {
      await api.delete(`/bookings/${cancelId}`);
      setBookings(bs => bs.map(b => b.booking_id === cancelId ? { ...b, status: 'cancelled' } : b));
      showToast('Booking cancelled successfully.');
    } catch (err) {
      showToast(err.response?.data?.error || 'Cancel failed.');
    } finally {
      setCancelling(false);
      setCancelId(null);
    }
  };

  const visible = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);

  return (
    <Layout>
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-navy text-white px-5 py-3 rounded-xl shadow-hover font-body text-sm animate-fade-in">
          {toast}
        </div>
      )}
      {cancelId && <ConfirmModal onConfirm={doCancel} onCancel={() => setCancelId(null)} loading={cancelling} />}

      <div className="mb-6 animate-fade-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">My Bookings</h1>
            <p className="text-slate-500 text-sm mt-1 font-body">Track and manage all your room reservations</p>
          </div>
          <button onClick={() => navigate('/rooms')} className="btn-gold flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            New Booking
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap animate-fade-up" style={{ animationDelay: '0.05s' }}>
        {STATUS_FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-xs font-display font-semibold capitalize transition-all duration-150 ${
                    filter === f
                      ? 'bg-navy text-white shadow-card'
                      : 'bg-white text-slate-500 hover:bg-navy/5 hover:text-navy shadow-card'
                  }`}>
            {f} {f !== 'all' && `(${bookings.filter(b => b.status === f).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_,i) => <div key={i} className="h-20 rounded-2xl bg-white animate-pulse shadow-card" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-navy/5 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-navy/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <p className="font-display font-semibold text-navy/50 text-lg">No bookings found</p>
          <button onClick={() => navigate('/rooms')} className="btn-primary mt-4">Book a Room</button>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((b, i) => {
            const canCancel = b.status === 'pending' || b.status === 'approved';
            const typeLabel = b.room?.room_type?.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) || '—';
            return (
              <div key={b.booking_id}
                   className="card flex items-center gap-4 animate-fade-up p-4"
                   style={{ animationDelay: `${i * 0.03}s` }}>
                {/* Room avatar */}
                <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center flex-shrink-0">
                  <span className="text-gold font-display font-bold text-xs">
                    {b.room?.room_number?.slice(0,3) || `#${b.room_id}`}
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-navy text-sm">
                      {b.room?.room_number || `Room #${b.room_id}`}
                    </p>
                    <span className="text-slate-300">·</span>
                    <p className="text-xs text-slate-500 font-body">{typeLabel}</p>
                    {b.priority_access && (
                      <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">⭐ Priority</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-body mt-0.5">
                    {b.booking_date} · {b.start_time}–{b.end_time}
                  </p>
                  <p className="text-xs text-slate-400 font-body truncate mt-0.5">{b.purpose}</p>
                  {b.admin_remarks && (
                    <p className="text-xs text-red-500 font-body mt-1">
                      Remarks: {b.admin_remarks}
                    </p>
                  )}
                </div>

                {/* Status + action */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={b.status} />
                  {canCancel && (
                    <button onClick={() => setCancelId(b.booking_id)}
                            className="btn-danger text-xs px-3 py-1.5">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
