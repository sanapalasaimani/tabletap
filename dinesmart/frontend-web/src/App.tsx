import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { MainContainer } from './pages/customer/MainContainer';
import { KitchenModule } from './pages/kitchen/KitchenModule';
import { AdminModule } from './pages/admin/AdminModule';
import './App.css';

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Main Customer QR Entry Route */}
          <Route path="/table/:tableId" element={<MainContainer />} />
          
          {/* Kitchen Dashboard Route */}
          <Route path="/kitchen" element={<KitchenModule />} />
          
          {/* Admin Dashboard Route */}
          <Route path="/admin/*" element={<AdminModule />} />
          
          {/* Default Table fallback for demo purposes */}
          <Route path="/table" element={<Navigate to="/table/05" replace />} />
          
          {/* Catch-all redirects to default table */}
          <Route path="*" element={<Navigate to="/table/05" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
