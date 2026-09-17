import React, { useState, useEffect } from 'react';
import { KitchenLogin } from './KitchenLogin';
import { KitchenDashboard } from './KitchenDashboard';

export const KitchenModule: React.FC = () => {
  // BYPASS: Automatically set to true to bypass the login console
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

  useEffect(() => {
    // Automatically set the token to bypass login in the future
    localStorage.setItem('tabletap_kitchen_token', 'session_chef1');
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('tabletap_kitchen_token');
  };

  if (!isAuthenticated) {
    return <KitchenLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return <KitchenDashboard onLogout={handleLogout} />;
};
