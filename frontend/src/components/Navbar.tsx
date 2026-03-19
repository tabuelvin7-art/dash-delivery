import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const links: Record<string, { label: string; href: string; icon: string }[]> = {
    business_owner: [
      { label: 'Dashboard', href: '/dashboard', icon: '▦' },
      { label: 'Packages', href: '/packages', icon: '📦' },
      { label: 'Shelves', href: '/shelves', icon: '🗄️' },
      { label: 'Reports', href: '/reports', icon: '📊' },
    ],
    customer: [
      { label: 'My Deliveries', href: '/dashboard', icon: '📦' },
    ],
    agent: [
      { label: 'Dashboard', href: '/agent', icon: '▦' },
      { label: 'Packages', href: '/packages', icon: '📦' },
      { label: 'Shelves', href: '/agent/shelves', icon: '🗄️' },
      { label: 'Reports', href: '/agent/reports', icon: '📊' },
    ],
    admin: [
      { label: 'Dashboard', href: '/dashboard', icon: '▦' },
      { label: 'Packages', href: '/admin/packages', icon: '📦' },
      { label: 'Reports', href: '/reports', icon: '📊' },
      { label: 'Agents', href: '/admin/agents', icon: '👥' },
    ],
  };

  const navLinks = user ? (links[user.role] || []) : [];
  const roleLabel: Record<string, string> = {
    business_owner: 'Business',
    customer: 'Customer',
    agent: 'Agent',
    admin: 'Admin',
  };

  return (
    <nav className="bg-gradient-to-r from-green-800 to-green-700 text-white shadow-lg sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <span className="bg-white/20 rounded-lg px-2 py-0.5 text-white text-sm font-black">DD</span>
            <span className="hidden sm:inline">DashDelivery</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(l => {
              const active = location.pathname === l.href || (l.href !== '/agent' && location.pathname.startsWith(l.href + '/'));
              return (
                <Link
                  key={l.href}
                  to={l.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'text-green-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user && <NotificationBell />}
            {user && (
              <div className="flex items-center gap-2">
                <Link to="/profile" className="text-right hover:opacity-80 transition-opacity">
                  <p className="text-xs font-semibold leading-none">{user.profile?.firstName} {user.profile?.lastName}</p>
                  <p className="text-xs text-green-300 leading-none mt-0.5">{roleLabel[user.role] || user.role}</p>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-xs bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
            {!user && (
              <Link to="/track" className="text-xs text-green-200 hover:text-white font-medium">Track Package</Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2 rounded-lg hover:bg-white/10" onClick={() => setOpen(!open)}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/10 px-4 py-3 space-y-1 bg-green-800">
          {navLinks.map(l => (
            <Link
              key={l.href}
              to={l.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                location.pathname === l.href ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
            >
              {l.label}
            </Link>
          ))}
          {user && (
            <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium hover:bg-white/10">
              My Profile
            </Link>
          )}
          {user && (
            <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-green-200 hover:text-white">
              Logout
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
