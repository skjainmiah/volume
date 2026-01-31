import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Radar as RadarIcon,
  TrendingUp,
  Clock,
  Brain,
  Settings,
  Shield,
  Activity
} from 'lucide-react';
import StatusBar from './StatusBar';
import clsx from 'clsx';

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/radar', label: 'Radar', icon: RadarIcon },
  { path: '/live-decision', label: 'Live Decision', icon: Clock },
  { path: '/trades', label: 'Trades', icon: TrendingUp },
  { path: '/learning', label: 'Learning', icon: Brain },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/safety', label: 'Safety & Logs', icon: Shield },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <StatusBar />

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-surface border-r border-surface-light overflow-y-auto scrollbar-thin">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-8">
              <Activity className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-xl font-bold text-text-primary">SANIA AI</h1>
                <p className="text-xs text-text-muted">Autonomous Trading</p>
              </div>
            </div>

            <nav className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-text-secondary hover:bg-surface-light hover:text-text-primary'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="flex-1 overflow-auto scrollbar-thin">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
