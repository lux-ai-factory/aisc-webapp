import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  INSTALL_MESSAGE_TYPE,
  type CatalogInstallPayload,
  type InstallMessage,
  type ProtocolRegistrationStatus,
  parseInstallUri,
  tryRegisterProtocolHandler,
} from './installUri';

interface PluginInstallContextType {
  /** The catalogue install currently awaiting user confirmation, if any. */
  pendingInstall: CatalogInstallPayload | null;
  /** Show/clear the install prompt from the UI. */
  setPendingInstall: (payload: CatalogInstallPayload | null) => void;
  /** Whether the web+aiscplugin protocol handler is registered. */
  protocolStatus: ProtocolRegistrationStatus;
  /** (Re-)attempt to register the protocol handler. Pass `forceReset=true` to
   *  unregister first (destructive) so the browser prompt reappears — use only
   *  from an explicit user gesture. */
  registerProtocol: (forceReset?: boolean) => Promise<ProtocolRegistrationStatus>;
}

const PluginInstallContext = createContext<PluginInstallContextType | undefined>(undefined);

/**
 * Registers the service worker and wires up the two ways an install can reach
 * this app:
 *   1. A postMessage from the service worker (handshake to an open tab).
 *   2. A `uri` query parameter (app booting from scratch via protocol handler).
 *
 * Exposes the detected install so a global dialog can prompt the user to target
 * a project.
 */
export function PluginInstallProvider({ children }: { children: ReactNode }) {
  const [pendingInstall, setPendingInstall] = useState<CatalogInstallPayload | null>(null);
  const [protocolStatus, setProtocolStatus] = useState<ProtocolRegistrationStatus>('not-ready');

  const registerProtocol = async (forceReset = false): Promise<ProtocolRegistrationStatus> => {
    const status = await tryRegisterProtocolHandler(forceReset);
    setProtocolStatus(status);
    return status;
  };

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('SW Registration Error:', err);
      });
    }

    // Best-effort protocol registration so OS-level deep links can work without
    // a prior handshake. Safe to call; browsers silently no-op if unsupported.
    registerProtocol();

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as InstallMessage | null | undefined;
      if (data && data.type === INSTALL_MESSAGE_TYPE && typeof data.payload === 'string') {
        const parsed = parseInstallUri(data.payload);
        if (parsed) setPendingInstall(parsed);
      }
    };

    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }

    // Check for a URI delivered directly on the URL (fresh boot).
    const params = new URLSearchParams(window.location.search);
    const uri = params.get('uri');
    if (uri) {
      const parsed = parseInstallUri(uri);
      if (parsed) setPendingInstall(parsed);
      window.history.replaceState(null, '', window.location.pathname);
    }

    return () => {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, []);

  return (
    <PluginInstallContext.Provider
      value={{ pendingInstall, setPendingInstall, protocolStatus, registerProtocol }}
    >
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
