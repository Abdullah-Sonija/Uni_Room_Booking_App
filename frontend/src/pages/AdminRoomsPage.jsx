import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';

const TYPES = ['classroom', 'lab'];
const typeLabel = t => t.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

const EMPTY = { room_number:'', room_type:'', capacity:'', location:'', is_active: true };

function RoomModal({ initial, onSave, onClose, loading }) {
  const isEdit = !!initial?.room_id;
  const [form, setForm] = useState(initial || EMPTY);
  const [errors, setErrors] = useState({});

  const handle = e => { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setErrors(er => ({ ...er, [e.target.name]: '' })); };

  const validate = () => {
    const e = {};
    if (!form.room_number.trim()) e.room_number = 'Room number is required.';
    if (!TYPES.includes(form.room_type)) e.room_type = 'Select a valid room type.';
    const cap = parseInt(form.capacity);
    if (!cap || cap < 1 || cap > 500) e.capacity = 'Capacity must be 1–500.';
    return e;
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave({ ...form, capacity: parseInt(form.capacity) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-hover p-6 w-full max-w-md mx-4 animate-fade-up">
        <h3 className="font-display font-bold text-navy text-lg mb-5">{isEdit ? 'Edit Room' : 'Add New Room'}</h3>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Room Number</label>
            <input name="room_number" placeholder="e.g. A101" value={form.room_number} onChange={handle}
                   className={`input-field ${errors.room_number ? 'border-coral ring-1 ring-coral' : ''}`} />
            {errors.room_number && <p className="error-text">{errors.room_number}</p>}
          </div>
          <div>
            <label className="label">Room Type</label>
            <select name="room_type" value={form.room_type} onChange={handle}
                    className={`input-field ${errors.room_type ? 'border-coral ring-1 ring-coral' : ''}`}>
              <option value="">Select type...</option>
              {TYPES.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </select>
            {errors.room_type && <p className="error-text">{errors.room_type}</p>}
          </div>
          <div>
            <label className="label">Capacity</label>
            <input name="capacity" type="number" min="1" max="500" placeholder="e.g. 30"
                   value={form.capacity} onChange={handle}
                   className={`input-field ${errors.capacity ? 'border-coral ring-1 ring-coral' : ''}`} />
            {errors.capacity && <p className="error-text">{errors.capacity}</p>}
          </div>
          <div>
            <label className="label">Location <span className="text-slate-400 font-normal">(optional)</span></label>
            <input name="location" placeholder="e.g. Block A, Floor 1" value={form.location} onChange={handle} className="input-field" />
          </div>
          {isEdit && (
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={form.is_active}
                       onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                       className="sr-only peer" />
                <div className="w-10 h-5 bg-slate-200 peer-checked:bg-jade rounded-full transition-colors peer-focus:ring-2 peer-focus:ring-jade/30 after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:w-4 after:h-4 after:transition-transform peer-checked:after:translate-x-5" />
              </label>
              <span className="text-sm font-body text-slate-600">Room is active</span>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
              {isEdit ? 'Save Changes' : 'Add Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminRoomsPage() {
  const [rooms,   setRooms]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null); // null | 'add' | room object
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');
  const [search,  setSearch]  = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = () => {
    setLoading(true);
    api.get('/rooms').then(r => setRooms(r.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (modal?.room_id) {
        const { data: updated } = await api.put(`/admin/rooms/${modal.room_id}`, data);
        setRooms(rs => rs.map(r => r.room_id === modal.room_id ? updated.room : r));
        showToast('Room updated.');
      } else {
        await api.post('/admin/rooms', data);
        load();
        showToast('Room added.');
      }
      setModal(null);
    } catch (err) {
      showToast(err.response?.data?.error || 'Save failed.');
    } finally { setSaving(false); }
  };

  const deactivate = async (room) => {
    if (!window.confirm(`Deactivate ${room.room_number}? It will be hidden from searches.`)) return;
    try {
      await api.delete(`/admin/rooms/${room.room_id}`);
      setRooms(rs => rs.map(r => r.room_id === room.room_id ? { ...r, is_active: false } : r));
      showToast('Room deactivated.');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed.');
    }
  };

  const filtered = rooms.filter(r =>
    r.room_number.toLowerCase().includes(search.toLowerCase()) ||
    r.room_type.toLowerCase().includes(search.toLowerCase()) ||
    (r.location || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      {toast && <div className="fixed top-5 right-5 z-50 bg-navy text-white px-5 py-3 rounded-xl shadow-hover font-body text-sm animate-fade-in">{toast}</div>}
      {modal !== null && (
        <RoomModal
          initial={modal === 'add' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
          loading={saving}
        />
      )}

      <div className="mb-6 animate-fade-up flex items-center justify-between">
        <div>
          <h1 className="page-title">Room Management</h1>
          <p className="text-slate-500 text-sm mt-1 font-body">{rooms.filter(r=>r.is_active).length} active rooms</p>
        </div>
        <button onClick={() => setModal('add')} className="btn-gold flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Add Room
        </button>
      </div>

      {/* Search */}
      <div className="card mb-4 animate-fade-up p-4" style={{ animationDelay: '0.05s' }}>
        <div className="relative">
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="text" placeholder="Search by room number, type, or location..."
                 value={search} onChange={e => setSearch(e.target.value)}
                 className="input-field pl-9" />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden animate-fade-up" style={{ animationDelay: '0.1s' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy/5 border-b border-slate-200">
                {['Room No.','Type','Capacity','Location','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-display font-semibold text-navy text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_,i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {[...Array(6)].map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400 font-body">No rooms found</td></tr>
              ) : filtered.map(r => (
                <tr key={r.room_id} className={`border-b border-slate-100 hover:bg-slate2 transition-colors ${!r.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-display font-bold text-navy">{r.room_number}</td>
                  <td className="px-4 py-3 text-slate-600 font-body">{typeLabel(r.room_type)}</td>
                  <td className="px-4 py-3 text-slate-600 font-body">{r.capacity}</td>
                  <td className="px-4 py-3 text-slate-500 font-body text-xs">{r.location || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={r.is_active ? 'badge-approved' : 'badge-cancelled'}>
                      <span className={`w-1.5 h-1.5 rounded-full ${r.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {r.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setModal(r)}
                              className="px-3 py-1 rounded-lg bg-navy/5 hover:bg-navy hover:text-white text-navy text-xs font-display font-semibold transition-all duration-150">
                        Edit
                      </button>
                      {r.is_active && (
                        <button onClick={() => deactivate(r)}
                                className="px-3 py-1 rounded-lg bg-red-50 hover:bg-coral hover:text-white text-coral text-xs font-display font-semibold transition-all duration-150">
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
