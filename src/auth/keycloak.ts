// The Keycloak client for the webapp (config from Vite env vars).
// Single shared instance; initKeycloak() runs init exactly once (React StrictMode double-invokes
// effects in dev, and keycloak-js throws if init() is called twice).
import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL as string,        // e.g. http://localhost:8081
  realm: import.meta.env.VITE_KEYCLOAK_REALM as string,    // e.g. aisc
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID as string, // e.g. aisc-webapp
});

let initPromise: Promise<boolean> | null = null;

export function initKeycloak(): Promise<boolean> {
  if (!initPromise) {
    initPromise = keycloak.init({
      onLoad: "login-required", // FORCE login: unauthenticated users are sent straight to Keycloak,
                                // the app is never shown until they log in.
      pkceMethod: "S256",
    });
  }
  return initPromise;
}

// Wrap window.fetch so every request to the API gets the Bearer token (and a fresh one if it's
// about to expire). Installed once, after Keycloak init. No-op for unauthenticated users.
let fetchPatched = false;
export function installAuthFetch(apiBaseUrl: string): void {
  if (fetchPatched) return;
  fetchPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (keycloak.authenticated && url.startsWith(apiBaseUrl)) {
      try {
        await keycloak.updateToken(30); // refresh if it expires within 30s
      } catch {
        /* refresh failed; send the request without a (fresh) token */
      }
      init = {
        ...init,
        headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${keycloak.token}` },
      };
    }
    return original(input as RequestInfo | URL, init);
  };
}

export default keycloak;
