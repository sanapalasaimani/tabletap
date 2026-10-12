import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity

export const AdminModule: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminRole, setAdminRole] = useState<string>('Hotel Manager');
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string>('');
  
  const lastActivityRef = useRef<number>(Date.now());

  const handleLogout = useCallback((reason?: string) => {
    localStorage.removeItem('dinesmart_admin_token');
    localStorage.removeItem('dinesmart_admin_role');
    localStorage.removeItem('dinesmart_admin_last_active');
    setIsAuthenticated(false);
    if (reason) {
      setSessionExpiredNotice(reason);
    }
  }, []);

  // Update activity timestamp
  const recordActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    localStorage.setItem('dinesmart_admin_last_active', String(now));
  }, []);

  // Check initial authentication and initial timeout validity
  useEffect(() => {
    const token = localStorage.getItem('dinesmart_admin_token');
    const role = localStorage.getItem('dinesmart_admin_role');
    const lastActiveStr = localStorage.getItem('dinesmart_admin_last_active');

    if (token === 'session_admin1') {
      const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : Date.now();
      const timeSinceActive = Date.now() - lastActive;

      if (timeSinceActive > INACTIVITY_TIMEOUT_MS) {
        handleLogout('Session expired after 5 minutes of inactivity. Please log in again.');
      } else {
        setIsAuthenticated(true);
        if (role) setAdminRole(role);
        lastActivityRef.current = Date.now();
        localStorage.setItem('dinesmart_admin_last_active', String(Date.now()));
      }
    }
  }, [handleLogout]);

  // Activity listeners & 5-minute inactivity interval watcher
  useEffect(() => {
    if (!isAuthenticated) return;

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    const handleUserActivity = () => {
      recordActivity();
    };

    activityEvents.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Check every 5 seconds for inactivity timeout
    const intervalId = setInterval(() => {
      const now = Date.now();
      const lastActive = lastActivityRef.current;
      if (now - lastActive >= INACTIVITY_TIMEOUT_MS) {
        handleLogout('Session timed out due to 5 minutes of inactivity. Please sign in again.');
      }
    }, 5000);

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      clearInterval(intervalId);
    };
  }, [isAuthenticated, handleLogout, recordActivity]);

  const handleLoginSuccess = (role: string) => {
    setSessionExpiredNotice('');
    setAdminRole(role);
    setIsAuthenticated(true);
    lastActivityRef.current = Date.now();
    localStorage.setItem('dinesmart_admin_last_active', String(Date.now()));
  };

  if (!isAuthenticated) {
    return (
      <AdminLogin 
        onLoginSuccess={handleLoginSuccess} 
        sessionExpiredNotice={sessionExpiredNotice} 
      />
    );
  }

  return <AdminDashboard role={adminRole} onLogout={() => handleLogout()} />;
};

export default AdminModule;
