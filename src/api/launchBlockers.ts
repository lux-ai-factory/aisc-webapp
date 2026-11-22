/**
 * Which tests of the open project cannot be launched yet, and why (configurator only). The engine names a
 * test that calls its target while no target of the AI card has a connection (GET /plugins/launch-blockers,
 * aisc_backend/routers/target_input.py): the launch page greys its card out. Nothing is blocked when the
 * engine does not answer: a standalone engine has no such route, and the launch check still decides.
 */
import { API_VERSION_PREFIX } from "../config";

/** The reason each blocked test cannot be launched, by plugin pid; a test not named can be launched. */
export async function getLaunchBlockers(): Promise<Record<string, string>> {
  const base = `${import.meta.env.VITE_API_URL}${API_VERSION_PREFIX}`;
  try {
    const res = await fetch(`${base}/plugins/launch-blockers`);
    if (!res.ok) return {};
    const body = await res.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, string>) : {};
  } catch {
    return {};
  }
}
