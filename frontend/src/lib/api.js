// Shared HTTP client: use the configured API host, include the session cookie, and time out requests after 20 seconds.
import axios from 'axios';
import { notify } from './notify.js';
import { mutationToastMessage } from './mutationToast.js';

export const api = axios.create({
  baseURL: `${import.meta.env?.VITE_API_URL || 'http://localhost:5000'}/api`,
  withCredentials: true,
  timeout: 20000,
});

api.interceptors.response.use(
  (response) => {
    const message = mutationToastMessage(response.config, response.data);
    if (message) notify(message);
    return response;
  },
  (error) => {
    if (!axios.isCancel(error) && mutationToastMessage(error.config)) {
      notify(error.response?.data?.message || 'Unable to save your changes. Please try again.', 'error');
    }
    return Promise.reject(error);
  },
);
