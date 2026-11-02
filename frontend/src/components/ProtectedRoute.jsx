import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Loading from './Loading.jsx';

/** Only logged-in students can see these pages. */
export function ProtectedRoute() {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return <Loading label="Checking your session..." />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Login/Register are hidden once you're logged in. */
export function GuestRoute() {
  const { user, initializing } = useAuth();
  if (initializing) return <Loading label="Checking your session..." />;
  if (user) return <Navigate to="/find-ride" replace />;
  return <Outlet />;
}
