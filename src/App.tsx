import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Radar from './pages/Radar';
import StockIntelligence from './pages/StockIntelligence';
import LiveDecision from './pages/LiveDecision';
import Trades from './pages/Trades';
import Learning from './pages/Learning';
import Settings from './pages/Settings';
import SafetyLogs from './pages/SafetyLogs';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="radar" element={<Radar />} />
          <Route path="stock/:radarId" element={<StockIntelligence />} />
          <Route path="live-decision" element={<LiveDecision />} />
          <Route path="trades" element={<Trades />} />
          <Route path="learning" element={<Learning />} />
          <Route path="settings" element={<Settings />} />
          <Route path="safety" element={<SafetyLogs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
