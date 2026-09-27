export type GatewayUser = { username: string; roles: string[] };

/**
 * Who the gateway says this is.
 *
 * Every request to the engine passes through oauth2-proxy, which holds the
 * session, refreshes it, and passes the token it has. So a page with no token
 * of its own is not signed out: it asks the API who it is, and the answer comes
 * from a token the engine verified against the realm.
 *
 * Nobody is returned when the request is refused, when the engine cannot be
 * reached, and when the engine is not verifying tokens at all: in that last
 * case it answers, but there is no user behind the request, and saying "signed
 * in" on the screen would be a lie.
 */
export async function whoTheGatewaySays(
  apiUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GatewayUser | null> {
  try {
    const res = await fetchImpl(`${apiUrl}/me`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<GatewayUser> & { auth_disabled?: boolean };
    if (body.auth_disabled || !body.username) return null;
    return { username: body.username, roles: body.roles ?? [] };
  } catch {
    return null;
  }
}

type Where = { pathname: string; search: string };
type Go = (url: string) => void;
const assignLocation: Go = (url) => window.location.assign(url);

/** Sign in at the gateway, the one sign-in for every module, and come back here. */
export function gatewaySignIn(where: Where = window.location, go: Go = assignLocation): void {
  go(`/oauth2/start?rd=${encodeURIComponent(where.pathname + where.search)}`);
}

/** Sign out at the gateway, which ends the session every module shares. */
export function gatewaySignOut(go: Go = assignLocation): void {
  go(`/oauth2/sign_out?rd=${encodeURIComponent("/")}`);
}
