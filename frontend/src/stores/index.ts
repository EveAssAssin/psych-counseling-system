import { create } from 'zustand';
import { authApi } from '../services/api';

// ============================================
// Types
// ============================================
export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  roles: string[];
}

export interface Employee {
  id: string;
  employeeappnumber: string;
  employeeerpid?: string;
  name: string;
  role?: string;
  title?: string;
  store_id?: string;
  store_name?: string;
  department?: string;
  is_active: boolean;
  is_leave: boolean;
}

export interface Conversation {
  id: string;
  employee_id: string;
  source_type: string;
  conversation_date?: string;
  conversation_type?: string;
  interviewer_name?: string;
  background_note?: string;
  raw_text?: string;
  extracted_text?: string;
  priority: string;
  need_followup: boolean;
  tags: string[];
  intake_status: string;
  created_at: string;
}

export interface Analysis {
  id: string;
  conversation_intake_id: string;
  employee_id: string;
  current_psychological_state?: string;
  stress_level?: string;
  risk_level?: string;
  summary?: string;
  key_topics: string[];
  observations: string[];
  suggested_actions: string[];
  taboo_topics: string[];
  interviewer_question_suggestions: string[];
  followup_needed: boolean;
  supervisor_involvement?: string;
  next_talk_focus?: string;
  created_at: string;
}

export interface RiskFlag {
  id: string;
  employee_id: string;
  risk_type: string;
  severity: string;
  title: string;
  description?: string;
  evidence_text?: string;
  status: string;
  created_at: string;
}

// ============================================
// Auth Store
// ============================================
interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  
  login: async (token: string) => {
    localStorage.setItem('token', token);
    try {
      const response = await authApi.getMe();
      set({
        user: {
          ...response.data.user,
          roles: response.data.roles.map((r: any) => r.role),
        },
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      localStorage.removeItem('token');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
  
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, isAuthenticated: false });
  },
  
  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }
    
    try {
      const response = await authApi.getMe();
      set({
        user: {
          ...response.data.user,
          roles: response.data.roles.map((r: any) => r.role),
        },
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      localStorage.removeItem('token');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

// ============================================
// UI Store
// ============================================
interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
