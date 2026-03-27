import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 請求攔截器 - 加入 JWT Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 回應攔截器 - 處理錯誤
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

// ============================================
// Auth API
// ============================================
export const authApi = {
  getGoogleLoginUrl: () => `${API_BASE_URL}/auth/google`,
  
  getMe: () => api.get('/auth/me'),
  
  verify: () => api.get('/auth/verify'),
  
  logout: () => {
    localStorage.removeItem('token');
    return api.post('/auth/logout');
  },
};

// ============================================
// Employees API
// ============================================
export const employeesApi = {
  search: (params: {
    q?: string;
    store_id?: string;
    department?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }) => api.get('/employees', { params }),
  
  getById: (id: string) => api.get(`/employees/${id}`),
  
  getByAppNumber: (appnumber: string) => api.get(`/employees/by-appnumber/${appnumber}`),
  
  create: (data: any) => api.post('/employees', data),
  
  update: (id: string, data: any) => api.put(`/employees/${id}`, data),
  
  delete: (id: string) => api.delete(`/employees/${id}`),
  
  getStats: () => api.get('/employees/stats'),
  
  identify: (data: {
    employeeappnumber?: string;
    employeeerpid?: string;
    name?: string;
    store_name?: string;
  }) => api.post('/employees/identify', data),
};

// ============================================
// Conversations API
// ============================================
export const conversationsApi = {
  search: (params: {
    employee_id?: string;
    status?: string;
    priority?: string;
    need_followup?: boolean;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/conversations', { params }),
  
  getById: (id: string) => api.get(`/conversations/${id}`),
  
  getByEmployee: (employeeId: string) => api.get(`/conversations/employee/${employeeId}`),
  
  create: (data: {
    employee_id: string;
    conversation_date?: string;
    conversation_type?: string;
    interviewer_name?: string;
    background_note?: string;
    raw_text: string;
    priority?: string;
    need_followup?: boolean;
    tags?: string[];
  }) => api.post('/conversations', data),
  
  upload: (formData: FormData) => api.post('/conversations/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  
  update: (id: string, data: any) => api.put(`/conversations/${id}`, data),
  
  delete: (id: string) => api.delete(`/conversations/${id}`),
  
  getStats: () => api.get('/conversations/stats'),
  
  getAttachments: (id: string) => api.get(`/conversations/${id}/attachments`),
};

// ============================================
// Analysis API
// ============================================
export const analysisApi = {
  run: (conversationId: string, force?: boolean) => 
    api.post(`/analysis/run/${conversationId}`, null, { params: { force } }),
  
  getById: (id: string) => api.get(`/analysis/${id}`),
  
  getByConversation: (conversationId: string) => 
    api.get(`/analysis/conversation/${conversationId}`),
  
  getByEmployee: (employeeId: string) => api.get(`/analysis/employee/${employeeId}`),
  
  getLatestByEmployee: (employeeId: string) => 
    api.get(`/analysis/employee/${employeeId}/latest`),
  
  getHighRisk: (limit?: number) => api.get('/analysis/high-risk', { params: { limit } }),
  
  search: (params: {
    employee_id?: string;
    risk_level?: string;
    stress_level?: string;
    followup_needed?: boolean;
    limit?: number;
    offset?: number;
  }) => api.get('/analysis', { params }),
};

// ============================================
// Risk Flags API
// ============================================
export const riskFlagsApi = {
  getOpen: (params?: {
    severity?: string;
    risk_type?: string;
    employee_id?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/risk-flags', { params }),
  
  getHighRisk: (limit?: number) => api.get('/risk-flags/high-risk', { params: { limit } }),
  
  getById: (id: string) => api.get(`/risk-flags/${id}`),
  
  getByEmployee: (employeeId: string) => api.get(`/risk-flags/employee/${employeeId}`),
  
  acknowledge: (id: string, userId: string) => 
    api.patch(`/risk-flags/${id}/acknowledge`, { user_id: userId }),
  
  startProgress: (id: string, assignedTo?: string) => 
    api.patch(`/risk-flags/${id}/start-progress`, { assigned_to: assignedTo }),
  
  resolve: (id: string, userId: string, note?: string) => 
    api.patch(`/risk-flags/${id}/resolve`, { user_id: userId, resolution_note: note }),
  
  markFalsePositive: (id: string, userId: string, note?: string) => 
    api.patch(`/risk-flags/${id}/false-positive`, { user_id: userId, note }),
  
  getStats: () => api.get('/risk-flags/stats'),
};

// ============================================
// Query API
// ============================================
export const queryApi = {
  ask: (data: {
    question: string;
    employee_identifier?: {
      employeeappnumber?: string;
      employeeerpid?: string;
      name?: string;
    };
    context?: string;
  }) => api.post('/query', data),
  
  getEmployeeStatus: (params: {
    employeeappnumber?: string;
    employeeerpid?: string;
    name?: string;
  }) => api.get('/query/employee-status', { params }),
  
  chat: (message: string, sessionId?: string) => 
    api.post('/query/chat', { message, session_id: sessionId }),
};

// ============================================
// Sync API
// ============================================
export const syncApi = {
  syncEmployees: () => api.post('/sync/employees'),
  
  syncDaily: () => api.post('/sync/daily'),
  
  syncOfficialChannel: () => api.post('/sync/official-channel'),
  
  getLogs: (limit?: number) => api.get('/sync/logs', { params: { limit } }),
  
  getLog: (id: string) => api.get(`/sync/logs/${id}`),
};

// ============================================
// Official Channel API
// ============================================
export const officialChannelApi = {
  search: (params: {
    employee_id?: string;
    employee_app_number?: string;
    channel?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/official-channel', { params }),

  getByEmployeeId: (employeeId: string, limit?: number) => 
    api.get(`/official-channel/employee/${employeeId}`, { params: { limit } }),

  getByAppNumber: (appNumber: string, limit?: number) =>
    api.get(`/official-channel/by-app-number/${appNumber}`, { params: { limit } }),

  getStats: () => api.get('/official-channel/stats'),

  getById: (id: string) => api.get(`/official-channel/${id}`),
};

// ============================================
// Health API
// ============================================
export const healthApi = {
  check: () => api.get('/health'),
};
