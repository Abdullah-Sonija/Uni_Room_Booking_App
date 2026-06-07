import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/axios';

// ── Constants ────────────────────────────────────────────────────────────────
const ROOM_TYPES = ['classroom', 'lab'];
const DAYS = [
  { label: 'Mon', value: 'Monday' },
  { label: 'Tue', value: 'Tuesday' },
  { label: 'Wed', value: 'Wednesday' },
  { label: 'Thu', value: 'Thursday' },
  { label: 'Fri', value: 'Friday' },
];
const SLOT_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getTodayDayName() {
  const d = new Date().getDay(); // 0=Sun,1=Mon…5=Fri,6=Sat
  const names = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const name  = names[d];
  return DAYS.find(x => x.value === name)?.value || 'Monday';
}

function getDateForDay(dayLabel) {
  const targets = { Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5 };
  const target  = targets[dayLabel];
  const today   = new Date();
  const todayDay = today.getDay();
  let diff = target - todayDay;
  if (diff < 0) diff += 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number);
  const total  = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
}

function normalizeQuery(q) {
  return q.toLowerCase().replace(/[\s\-_]/g, '');
}

function roomMatchesName(roomNumber, query) {
  if (!query) return true;
  return normalizeQuery(roomNumber).includes(normalizeQuery(query));
}

function slotDuration(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const typeIcon = {
  classroom: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  lab:       'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
};

// ── Sub-components ────────────────────────────────────────────────────────────
function FreeSlotPills({ slots, highlightStart, numSlots }) {
  if (!slots || slots.length === 0)
    return <p className="text-xs text-slate-400 font-body italic mt-1">No free slots this day</p>;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {slots.map(s => {
        const isHighlighted = highlightStart && s.start === highlightStart;
        return (
          <span key={s.slot}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-body font-medium border transition-all
              ${isHighlighted
                ? 'bg-jade text-white border-jade shadow'
                : 'bg-jade/10 text-jade border-jade/20'}`}
            title={`Slot ${s.slot}: ${s.start}–${s.end} (${slotDuration(s.start, s.end)})`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isHighlighted ? 'bg-white' : 'bg-jade'}`} />
            {s.start}–{s.end}
            <span className={`ml-0.5 ${isHighlighted ? 'text-white/70' : 'text-jade/60'}`}>
              ({slotDuration(s.start, s.end)})
            </span>
          </span>
        );
      })}
    </div>
  );
}

function RoomCard({ room, startTime, numSlots, onBook }) {
  const [showSlots, setShowSlots] = useState(false);
  const typeLabel = room.room_type.charAt(0).toUpperCase() + room.room_type.slice(1);

  return (
    <div className="card flex flex-col gap-3 hover:shadow-hover transition-shadow">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-navy/50" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={typeIcon[room.room_type] || typeIcon.classroom} />
          </svg>
        </div>
        {room.faculty_locked ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200">
            ⭐ Faculty Priority
          </span>
        ) : (
          <span className="badge-free flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-jade" />
            Available
          </span>
        )}
      </div>

      <div>
        <h3 className="font-display font-bold text-base text-navy leading-snug">{room.room_number}</h3>
        <p className="text-xs text-slate-400 font-body">{typeLabel}</p>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-400 font-body">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          {room.capacity} seats
        </span>
        {room.location && (
          <span className="flex items-center gap-1 truncate">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            </svg>
            <span className="truncate">{room.location}</span>
          </span>
        )}
      </div>

      <div>
        <button
          onClick={() => setShowSlots(v => !v)}
          className="flex items-center gap-1.5 text-xs text-navy/60 hover:text-navy font-body transition-colors"
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${showSlots ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
          {room.free_slots?.length || 0} free slot{room.free_slots?.length !== 1 ? 's' : ''} this day
        </button>
        {showSlots && <FreeSlotPills slots={room.free_slots} highlightStart={startTime} numSlots={numSlots} />}
      </div>

      <button onClick={() => onBook(room)} className="mt-auto w-full py-2 rounded-xl text-sm font-display font-semibold bg-navy text-white hover:bg-gold hover:text-navy active:scale-95 transition-all duration-150">
        Book Now →
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RoomSearchPage() {
  const navigate   = useNavigate();
  const todayName  = getTodayDayName();
  const debounceRef = useRef(null);

  const [selectedDay, setSelectedDay] = useState(todayName);
  const [slotSchedule, setSlotSchedule] = useState([]); // [{slot,start,end}]
  const [filters, setFilters] = useState({
    start_time:   '',
    num_slots:    '1',
    slot_filter:  '',    // specific slot number to filter by
    room_type:    '',
    min_capacity: '',
    name_query:   '',
  });
  const [rooms,    setRooms]    = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Compute end_time from start_time + num_slots * 50min
  const computedEndTime = useMemo(() => {
    if (!filters.start_time || !filters.num_slots) return '';
    return addMinutes(filters.start_time, Number(filters.num_slots) * 50);
  }, [filters.start_time, filters.num_slots]);

  // Load slot schedule whenever day changes
  useEffect(() => {
    api.get('/rooms/slots', { params: { day: selectedDay.toUpperCase() } })
      .then(r => setSlotSchedule(r.data))
      .catch(() => setSlotSchedule([]));
  }, [selectedDay]);

  // Auto-search with debounce whenever any filter or day changes
  const doSearch = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const date   = getDateForDay(selectedDay);
      const params = { date };

      if (filters.start_time && computedEndTime) {
        params.start_time = filters.start_time;
        params.end_time   = computedEndTime;
      }
      if (filters.room_type)    params.room_type    = filters.room_type;
      if (filters.min_capacity) params.min_capacity = filters.min_capacity;
      if (filters.slot_filter) {
        params.slot      = filters.slot_filter;
        params.num_slots = filters.num_slots;  // consecutive slot count
      }

      const { data } = await api.get('/rooms/available', { params });
      setRooms(data.rooms || data);       // handle both response shapes
      setSearched(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed.');
    } finally {
      setLoading(false);
    }
  }, [selectedDay, filters, computedEndTime]);

  // Debounced auto-search on any dependency change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(doSearch, 350);
    return () => clearTimeout(debounceRef.current);
  }, [doSearch]);

  const handle = (e) => setFilters(f => ({ ...f, [e.target.name]: e.target.value }));

  // Client-side name filter
  const displayed = useMemo(() => {
    if (!filters.name_query.trim()) return rooms;
    return rooms.filter(r => roomMatchesName(r.room_number, filters.name_query));
  }, [rooms, filters.name_query]);

  const handleBook = (room) => {
    navigate('/book', {
      state: {
        room,
        booking: {
          day:        selectedDay,
          date:       getDateForDay(selectedDay),
          start_time: filters.start_time,
          end_time:   computedEndTime,
          num_slots:  Number(filters.num_slots),
          slot_schedule: slotSchedule,
        },
      },
    });
  };

  return (
    <Layout>
      <div className="mb-6 animate-fade-up">
        <h1 className="page-title">Browse Rooms</h1>
        <p className="text-slate-500 text-sm mt-1 font-body">Results update automatically — only fully-available rooms are shown</p>
      </div>

      <div className="card mb-6 animate-fade-up" style={{ animationDelay: '0.05s' }}>
        <div className="space-y-4">

          {/* Day pills */}
          <div>
            <label className="label mb-2">Day</label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map(d => (
                <button key={d.value} type="button" onClick={() => setSelectedDay(d.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-display font-semibold border transition-all duration-150
                    ${selectedDay === d.value
                      ? 'bg-navy text-white border-navy shadow-card'
                      : 'bg-white text-navy/60 border-slate-200 hover:border-navy hover:text-navy'}`}>
                  {d.label}
                  {d.value === todayName && selectedDay !== d.value &&
                    <span className="ml-1 text-xs opacity-60">(today)</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Time row: start + num slots → shows computed end */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="label">Start Time <span className="text-slate-400 font-normal">(optional)</span></label>
              <input type="time" name="start_time" value={filters.start_time} onChange={handle} className="input-field" />
            </div>
            <div>
              <label className="label">No. of Slots</label>
              <select name="num_slots" value={filters.num_slots} onChange={handle} className="input-field">
                {SLOT_COUNT_OPTIONS.map(n => (
                  <option key={n} value={n}>{n} slot{n > 1 ? 's' : ''} ({n * 50} min)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-slate-400">End Time (auto)</label>
              <div className={`input-field flex items-center text-sm font-body
                ${computedEndTime ? 'text-jade font-semibold' : 'text-slate-300'}`}>
                {computedEndTime || '—'}
              </div>
            </div>
            {/* Slot filter */}
            <div>
              <label className="label">Filter by Slot</label>
              <select name="slot_filter" value={filters.slot_filter} onChange={handle} className="input-field">
                <option value="">Any slot</option>
                {slotSchedule.map(s => (
                  <option key={s.slot} value={s.slot}>
                    Slot {s.slot} ({s.start}–{s.end})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Type + capacity + name row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Room Type</label>
              <select name="room_type" value={filters.room_type} onChange={handle} className="input-field">
                <option value="">All types</option>
                {ROOM_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Min Capacity</label>
              <input type="number" name="min_capacity" min="1" max="500" placeholder="e.g. 30"
                     value={filters.min_capacity} onChange={handle} className="input-field" />
            </div>
            <div>
              <label className="label">Search by Name</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input type="text" name="name_query"
                       placeholder='"a1", "A-1", "LAB-3"…'
                       value={filters.name_query} onChange={handle} className="input-field pl-9" />
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            {loading ? (
              <span className="flex items-center gap-2 text-sm text-slate-400 font-body">
                <svg className="animate-spin w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Searching...
              </span>
            ) : searched ? (
              <span className="text-sm font-body text-slate-500">
                <span className="font-display font-semibold text-jade">{displayed.length}</span>
                {' '}room{displayed.length !== 1 ? 's' : ''} available on <strong>{selectedDay}</strong>
                {computedEndTime && filters.start_time && <span className="text-slate-400"> · {filters.start_time}–{computedEndTime}</span>}
                {filters.name_query && rooms.length !== displayed.length &&
                  <span className="text-slate-400"> · filtered to {displayed.length} of {rooms.length}</span>}
              </span>
            ) : (
              <span className="text-sm text-slate-400 font-body">Loading…</span>
            )}
            {error && <p className="text-xs text-coral font-body">{error}</p>}
          </div>
        </div>
      </div>

      {/* Empty states */}
      {searched && !loading && displayed.length === 0 && (
        <div className="text-center py-20 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-navy/5 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-navy/20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
          </div>
          <p className="font-display font-semibold text-navy/40 text-lg">No rooms found</p>
          <p className="text-slate-400 text-sm font-body mt-1">
            {filters.name_query ? 'Try a different name query or clear the name filter.' : 'All rooms are occupied for this window — try a different time or day.'}
          </p>
        </div>
      )}

      {/* Results grid */}
      {displayed.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayed.map((room, i) => (
            <div key={room.room_id} className="animate-fade-up" style={{ animationDelay: `${i * 0.03}s` }}>
              <RoomCard room={room} startTime={filters.start_time} numSlots={filters.num_slots} onBook={handleBook} />
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
