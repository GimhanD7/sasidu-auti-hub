import { useEffect, useState } from 'react';
export default function Toast() {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    const show = (event) => setToast(event.detail);
    window.addEventListener('app-toast', show);
    return () => window.removeEventListener('app-toast', show);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  return toast ? (
    <div className={`app-toast ${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      {toast.message}
      <button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}>
        ×
      </button>
    </div>
  ) : null;
}
