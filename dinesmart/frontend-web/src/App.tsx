import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { AppProvider } from './context/AppContext';
import { MainContainer } from './pages/customer/MainContainer';
import { ScanQrLanding } from './pages/customer/ScanQrLanding';
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
          {/* Landing / Scan QR Requirement: No default table */}
          <Route path="/" element={<ScanQrLanding />} />

          {/* Waiter App Route */}
          <Route path="/waiter" element={<WaiterModule />} />
          <Route path="/waiter/*" element={<WaiterModule />} />

          {/* Authenticated Customer Table QR Entry Route */}
          <Route path="/table/:tableId" element={<MainContainer />} />
          
          {/* Kitchen Dashboard Route */}
          <Route path="/kitchen" element={<KitchenModule />} />
          
          {/* Admin Dashboard Route */}
          <Route path="/admin/*" element={<AdminModule />} />
          
          {/* Missing table redirect to Scan QR page */}
          <Route path="/table" element={<Navigate to="/" replace />} />
          
          {/* Catch-all redirects */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
