// Shared HTTP client: use the configured API host, include the session cookie, and time out requests after 20 seconds.
import axios from 'axios';

export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`,
  withCredentials: true,
  timeout: 20000,
});
