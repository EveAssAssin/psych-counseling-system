import { Routes, Route, Navigate } from 'react-router-dom';

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
      
      {/* 主要頁面（不需登入） */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
      </Route>
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
