import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import api from '../api/axios';

function RejectModal({ onConfirm, onCancel, loading }) {
  const [remarks, setRemarks] = useState('');
  const [err, setErr]         = useState('');

  const submit = () => {
    if (!remarks.trim() || remarks.trim().length < 10) {
      setErr('Remarks must be at least 10 characters.'); return;
    }
    onConfirm(remarks.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-hover p-6 w-full max-w-md mx-4 animate-fade-up">
        <h3 className="font-display font-bold text-navy text-lg mb-1">Reject Booking</h3>
        <p className="text-slate-500 text-sm font-body mb-4">
          Provide a reason for rejection. This will be shown to the requester.
        </p>
        <label className="label">Rejection Remarks <span className="text-coral">*</span></label>
        <textarea rows={4} value={remarks} onChange={e => { setRemarks(e.target.value); setErr(''); }}
                  placeholder="e.g. Room is reserved for faculty meeting during this slot..."
                  className={`input-field resize-none ${err ? 'border-coral ring-1 ring-coral' : ''}`} />
        <div className="flex justify-between items-center mt-1 mb-4">
          {err ? <p className="error-text">{err}</p> : <span />}
          <p className={`text-xs font-body ${remarks.length > 450 ? 'text-amber-500' : 'text-slate-400'}`}>{remarks.length}/500</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading} className="btn-outline flex-1">Cancel</button>
          <button onClick={submit}   disabled={loading} className="btn-danger flex-1 flex items-center justify-center gap-2">
            {loading && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

function ApproveConfirmModal({ message, conflictCount, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-hover p-6 w-full max-w-md mx-4 animate-fade-up">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
          </div>
          <h3 className="font-display font-bold text-navy text-lg">Confirm Approval</h3>
        </div>
        <p className="text-slate-600 text-sm font-body mb-5 leading-relaxed">{message}</p>
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-body mb-5">
          ⚠️ {conflictCount} conflicting pending request{conflictCount !== 1 ? 's' : ''} will be automatically <strong>rejected</strong>.
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading} className="btn-outline flex-1">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-jade text-white text-sm font-display font-semibold hover:bg-jade-dark active:scale-95 transition-all duration-150 disabled:opacity-50">
            {loading && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
            Approve &amp; Reject Conflicts
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminApprovalsPage() {
  const [bookings,       setBookings]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [rejectId,       setRejectId]       = useState(null);
  const [actioning,      setActioning]      = useState(null);
  const [toast,          setToast]          = useState({ msg: '', type: '' });
  const [confirmApprove, setConfirmApprove] = useState(null); // { id, message, conflictCount }

  const load = () => {
    setLoading(true);
    api.get('/admin/bookings?status=pending')
       .then(r => setBookings(r.data))
       .catch(() => {})
       .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg:'', type:'' }), 3500);
  };

  /**
   * Two-phase approval:
   * Phase 1 — call API without confirmed flag; if backend says requires_confirmation,
   *            show the confirmation modal.
   * Phase 2 — user confirms; call API again with confirmed=true to proceed.
   */
  const approve = async (id, confirmed = false) => {
    setActioning(id);
    try {
      const { data } = await api.put(`/admin/bookings/${id}/approve`, { confirmed });

      if (data.requires_confirmation) {
        // Show confirmation dialog
        setConfirmApprove({
          id,
          message:       data.message,
          conflictCount: data.conflict_count,
        });
        setActioning(null);
        return;
      }

      // Approval went through (no conflicts, or confirmed)
      setConfirmApprove(null);
      setBookings(bs => bs.filter(b => b.booking_id !== id));
      const extra = data.auto_rejected_count
        ? ` (${data.auto_rejected_count} conflicting request${data.auto_rejected_count !== 1 ? 's' : ''} auto-rejected)`
        : '';
      showToast(`Booking approved.${extra}`);
    } catch (err) {
      setConfirmApprove(null);
      showToast(err.response?.data?.error || 'Approval failed.', 'error');
    } finally {
      setActioning(null);
    }
  };

  const reject = async (id, remarks) => {
    setActioning(id);
    try {
      await api.put(`/admin/bookings/${id}/reject`, { admin_remarks: remarks });
      setBookings(bs => bs.filter(b => b.booking_id !== id));
      setRejectId(null);
      showToast('Booking rejected.');
    } catch (err) {
      showToast(err.response?.data?.error || 'Rejection failed.', 'error');
    } finally { setActioning(null); }
  };

  return (
    <Layout>
      {toast.msg && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-hover font-body text-sm animate-fade-in text-white ${toast.type === 'error' ? 'bg-coral' : 'bg-navy'}`}>
          {toast.msg}
        </div>
      )}
      {rejectId && (
        <RejectModal
          onConfirm={(r) => reject(rejectId, r)}
          onCancel={() => setRejectId(null)}
          loading={actioning === rejectId}
        />
      )}
      {confirmApprove && (
        <ApproveConfirmModal
          message={confirmApprove.message}
          conflictCount={confirmApprove.conflictCount}
          onConfirm={() => approve(confirmApprove.id, true)}
          onCancel={() => { setConfirmApprove(null); setActioning(null); }}
          loading={actioning === confirmApprove.id}
        />
      )}

      <div className="mb-6 animate-fade-up">
        <h1 className="page-title">Approval Queue</h1>
        <p className="text-slate-500 text-sm mt-1 font-body">
          {bookings.length} pending request{bookings.length !== 1 ? 's' : ''} awaiting review
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_,i) => <div key={i} className="h-32 rounded-2xl bg-white animate-pulse shadow-card" />)}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-20 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-jade/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-jade" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <p className="font-display font-semibold text-navy text-lg">All caught up!</p>
          <p className="text-slate-400 text-sm font-body mt-1">No pending requests right now</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b, i) => {
            const typeLabel = b.room?.room_type?.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) || '—';
            const isActioning = actioning === b.booking_id;
            return (
              <div key={b.booking_id}
                   className="card animate-fade-up border-l-4 border-amber-400"
                   style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-gold font-display font-bold text-xs">
                      {b.room?.room_number?.slice(0,3) || '#'}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-display font-bold text-navy">{b.room?.room_number}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-sm text-slate-500 font-body">{typeLabel}</span>
                      {b.priority_access && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                          ⭐ Faculty Priority
                        </span>
                      )}
                      <StatusBadge status={b.status} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-500 font-body mb-2">
                      <span>📅 {b.booking_date}</span>
                      <span>🕐 {b.start_time} – {b.end_time}</span>
                      <span>👤 {b.user?.full_name} ({b.user?.role})</span>
                    </div>

                    <p className="text-sm text-slate-600 font-body bg-slate2 rounded-lg px-3 py-2">
                      <strong className="text-navy font-display">Purpose:</strong> {b.purpose}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => approve(b.booking_id)}
                      disabled={isActioning}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-jade text-white text-sm font-display font-semibold hover:bg-jade-dark active:scale-95 transition-all duration-150 disabled:opacity-50">
                      {isActioning
                        ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      }
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectId(b.booking_id)}
                      disabled={isActioning}
                      className="btn-danger flex items-center justify-center gap-1.5 text-sm px-4 py-2 disabled:opacity-50">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
