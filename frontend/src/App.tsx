import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdSubmission from './pages/AdSubmission';
import BulkUpload from './pages/BulkUpload';
import Campaigns from './pages/Campaigns';
import Reporting from './pages/Reporting';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import './i18n';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/ad-submission" element={<AdSubmission />} />
                    <Route path="/bulk-upload" element={<BulkUpload />} />
                    <Route path="/campaigns" element={<Campaigns />} />
                    <Route path="/reporting" element={<Reporting />} />
                    <Route path="/alerts" element={<Alerts />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;