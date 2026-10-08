export const MAX_IMAGE_BYTES = 1024 * 1024;
export function validVehicleImage(value) {
  if (!value) return true;
  if (typeof value !== 'string') return false;
  if (value.startsWith('data:')) {
    if (value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 32) return false;
    const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) return false;
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== match[2]) return false;
    return match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  }
  try { const url = new URL(value); return value.length <= 2048 && url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}
