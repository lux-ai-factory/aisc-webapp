import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

const ALLAUTH_BASE = "/_allauth/browser/v1";
const API_BASE = import.meta.env.VITE_API_URL + "/api/v1";

type User = {
  id: number;
  email: string;
  username: string;
  roles: string[];
  is_admin: boolean;
};

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  checkSession: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(`${ALLAUTH_BASE}/auth/session`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const u = data?.data?.user;
        if (u) {
          // Fetch roles from /api/v1/auth/me
          let roles: string[] = [];
          let is_admin = false;
          try {
            const meRes = await fetch(`${API_BASE}/auth/me`, {
              credentials: "include",
            });
            if (meRes.ok) {
              const meData = await meRes.json();
              roles = meData.roles ?? [];
              is_admin = meData.is_admin ?? false;
            }
          } catch {
            // Roles endpoint not available, continue without roles
          }
          setUser({
            id: u.id,
            email: u.email,
            username: u.username || u.email,
            roles,
            is_admin,
          });
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const logout = useCallback(async () => {
    // 1. Kill Django session (with CSRF token)
    const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/);
    const csrfToken = csrfMatch ? csrfMatch[1] : "";
    await fetch(`${ALLAUTH_BASE}/auth/session`, {
      method: "DELETE",
      credentials: "include",
      headers: { "X-CSRFToken": csrfToken },
    });
    setUser(null);
    setIsAuthenticated(false);

    // 2. Kill Keycloak session so user must re-enter credentials
    const keycloakLogout = `${import.meta.env.VITE_KEYCLOAK_URL || "http://keycloak.localhost:8180"}/realms/a4s/protocol/openid-connect/logout`;
    const redirectUri = encodeURIComponent(window.location.origin + "/");
    window.location.href = `${keycloakLogout}?client_id=a4s-backend&post_logout_redirect_uri=${redirectUri}`;
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, checkSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
