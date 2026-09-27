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

/** The project in the URL (`?project=<uuid>`), remembered for this tab. */
export function currentPlatformProject(
  search: string = typeof window === "undefined" ? "" : window.location.search,
  storage: Storage | null = tabStorage(),
): string | null {
  const fromUrl = new URLSearchParams(search).get("project");
  if (fromUrl) {
    rememberPlatformProject(fromUrl, storage);
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
