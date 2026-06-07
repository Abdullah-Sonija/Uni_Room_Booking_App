import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

// ── Helpers ────────────────────────────────────────────────────────────────────
function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number);
  const total  = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
}

function formatDuration(totalMins) {
  if (totalMins < 60) return `${totalMins} min`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Given a list of free slots and a start slot index + num_slots, check if all consecutive slots are free
function getConsecutiveFreeSlots(freeSlots, startSlotNum, numSlots) {
  // sort free slots by slot number
  const sorted = [...freeSlots].sort((a, b) => a.slot - b.slot);
  const startIdx = sorted.findIndex(s => s.slot === startSlotNum);
  if (startIdx === -1) return null;   // start slot not free

  const window = [];
  for (let i = 0; i < numSlots; i++) {
    const s = sorted[startIdx + i];
    if (!s) return null;             // not enough free slots
    // Must be consecutive (no gap)
    if (i > 0 && s.slot !== sorted[startIdx + i - 1].slot + 1) return null;
    window.push(s);
  }
  return window;  // array of slot objects covering the window
}

// ── Sub-components ────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, highlight }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-navy/5 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-navy/50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon}/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-body">{label}</p>
        <p className={`text-sm font-display font-semibold ${highlight ? 'text-jade' : 'text-navy'}`}>{value || '—'}</p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BookingFormPage() {
  const { state }  = useLocation();
  const navigate   = useNavigate();
  const { user }   = useAuth();

  const room          = state?.room;
  const bookingMeta   = state?.booking || {};
  const slotSchedule  = bookingMeta.slot_schedule || [];  // [{slot, start, end}]
  const freeSlots     = room?.free_slots || [];
  const today         = new Date().toISOString().split('T')[0];
  const isFaculty     = user?.role === 'faculty';

  const [form, setForm] = useState({
    booking_date: bookingMeta.date   || today,
    start_slot:   '',       // slot number chosen by user
    num_slots:    bookingMeta.num_slots ? String(bookingMeta.num_slots) : '1',
    purpose:      '',
    start_time_manual: '',
  });
  const [errors,  setErrors]  = useState({});
  const [apiErr,  setApiErr]  = useState('');
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Derive computed values from the chosen start_slot + num_slots
  const selectedSlotObj = useMemo(
    () => freeSlots.find(s => s.slot === Number(form.start_slot)),
    [freeSlots, form.start_slot]
  );

  const consecutiveWindow = useMemo(() => {
    if (!form.start_slot) return null;
    return getConsecutiveFreeSlots(freeSlots, Number(form.start_slot), Number(form.num_slots));
  }, [freeSlots, form.start_slot, form.num_slots]);

  const startTime = selectedSlotObj?.start || bookingMeta.start_time || form.start_time_manual || '';
  const endTime   = consecutiveWindow
    ? consecutiveWindow[consecutiveWindow.length - 1].end
    : (startTime ? addMinutes(startTime, Number(form.num_slots) * 50) : '');
  const totalMins = Number(form.num_slots) * 50;

  // Max slots user can book starting from the chosen slot (consecutive free)
  const maxSlotsFromStart = useMemo(() => {
    if (!form.start_slot) return 6;
    const sorted = [...freeSlots].sort((a, b) => a.slot - b.slot);
    const startIdx = sorted.findIndex(s => s.slot === Number(form.start_slot));
    if (startIdx === -1) return 1;
    let count = 0;
    for (let i = startIdx; i < sorted.length; i++) {
      if (i > startIdx && sorted[i].slot !== sorted[i - 1].slot + 1) break;
      count++;
    }
    return count;
  }, [freeSlots, form.start_slot]);

  if (!room) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="font-display font-semibold text-navy text-lg">No room selected.</p>
          <button onClick={() => navigate('/rooms')} className="btn-primary mt-4">Browse Rooms</button>
        </div>
      </Layout>
    );
  }

  const handle = (e) => {
    const { name, value } = e.target;
    setForm(f => {
      const next = { ...f, [name]: value };
      // Reset num_slots if start_slot changes and current num_slots exceeds new max
      if (name === 'start_slot') next.num_slots = '1';
      return next;
    });
    setErrors(er => ({ ...er, [name]: '' }));
    setApiErr('');
  };

  const validate = () => {
    const e = {};
    if (!form.booking_date) e.booking_date = 'Date is required.';
    else if (form.booking_date < today) e.booking_date = 'Date must not be in the past.';

    if (freeSlots.length > 0 && !form.start_slot)
      e.start_slot = 'Please select a starting slot.';

    if (form.start_slot && !consecutiveWindow)
      e.start_slot = `Only ${maxSlotsFromStart} consecutive free slot${maxSlotsFromStart > 1 ? 's' : ''} available from this start. Reduce number of slots.`;

    if (freeSlots.length === 0 && !form.start_time_manual)
      e.start_time_manual = 'Please enter a start time.';

    if (!form.purpose.trim() || form.purpose.trim().length < 10)
      e.purpose = 'Purpose must be at least 10 characters.';
    if (form.purpose.trim().length > 500)
      e.purpose = 'Purpose must not exceed 500 characters.';
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    setApiErr('');
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/bookings', {
        room_id:      room.room_id,
        booking_date: form.booking_date,
        start_time:   startTime,
        end_time:     endTime,
        purpose:      form.purpose.trim(),
      });
      if (data.warning) setWarning(data.warning);
      setSuccess(true);
    } catch (err) {
      setApiErr(err.response?.data?.error || 'Booking failed. Please try again.');
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-20 text-center animate-fade-up">
          <div className="w-20 h-20 rounded-full bg-jade/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-jade" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h2 className="font-display font-bold text-2xl text-navy mb-2">Request Submitted!</h2>
          <p className="text-slate-500 font-body mb-2">
            <strong className="text-navy">{room.room_number}</strong> on{' '}
            <strong className="text-navy">{formatDate(form.booking_date)}</strong>
            <br />{startTime}–{endTime} · {form.num_slots} slot{Number(form.num_slots) > 1 ? 's' : ''} · {formatDuration(totalMins)}
          </p>
          <p className="text-xs text-slate-400 font-body">Pending admin approval</p>
          {warning && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-body flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
              {warning}
            </div>
          )}
          {isFaculty && (
            <p className="text-sm text-blue-600 bg-blue-50 rounded-xl px-4 py-2 mb-4 mt-3 font-body">
              ⭐ Faculty priority flag applied to this request.
            </p>
          )}
          <div className="flex gap-3 justify-center mt-6">
            <button onClick={() => navigate('/my-bookings')} className="btn-primary">View My Bookings</button>
            <button onClick={() => navigate('/rooms')} className="btn-outline">Book Another</button>
          </div>
        </div>
      </Layout>
    );
  }

  const typeLabel = room.room_type.charAt(0).toUpperCase() + room.room_type.slice(1);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 animate-fade-up">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-navy font-display font-medium mb-3 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Back to Search
          </button>
          <h1 className="page-title">Book a Room</h1>
          <p className="text-slate-500 text-sm mt-1 font-body">Select a slot from the available windows below</p>
        </div>

        {/* Room summary */}
        <div className="card mb-4 border-l-4 border-navy animate-fade-up" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center flex-shrink-0">
              <span className="text-gold font-display font-bold text-sm">{room.room_number.slice(0,3)}</span>
            </div>
            <div>
              <p className="font-display font-bold text-navy text-lg">{room.room_number}</p>
              <p className="text-sm text-slate-500 font-body">{typeLabel} · {room.capacity} seats{room.location ? ` · ${room.location}` : ''}</p>
            </div>
            <span className="ml-auto badge-free"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Available</span>
          </div>
        </div>

        {/* Faculty notice */}
        {isFaculty && (
          <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-body flex items-center gap-2 animate-fade-up">
            ⭐ <strong>Faculty Priority Access</strong> — your request is flagged for elevated review.
          </div>
        )}

        {/* Booking summary panel (shown when start_slot chosen) */}
        {form.start_slot && (
          <div className="card mb-4 bg-navy/2 animate-fade-in" style={{ animationDelay: '0.08s' }}>
            <p className="text-xs font-display font-semibold text-slate-400 uppercase tracking-wide mb-1">Booking Summary</p>
            <div className="divide-y divide-slate-100">
              <InfoRow icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" label="Day & Date" value={`${bookingMeta.day || '—'}, ${formatDate(form.booking_date)}`} />
              <InfoRow icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" label="Start Time" value={startTime} />
              <InfoRow icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" label="Slots" value={`${form.num_slots} slot${Number(form.num_slots) > 1 ? 's' : ''}`} />
              <InfoRow icon="M13 10V3L4 14h7v7l9-11h-7z" label="Duration" value={formatDuration(totalMins)} />
              <InfoRow icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" label="End Time" value={endTime} highlight />
            </div>
          </div>
        )}

        {apiErr && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-body animate-fade-in">
            {apiErr}
          </div>
        )}

        <div className="card animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <form onSubmit={submit} className="space-y-5">

            {/* Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Date</label>
                <input type="date" name="booking_date" min={today} value={form.booking_date} onChange={handle}
                  className={`input-field ${errors.booking_date ? 'border-coral ring-1 ring-coral' : ''}`} />
                {errors.booking_date && <p className="error-text">{errors.booking_date}</p>}
              </div>
              {bookingMeta.day && (
                <div>
                  <label className="label">Day</label>
                  <div className="input-field flex items-center text-sm font-body text-navy/70">{bookingMeta.day}</div>
                </div>
              )}
            </div>

            {/* Slot picker: only show the room's free slots */}
            {freeSlots.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Starting Slot</label>
                  <select name="start_slot" value={form.start_slot} onChange={handle}
                    className={`input-field ${errors.start_slot ? 'border-coral ring-1 ring-coral' : ''}`}>
                    <option value="">Select a free slot…</option>
                    {freeSlots.sort((a,b) => a.slot - b.slot).map(s => (
                      <option key={s.slot} value={s.slot}>
                        Slot {s.slot} — {s.start}–{s.end}
                      </option>
                    ))}
                  </select>
                  {errors.start_slot && <p className="error-text">{errors.start_slot}</p>}
                </div>

                <div>
                  <label className="label">
                    Number of Slots
                    {form.start_slot && <span className="text-slate-400 font-normal ml-1">(max {maxSlotsFromStart} consecutive free)</span>}
                  </label>
                  <select name="num_slots" value={form.num_slots} onChange={handle} className="input-field">
                    {Array.from({ length: maxSlotsFromStart }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n} slot{n > 1 ? 's' : ''} ({formatDuration(n * 50)})</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              /* Fallback: no free-slot data (e.g. weekend / sheet not loaded) */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Time</label>
                  <input type="time" name="start_time_manual" value={form.start_time_manual} onChange={handle}
                    className={`input-field ${errors.start_time_manual ? 'border-coral ring-1 ring-coral' : ''}`} />
                  {errors.start_time_manual && <p className="error-text">{errors.start_time_manual}</p>}
                </div>
                <div>
                  <label className="label">Number of Slots</label>
                  <select name="num_slots" value={form.num_slots} onChange={handle} className="input-field">
                    {[1,2,3,4,5,6].map(n => (
                      <option key={n} value={n}>{n} slot{n > 1 ? 's' : ''} ({formatDuration(n * 50)})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Purpose */}
            <div>
              <label className="label">Purpose</label>
              <textarea name="purpose" rows={4}
                placeholder="Describe the purpose of this booking (e.g. Group study session for Database Systems finals...)"
                value={form.purpose} onChange={handle}
                className={`input-field resize-none ${errors.purpose ? 'border-coral ring-1 ring-coral' : ''}`} />
              <div className="flex justify-between items-center mt-1">
                {errors.purpose
                  ? <p className="error-text">{errors.purpose}</p>
                  : <p className="text-xs text-slate-400 font-body">Min 10 characters</p>}
                <p className={`text-xs font-body ${form.purpose.length > 450 ? 'text-amber-500' : 'text-slate-400'}`}>
                  {form.purpose.length}/500
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading} className="btn-gold flex-1 flex items-center justify-center gap-2 py-3">
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Submitting…
                  </>
                ) : 'Submit Booking Request'}
              </button>
              <button type="button" onClick={() => navigate('/rooms')} className="btn-outline px-5">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
