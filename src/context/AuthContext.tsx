import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { API_VERSION_PREFIX } from "../config";
import { gatewaySignIn, gatewaySignOut, whoTheGatewaySays } from "../platform/gatewaySession";

/**
 * Who is using the engine, as the gateway says.
 *
 * The engine has no login of its own. People sign in once, at the gateway
 * (oauth2-proxy in front of Keycloak), which holds the session and passes its
 * token on every request; the page asks the API who that is. Signing in and
 * out go to the gateway too.
 */
type AuthState = {
  ready: boolean;
  authenticated: boolean;
  username?: string;
  roles: string[];
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | undefined>();
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    whoTheGatewaySays(`${import.meta.env.VITE_API_URL}${API_VERSION_PREFIX}`)
      .then((who) => {
        setAuthenticated(Boolean(who));
        setUsername(who?.username);
        setRoles(who?.roles ?? []);
      })
      .finally(() => setReady(true));
  }, []);

  const value: AuthState = {
    ready,
    authenticated,
    username,
    roles,
    login: () => gatewaySignIn(),
    logout: () => gatewaySignOut(),
  };

  if (!ready) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
