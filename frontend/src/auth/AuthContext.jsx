import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [signedOut, setSignedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    // Remove credentials stored by the previous login implementation.
    localStorage.removeItem('userInfo');
    api.get('/auth/me', { signal: controller.signal }).then(({ data }) => {
      setUser(data);
      setSessionError('');
    }).catch(error => {
      if (controller.signal.aborted) return;
      setUser(null);
      setSessionError(error.response?.status === 401 ? '' : 'Unable to verify your session. Check your connection and try again.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const id = api.interceptors.response.use(response => response, error => {
      if (error.response?.status === 401) setUser(null);
      return Promise.reject(error);
    });
    return () => api.interceptors.response.eject(id);
  }, []);

  async function login(credentials) {
    const { adminOnly = false, technicianOnly = false, ...loginCredentials } = credentials;
    const endpoint = adminOnly ? '/auth/admin/login' : technicianOnly ? '/auth/technician/login' : '/auth/login';
    const { data } = await api.post(endpoint, loginCredentials);
    setUser(data);
    setSignedOut(false);
    setSessionError('');
    return data;
  }
  async function logout() {
    await api.post('/auth/logout');
    setSignedOut(true);
    setUser(null);
    setSessionError('');
  }

  function retrySession() { setLoading(true); setRetry(value => value + 1); }
  return <AuthContext.Provider value={{ user, signedOut, loading, sessionError, login, logout, retrySession }}>{children}</AuthContext.Provider>;
}
