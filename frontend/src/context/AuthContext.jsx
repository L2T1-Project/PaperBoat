import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

function parseStoredUser(rawUser) {
  if (!rawUser) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawUser);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (typeof parsed.userId === "number" || typeof parsed.userId === "string") &&
      typeof parsed.role === "string"
    ) {
      const normalizedUserId = Number(parsed.userId);
      const normalizedRole = parsed.role.trim().toLowerCase();

      if (Number.isNaN(normalizedUserId) || !normalizedRole) {
        return null;
      }

      return {
        ...parsed,
        userId: normalizedUserId,
        role: normalizedRole,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("pb_token");
    const storedUser = parseStoredUser(localStorage.getItem("pb_user"));

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
      setIsAuthReady(true);
      return;
    }

    localStorage.removeItem("pb_token");
    localStorage.removeItem("pb_user");
    setIsAuthReady(true);
  }, []);

  const login = (nextToken, userObj) => {
    const normalizedUser = {
      ...userObj,
      userId: Number(userObj?.userId),
      role: String(userObj?.role || "").trim().toLowerCase(),
    };

    if (Number.isNaN(normalizedUser.userId) || !normalizedUser.role) {
      return;
    }

    setToken(nextToken);
    setUser(normalizedUser);
    localStorage.setItem("pb_token", nextToken);
    localStorage.setItem("pb_user", JSON.stringify(normalizedUser));
  };

  const logout = async () => {
    try {
      if (token) {
        await api.post("/users/logout");
      }
    } catch {
      // Clear local auth state even if server-side logout fails.
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem("pb_token");
      localStorage.removeItem("pb_user");

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
  };

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthReady,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
    }),
    [token, user, isAuthReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
