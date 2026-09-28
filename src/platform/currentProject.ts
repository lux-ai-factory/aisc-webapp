/**
 * The platform project this engine was opened from.
 *
 * There is one database and one list of projects: the launcher opens each
 * module with the project being worked on, and a workspace made here belongs
 * to it. The engine still runs on its own, so an absent project is normal, not
 * an error: the workspace simply belongs to no platform project.
 */
const STORAGE_KEY = "aisc_platform_project";

const tabStorage = (): Storage | null =>
  typeof window === "undefined" ? null : window.sessionStorage;

/** Remember a platform project for this tab. */
export function rememberPlatformProject(
  project: string,
  storage: Storage | null = tabStorage(),
): void {
  try {
    storage?.setItem(STORAGE_KEY, project);
  } catch {
    /* private window: the project still works for this page load */
  }
}

const LAST_KEY = "aisc_last_platform_project";

const PID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only a pid is a platform project; anything else counts as none. */
export const isPlatformPid = (value: string | null | undefined): value is string =>
  typeof value === "string" && PID.test(value);

/** This browser's storage, shared by its tabs; null when the browser refuses it. */
const browserStorage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

/**
 * Remember, for the whole browser, the project the engine was last opened on.
 *
 * The catalogue opens the engine in a new tab with no project; the install
 * dialog then goes to this one, so it is written whenever a `?project=` is read.
 */
export function rememberLastPlatformProject(
  project: string,
  storage: Storage | null = browserStorage(),
): void {
  try {
    storage?.setItem(LAST_KEY, project);
  } catch {
    /* private window: the dialog then asks which project */
  }
}

/** The project the engine was last opened on in this browser, if any. */
export function lastPlatformProject(storage: Storage | null = browserStorage()): string | null {
  try {
    const stored = storage?.getItem(LAST_KEY) ?? null;
    return isPlatformPid(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** The project in the URL (`?project=<uuid>`, a pid only), remembered for this tab and as the browser's last. */
export function currentPlatformProject(
  search: string = typeof window === "undefined" ? "" : window.location.search,
  storage: Storage | null = tabStorage(),
  lastStorage: Storage | null = browserStorage(),
): string | null {
  // A ?project= that is not a pid is ignored, as if absent: it is never stored,
  // so the URL and the X-AISC-Project header cannot name two projects.
  const fromUrl = new URLSearchParams(search).get("project");
  if (isPlatformPid(fromUrl)) {
    rememberPlatformProject(fromUrl, storage);
    rememberLastPlatformProject(fromUrl, lastStorage);
    return fromUrl;
  }
  try {
    return storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/**
 * Where to ask for workspaces.
 *
 * The launcher decides the project; the engine then only ever asks for that
 * project's workspaces, so it never shows a list someone could choose a
 * different project from. Used on its own, with no project, it asks for all of
 * them.
 */
export function projectsUrl(
  apiUrl: string,
  project: string | null = currentPlatformProject(),
): string {
  const base = `${apiUrl}/projects`;
  return project ? `${base}?platform_project_id=${encodeURIComponent(project)}` : base;
}

/**
 * Where to ask for this service's row for a platform project.
 *
 * There is no workspace to create in the engine. The project was chosen on the
 * launcher, so the engine asks for its own side of it: the first visit makes
 * the row, every visit after finds it, and nobody is asked to name anything.
 */
export function projectForPlatformUrl(apiUrl: string, project: string): string {
  return `${apiUrl}/projects/for-platform/${encodeURIComponent(project)}`;
}

/**
 * The way back to the project page on the launcher, where all six steps are.
 *
 * Every tool has one, because the project is chosen there and each tool is
 * entered from it. Without a project there is nothing to go back to but the
 * launcher itself.
 */
export function projectPageUrl(
  launcherUrl: string,
  project: string | null = currentPlatformProject(),
): string {
  const launcher = launcherUrl.replace(/\/+$/, "");
  return project ? `${launcher}/p/${encodeURIComponent(project)}` : launcher;
}
