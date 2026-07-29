import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL as string,
  realm: import.meta.env.VITE_KEYCLOAK_REALM as string,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID as string,
});

let initPromise: Promise<boolean> | null = null;

export function initKeycloak(): Promise<boolean> {
  if (!initPromise) {
    initPromise = keycloak
      .init({
        onLoad: "check-sso",
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        pkceMethod: "S256",
        checkLoginIframe: false,
      })
      .then(() => keycloak.authenticated ?? false);
  }
  return initPromise;
}

export function login(): void {
  keycloak.login();
}

export function logout(): void {
  keycloak.logout({ redirectUri: window.location.origin });
}

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
        await keycloak.updateToken(30);
      } catch {
        keycloak.authenticated = false;
      }
      if (keycloak.authenticated) {
        init = {
          ...init,
          headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${keycloak.token}` },
        };
      }
    }
    return original(input as RequestInfo | URL, init);
  };
}

export default keycloak;
