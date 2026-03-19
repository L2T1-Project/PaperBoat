import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children, allowedRoles, requireUserIdParam }) {
  const { isAuthenticated, isAuthReady, user } = useAuth();
  const params = useParams();

  if (!isAuthReady) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length) {
    if (!allowedRoles.includes(user?.role)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  if (requireUserIdParam) {
    const routeUserId = Number(params?.[requireUserIdParam]);
    if (Number.isNaN(routeUserId) || Number(user?.userId) !== routeUserId) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}
