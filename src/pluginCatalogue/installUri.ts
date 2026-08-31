/**
 * Helpers for the public-catalogue <-> local-app plugin install flow.
 *
 * The public catalogue communicates with this local app using a custom
 * protocol URI of the form:
 *
 *   web+aiscplugin://install?package=<name>&version=<version>
 *
 * The URI reaches the app either:
 *   - via the service worker interceptor (/protocol-receiver?uri=...) and a
 *     postMessage to an open tab, or
 *   - directly on the URL (?uri=...) when the app boots from scratch.
 */

export interface CatalogInstallPayload {
  /** Plugin package name, e.g. "aisc-plugin-fairness". */
  package: string;
  /** Optional explicit version. */
  version: string | null;
  /** The raw incoming URI, kept for debugging/forwarding. */
  uri: string;
}

export const INSTALL_MESSAGE_TYPE = 'PLUGIN_INSTALL';

/** Message contract received from the service worker. */
export interface InstallMessage {
  type: typeof INSTALL_MESSAGE_TYPE;
  payload: string;
}

/**
 * Parse a catalogue install URI into a structured payload.
 * Returns null if the URI does not carry a `package` query parameter.
 */
export function parseInstallUri(uri: string | null | undefined): CatalogInstallPayload | null {
  if (!uri) return null;

  let packageName: string | null = null;
  let version: string | null = null;

  try {
    const parsed = new URL(uri);
    packageName = parsed.searchParams.get('package');
    version = parsed.searchParams.get('version');
  } catch {
    // A malformed URL should not crash the app; fall through to regex.
  }

  if (!packageName) {
    const m = uri.match(/[?&]package=([^&]+)/);
    if (m) {
      packageName = decodeURIComponent(m[1]);
      const v = uri.match(/[?&]version=([^&]+)/);
      version = v ? decodeURIComponent(v[1]) : null;
    }
  }

  if (!packageName) return null;

  return { package: packageName, version, uri };
}

/**
 * Open the public catalogue in a new tab, attaching an expiring, obfuscated
 * handshake token in the URL fragment so the catalogue can route installs
 * straight back to this local app without storing any private network info.
 */
export function openPublicCatalogue(): void {
  const base = (import.meta.env.VITE_CATALOG_URL as string | undefined) || 'http://localhost:8000';
  const catalogUrl = base.replace(/\/+$/, '');

  const payload = {
    url: window.location.origin,
    expires: Date.now() + 60 * 60 * 1000, // 60 minutes
  };
  const encoded = btoa(JSON.stringify(payload));

  window.open(`${catalogUrl}/#env=${encoded}`, '_blank');
}

// Browsers only accept custom schemes of the form "web+<lowercase letters>" —
// no hyphens/digits/dots — so this must remain plain ASCII letters.
export const PROTOCOL_SCHEME = 'web+aiscplugin';

export type ProtocolRegistrationStatus =
  | 'not-ready' // never attempted
  | 'registered'
  | 'unsupported'
  | 'error';

/**
 * Whether the current context is able to register custom protocol handlers.
 * Requires a secure context (HTTPS or localhost) and browser support.
 */
export function isProtocolHandlerSupported(): boolean {
  if (!('registerProtocolHandler' in navigator)) return false;
  return window.isSecureContext;
}

/**
 * Register this app as the handler for the web+aiscplugin custom protocol.
 * Enables OS-level deep links (e.g. clicking an install link from email/Discord)
 * even without an active handshake.
 *
 * In modern browsers this returns a Promise, which rejects if the registration
 * is refused, so callers should not rely on throwing. Returns the resulting
 * status.
 *
 * Only available on localhost or HTTPS origins.
 *
 * Registration is browser-global and persistent: it survives tab open/close
 * and app reloads, so callers must NOT unregister it on a routine basis. The
 * only reason to unregister first is to reset Chrome's "user declined" cache so
 * the prompt reappears — a destructive action that should happen only on an
 * explicit user gesture (see `forceReset`).
 */
export async function tryRegisterProtocolHandler(
  forceReset = false,
): Promise<ProtocolRegistrationStatus> {
  if (!('registerProtocolHandler' in navigator)) return 'unsupported';
  if (!window.isSecureContext) return 'unsupported';

  const handlerUrl = `${window.location.origin}/protocol-receiver?uri=%s`;

  // If the user previously declined the registration prompt, the browser caches
  // that refusal and suppresses the prompt on subsequent calls. Unregistering
  // (Chrome/Edge) sometimes resets this cache so the prompt appears again. This
  // is destructive (it removes a working registration), so it only runs when the
  // user explicitly asks to (re-)register — never from the automatic boot path.
  if (forceReset) {
    const navWithUnregister = navigator as Navigator & {
      unregisterProtocolHandler?: (scheme: string, url: string) => void | Promise<void>;
    };
    if (typeof navWithUnregister.unregisterProtocolHandler === 'function') {
      try {
        const pending = navWithUnregister.unregisterProtocolHandler(PROTOCOL_SCHEME, handlerUrl);
        if (pending && typeof (pending as Promise<void>).catch === 'function') {
          await (pending as Promise<void>);
        }
      } catch {
        // Unregister may fail if nothing was registered; ignore.
      }
    }
  }

  try {
    navigator.registerProtocolHandler(PROTOCOL_SCHEME, handlerUrl)
    return 'registered';
  } catch (err) {
    console.log(err)
    return 'error';
  }
}
