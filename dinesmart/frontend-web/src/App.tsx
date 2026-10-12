import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { AppProvider } from './context/AppContext';
import { MainContainer } from './pages/customer/MainContainer';
import { KitchenModule } from './pages/kitchen/KitchenModule';
import { AdminModule } from './pages/admin/AdminModule';
import { WaiterModule } from './pages/waiter/WaiterModule';
import './App.css';

function App() {
  const isNative = Capacitor.isNativePlatform();

  // In Android APK: strictly isolate and run Waiter App only (no kitchen, customer, or admin views)
  if (isNative) {
    return (
      <AppProvider>
        <WaiterModule />
      </AppProvider>
    );
  }

  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Waiter App Route */}
          <Route path="/waiter" element={<WaiterModule />} />
          <Route path="/waiter/*" element={<WaiterModule />} />

          {/* Main Customer QR Entry Route */}
          <Route path="/table/:tableId" element={<MainContainer />} />
          
          {/* Kitchen Dashboard Route */}
          <Route path="/kitchen" element={<KitchenModule />} />
          
          {/* Admin Dashboard Route */}
          <Route path="/admin/*" element={<AdminModule />} />
          
          {/* Default Table fallback for demo purposes */}
          <Route path="/table" element={<Navigate to="/table/05" replace />} />
          
          {/* Catch-all redirects: Native APK defaults to /waiter, browser defaults to /table/05 */}
          <Route path="*" element={<Navigate to={isNative ? "/waiter" : "/table/05"} replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
