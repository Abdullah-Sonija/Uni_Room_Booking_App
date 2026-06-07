import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import api from '../api/axios';

const FILTERS = ['all','pending','approved','rejected','cancelled','completed'];

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [filter,   setFilter]   = useState('all');
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.get('/admin/bookings/all')
       .then(r => setBookings(r.data))
       .catch(() => {})
       .finally(() => setLoading(false));
  }, []);

  const visible = bookings
    .filter(b => filter === 'all' || b.status === filter)
    .filter(b => {
      const q = search.toLowerCase();
      return !q ||
        b.user?.full_name?.toLowerCase().includes(q) ||
        b.room?.room_number?.toLowerCase().includes(q) ||
        b.purpose?.toLowerCase().includes(q);
    });

  return (
    <Layout>
      <div className="mb-6 animate-fade-up">
        <h1 className="page-title">All Bookings</h1>
        <p className="text-slate-500 text-sm mt-1 font-body">{bookings.length} total bookings across all users</p>
      </div>

      {/* Filters */}
      <div className="card mb-4 p-4 animate-fade-up" style={{ animationDelay: '0.05s' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" placeholder="Search by user, room, or purpose..."
                   value={search} onChange={e => setSearch(e.target.value)}
                   className="input-field pl-9" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 rounded-full text-xs font-display font-semibold capitalize transition-all ${
                        filter === f ? 'bg-navy text-white' : 'bg-white text-slate-500 hover:bg-navy/5 shadow-card'
                      }`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden animate-fade-up" style={{ animationDelay: '0.1s' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy/5 border-b border-slate-200">
                {['#','Room','Requester','Date','Time','Purpose','Status','Priority'].map(h => (
                  <th key={h} className="px-3 py-3 text-left font-display font-semibold text-navy text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_,i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {[...Array(8)].map((_,j) => <td key={j} className="px-3 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : visible.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400 font-body">No bookings match your filters</td></tr>
              ) : visible.map((b, i) => (
                <tr key={b.booking_id} className="border-b border-slate-100 hover:bg-slate2 transition-colors">
                  <td className="px-3 py-3 text-slate-400 font-mono text-xs">#{b.booking_id}</td>
                  <td className="px-3 py-3 font-display font-bold text-navy text-xs">{b.room?.room_number || `#${b.room_id}`}</td>
                  <td className="px-3 py-3">
                    <p className="font-display font-medium text-navy text-xs">{b.user?.full_name || '—'}</p>
                    <p className="text-slate-400 font-body capitalize" style={{fontSize:'10px'}}>{b.user?.role}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-600 font-body text-xs">{b.booking_date}</td>
                  <td className="px-3 py-3 text-slate-600 font-body text-xs whitespace-nowrap">{b.start_time}–{b.end_time}</td>
                  <td className="px-3 py-3 text-slate-500 font-body text-xs max-w-[160px] truncate" title={b.purpose}>{b.purpose}</td>
                  <td className="px-3 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-3 py-3">
                    {b.priority_access
                      ? <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">⭐</span>
                      : <span className="text-slate-300 text-xs">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length > 0 && (
          <div className="px-4 py-3 bg-slate2 border-t border-slate-200 text-xs text-slate-400 font-body">
            Showing {visible.length} of {bookings.length} bookings
          </div>
        )}
      </div>
    </Layout>
  );
}
