import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate   = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) { setError('Both fields are required.'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login({ user_id: data.user_id, full_name: data.full_name, role: data.role }, data.token);
      navigate(data.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-slate2">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-navy flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center shadow-glow">
            <svg className="w-6 h-6 text-navy" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
            </svg>
          </div>
          <span className="font-display font-bold text-white text-xl">URBS</span>
        </div>

        <div>
          <h1 className="font-display font-bold text-4xl text-white leading-snug mb-4">
            University<br />Room Booking<br />
            <span className="text-gold">System</span>
          </h1>
          <p className="text-white/50 text-base font-body leading-relaxed max-w-xs">
            Reserve lecture halls, labs, and seminar rooms — no email chains, no double-bookings.
          </p>
          <div className="mt-10 space-y-3">
            {['Conflict detection', 'Admin approval workflow', 'Live room availability'].map(f => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-jade/20 flex items-center justify-center">
                  <svg className="w-3 h-3 text-jade" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
                <span className="text-white/70 text-sm font-body">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/20 text-xs font-body">FSE Course Project · 2025</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-up">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <svg className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
              </svg>
            </div>
            <span className="font-display font-bold text-navy text-lg">URBS</span>
          </div>

          <h2 className="font-display font-bold text-3xl text-navy mb-1">Welcome back</h2>
          <p className="text-slate-500 text-sm font-body mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-body flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="label">Email Address</label>
              <input className="input-field" type="email" name="email" placeholder="you@university.edu"
                     value={form.email} onChange={handle} autoComplete="email" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input-field" type="password" name="password" placeholder="Enter your password"
                     value={form.password} onChange={handle} autoComplete="current-password" />
            </div>
            <button type="submit" disabled={loading} className="btn-gold w-full text-base py-3">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 font-body">
            No account?{' '}
            <Link to="/register" className="text-navy font-display font-semibold hover:text-gold transition-colors">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
