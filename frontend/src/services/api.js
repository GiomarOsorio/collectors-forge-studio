import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (username, password) => {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  return api.post('/auth/login', formData);
};
export const getMe = () => api.get('/auth/me');
export const register = (data) => api.post('/auth/register', data);

// Filaments
export const getFilaments = () => api.get('/filaments/');
export const getFilament = (id) => api.get(`/filaments/${id}`);
export const createFilament = (data) => api.post('/filaments/', data);
export const updateFilament = (id, data) => api.put(`/filaments/${id}`, data);
export const deleteFilament = (id) => api.delete(`/filaments/${id}`);

// Printers
export const getPrinters = () => api.get('/printers/');
export const getPrinter = (id) => api.get(`/printers/${id}`);
export const createPrinter = (data) => api.post('/printers/', data);
export const updatePrinter = (id, data) => api.put(`/printers/${id}`, data);
export const deletePrinter = (id) => api.delete(`/printers/${id}`);

// Settings
export const getSettings = () => api.get('/settings/');
export const updateSettings = (data) => api.put('/settings/', data);

// Quotes
export const calculateQuote = (data) => api.post('/quotes/calculate', data);
export const createQuote = (data) => api.post('/quotes/', data);
export const getQuotes = () => api.get('/quotes/');
export const getQuote = (id) => api.get(`/quotes/${id}`);
export const deleteQuote = (id) => api.delete(`/quotes/${id}`);
export const downloadQuotePdf = (id) =>
  api.get(`/quotes/${id}/pdf`, { responseType: 'blob' });

export default api;
