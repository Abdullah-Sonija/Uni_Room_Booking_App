import { useEffect, useState, useMemo } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';

// ── Mini bar (pure CSS, no external chart lib) ────────────────────────────────
function Bar({ pct, color = 'bg-navy' }) {
  return (
    <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.max(pct, 0)}%` }}
      />
    </div>
  );
}

function StatBadge({ label, value, color }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {label}: {value}
    </span>
  );
}

const DAY_COLORS = [
  'bg-navy', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500',
];
const HOUR_COLOR = 'bg-jade';

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminRoomUtilizationPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [sortBy,  setSortBy]  = useState('total'); // total | approved | pending | room_number

  useEffect(() => {
    api.get('/admin/utilization')
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load utilization data.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = [...data.rooms];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.room_number.toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      if (sortBy === 'room_number') return a.room_number.localeCompare(b.room_number);
      return b[sortBy] - a[sortBy];
    });
    return rows;
  }, [data, search, sortBy]);

  const maxTotal = useMemo(() => Math.max(...(data?.rooms || []).map(r => r.total), 1), [data]);
  const maxDay   = useMemo(() => Math.max(...(data?.day_breakdown  || []).map(d => d.count), 1), [data]);
  const maxHour  = useMemo(() => Math.max(...(data?.hour_breakdown || []).map(h => h.count), 1), [data]);

  return (
    <Layout>
      <div className="mb-6 animate-fade-up">
        <h1 className="page-title">Room Utilization</h1>
        <p className="text-slate-500 text-sm mt-1 font-body">
          Analytics on booking frequency, occupancy trends, and usage patterns
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-body">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-white animate-pulse shadow-card" />
          ))}
        </div>
      ) : data && (
        <>
          {/* ── KPI summary cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-up">
            {[
              { label: 'Total Bookings',  value: data.total_bookings,       color: 'bg-navy/10 text-navy' },
              { label: 'Active Rooms',    value: data.rooms.length,          color: 'bg-jade/10 text-jade' },
              { label: 'Most Used',       value: data.rooms[0]?.room_number || '—', color: 'bg-gold/10 text-amber-700', small: true },
              { label: 'Least Used',      value: data.rooms[data.rooms.length-1]?.room_number || '—', color: 'bg-slate-100 text-slate-600', small: true },
            ].map(({ label, value, color, small }) => (
              <div key={label} className={`card flex items-center gap-3 ${color}`}>
                <div>
                  <p className={`font-display font-bold ${small ? 'text-base' : 'text-2xl'} truncate`}>{value}</p>
                  <p className="text-xs font-body opacity-70 mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* ── Bookings by Day ──────────────────────────────────────────── */}
            <div className="card animate-fade-up" style={{ animationDelay: '0.05s' }}>
              <h2 className="font-display font-semibold text-navy text-base mb-4">Bookings by Day</h2>
              <div className="space-y-3">
                {data.day_breakdown.map((d, i) => (
                  <div key={d.day} className="flex items-center gap-3">
                    <span className="text-xs font-body text-slate-500 w-20 flex-shrink-0">{d.day}</span>
                    <Bar pct={(d.count / maxDay) * 100} color={DAY_COLORS[i] || 'bg-navy'} />
                    <span className="text-xs font-display font-semibold text-navy w-6 text-right">{d.count}</span>
                  </div>
                ))}
                {data.day_breakdown.every(d => d.count === 0) && (
                  <p className="text-slate-400 text-xs font-body text-center py-4">No bookings yet</p>
                )}
              </div>
            </div>

            {/* ── Bookings by Hour ─────────────────────────────────────────── */}
            <div className="card animate-fade-up" style={{ animationDelay: '0.08s' }}>
              <h2 className="font-display font-semibold text-navy text-base mb-4">Bookings by Start Hour</h2>
              {data.hour_breakdown.length === 0 ? (
                <p className="text-slate-400 text-xs font-body text-center py-8">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {data.hour_breakdown.map(h => (
                    <div key={h.hour} className="flex items-center gap-3">
                      <span className="text-xs font-body text-slate-500 w-12 flex-shrink-0">{h.hour}</span>
                      <Bar pct={(h.count / maxHour) * 100} color={HOUR_COLOR} />
                      <span className="text-xs font-display font-semibold text-navy w-6 text-right">{h.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Top 5 Rooms ───────────────────────────────────────────────── */}
            <div className="card animate-fade-up" style={{ animationDelay: '0.1s' }}>
              <h2 className="font-display font-semibold text-navy text-base mb-4">Top 5 Most Used</h2>
              <div className="space-y-3">
                {data.rooms.slice(0, 5).map((r, i) => (
                  <div key={r.room_id} className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                      ${i === 0 ? 'bg-gold text-navy' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                      {i + 1}
                    </span>
                    <span className="text-xs font-body text-navy truncate flex-1" title={r.room_number}>{r.room_number}</span>
                    <span className="text-xs font-display font-semibold text-navy">{r.total}</span>
                  </div>
                ))}
                {data.rooms.length === 0 && (
                  <p className="text-slate-400 text-xs font-body text-center py-4">No bookings yet</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Full room table ───────────────────────────────────────────── */}
          <div className="card animate-fade-up" style={{ animationDelay: '0.12s' }}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
              <h2 className="font-display font-semibold text-navy text-base flex-1">All Rooms</h2>
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search room…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input-field pl-8 py-1.5 text-sm w-48"
                />
              </div>
              {/* Sort */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="input-field py-1.5 text-sm w-44"
              >
                <option value="total">Sort: Most Used</option>
                <option value="approved">Sort: Approved</option>
                <option value="pending">Sort: Pending</option>
                <option value="room_number">Sort: Name A→Z</option>
              </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 pr-4 font-display font-semibold text-slate-500 text-xs uppercase tracking-wide">Room</th>
                    <th className="text-left py-2 pr-4 font-display font-semibold text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Type</th>
                    <th className="text-left py-2 pr-4 font-display font-semibold text-slate-500 text-xs uppercase tracking-wide hidden md:table-cell">Capacity</th>
                    <th className="text-right py-2 pr-4 font-display font-semibold text-slate-500 text-xs uppercase tracking-wide">Total</th>
                    <th className="text-right py-2 pr-4 font-display font-semibold text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Approved</th>
                    <th className="text-right py-2 pr-4 font-display font-semibold text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Pending</th>
                    <th className="text-left py-2 font-display font-semibold text-slate-500 text-xs uppercase tracking-wide">Usage</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 text-sm font-body">
                        {search ? 'No rooms match your search.' : 'No data available.'}
                      </td>
                    </tr>
                  ) : filtered.map((r, i) => (
                    <tr key={r.room_id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                      <td className="py-3 pr-4">
                        <p className="font-display font-semibold text-navy text-xs leading-snug">{r.room_number}</p>
                        {r.location && <p className="text-xs text-slate-400 font-body truncate max-w-xs">{r.location}</p>}
                      </td>
                      <td className="py-3 pr-4 hidden sm:table-cell">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold
                          ${r.room_type === 'lab' ? 'bg-violet-100 text-violet-700' : 'bg-navy/10 text-navy'}`}>
                          {r.room_type.charAt(0).toUpperCase() + r.room_type.slice(1)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-500 font-body hidden md:table-cell">{r.capacity}</td>
                      <td className="py-3 pr-4 text-right font-display font-bold text-navy">{r.total}</td>
                      <td className="py-3 pr-4 text-right hidden sm:table-cell">
                        <StatBadge label="✓" value={r.approved} color="bg-jade/10 text-jade" />
                      </td>
                      <td className="py-3 pr-4 text-right hidden sm:table-cell">
                        <StatBadge label="⏳" value={r.pending} color="bg-amber-100 text-amber-700" />
                      </td>
                      <td className="py-3 min-w-32">
                        <div className="flex items-center gap-2">
                          <Bar pct={(r.total / maxTotal) * 100} color={r.total === 0 ? 'bg-slate-200' : 'bg-navy'} />
                          <span className="text-xs text-slate-400 font-body w-9 text-right">{r.usage_pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-400 font-body mt-4 text-right">
              Showing {filtered.length} of {data.rooms.length} rooms
            </p>
          </div>
        </>
      )}
    </Layout>
  );
}
