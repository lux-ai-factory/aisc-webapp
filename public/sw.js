// sw.js — Service Worker for the AISC local web app.
//
// Acts as the "Traffic Cop" for incoming plugin-install requests routed from
// the public catalogue. It intercepts requests to /protocol-receiver (the path
// registered via `navigator.registerProtocolHandler('web+aiscplugin', ...)` and used
// by the catalogue handshake flow), extracts the plugin URI, and delivers it to
// an already-open tab via postMessage. If no tab is open, it boots the SPA with
// the URI in the query string so the app can handle it on load.

const PROTOCOL_RECEIVER = '/protocol-receiver';

self.addEventListener('install', (event) => {
  // Activate the new service worker immediately instead of waiting for page reload.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only intercept requests to our protocol receiver path.
  if (url.pathname !== PROTOCOL_RECEIVER) return;

  event.respondWith((async () => {
    try {
      const incomingUri = url.searchParams.get('uri');

      // Look for any already-open tabs of the local app. The freshly-spawned
      // /protocol-receiver "ghost" tab is itself a window client and must be
      // excluded, otherwise we'd deliver the install to an about-to-close tab
      // and never surface it anywhere.
      const windowClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const realClients = windowClients.filter((client) => {
        // Drop the client that initiated this navigation (the ghost tab).
        if (event.clientId && client.id === event.clientId) return false;
        // Drop any client that is still sitting on the receiver path.
        try {
          if (new URL(client.url).pathname === PROTOCOL_RECEIVER) return false;
        } catch {
          // Unparseable client URL; keep it by default.
        }
        return true;
      });

      if (realClients.length > 0) {
        // Deliver the plugin data to the first open tab.
        realClients[0].postMessage({ type: 'PLUGIN_INSTALL', payload: incomingUri });

        // Bring the install prompt into view: focus the app tab. When the
        // browser allows it this switches the user straight to the local app;
        // otherwise they stay on the catalogue tab (which shows a "switch tabs"
        // hint). focus() can throw (e.g. missing user activation), so guard it.
        try {
          await realClients[0].focus();
        } catch (err) {
          console.warn('Could not focus the local app tab:', err);
        }

        // Instantly close the newly spawned "ghost" tab.
        return new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>window.close();</script></body></html>',
          { headers: { 'Content-Type': 'text/html' } },
        );
      }

      // Fallback: no real tab is open. Rather than spawning a fresh window, reuse
      // the current /protocol-receiver "ghost" tab as the app tab by redirecting
      // it to the app root, carrying the URI in the query string so the SPA can
      // surface the install prompt on boot. The SPA's router then sees "/" (no
      // NotFound) and PluginInstallProvider reads ?uri on mount.
      const base = new URL('/', event.request.url).href;
      const target = incomingUri
        ? `${base}?uri=${encodeURIComponent(incomingUri)}`
        : base;

      return Response.redirect(target, 302);
    } catch (err) {
      console.error('SW Routing Error:', err);
      return new Response(
        `<h1>Routing Error</h1><p>${String(err && err.message || err)}</p>`,
        { status: 500, headers: { 'Content-Type': 'text/html' } },
      );
    }
  })());
});
