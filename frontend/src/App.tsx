import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Layouts
import MainLayout from './layouts/MainLayout';

// Pages
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeDetailPage from './pages/EmployeeDetailPage';
import ConversationsPage from './pages/ConversationsPage';
import ConversationDetailPage from './pages/ConversationDetailPage';
import NewConversationPage from './pages/NewConversationPage';
import RiskFlagsPage from './pages/RiskFlagsPage';
import QueryPage from './pages/QueryPage';
import DataManagementPage from './pages/DataManagementPage';
import EntryPage from './pages/EntryPage';
import PeriodAnalysisPage from './pages/PeriodAnalysisPage';
import SupervisorHubPage from './pages/SupervisorHubPage';
import LineAssistantPage from './pages/LineAssistantPage';
import LineMobilePage from './pages/LineMobilePage';

// Counseling cases (Phase 5)
import CounselingTodayPage from './pages/CounselingTodayPage';
import CounselingCasesPage from './pages/CounselingCasesPage';
import NewCounselingCasePage from './pages/NewCounselingCasePage';
import CounselingCaseDetailPage from './pages/CounselingCaseDetailPage';

/**
 * 根路徑跳轉邏輯：
 * - 若 URL 帶 ?app_number=... 視為「統一入口跳轉」，導到 /entry 走自動登入流程
 * - 否則導到 /dashboard
 */
function RootRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (params.get('app_number')) {
    return <Navigate to={`/entry${location.search}`} replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

function App() {
  return (
    <Routes>
      {/* 統一入口：讀取 app_number 自動跳轉（公開） */}
      <Route path="/entry" element={<EntryPage />} />

      {/* 主管輔助中心（獨立入口，無側邊欄） */}
      <Route path="/supervisor-hub" element={<SupervisorHubPage />} />

      {/* LINE AI 訊息輔助（獨立入口） */}
      <Route path="/line-assistant" element={<LineAssistantPage />} />

      {/* LINE 行動版訊息助理（手機入口，獨立驗證） */}
      <Route path="/line-mobile" element={<LineMobilePage />} />

      {/* 根路徑：偵測 app_number → 走 entry 自動登入；否則 → dashboard */}
      <Route path="/" element={<RootRedirect />} />

      {/* 主要頁面 */}
      <Route element={<MainLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/employees/:id" element={<EmployeeDetailPage />} />
        <Route path="/conversations" element={<ConversationsPage />} />
        <Route path="/conversations/new" element={<NewConversationPage />} />
        <Route path="/conversations/:id" element={<ConversationDetailPage />} />
        <Route path="/risk-flags" element={<RiskFlagsPage />} />
        <Route path="/query" element={<QueryPage />} />
        <Route path="/data-management" element={<DataManagementPage />} />
        <Route path="/period-analysis" element={<PeriodAnalysisPage />} />

        {/* 輔導案管理（Phase 5） */}
        <Route path="/counseling-today" element={<CounselingTodayPage />} />
        <Route path="/counseling-cases" element={<CounselingCasesPage />} />
        <Route path="/counseling-cases/new" element={<NewCounselingCasePage />} />
        <Route path="/counseling-cases/:id" element={<CounselingCaseDetailPage />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
