import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { get } from './api/client';
import type { SystemStatus } from './api/types';
import { AuthProvider, useAuth } from './auth';
import { Banner } from './components/Banner';
import { Loading } from './components/ui';
import { useLoad } from './lib/useLoad';
import { ROLE_LABEL } from './lib/format';
import Access from './pages/Access';
import Diagnostics from './pages/Diagnostics';
import Hvac from './pages/Hvac';
import Live from './pages/Live';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Playback from './pages/Playback';
import Relay from './pages/Relay';
import Settings from './pages/Settings';

const NAV = [
  { to: '/', label: '總覽', end: true },
  { to: '/hvac', label: '冷氣' },
  { to: '/access', label: '門禁' },
  { to: '/relay', label: 'Relay 迴路' },
  { to: '/live', label: '即時影像' },
  { to: '/playback', label: '歷史回放' },
  { to: '/settings', label: '系統設定' },
  { to: '/diagnostics', label: '系統診斷' },
];

function Shell() {
  const { me, logout } = useAuth();
  const { data: status } = useLoad((s) => get<SystemStatus>('/v1/system/status', { signal: s }), [], { intervalMs: 30000 });
  if (!me) return null;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">顧好 Edge Control</div>
        <nav aria-label="主選單">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="small">{me.actor}</div>
          <div className="small muted">{ROLE_LABEL[me.role] ?? me.role} · {me.site_id}/{me.edge_id}</div>
          <button type="button" className="btn btn-sm" onClick={() => void logout()}>登出</button>
        </div>
      </aside>
      <div className="main-col">
        <Banner mode={me.mode} simulationMapping={status?.simulation_mapping} />
        <main className="main">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/hvac" element={<Hvac />} />
            <Route path="/access" element={<Access />} />
            <Route path="/relay" element={<Relay />} />
            <Route path="/live" element={<Live />} />
            <Route path="/playback" element={<Playback />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/diagnostics" element={<Diagnostics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function Gate() {
  const { me, loading } = useAuth();
  if (loading) return <Loading text="確認登入狀態…" />;
  if (!me) return <Login />;
  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Gate />
      </HashRouter>
    </AuthProvider>
  );
}
