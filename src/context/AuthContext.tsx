import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { API_VERSION_PREFIX } from "../config";
import keycloak, { initKeycloak, installAuthFetch, login as kcLogin, logout as kcLogout } from "../auth/keycloak";
import { isConfigurator } from "../deployment";
import { gatewaySignIn, gatewaySignOut, whoTheGatewaySays } from "../platform/gatewaySession";

/**
 * Who is using the engine.
 *
 * Standalone (Sean's engine): its own Keycloak login, the token added to every
 * API call.
 *
 * Configurator: the engine has no login of its own. People sign in once, at
 * the gateway (oauth2-proxy in front of Keycloak), which holds the session and
 * passes its token on every request; the page asks the API who that is.
 * Signing in and out go to the gateway too.
 */
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
  const configurator = isConfigurator();

  useEffect(() => {
    if (configurator) {
      whoTheGatewaySays(`${import.meta.env.VITE_API_URL}${API_VERSION_PREFIX}`)
        .then((who) => {
          setAuthenticated(Boolean(who));
          setUsername(who?.username);
          setRoles(who?.roles ?? []);
        })
        .finally(() => setReady(true));
      return;
    }

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
  }, [configurator]);

  const value: AuthState = {
    ready,
    authenticated,
    username,
    roles,
    token,
    login: () => (configurator ? gatewaySignIn() : kcLogin()),
    logout: () => (configurator ? gatewaySignOut() : kcLogout()),
  };

  if (!ready) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
