export function validateRegistration(body = {}) {
  const { fullName, email, mobile, password, confirmPassword } = body ?? {};
  if ([fullName, email, mobile, password, confirmPassword].some(value => typeof value !== 'string')) {
    return { error: 'Full name, email, mobile number and both passwords are required.' };
  }
  const data = { name: fullName.trim(), email: email.trim().toLowerCase(), mobile: mobile.trim().replace(/[\s()-]/g, ''), password };
  if (data.name.length < 2 || data.name.length > 100) return { error: 'Full name must contain 2 to 100 characters.' };
  if (data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { error: 'Enter a valid email address.' };
  if (!/^\+?\d{10,15}$/.test(data.mobile)) return { error: 'Enter a mobile number with 10 to 15 digits, optionally starting with +.' };
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) return { error: 'Password must contain at least 8 characters and no more than 72 UTF-8 bytes.' };
  if (password !== confirmPassword) return { error: 'Passwords do not match.' };
  return { data };
}
