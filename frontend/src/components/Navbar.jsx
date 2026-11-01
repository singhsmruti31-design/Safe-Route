import { Link, useLocation } from 'react-router-dom';
import { Shield, MapPin, Navigation, AlertTriangle, Info, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import UserMenu from './UserMenu.jsx';

const navLinks = [
  { to: '/',           label: 'Home',        icon: Shield },
  { to: '/dashboard',  label: 'Dashboard',   icon: Navigation },
  { to: '/nearby',     label: 'Nearby Help', icon: MapPin },
  { to: '/report',     label: 'Report',      icon: AlertTriangle },
  { to: '/about',      label: 'About',       icon: Info },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group" aria-label="Safe Route Home">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-text-dark text-lg tracking-tight">
            Safe<span className="text-primary">Route</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(({ to, label }) => {
            const active = pathname === to || (to !== '/' && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-primary'
                    : 'text-text-muted hover:text-text-dark hover:bg-gray-50'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link to="/login" className="text-sm font-medium text-text-dark px-3 py-1.5 rounded-lg hover:bg-gray-50">
                Login
              </Link>
              <Link to="/signup" className="text-sm font-semibold text-white bg-primary px-3 py-1.5 rounded-lg hover:bg-blue-700">
                Sign Up
              </Link>
            </div>
          )}
          <Link
            to="/sos"
            className="hidden sm:flex items-center gap-1.5 bg-danger text-white text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors sos-pulse"
            aria-label="Emergency SOS"
          >
            <AlertTriangle className="w-4 h-4" />
            SOS
          </Link>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-text-muted hover:bg-gray-100 transition"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-border px-4 py-3 space-y-1 animate-fade-in">
          {navLinks.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to !== '/' && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-blue-50 text-primary' : 'text-text-muted hover:text-text-dark hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
          {isAuthenticated ? (
            <>
              <Link to="/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-muted hover:bg-gray-50">
                Profile
              </Link>
              <Link to="/settings" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-muted hover:bg-gray-50">
                Settings
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-muted hover:bg-gray-50">
                Login
              </Link>
              <Link to="/signup" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary hover:bg-blue-50">
                Sign Up
              </Link>
            </>
          )}
          <Link
            to="/sos"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold text-danger hover:bg-red-50 transition"
          >
            <AlertTriangle className="w-4 h-4" />
            Emergency SOS
          </Link>
        </div>
      )}
    </header>
  );
}
