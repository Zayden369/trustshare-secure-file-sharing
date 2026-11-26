import axios from 'axios';
import { API_BASE_URL } from '../data/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

const AUTH_STORAGE_KEYS = ['access_token', 'refresh_token', 'user'];

const ASSISTANT_SESSION_KEYS = [
  'trustshare_bubble_conversation_id',
  'trustshare_bubble_open',
];

export const clearAuthStorage = () => {
  AUTH_STORAGE_KEYS.forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
  ASSISTANT_SESSION_KEYS.forEach((k) => {
    sessionStorage.removeItem(k);
  });
};

export const setAuthTokens = (accessToken, refreshToken, rememberMe) => {
  clearAuthStorage();
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem('access_token', accessToken);
  storage.setItem('refresh_token', refreshToken);
};

// ── Request interceptor: attach JWT ───────────────────────────────
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: handle 401 ─────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const usedSessionStorage = !!sessionStorage.getItem('refresh_token');
      const refreshToken =
        sessionStorage.getItem('refresh_token') ||
        localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const storage = usedSessionStorage ? sessionStorage : localStorage;
          storage.setItem('access_token', data.access_token);
          storage.setItem('refresh_token', data.refresh_token);
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
          return api(originalRequest);
        } catch {
          clearAuthStorage();
          window.location.href = '/login';
        }
      } else {
        clearAuthStorage();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  signup: (name, email, password) => api.post('/api/auth/signup', { name, email, password }),
  me: () => api.get('/api/auth/me'),
  storageBreakdown: () => api.get('/api/auth/me/storage-breakdown'),
  logout: () => api.post('/api/auth/logout'),
  verifyOTP: (mfa_token, code) => api.post('/api/auth/verify-otp', { mfa_token, code }),
  resendOTP: (mfa_token) => api.post('/api/auth/resend-otp', { mfa_token }),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => api.post('/api/auth/reset-password', { token, new_password }),
  oauthToken: (provider, code) => api.post('/api/auth/oauth/token', { provider, code }),
  updateProfile: (data) => api.patch('/api/users/me', data),
  mfaSetup: () => api.post('/api/auth/mfa/setup'),
  mfaVerifySetup: (code) => api.post('/api/auth/mfa/verify-setup', { code }),
  mfaDisableWithPassword: (password) => api.post('/api/auth/mfa/disable-with-password', { password }),
};

// ── Files ─────────────────────────────────────────────────────────────────
export const filesAPI = {
  list: (folderId) => api.get('/api/files/', { params: { folder_id: folderId } }),
  upload: (formData, onProgress, folderId) =>
    api.post('/api/files/upload', formData, {
      params: folderId ? { folder_id: folderId } : undefined,
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress && onProgress(Math.round((e.loaded * 100) / e.total)),
    }),
  get: (id) => api.get(`/api/files/${id}`),
  download: (id) =>
    api.get(`/api/files/${id}/download`, { responseType: 'blob' }),
  move: (id, folderId) => api.patch(`/api/files/${id}/move`, { folder_id: folderId }),
  delete: (id) => api.delete(`/api/files/${id}`),
  listVersions: (fileId) => api.get(`/api/files/${fileId}/versions`),
  uploadVersion: (fileId, formData) =>
    api.post(`/api/files/${fileId}/versions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  restoreVersion: (fileId, versionId) =>
    api.post(`/api/files/${fileId}/versions/${versionId}/restore`),
  downloadVersion: (fileId, versionId) =>
    api.get(`/api/files/${fileId}/versions/${versionId}/download`, {
      responseType: 'blob',
    }),
};

export const fileSummaryAPI = {
  create: (fileId, options) => api.post(`/api/files/${fileId}/summaries`, options),
  list: (fileId) => api.get(`/api/files/${fileId}/summaries`),
  get: (fileId, summaryId) => api.get(`/api/files/${fileId}/summaries/${summaryId}`),
  regenerate: (fileId, summaryId) => api.post(`/api/files/${fileId}/summaries/${summaryId}/regenerate`),
  delete: (fileId, summaryId) => api.delete(`/api/files/${fileId}/summaries/${summaryId}`),
};

// ── Folders ───────────────────────────────────────────────────────────────
export const foldersAPI = {
  list: (parentId) => api.get('/api/folders/', { params: { parent_id: parentId } }),
  create: (name, parentId) => api.post('/api/folders/', { name, parent_id: parentId }),
  rename: (id, name) => api.patch(`/api/folders/${id}`, { name }),
  delete: (id, recursive = false) => api.delete(`/api/folders/${id}`, { params: { recursive } }),
};

// ── Shares ────────────────────────────────────────────────────────────────
export const sharesAPI = {
  list: () => api.get('/api/shares/'),
  create: (data) => api.post('/api/shares/', data),
  revoke: (id) => api.delete(`/api/shares/${id}`),
  deleteInactive: (id) => api.delete(`/api/shares/${id}/record`),
  updatePermission: (id, permission) => api.patch(`/api/shares/${id}`, { permission }),
  access: (token, password) => api.get(`/api/shares/access/${token}`, { params: { password } }),
  publicDetails: (token, password) => axios.get(`${API_BASE_URL}/api/shares/public/${token}`, { params: { password } }),
  publicContent: (token, password) => axios.get(`${API_BASE_URL}/api/shares/public/${token}/content`, {
    params: { password },
    responseType: 'blob',
  }),
};

// ── Notifications ─────────────────────────────────────────────────────────
export const notificationsAPI = {
  list: () => api.get('/api/notifications/'),
  markRead: (id) => api.patch(`/api/notifications/${id}/read`),
  markAllRead: () => api.patch('/api/notifications/read-all'),
  delete: (id) => api.delete(`/api/notifications/${id}`),
  deleteAll: () => api.delete('/api/notifications/'),
};

// ── Analytics ─────────────────────────────────────────────────────────────
export const analyticsAPI = {
  summary: (days = 30, userId = null) => {
    const params = { days };
    if (userId) params.user_id = userId;
    return api.get('/api/analytics/summary', { params });
  },
  users: () => api.get('/api/analytics/users'),
  systemStats: () => api.get('/api/analytics/system-stats'),
  trends: () => api.get('/api/analytics/trends'),
  exportFileAnalytics: (days = 30, startDate = null, endDate = null) => {
    const params = { days };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return api.get('/api/analytics/export/file-analytics', {
      params,
      responseType: 'blob',
    });
  },
  exportSecurity: (days = 30, startDate = null, endDate = null) => {
    const params = { days };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return api.get('/api/analytics/export/security', {
      params,
      responseType: 'blob',
    });
  },
  exportCSV: (tab = "file", days = 30, startDate = null, endDate = null) => {
    const params = { tab, days };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return api.get('/api/analytics/export/csv', {
      params,
      responseType: 'blob',
    });
  },
  get: (url, config) => api.get(url, config),
};

export const dashboardAPI = {
  get: () => api.get('/api/dashboard/'),
};

export const sharedWithMeAPI = {
  list: () => api.get('/api/shared-with-me/'),
  download: (fileId) => api.get(`/api/shared-with-me/${fileId}/download`, { responseType: 'blob' }),
  view: (fileId) => api.get(`/api/shared-with-me/${fileId}/view`, { responseType: 'blob' }),
  listDirect: () => api.get('/api/shared-with-me/direct'),
  shareDirect: (data) => api.post('/api/shared-with-me/direct', data),
  updateDirectPermission: (permissionId, permission) => api.patch(`/api/shared-with-me/direct/${permissionId}`, { permission }),
  revokeDirect: (permissionId) => api.delete(`/api/shared-with-me/direct/${permissionId}`),
};

// ── Admin ─────────────────────────────────────────────────────────────────
export const adminAPI = {
  listUsers: (search = null, role = null) => {
    const params = {};
    if (search) params.search = search;
    if (role) params.role = role;
    return api.get('/api/admin/users', { params });
  },
  updateUser: (id, data) => api.patch(`/api/admin/users/${id}`, data),
  getStats: () => api.get('/api/admin/stats'),
};

// ── Audit ─────────────────────────────────────────────────────────────────
export const auditAPI = {
  list: (limit = 50) => api.get('/api/audit/', { params: { limit } }),
};

// Current user's activity feed.
export const activityAPI = {
  list: (limit = 100) => api.get('/api/activity/', { params: { limit } }),
  sessions: () => api.get('/api/activity/sessions'),
};

// ── Search ───────────────────────────────────────────────────────────────
export const searchAPI = {
  search: (query) =>
    api.get("/api/search/", {
      params: { q: query },
    }),
  searchContent: (query, limit = 20) =>
    api.get("/api/search/content", {
      params: { q: query, limit },
    }),
};

// ── Settings (API Placeholders) ──────────────────────────────────────────
export const settingsAPI = {
  getProfile: () => api.get("/api/settings/profile"),
  updateProfile: (data) => api.put("/api/settings/profile", data),
  changePassword: (data) => api.post("/api/settings/change-password", data),
  getSessions: () => api.get("/api/settings/sessions"),
  logoutSession: (id) => api.delete(`/api/settings/sessions/${id}`),
  logoutAllSessions: () => api.delete("/api/settings/sessions"),
  getNotificationPreferences: () => api.get("/api/settings/notifications"),
  updateNotificationPreferences: (data) => api.put("/api/settings/notifications", data),
};

export default api;
