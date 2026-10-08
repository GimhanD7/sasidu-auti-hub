import { useState } from 'react';
export default function PasswordInput(props) {
  const [visible, setVisible] = useState(false);
  return <span className="password-control"><input {...props} type={visible ? 'text' : 'password'} /><button type="button" className="password-toggle" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(value => !value)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="m3 3 18 18"/>}</svg></button></span>;
}
