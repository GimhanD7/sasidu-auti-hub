// Limit repeated authentication requests within a time window. The counters live in this server process, not in MongoDB.
// Per-process protection. Use a shared rate-limit store when running multiple instances.
export function authRateLimit(limit = 20, windowMs = 15 * 60 * 1000) {
  const attempts = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.resetAt <= now) attempts.delete(key);
    const key = req.ip;
    const entry = attempts.get(key) || { count: 0, resetAt: now + windowMs };
    attempts.set(key, entry);
    entry.count++;
    if (entry.count > limit) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ message: 'Too many attempts. Please try again later.' });
    }
    next();
  };
}
