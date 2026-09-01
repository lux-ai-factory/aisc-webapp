import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  type CatalogInstallPayload,
  type ProtocolRegistrationStatus,
  parseInstallUris,
  tryRegisterProtocolHandler,
} from './installUri';

interface PluginInstallContextType {
  /** Catalogue installs awaiting user confirmation, in the order received. */
  pendingInstalls: CatalogInstallPayload[];
  /** The install currently being displayed, if any. */
  currentInstall: CatalogInstallPayload | null;
  /** Remove the front of the queue after it has been handled/declined. */
  advance: () => void;
  /** Clear the whole queue. */
  clear: () => void;
  /** Whether the web+aiscplugin protocol handler is registered. */
  protocolStatus: ProtocolRegistrationStatus;
  /** Register the protocol handler (destructive reset; call from a user gesture). */
  registerProtocol: (forceReset?: boolean) => Promise<ProtocolRegistrationStatus>;
}

const PluginInstallContext = createContext<PluginInstallContextType | undefined>(undefined);

// Parse any boot-time URI(s) attached to the initial page load (e.g. the
// protocol handler routing to /receiver?uri=...). Computed once at module load,
// guarded against React StrictMode's dev-time remount (which would otherwise
// re-run the effect after the token has been stripped, losing the installs).
let bootHandled = false;
const bootInstalls: CatalogInstallPayload[] = (() => {
  if (typeof window === 'undefined') return [];
  if (bootHandled) return [];
  bootHandled = true;
  const uri = new URLSearchParams(window.location.search).get('uri');
  if (!uri) return [];
  // Drop the token from the URL so it is never shared/history-logged.
  window.history.replaceState(null, '', window.location.pathname);
  return parseInstallUris(uri);
})();

/**
 * Wires up how an install can reach this app:
 *   - a `uri` query parameter (app booting from scratch via the protocol
 *     handler), which may encode several plugins at once.
 *
 * Exposes a queue of detected installs so a global dialog can prompt the user
 * to target a project for each plugin. There is no service worker involved.
 */
export function PluginInstallProvider({ children }: { children: ReactNode }) {
  const [pendingInstalls, setPendingInstalls] = useState<CatalogInstallPayload[]>(
    bootInstalls,
  );
  const [protocolStatus, setProtocolStatus] = useState<ProtocolRegistrationStatus>('not-ready');

  const registerProtocol = async (forceReset = false): Promise<ProtocolRegistrationStatus> => {
    const status = await tryRegisterProtocolHandler(forceReset);
    setProtocolStatus(status);
    return status;
  };

  const value = useMemo<PluginInstallContextType>(
    () => ({
      pendingInstalls,
      currentInstall: pendingInstalls[0] ?? null,
      advance: () => setPendingInstalls((prev) => prev.slice(1)),
      clear: () => setPendingInstalls([]),
      protocolStatus,
      registerProtocol,
    }),
    [pendingInstalls, protocolStatus, registerProtocol],
  );

  return (
    <PluginInstallContext.Provider value={value}>
      {children}
    </PluginInstallContext.Provider>
  );
}

export function usePluginInstall(): PluginInstallContextType {
  const context = useContext(PluginInstallContext);
  if (!context) {
    throw new Error('usePluginInstall must be used within a PluginInstallProvider');
  }
  return context;
}
