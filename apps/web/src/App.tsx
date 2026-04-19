import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserRole } from '@if-fleet/domain';
import { useAuthStore } from './stores/auth.store';
import { Layout } from './components/Layout';

// Auth pages
import { LoginPage } from './pages/auth/LoginPage';
import { CompleteProfilePage } from './pages/auth/CompleteProfilePage';

// Employee pages
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard';
import { NewBookingPage } from './pages/employee/NewBookingPage';
import { BookingHistoryPage } from './pages/employee/BookingHistoryPage';
import { TripTrackingPage } from './pages/employee/TripTrackingPage';
import { EmployeeProfilePage } from './pages/employee/ProfilePage';

// Driver pages
import { DriverDashboard } from './pages/driver/DriverDashboard';
import { DriverFleetPage } from './pages/driver/FleetPage';
import { ActiveTripPage } from './pages/driver/ActiveTripPage';
import { DriverHistoryPage } from './pages/driver/HistoryPage';
import { DriverProfilePage } from './pages/driver/ProfilePage';

// Admin pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { FleetMapPage } from './pages/admin/FleetMapPage';
import { BookingQueuePage } from './pages/admin/BookingQueuePage';
import { FleetMasterPage } from './pages/admin/FleetMasterPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { UsersPage } from './pages/admin/UsersPage';

function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: UserRole[] }) {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated()) return <Navigate to="/login" replace />;

  // Profile completion gate — applies to all roles
  if (user && !user.profileCompleted) {
    return <Navigate to="/complete-profile" replace />;
  }

  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <Layout>{children}</Layout>;
}

function RoleHome() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.profileCompleted) return <Navigate to="/complete-profile" replace />;
  if (user.role === UserRole.ADMIN) return <Navigate to="/admin" replace />;
  if (user.role === UserRole.DRIVER) return <Navigate to="/driver" replace />;
  return <Navigate to="/employee" replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Profile completion — requires auth but bypasses layout and profileCompleted check */}
        <Route path="/complete-profile" element={<CompleteProfilePage />} />

        {/* Role home redirect */}
        <Route path="/" element={<RequireAuth><RoleHome /></RequireAuth>} />

        {/* Employee */}
        <Route path="/employee" element={<RequireAuth roles={[UserRole.EMPLOYEE, UserRole.ADMIN]}><EmployeeDashboard /></RequireAuth>} />
        <Route path="/employee/book" element={<RequireAuth roles={[UserRole.EMPLOYEE, UserRole.ADMIN]}><NewBookingPage /></RequireAuth>} />
        <Route path="/employee/history" element={<RequireAuth roles={[UserRole.EMPLOYEE, UserRole.ADMIN]}><BookingHistoryPage /></RequireAuth>} />
        <Route path="/employee/trip/:tripId" element={<RequireAuth roles={[UserRole.EMPLOYEE, UserRole.ADMIN]}><TripTrackingPage /></RequireAuth>} />
        <Route path="/employee/profile" element={<RequireAuth roles={[UserRole.EMPLOYEE, UserRole.ADMIN]}><EmployeeProfilePage /></RequireAuth>} />

        {/* Driver */}
        <Route path="/driver" element={<RequireAuth roles={[UserRole.DRIVER]}><DriverDashboard /></RequireAuth>} />
        <Route path="/driver/fleet" element={<RequireAuth roles={[UserRole.DRIVER]}><DriverFleetPage /></RequireAuth>} />
        <Route path="/driver/trip/:tripId" element={<RequireAuth roles={[UserRole.DRIVER]}><ActiveTripPage /></RequireAuth>} />
        <Route path="/driver/assignments" element={<RequireAuth roles={[UserRole.DRIVER]}><ActiveTripPage /></RequireAuth>} />
        <Route path="/driver/history" element={<RequireAuth roles={[UserRole.DRIVER]}><DriverHistoryPage /></RequireAuth>} />
        <Route path="/driver/profile" element={<RequireAuth roles={[UserRole.DRIVER]}><DriverProfilePage /></RequireAuth>} />

        {/* Admin */}
        <Route path="/admin" element={<RequireAuth roles={[UserRole.ADMIN]}><AdminDashboard /></RequireAuth>} />
        <Route path="/admin/map" element={<RequireAuth roles={[UserRole.ADMIN]}><FleetMapPage /></RequireAuth>} />
        <Route path="/admin/bookings" element={<RequireAuth roles={[UserRole.ADMIN]}><BookingQueuePage /></RequireAuth>} />
        <Route path="/admin/fleet" element={<RequireAuth roles={[UserRole.ADMIN]}><FleetMasterPage /></RequireAuth>} />
        <Route path="/admin/users" element={<RequireAuth roles={[UserRole.ADMIN]}><UsersPage /></RequireAuth>} />
        <Route path="/admin/reports" element={<RequireAuth roles={[UserRole.ADMIN]}><ReportsPage /></RequireAuth>} />
        <Route path="/admin/settings" element={<RequireAuth roles={[UserRole.ADMIN]}><SettingsPage /></RequireAuth>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
