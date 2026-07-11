import React, { useState, useEffect } from 'react';
import { KitchenLogin } from './KitchenLogin';
import { KitchenDashboard } from './KitchenDashboard';

export const KitchenModule: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const token = localStorage.getItem('tabletap_kitchen_token');
    if (token === 'session_chef1') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <KitchenLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return <KitchenDashboard onLogout={handleLogout} />;
};
