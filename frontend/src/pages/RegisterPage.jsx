import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';

const ROLES = ['student', 'faculty'];

// Field defined OUTSIDE component so React never unmounts/remounts it on re-render
function Field({ name, label, type = 'text', placeholder, value, onChange, error }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className={`input-field ${error ? 'border-coral ring-1 ring-coral' : ''}`}
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={type === 'password' ? 'new-password' : 'off'}
      />
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form,    setForm]    = useState({ full_name: '', email: '', password: '', confirm: '', role: '' });
  const [errors,  setErrors]  = useState({});
  const [apiErr,  setApiErr]  = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => {
    const { name, value } = e.target;
    setForm(f  => ({ ...f,  [name]: value }));
    setErrors(er => ({ ...er, [name]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.full_name.trim() || form.full_name.trim().length < 2)
      e.full_name = 'Full name must be at least 2 characters.';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Enter a valid email address.';
    if (form.password.length < 8)
      e.password = 'Password must be at least 8 characters.';
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
      e.password = 'Password must contain a letter and a digit.';
    if (form.password !== form.confirm)
      e.confirm = 'Passwords do not match.';
    if (!form.role)
      e.role = 'Please select a role.';
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    setApiErr('');
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await api.post('/auth/register', {
        full_name: form.full_name,
        email:     form.email,
        password:  form.password,
        role:      form.role,
      });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setApiErr(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate2">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-navy flex-col justify-center p-12">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center shadow-glow">
            <svg className="w-6 h-6 text-navy" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
            </svg>
          </div>
          <span className="font-display font-bold text-white text-xl">URBS</span>
        </div>
        <h2 className="font-display font-bold text-3xl text-white mb-3">Join URBS today</h2>
        <p className="text-white/50 text-sm font-body leading-relaxed max-w-xs">
          Create your account to start booking university rooms in seconds.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-up">
          <h2 className="font-display font-bold text-3xl text-navy mb-1">Create Account</h2>
          <p className="text-slate-500 text-sm font-body mb-8">Fill in the details below to get started</p>

          {apiErr && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {apiErr}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <Field name="full_name" label="Full Name"          placeholder="Muhammad Ali Khan"              value={form.full_name} onChange={handle} error={errors.full_name} />
            <Field name="email"     label="University Email"   placeholder="ali@university.edu" type="email" value={form.email}     onChange={handle} error={errors.email}     />
            <Field name="password"  label="Password"           placeholder="Min 8 chars, 1 letter + 1 digit" type="password" value={form.password} onChange={handle} error={errors.password} />
            <Field name="confirm"   label="Confirm Password"   placeholder="Repeat your password"            type="password" value={form.confirm}  onChange={handle} error={errors.confirm}  />

            <div>
              <label className="label">Role</label>
              <select
                name="role"
                value={form.role}
                onChange={handle}
                className={`input-field ${errors.role ? 'border-coral ring-1 ring-coral' : ''}`}
              >
                <option value="">Select your role...</option>
                {ROLES.map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
              {errors.role && <p className="error-text">{errors.role}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-gold w-full text-base py-3 mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Creating account...
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 font-body">
            Already have an account?{' '}
            <Link to="/login" className="text-navy font-display font-semibold hover:text-gold transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
