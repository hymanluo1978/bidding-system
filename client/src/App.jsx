import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import SupplierLayout from './layouts/SupplierLayout';
import JudgeLayout from './layouts/JudgeLayout';
import Login from './pages/auth/Login';
import ErrorBoundary from './components/ErrorBoundary';

// 管理员页面
import AdminDashboard from './pages/admin/Dashboard';
import TenderList from './pages/admin/TenderList';
import TenderForm from './pages/admin/TenderForm';
import TenderDetail from './pages/admin/TenderDetail';
import SupplierList from './pages/admin/SupplierList';
import SupplierForm from './pages/admin/SupplierForm';
import JudgeList from './pages/admin/JudgeList';
import JudgeForm from './pages/admin/JudgeForm';
import EvaluationList from './pages/admin/EvaluationList';
import EvaluationDetail from './pages/admin/EvaluationDetail';
import UserManagement from './pages/admin/UserManagement';

// 供应商页面
import SupplierTenders from './pages/supplier/TenderList';
import SupplierBidForm from './pages/supplier/BidForm';
import SupplierMyBids from './pages/supplier/MyBids';
import SupplierClarifications from './pages/supplier/Clarifications';

// 评委页面
import JudgeTasks from './pages/judge/Tasks';
import JudgeScoreForm from './pages/judge/ScoreForm';

// 路由守卫
const ProtectedRoute = ({ children, allowedRoles }) => {
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch (e) {
    user = {};
  }
  const token = localStorage.getItem('token');

  if (!token || !user.id) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const routes = { admin: '/admin/dashboard', manager: '/admin/dashboard', supplier: '/supplier/tenders', judge: '/judge/tasks' };
    return <Navigate to={routes[user.role] || '/login'} replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter basename="/bidding-system">
      <ErrorBoundary>
        <Routes>
        <Route path="/login" element={<Login />} />

        {/* 管理员路由 */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><AdminLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="tenders" element={<TenderList />} />
          <Route path="tenders/new" element={<TenderForm />} />
          <Route path="tenders/:id" element={<TenderDetail />} />
          <Route path="tenders/:id/edit" element={<TenderForm />} />
          <Route path="suppliers" element={<SupplierList />} />
          <Route path="suppliers/new" element={<SupplierForm />} />
          <Route path="suppliers/:id/edit" element={<SupplierForm />} />
          <Route path="judges" element={<JudgeList />} />
          <Route path="judges/new" element={<JudgeForm />} />
          <Route path="judges/:id/edit" element={<JudgeForm />} />
          <Route path="evaluation" element={<EvaluationList />} />
          <Route path="evaluation/:tenderId" element={<EvaluationDetail />} />
          <Route path="users" element={<UserManagement />} />
        </Route>

        {/* 供应商路由 */}
        <Route path="/supplier" element={<ProtectedRoute allowedRoles={['supplier']}><SupplierLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="tenders" replace />} />
          <Route path="tenders" element={<SupplierTenders />} />
          <Route path="tenders/:id/bid" element={<SupplierBidForm />} />
          <Route path="my-bids" element={<SupplierMyBids />} />
          <Route path="clarifications" element={<SupplierClarifications />} />
        </Route>

        {/* 评委路由 */}
        <Route path="/judge" element={<ProtectedRoute allowedRoles={['judge']}><JudgeLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="tasks" replace />} />
          <Route path="tasks" element={<JudgeTasks />} />
          <Route path="tasks/:tenderId" element={<JudgeScoreForm />} />
        </Route>

        {/* 默认跳转 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
