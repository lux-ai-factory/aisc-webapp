import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL as string,
  realm: import.meta.env.VITE_KEYCLOAK_REALM as string,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID as string,
});

const KC_TOKEN_URL = `${import.meta.env.VITE_KEYCLOAK_URL}/realms/${import.meta.env.VITE_KEYCLOAK_REALM}/protocol/openid-connect/token`;

let initPromise: Promise<boolean> | null = null;

export function initKeycloak(): Promise<boolean> {
  if (!initPromise) {
    initPromise = keycloak.init({
      onLoad: "check-sso",
      silentCheckSsoRedirectUri: window.location.origin + "/silent-check-sso.html",
      pkceMethod: "S256",
    });
  }
  return initPromise!;
}

export async function loginWithCredentials(
  username: string,
  password: string,
): Promise<{ access_token: string; tokenParsed: Record<string, unknown> }> {
  const params = new URLSearchParams({
    client_id: keycloak.clientId || "",
    username,
    password,
    grant_type: "password",
  });

  const res = await fetch(KC_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Login failed (${res.status})`);
  }

  const data = await res.json();

  const tokenParsed = JSON.parse(atob(data.access_token.split(".")[1]));

  keycloak.token = data.access_token;
  keycloak.tokenParsed = tokenParsed;
  keycloak.refreshToken = data.refresh_token;
  keycloak.authenticated = true;

  return { access_token: data.access_token, tokenParsed };
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
        /* refresh failed */
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