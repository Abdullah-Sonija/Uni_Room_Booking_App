import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

function KPICard({ label, value, sub, color, icon }) {
  return (
    <div className="card flex items-center gap-4 animate-fade-up">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-navy">{value}</p>
        <p className="text-sm font-body text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, isFaculty } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api.get('/bookings/mine')
       .then(r => setBookings(r.data))
       .catch(() => {})
       .finally(() => setLoading(false));
  }, []);

  const pending   = bookings.filter(b => b.status === 'pending').length;
  const approved  = bookings.filter(b => b.status === 'approved').length;
  const total     = bookings.length;

  const upcoming = bookings
    .filter(b => b.status === 'approved' && new Date(b.booking_date) >= new Date())
    .sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date))
    .slice(0, 5);

  return (
    <Layout>
      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title text-3xl">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
              <span className="text-gold">{user?.full_name?.split(' ')[0]}</span> 👋
            </h1>
            <p className="text-slate-500 text-sm mt-1 font-body">
              {new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
              {isFaculty && <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">⭐ Faculty Priority Access</span>}
            </p>
          </div>
          <button onClick={() => navigate('/rooms')} className="btn-gold flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Book a Room
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KPICard label="Total Bookings"    value={total}    color="bg-navy/10 text-navy"      icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        <KPICard label="Pending Approval"  value={pending}  color="bg-amber-100 text-amber-700" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        <KPICard label="Approved Bookings" value={approved} color="bg-jade/10 text-jade-dark"  icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming */}
        <div className="card animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg text-navy">Upcoming Reservations</h2>
            <button onClick={() => navigate('/my-bookings')} className="text-sm text-navy/60 hover:text-gold font-display font-medium transition-colors">
              View all →
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full bg-slate2 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <p className="text-slate-400 text-sm font-body">No upcoming reservations</p>
              <button onClick={() => navigate('/rooms')} className="mt-3 text-sm text-navy font-display font-semibold hover:text-gold transition-colors">
                Book a room now →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map(b => (
                <div key={b.booking_id} className="flex items-center gap-3 p-3 rounded-xl bg-slate2 hover:bg-slate2-dark transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-navy flex items-center justify-center flex-shrink-0">
                    <span className="text-gold font-display font-bold text-xs">{b.room?.room_number?.slice(0,3) || '—'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-sm text-navy truncate">{b.room?.room_number} — {b.room?.room_type?.replace('_',' ')}</p>
                    <p className="text-xs text-slate-500 font-body">{b.booking_date}  ·  {b.start_time}–{b.end_time}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="font-display font-semibold text-lg text-navy mb-4">Recent Activity</h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-400 text-sm font-body">No booking history yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bookings.slice(0, 6).map(b => (
                <div key={b.booking_id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate2 transition-colors">
                  <div>
                    <p className="text-sm font-display font-medium text-navy">{b.room?.room_number || `Room #${b.room_id}`}</p>
                    <p className="text-xs text-slate-400 font-body">{b.booking_date} · {b.start_time}–{b.end_time}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
