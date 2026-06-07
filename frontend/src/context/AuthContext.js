import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

/**
 * Storage strategy:
 * - We use sessionStorage for the token so that each browser tab has its own
 * isolated session. This fixes the cross-role bug where logging in as Faculty
 * in one tab would overwrite the Student token in another tab (both tabs shared
 * the same localStorage key).
 *
 * - We still persist user profile info in sessionStorage so that page refreshes
 * within the same tab don't log the user out.
 *
 * - If you want "remember me" across tab restores, the token is also backed up in
 * localStorage but only read on first mount if sessionStorage is empty.
 */
function readUser() {
  try {
    const ssUser = sessionStorage.getItem('urbs_user');
    return ssUser ? JSON.parse(ssUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);

  const login = useCallback((userData, token) => {
    sessionStorage.setItem('urbs_token', token);
    sessionStorage.setItem('urbs_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('urbs_token');
    sessionStorage.removeItem('urbs_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}