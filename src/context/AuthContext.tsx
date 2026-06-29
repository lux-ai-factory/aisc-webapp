// Auth context: initializes Keycloak once, tracks login state, and exposes login()/logout()
// plus the current user's identity + roles to the whole app.
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import keycloak, { initKeycloak, installAuthFetch } from "../auth/keycloak";

type AuthState = {
  ready: boolean;            // Keycloak finished initializing
  authenticated: boolean;    // is there a logged-in user
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

  useEffect(() => {
    // make every API call carry the Bearer token once Keycloak is set up
    installAuthFetch(import.meta.env.VITE_API_URL as string);

    initKeycloak()
      .then((auth) => setAuthenticated(auth))
      .catch(() => setAuthenticated(false))
      .finally(() => setReady(true));

    // keep the access token fresh; if refresh fails, drop to logged-out state
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => setAuthenticated(false));
    };
  }, []);

  const value: AuthState = {
    ready,
    authenticated,
    username: keycloak.tokenParsed?.preferred_username as string | undefined,
    roles: (keycloak.tokenParsed?.realm_access?.roles as string[]) ?? [],
    token: keycloak.token,
    login: () => keycloak.login(),                                   // redirect to Keycloak login
    logout: () => keycloak.logout({ redirectUri: window.location.origin }), // back to the app (login page)
  };

  if (!ready) return null; // wait for Keycloak init before rendering the app

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
