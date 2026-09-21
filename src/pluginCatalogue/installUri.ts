/**
 * Helpers for the public-catalogue <-> local-app plugin install flow.
 *
 * The public catalogue communicates with this local app using a custom
 * protocol URI of the form:
 *
 *   web+aiscplugin://enable?package=<name>&version=<version>&slug=<entry>
 *
 * (with the triple repeated for a batch of plugins). `slug` names the catalogue
 * entry the package came from; it is optional, because a deep link may arrive
 * from somewhere other than the catalogue.
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
  /** Catalogue entry the package came from, when the sender knew it. */
  slug?: string;
  /** The raw incoming URI, kept for debugging/forwarding. */
  uri: string;
}

/** Path on this app that the custom protocol handler routes to. */
export const RECEIVER_PATH = '/receiver';

/** Render the handler URL used to register/unregister the custom scheme. */
export function buildReceiverUrl(): string {
  return `${window.location.origin}${RECEIVER_PATH}?uri=%s`;
}

/** One entry while it is still being assembled from the query string. */
interface PartialEntry {
  package: string;
  version?: string;
  slug?: string;
}

/**
 * Group an ordered list of query parameters into install entries.
 *
 * `package` opens a new entry; `version` and `slug` belong to the entry that is
 * currently open, which is why the query string is walked in order instead of
 * zipping `getAll('package')` against `getAll('slug')`: an entry that carries no
 * slug would otherwise be handed the slug of a later one. Parameters appearing
 * before any `package` have no owner and are dropped.
 */
function groupEntries(params: Iterable<[string, string]>): PartialEntry[] {
  const entries: PartialEntry[] = [];
  for (const [key, value] of params) {
    if (key === 'package') {
      entries.push({ package: value });
      continue;
    }
    const current = entries[entries.length - 1];
    if (!current) continue;
    if (key === 'version' && current.version === undefined) current.version = value;
    if (key === 'slug' && current.slug === undefined) current.slug = value;
  }
  return entries;
}

/**
 * Parse repeated `package`/`version`/`slug` query parameters out of a catalogue
 * install URI. A request is only valid when it carries BOTH a `package` and a
 * `version` for a plugin; entries missing either are skipped. Each well-formed
 * entry is returned as a separate payload so a single URI can carry several
 * plugins. Returns an empty array when no complete packages are present.
 */
export function parseInstallUris(uri: string | null | undefined): CatalogInstallPayload[] {
  if (!uri) return [];

  let entries: PartialEntry[] = [];

  try {
    entries = groupEntries(new URL(uri).searchParams);
  } catch {
    // Malformed URL — fall through to manual extraction.
  }

  // Fallback for non-URL / custom-scheme URIs: read the query string by hand.
  if (entries.length === 0) {
    const query = uri.slice(uri.indexOf('?') + 1);
    const pairs: [string, string][] = query
      .split('&')
      .map((part) => part.split('='))
      .filter((kv) => kv.length === 2 && kv[0] !== '')
      .map(([k, v]) => [decodeURIComponent(k.trim()), decodeURIComponent(v.trim())]);
    entries = groupEntries(pairs);
  }

  return entries
    .filter((e): e is PartialEntry & { version: string } =>
      Boolean(e.package) && e.version !== undefined && e.version !== '')
    .map((e) => ({
      package: e.package,
      version: e.version,
      ...(e.slug ? { slug: e.slug } : {}),
      uri,
    }));
}

/** Body of POST /plugins for one catalogue install. */
export interface InstallRequestBody {
  package_name: string;
  version: string;
  project_uuid: string;
  /** Present only when the install came from a catalogue entry. */
  catalogue_slug?: string;
}

/**
 * Build the enable request the engine expects for one queued install.
 *
 * The slug is what ties an installed distribution back to its catalogue entry,
 * so it is forwarded when the sender knew it and left out entirely otherwise:
 * the engine stores an absent origin as absent, not as an empty string.
 */
export function installRequestBody(
  install: CatalogInstallPayload,
  projectUuid: string,
): InstallRequestBody {
  return {
    package_name: install.package,
    version: install.version,
    project_uuid: projectUuid,
    ...(install.slug ? { catalogue_slug: install.slug } : {}),
  };
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
