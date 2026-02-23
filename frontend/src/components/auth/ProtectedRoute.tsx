import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loadFromStorage } = useAuthStore();

  if (!isAuthenticated && !loadFromStorage()) {
    console.warn('[ProtectedRoute] NOT authenticated — redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
