/**
 * Helpers for the public-catalogue <-> local-app plugin install flow.
 *
 * The public catalogue communicates with this local app using a custom
 * protocol URI of the form:
 *
 *   web+aiscplugin://enable?package=<name>&version=<version>
 *
 * (with `package`/`version` repeated for a batch of plugins).
 *
 * The URI reaches the app in two ways:
 *   - via the registered protocol handler, which routes to the handler URL
 *     ({origin}/receiver?uri=...) in a new tab, or
 *   - directly on the URL (?uri=...) when the app boots from scratch.
 *
 * No service worker is involved; each enable opens its own new tab.
 */

export interface CatalogInstallPayload {
  /** Plugin package name, e.g. "aisc-plugin-fairness". */
  package: string;
  /** Version requested by the catalogue. */
  version: string;
  /** The raw incoming URI, kept for debugging/forwarding. */
  uri: string;
}

/** Path on this app that the custom protocol handler routes to. */
export const RECEIVER_PATH = '/receiver';

/** Render the handler URL used to register/unregister the custom scheme. */
export function buildReceiverUrl(): string {
  return `${window.location.origin}${RECEIVER_PATH}?uri=%s`;
}

/**
 * Parse repeated `package`/`version` query parameters out of a catalogue
 * install URI. A request is only valid when it carries BOTH a `package` and a
 * `version` for a plugin; entries missing either are skipped. Each well-formed
 * pair is returned as a separate payload so a single URI can carry several
 * plugins. Returns an empty array when no complete packages are present.
 */
export function parseInstallUris(uri: string | null | undefined): CatalogInstallPayload[] {
  if (!uri) return [];

  const result: CatalogInstallPayload[] = [];

  try {
    const parsed = new URL(uri);
    const packages = parsed.searchParams.getAll('package');
    const versions = parsed.searchParams.getAll('version');
    // Pairs 1:1 by order (the catalogue appends package+version together).
    const count = Math.min(packages.length, versions.length);
    for (let i = 0; i < count; i++) {
      result.push({ package: packages[i], version: versions[i], uri });
    }
  } catch {
    // Malformed URL — fall through to regex extraction.
  }

  // Regex fallback for non-URL / custom-scheme URIs.
  if (result.length === 0) {
    const re = /(?:[?&]package=([^&]+))(?:\s*&\s*version=([^&]+))?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(uri))) {
      const pkg = m[1];
      const version = m[2];
      if (pkg && version !== undefined) {
        result.push({
          package: decodeURIComponent(pkg),
          version: decodeURIComponent(version),
          uri,
        });
      }
    }
  }

  return result;
}

/** Parse a single-package install URI (backward compatible). */
export function parseInstallUri(uri: string | null | undefined): CatalogInstallPayload | null {
  return parseInstallUris(uri)[0] ?? null;
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
  return typeof navigator.registerProtocolHandler === 'function';
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

  const handlerUrl = buildReceiverUrl();

  // If the user previously declined the registration prompt, the browser caches
  // that refusal and suppresses the prompt on subsequent calls. Unregistering
  // (Chrome/Edge) sometimes resets this cache so the prompt appears again. This
  // is destructive (it removes a working registration), so it only runs when the
  // user explicitly asks to (re-)register — never from the automatic boot path.
  if (forceReset) {
    await unregisterProtocolHandler();
  }

  try {
    navigator.registerProtocolHandler(PROTOCOL_SCHEME, handlerUrl)
    return 'registered';
  } catch (err) {
    console.log(err)
    return 'error';
  }
}

/** Remove this app as the handler for the web+aiscplugin scheme. Does nothing
 *  (and resolves) when no handler is registered or the browser is unsupported. */
export async function unregisterProtocolHandler(): Promise<void> {
  const navWithUnregister = navigator as Navigator & {
    unregisterProtocolHandler?: (scheme: string, url: string) => void | Promise<void>;
  };
  if (typeof navWithUnregister.unregisterProtocolHandler !== 'function') return;
  try {
    const pending = navWithUnregister.unregisterProtocolHandler(
      PROTOCOL_SCHEME,
      buildReceiverUrl(),
    );
    if (pending && typeof (pending as Promise<void>).catch === 'function') {
      await (pending as Promise<void>);
    }
  } catch {
    // Nothing registered; ignore.
  }
}
