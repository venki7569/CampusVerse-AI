import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Building2,
  Boxes,
  Wrench,
  Zap,
  Bot,
  Bell,
  X,
  ShieldAlert,
  Car,
  BarChart3,
  Megaphone,
  LayoutDashboard,
  Layers,
  DoorOpen,
  School,
  FlaskConical,
  Droplet,
  Activity,
  Lightbulb,
  Radio,
  User,
} from 'lucide-react';
import { useAuth, type RoleName } from '../../store/authContext';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchItem {
  label: string;
  category: string;
  path: string;
  icon: React.ElementType;
  roles?: RoleName[];
}

const searchableItems: SearchItem[] = [
  { label: 'Dashboard', category: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Campus Analytics', category: 'Overview', path: '/analytics', icon: BarChart3, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'FACULTY', 'MAINTENANCE_STAFF', 'SECURITY_STAFF'] },
  { label: 'Digital Twin', category: 'Intelligence', path: '/digital-twin', icon: Activity, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'FACULTY', 'MAINTENANCE_STAFF', 'SECURITY_STAFF'] },
  { label: 'IoT Control Center', category: 'Intelligence', path: '/iot', icon: Radio, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'FACULTY', 'MAINTENANCE_STAFF', 'SECURITY_STAFF'] },
  { label: 'Recommendations', category: 'Intelligence', path: '/recommendations', icon: Lightbulb, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'FACULTY', 'MAINTENANCE_STAFF', 'SECURITY_STAFF'] },
  { label: 'Departments Directory', category: 'Facilities', path: '/departments', icon: Building2, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'] },
  { label: 'Buildings', category: 'Facilities', path: '/buildings', icon: Building2, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'] },
  { label: 'Floors', category: 'Facilities', path: '/floors', icon: Layers, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'] },
  { label: 'Rooms', category: 'Facilities', path: '/rooms', icon: DoorOpen, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'] },
  { label: 'Classrooms', category: 'Facilities', path: '/classrooms', icon: School, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'] },
  { label: 'Laboratories', category: 'Facilities', path: '/laboratories', icon: FlaskConical, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'] },
  { label: 'Campus Asset Registry', category: 'Assets', path: '/assets', icon: Boxes, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'] },
  { label: 'Maintenance Work Orders', category: 'Maintenance', path: '/maintenance', icon: Wrench },
  { label: 'Electricity Analytics', category: 'Utilities', path: '/electricity', icon: Zap, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'] },
  { label: 'Water Management', category: 'Utilities', path: '/water', icon: Droplet, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'] },
  { label: 'Notification Center', category: 'Alerts', path: '/notifications', icon: Bell },
  { label: 'Campus Announcements', category: 'Communication', path: '/announcements', icon: Megaphone },
  { label: 'Parking Management', category: 'Facilities', path: '/parking', icon: Car, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'FACULTY', 'STUDENT', 'MAINTENANCE_STAFF', 'SECURITY_STAFF'] },
  { label: 'Campus AI Assistant', category: 'AI', path: '/ai-assistant', icon: Bot },
  { label: 'Admin Control', category: 'Administration', path: '/admin', icon: ShieldAlert, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN'] },
  { label: 'My Profile', category: 'Account', path: '/profile', icon: User },
];

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();

  if (!isOpen) return null;

  const filtered = searchableItems.filter((item) => {
    if (item.roles && !hasAnyRole(item.roles)) return false;
    return (
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
    );
  });

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
    setQuery('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 text-slate-100">
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search campus modules..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white" aria-label="Close search">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">No matching campus resources found.</div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path + item.label}
                  onClick={() => handleSelect(item.path)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-800 text-left transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-slate-950 text-emerald-400 border border-slate-800 group-hover:border-emerald-500/30">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <p className="text-xs text-slate-400">{item.category}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">Jump →</span>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between">
          <span>Press ESC to exit</span>
          <span>Ctrl + K to toggle</span>
        </div>
      </div>
    </div>
  );
};
