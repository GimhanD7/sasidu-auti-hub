import { useRef, useState } from 'react';
export default function VehicleImageInput({ value = '', onChange, disabled }) {
  const [error, setError] = useState('');
  const input = useRef(null);
  async function choose(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 1024 * 1024) { setError('Choose a JPG or PNG file up to 1 MB.'); event.target.value = ''; return; }
    try {
      const value = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      const image = new Image();
      image.src = value;
      await image.decode();
      onChange(value);
    } catch { setError('This image could not be read. Choose another JPG or PNG.'); }
  }
  return <div className="vehicle-form-wide vehicle-image-input"><label>Upload vehicle image (JPG or PNG)<input ref={input} type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" disabled={disabled} onChange={choose} /></label><small>Optional, up to 1 MB. You can also use an HTTPS image URL.</small><label>Image URL<input type="url" maxLength={2048} disabled={disabled} placeholder="https://example.com/vehicle.jpg" value={value.startsWith('data:') ? '' : value} onChange={event => { setError(''); onChange(event.target.value); }} /></label>{error && <p role="alert">{error}</p>}{value && <div><img src={value} alt="Vehicle preview" style={{ maxWidth: '100%', width: 200, maxHeight: 140, objectFit: 'contain' }} /><button type="button" disabled={disabled} onClick={() => { onChange(''); if (input.current) input.current.value = ''; }}>Remove image</button></div>}</div>;
}
