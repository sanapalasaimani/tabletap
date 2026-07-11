import React, { useState, useEffect } from 'react';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';

export const AdminModule: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminRole, setAdminRole] = useState<string>('Hotel Manager');

  useEffect(() => {
    const token = localStorage.getItem('dinesmart_admin_token');
    const role = localStorage.getItem('dinesmart_admin_role');
    if (token === 'session_admin1') {
      setIsAuthenticated(true);
      if (role) setAdminRole(role);
    }
  }, []);

  const handleLoginSuccess = (role: string) => {
    setAdminRole(role);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('dinesmart_admin_token');
    localStorage.removeItem('dinesmart_admin_role');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return <AdminDashboard role={adminRole} onLogout={handleLogout} />;
};
export default AdminModule;
