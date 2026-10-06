import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './store/authContext';
import { ToastProvider } from './components/ui/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardShell } from './layouts/DashboardShell';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Unauthorized } from './pages/Unauthorized';
import { Dashboard } from './pages/Dashboard';
import { Buildings } from './pages/Buildings';
import { Floors } from './pages/Floors';
import { Rooms } from './pages/Rooms';
import { Classrooms } from './pages/Classrooms';
import { Laboratories } from './pages/Laboratories';
import { Departments } from './pages/Departments';
import { Assets } from './pages/Assets';
import { Maintenance } from './pages/Maintenance';
import { Electricity } from './pages/Electricity';
import { Water } from './pages/Water';
import { Notifications } from './pages/Notifications';
import { Admin } from './pages/Admin';
import { Parking } from './pages/Parking';
import { Analytics } from './pages/Analytics';
import { AIAssistant } from './pages/AIAssistant';
import { Announcements } from './pages/Announcements';
import { DigitalTwin } from './pages/DigitalTwin';
import { Recommendations } from './pages/Recommendations';
import { IoTControlCenter } from './pages/IoTControlCenter';
import { Profile } from './pages/Profile';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RealtimeProvider } from './providers/RealtimeProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RealtimeProvider>
            <ToastProvider>
              <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* Protected Routes (All Authenticated Users) */}
              <Route element={<ProtectedRoute />}>
                <Route
                  path="/dashboard"
                  element={
                    <DashboardShell>
                      <Dashboard />
                    </DashboardShell>
                  }
                />
                <Route
                  path="/maintenance"
                  element={
                    <DashboardShell>
                      <Maintenance />
                    </DashboardShell>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <DashboardShell>
                      <Notifications />
                    </DashboardShell>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <DashboardShell>
                      <Profile />
                    </DashboardShell>
                  }
                />
                <Route
                  path="/ai-assistant"
                  element={
                    <DashboardShell>
                      <AIAssistant />
                    </DashboardShell>
                  }
                />
                <Route
                  path="/announcements"
                  element={
                    <DashboardShell>
                      <Announcements />
                    </DashboardShell>
                  }
                />
              </Route>

              {/* Staff intelligence modules */}
              <Route
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'SUPER_ADMIN',
                      'CAMPUS_ADMIN',
                      'DEPARTMENT_ADMIN',
                      'FACULTY',
                      'MAINTENANCE_STAFF',
                      'SECURITY_STAFF',
                    ]}
                  />
                }
              >
                <Route
                  path="/digital-twin"
                  element={
                    <DashboardShell>
                      <DigitalTwin />
                    </DashboardShell>
                  }
                />
                <Route
                  path="/recommendations"
                  element={
                    <DashboardShell>
                      <Recommendations />
                    </DashboardShell>
                  }
                />
                <Route
                  path="/iot"
                  element={
                    <DashboardShell>
                      <IoTControlCenter />
                    </DashboardShell>
                  }
                />
              </Route>

              {/* Admin & Staff Protected Routes */}
              <Route
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'SUPER_ADMIN',
                      'CAMPUS_ADMIN',
                      'DEPARTMENT_ADMIN',
                      'MAINTENANCE_STAFF',
                      'FACULTY',
                    ]}
                  />
                }
              >
                <Route
                  path="/buildings"
                  element={
                    <DashboardShell>
                      <Buildings />
                    </DashboardShell>
                  }
                />
                <Route
                  path="/floors"
                  element={
                    <DashboardShell>
                      <Floors />
                    </DashboardShell>
                  }
                />
                <Route
                  path="/rooms"
                  element={
                    <DashboardShell>
                      <Rooms />
                    </DashboardShell>
                  }
                />
                <Route
                  path="/classrooms"
                  element={
                    <DashboardShell>
                      <Classrooms />
                    </DashboardShell>
                  }
                />
                <Route
                  path="/laboratories"
                  element={
                    <DashboardShell>
                      <Laboratories />
                    </DashboardShell>
                  }
                />
                <Route
                  path="/departments"
                  element={
                    <DashboardShell>
                      <Departments />
                    </DashboardShell>
                  }
                />
                <Route
                  path="/assets"
                  element={
                    <DashboardShell>
                      <Assets />
                    </DashboardShell>
                  }
                />
                <Route
                  path="/electricity"
                  element={
                    <DashboardShell>
                      <Electricity />
                    </DashboardShell>
                  }
                />
                <Route
                  path="/water"
                  element={
                    <DashboardShell>
                      <Water />
                    </DashboardShell>
                  }
                />
              </Route>

              {/* Analytics — campus-wide reporting */}
              <Route
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'SUPER_ADMIN',
                      'CAMPUS_ADMIN',
                      'DEPARTMENT_ADMIN',
                      'FACULTY',
                      'MAINTENANCE_STAFF',
                      'SECURITY_STAFF',
                    ]}
                  />
                }
              >
                <Route
                  path="/analytics"
                  element={
                    <DashboardShell>
                      <Analytics />
                    </DashboardShell>
                  }
                />
              </Route>

              {/* Parking — broader campus access */}
              <Route
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'SUPER_ADMIN',
                      'CAMPUS_ADMIN',
                      'DEPARTMENT_ADMIN',
                      'FACULTY',
                      'STUDENT',
                      'MAINTENANCE_STAFF',
                      'SECURITY_STAFF',
                    ]}
                  />
                }
              >
                <Route
                  path="/parking"
                  element={
                    <DashboardShell>
                      <Parking />
                    </DashboardShell>
                  }
                />
              </Route>

              {/* Admin Control */}
              <Route
                element={
                  <ProtectedRoute
                    allowedRoles={['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN']}
                  />
                }
              >
                <Route
                  path="/admin"
                  element={
                    <DashboardShell>
                      <Admin />
                    </DashboardShell>
                  }
                />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
              </BrowserRouter>
            </ToastProvider>
          </RealtimeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
