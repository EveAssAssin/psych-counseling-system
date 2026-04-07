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
import ReviewsPage from './pages/ReviewsPage';
import ReviewDetailPage from './pages/ReviewDetailPage';
import ReviewRespondPage from './pages/ReviewRespondPage';
import DataManagementPage from './pages/DataManagementPage';

function App() {
  return (
    <Routes>
      {/* 員工回覆頁面（公開） */}
      <Route path="/review/respond/:token" element={<ReviewRespondPage />} />
      
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
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/reviews/:id" element={<ReviewDetailPage />} />
        <Route path="/data-management" element={<DataManagementPage />} />
      </Route>
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
