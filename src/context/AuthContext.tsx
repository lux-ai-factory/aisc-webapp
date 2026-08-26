import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { API_VERSION_PREFIX } from "../config";
import keycloak, { initKeycloak, installAuthFetch, login as kcLogin, logout as kcLogout } from "../auth/keycloak";

type AuthState = {
  ready: boolean;
  authenticated: boolean;
  username?: string;
  roles: string[];
  token?: string;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | undefined>();
  const [roles, setRoles] = useState<string[]>([]);
  const [token, setToken] = useState<string | undefined>();

  useEffect(() => {
    installAuthFetch(`${import.meta.env.VITE_API_URL}${API_VERSION_PREFIX}`);

    initKeycloak()
      .then(() => {
        setAuthenticated(keycloak.authenticated ?? false);
        setUsername(keycloak.tokenParsed?.preferred_username as string | undefined);
        setRoles((keycloak.tokenParsed?.realm_access?.roles as string[]) ?? []);
        setToken(keycloak.token);
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setReady(true));

    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => {
        setAuthenticated(false);
        setUsername(undefined);
        setRoles([]);
        setToken(undefined);
      });
    };
  }, []);

  const value: AuthState = {
    ready,
    authenticated,
    username,
    roles,
    token,
    login: () => kcLogin(),
    logout: () => kcLogout(),
  };

  if (!ready) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
