import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, type RoleName } from '../store/authContext';
import {
  LayoutDashboard,
  Building2,
  Boxes,
  Wrench,
  Zap,
  Bot,
  LogOut,
  ShieldAlert,
  Layers,
  DoorOpen,
  School,
  FlaskConical,
  Droplet,
  Bell,
  Car,
  Megaphone,
  BarChart3,
  Activity,
  Lightbulb,
  Radio,
} from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles?: RoleName[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Analytics',
    path: '/analytics',
    icon: BarChart3,
    roles: [
      'SUPER_ADMIN',
      'CAMPUS_ADMIN',
      'DEPARTMENT_ADMIN',
      'FACULTY',
      'MAINTENANCE_STAFF',
      'SECURITY_STAFF',
    ],
  },
  { label: 'Notifications', path: '/notifications', icon: Bell },
  { label: 'Announcements', path: '/announcements', icon: Megaphone },
  {
    label: 'Digital Twin',
    path: '/digital-twin',
    icon: Activity,
    roles: [
      'SUPER_ADMIN',
      'CAMPUS_ADMIN',
      'DEPARTMENT_ADMIN',
      'FACULTY',
      'MAINTENANCE_STAFF',
      'SECURITY_STAFF',
    ],
  },
  {
    label: 'IoT Control',
    path: '/iot',
    icon: Radio,
    roles: [
      'SUPER_ADMIN',
      'CAMPUS_ADMIN',
      'DEPARTMENT_ADMIN',
      'FACULTY',
      'MAINTENANCE_STAFF',
      'SECURITY_STAFF',
    ],
  },
  {
    label: 'Recommendations',
    path: '/recommendations',
    icon: Lightbulb,
    roles: [
      'SUPER_ADMIN',
      'CAMPUS_ADMIN',
      'DEPARTMENT_ADMIN',
      'FACULTY',
      'MAINTENANCE_STAFF',
      'SECURITY_STAFF',
    ],
  },
  {
    label: 'Departments',
    path: '/departments',
    icon: Building2,
    roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'],
  },
  {
    label: 'Assets',
    path: '/assets',
    icon: Boxes,
    roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'],
  },
  {
    label: 'Maintenance',
    path: '/maintenance',
    icon: Wrench,
  },
  {
    label: 'Electricity',
    path: '/electricity',
    icon: Zap,
    roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'],
  },
  {
    label: 'Water',
    path: '/water',
    icon: Droplet,
    roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'],
  },
  {
    label: 'Parking',
    path: '/parking',
    icon: Car,
    roles: [
      'SUPER_ADMIN',
      'CAMPUS_ADMIN',
      'DEPARTMENT_ADMIN',
      'FACULTY',
      'STUDENT',
      'MAINTENANCE_STAFF',
      'SECURITY_STAFF',
    ],
  },
  { label: 'Buildings', path: '/buildings', icon: Building2, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'] },
  { label: 'Floors', path: '/floors', icon: Layers, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'] },
  { label: 'Rooms', path: '/rooms', icon: DoorOpen, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'] },
  { label: 'Classrooms', path: '/classrooms', icon: School, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'] },
  { label: 'Laboratories', path: '/laboratories', icon: FlaskConical, roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'] },
  {
    label: 'AI Assistant',
    path: '/ai-assistant',
    icon: Bot,
  },
  {
    label: 'Admin Control',
    path: '/admin',
    icon: ShieldAlert,
    roles: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN'],
  },
];

export const Navigation: React.FC = () => {
  const { user, logout, hasAnyRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 min-h-screen">
      <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950">
          CV
        </div>
        <div>
          <h1 className="font-bold text-lg leading-none text-white">CampusVerse AI</h1>
          <span className="text-xs text-slate-400">Digital Twin Platform</span>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-slate-800 bg-slate-950/50">
        <p className="text-xs text-slate-400">Signed in as</p>
        <p className="font-medium text-sm text-slate-200 truncate">{user?.firstName} {user?.lastName}</p>
        <div className="flex flex-wrap gap-1 mt-2">
          {user?.roles.map((role) => (
            <span
              key={role}
              className="text-[10px] uppercase tracking-wider bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold"
            >
              {role.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          if (item.roles && !hasAnyRole(item.roles)) {
            return null;
          }
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Icon className="w-5 h-5 text-slate-400" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors text-sm font-medium"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
