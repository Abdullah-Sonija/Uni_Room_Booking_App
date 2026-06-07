import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import api from '../api/axios';

function KPI({ label, value, color, icon }) {
  return (
    <div className="card flex items-center gap-4 animate-fade-up">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-navy">{value ?? '—'}</p>
        <p className="text-sm text-slate-500 font-body">{label}</p>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard')
       .then(r => setStats(r.data))
       .catch(() => {})
       .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="mb-8 animate-fade-up">
        <h1 className="page-title text-3xl">Admin Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1 font-body">System overview and recent activity</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? (
          [...Array(4)].map((_,i) => <div key={i} className="h-24 rounded-2xl bg-white animate-pulse shadow-card" />)
        ) : (
          <>
            <KPI label="Active Rooms"       value={stats?.total_rooms}    color="bg-navy/10 text-navy"        icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            <KPI label="Pending Requests"   value={stats?.pending_count}  color="bg-amber-100 text-amber-700"  icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            <KPI label="Approved This Month"value={stats?.approved_month} color="bg-jade/10 text-jade-dark"   icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            <KPI label="Total Users"        value={stats?.total_users}    color="bg-gold/10 text-gold-dark"   icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Review Pending',    sub: `${stats?.pending_count || 0} awaiting`,      to: '/admin/approvals',   color: 'border-amber-300 hover:bg-amber-50' },
          { label: 'Manage Rooms',      sub: `${stats?.total_rooms || 0} active rooms`,    to: '/admin/rooms',       color: 'border-navy/20 hover:bg-navy/5' },
          { label: 'All Bookings',      sub: `${stats?.total_bookings || 0} total`,        to: '/admin/bookings',    color: 'border-jade/30 hover:bg-jade/5' },
          { label: 'Room Utilization',  sub: 'Analytics & trends',                         to: '/admin/utilization', color: 'border-violet-200 hover:bg-violet-50' },
        ].map(({ label, sub, to, color }) => (
          <button key={to} onClick={() => navigate(to)}
                  className={`card border-2 text-left transition-colors duration-150 animate-fade-up ${color}`}>
            <p className="font-display font-bold text-navy">{label}</p>
            <p className="text-sm text-slate-400 font-body mt-1">{sub}</p>
          </button>
        ))}
      </div>

      {/* Activity feed */}
      <div className="card animate-fade-up" style={{ animationDelay: '0.15s' }}>
        <h2 className="font-display font-semibold text-lg text-navy mb-4">Recent Activity</h2>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_,i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : !stats?.recent_activity?.length ? (
          <p className="text-slate-400 text-sm font-body text-center py-8">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {stats.recent_activity.map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate2 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-navy/5 flex items-center justify-center flex-shrink-0">
                  <span className="font-display font-bold text-navy text-xs">{a.room?.slice(0,3)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-display font-medium text-navy truncate">
                    {a.user} — {a.room}
                  </p>
                  <p className="text-xs text-slate-400 font-body">
                    {new Date(a.timestamp).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={a.action} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
