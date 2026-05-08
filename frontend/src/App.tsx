import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { clearStoredToken, getStoredToken } from './api/client';
import AppLayout from './components/AppLayout';
import AwardOverridesPage from './pages/AwardOverridesPage';
import BulkSimulationPage from './pages/BulkSimulationPage';
import DemoSitePage from './pages/DemoSitePage';
import LoginPage from './pages/LoginPage';
import PlayerLookupPage from './pages/PlayerLookupPage';
import ProbabilitySettingsPage from './pages/ProbabilitySettingsPage';
import ReportsPage from './pages/ReportsPage';
import SpinSimulatorPage from './pages/SpinSimulatorPage';

export default function App() {
  const [token, setToken] = useState(() => getStoredToken());
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {token ? (
          <AppLayout
            onLogout={() => {
              clearStoredToken();
              setToken(null);
              queryClient.clear();
            }}
          >
            <Routes>
              <Route path="/" element={<Navigate to="/spin-simulator" replace />} />
              <Route path="/spin-simulator" element={<SpinSimulatorPage />} />
              <Route path="/players" element={<PlayerLookupPage />} />
              <Route path="/award-overrides" element={<AwardOverridesPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/bulk-simulation" element={<BulkSimulationPage />} />
              <Route path="/demo" element={<DemoSitePage />} />
              <Route path="/probability" element={<ProbabilitySettingsPage />} />
              <Route path="*" element={<Navigate to="/spin-simulator" replace />} />
            </Routes>
          </AppLayout>
        ) : (
          <LoginPage onLogin={() => setToken(getStoredToken())} />
        )}
      </BrowserRouter>
    </QueryClientProvider>
  );
}
