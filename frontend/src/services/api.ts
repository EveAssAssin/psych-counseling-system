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

  /**
   * 用員工編號自動登入（給樂活統一入口跳轉用）
   * URL 帶 ?app_number=A1234 → 前端呼叫此 API → 取得 JWT
   */
  loginByAppNumber: (appNumber: string) =>
    api.post('/auth/by-app-number', { app_number: appNumber }),

  logout: () => {
    localStorage.removeItem('token');
    return api.post('/auth/logout');
  },
};

// ============================================
// Permissions API（權限管理，僅 super_admin 可用）
// ============================================
export const permissionsApi = {
  /** 列出所有權限記錄 */
  list: (params?: { only_active?: boolean; role?: 'admin' | 'counselor' }) =>
    api.get('/permissions', { params }),

  /** 取得可用角色清單（給下拉用） */
  getRoles: () => api.get('/permissions/roles'),

  /** 指派權限（給某 app_number 一個角色） */
  grant: (data: {
    app_number: string;
    role: 'admin' | 'counselor';
    scope_type?: string;
    scope_value?: Record<string, any>;
  }) => api.post('/permissions', data),

  /** 更新權限 */
  update: (
    id: string,
    data: {
      role?: 'admin' | 'counselor';
      scope_type?: string;
      scope_value?: Record<string, any>;
      is_active?: boolean;
    },
  ) => api.put(`/permissions/${id}`, data),

  /** 撤銷權限（軟刪除） */
  revoke: (id: string) => api.delete(`/permissions/${id}`),
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
    attachments?: any[];
  }) => api.post('/conversations', data),
  
  upload: (formData: FormData) => api.post('/conversations/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  /**
   * 音檔 / 逐字稿轉錄與智慧預填
   * 上傳音檔 → Whisper 轉文字 → Claude 清理 + 識別員工/主管/背景
   * 不會建立對話記錄，回傳建議讓使用者預覽再確認
   */
  transcribe: (formData: FormData, opts?: { onUploadProgress?: (e: any) => void }) =>
    api.post('/conversations/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Whisper (20-60s for 1MB) + Claude smart-fill (10-30s) 通常 1-3 分鐘
      // 留 6 分鐘 buffer，配合 vite proxy 5 分鐘 timeout
      timeout: 6 * 60 * 1000,
      onUploadProgress: opts?.onUploadProgress,
      // 大檔不要被 axios 預設 maxContentLength（10MB）擋
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
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

  syncOfficialChannelForce: () => api.post('/sync/official-channel?force=true'),

  resetCursor: (type: string) => api.delete(`/sync/cursors/${type}`),

  syncTicketHistory: () => api.post('/sync/ticket-history'),

  syncReviewData: () => api.post('/sync/review-data'),

  getStatus: () => api.get('/sync/status'),

  getLogs: (limit?: number) => api.get('/sync/logs', { params: { limit } }),

  getLog: (id: string) => api.get(`/sync/logs/${id}`),

  patchStoreNames: () => api.post('/sync/patch-store-names'),

  syncOrderStats: () => api.post('/sync/order-stats'),
  syncOrderStatsMonth: (year: number, month: number) => api.post(`/sync/order-stats/${year}/${month}`),
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
// Ticket History API
// ============================================
export const ticketHistoryApi = {
  getByEmployeeId: (employeeId: string, limit?: number) =>
    api.get(`/ticket-history/employee/${employeeId}`, { params: { limit } }),

  getByAppNumber: (appNumber: string, limit?: number) =>
    api.get(`/ticket-history/by-app-number/${appNumber}`, { params: { limit } }),

  getStats: (appNumber: string) => api.get(`/ticket-history/stats/${appNumber}`),

  getConversations: (ticketId: number) =>
    api.get(`/ticket-history/ticket/${ticketId}/conversations`),

  getByTicketId: (ticketId: number) => api.get(`/ticket-history/${ticketId}`),
};

// ============================================
// Health API
// ============================================
export const healthApi = {
  check: () => api.get('/health'),
};

// ============================================
// Employee Insight API
// ============================================
export const insightApi = {
  // 取得員工綜合洞察（有快取就用快取）
  getInsight: (appNumber: string, days?: number) => 
    api.get(`/v1/employee-insight/${appNumber}`, { params: { days } }),
  
  // 強制重新分析
  refreshInsight: (appNumber: string) => 
    api.get(`/v1/employee-insight/${appNumber}`, { params: { refresh: true } }),
  
  // 取得快速摘要
  getSummary: (appNumber: string) => 
    api.get(`/v1/employee-insight/${appNumber}/summary`),
  
  // 取得溝通建議
  getCommunication: (appNumber: string) => 
    api.get(`/v1/employee-insight/${appNumber}/communication`),
  
  // 取得時間軸
  getTimeline: (appNumber: string, days?: number) => 
    api.get(`/v1/employee-insight/${appNumber}/timeline`, { params: { days } }),
  
  // 取得調動評估
  getTransferAssessment: (appNumber: string) => 
    api.get(`/v1/employee-insight/${appNumber}/transfer-assessment`),
};

// ============================================
// Counseling Cases API
// ============================================
export const counselingApi = {
  // 輔導員 picker
  listSupervisors: () => api.get('/counseling-cases/supervisors'),

  // 狀態標籤
  listStateTags: () => api.get('/counseling-cases/state-tags'),
  upsertStateTag: (body: {
    code: string;
    label: string;
    description?: string;
    ai_prompt_hint?: string;
    severity?: string;
    default_duration_days?: number;
    sort_order?: number;
  }) => api.post('/counseling-cases/state-tags', body),
  deactivateStateTag: (id: string) => api.delete(`/counseling-cases/state-tags/${id}`),

  // 假日表
  listHolidays: (year?: number) => api.get('/counseling-cases/holidays', { params: { year } }),

  // 今日 / 過期
  getToday: (params?: { date?: string; supervisor_id?: string }) =>
    api.get('/counseling-cases/today', { params }),
  getOverdue: (supervisor_id?: string) =>
    api.get('/counseling-cases/overdue', { params: { supervisor_id } }),

  // 案件 CRUD
  listCases: (params?: {
    status?: string;
    supervisor_id?: string;
    employee_app_number?: string;
    state_tag_code?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/counseling-cases', { params }),

  getCase: (id: string) => api.get(`/counseling-cases/${id}`),

  updateCase: (id: string, body: any) => api.patch(`/counseling-cases/${id}`, body),

  closeCase: (id: string, closing_summary: string) =>
    api.post(`/counseling-cases/${id}/close`, { closing_summary }),

  // 建案
  createDraft: (body: {
    employee_app_number: string;
    supervisor_id: string;
    state_tag_codes: string[];
    state_description?: string;
    goal: string;
    start_date: string;
    target_end_date: string;
    allowed_methods: string[];
  }) => api.post('/counseling-cases/draft', body),

  confirmCase: (body: {
    draft_token: string;
    adjusted_plan_items?: any[];
    adjusted_summary?: string;
  }) => api.post('/counseling-cases/confirm', body),

  // 排程節點
  updatePlanItem: (itemId: string, body: any) =>
    api.patch(`/counseling-cases/plan-items/${itemId}`, body),

  // 執行紀錄
  listExecutions: (caseId: string) =>
    api.get(`/counseling-cases/${caseId}/executions`),

  createExecution: (caseId: string, body: any) =>
    api.post(`/counseling-cases/${caseId}/executions`, body),

  // 案件 AI 討論
  listAiSessions: (caseId: string) =>
    api.get(`/counseling-cases/${caseId}/ai/sessions`),

  openAiSession: (caseId: string, supervisor_identifier: string) =>
    api.post(`/counseling-cases/${caseId}/ai/session`, { supervisor_identifier }),

  listAiMessages: (sessionId: string, supervisor_identifier: string) =>
    api.get(`/counseling-cases/ai/sessions/${sessionId}/messages`, {
      params: { supervisor_identifier },
    }),

  sendAiMessage: (sessionId: string, supervisor_identifier: string, content: string) =>
    api.post(`/counseling-cases/ai/sessions/${sessionId}/messages`, {
      supervisor_identifier,
      content,
    }),

  // 員工出勤（左手 API）
  getEmployeeAttendance: (appNumber: string, params?: { start_date?: string; end_date?: string }) =>
    api.get(`/counseling-cases/employee-attendance/${appNumber}`, { params }),

  // LINE 推播
  bindLine: (identifier: string, line_user_id: string) =>
    api.post('/counseling-cases/supervisors/bind-line', { identifier, line_user_id }),

  notifyTodayAll: () => api.post('/counseling-cases/notify/today'),

  notifyTodayOne: (supervisorId: string) =>
    api.post(`/counseling-cases/notify/today/${supervisorId}`),
};
