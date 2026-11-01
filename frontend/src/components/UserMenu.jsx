import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  const initial = (user.fullName || user.email || 'U').charAt(0).toUpperCase();

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 border border-transparent hover:border-border"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user.photoUrl ? (
          <img src={user.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <span className="w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center">
            {initial}
          </span>
        )}
        <span className="hidden sm:block text-sm font-medium text-text-dark max-w-[120px] truncate">
          {user.fullName || user.email}
        </span>
        <ChevronDown className="w-4 h-4 text-text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-white border border-border rounded-xl shadow-lg py-1 z-50" role="menu">
          <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-text-dark hover:bg-blue-50">
            <User className="w-4 h-4 text-primary" /> Profile
          </Link>
          <Link to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-text-dark hover:bg-blue-50">
            <Settings className="w-4 h-4 text-primary" /> Settings
          </Link>
          <button type="button" onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-danger hover:bg-red-50">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
