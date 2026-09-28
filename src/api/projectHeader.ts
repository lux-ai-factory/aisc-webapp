/**
 * The one way the SPA calls the engine's API (isolation 2026-09-25, I7.4).
 *
 * The engine keeps every project in its own database, and its door opens the
 * database of the project named in the X-AISC-Project header. So every call the
 * SPA makes goes through here (installProjectHeader wraps fetch and axios at
 * start), and each one names the platform project this tab was opened on.
 * With no current project, a route that belongs to a project is not called at
 * all (NoCurrentProject); the few routes that need no project (the plugin
 * list, who am I, the app name, the docs, the audit) still are.
 *
 * Which project a caller may reach is decided by the backend, not here: this
 * only says which one the SPA is working on.
 *
 * All of this is the configurator's (AISC_DEPLOYMENT=configurator). Sean's
 * standalone engine has one database and no door: there nothing is installed,
 * and fetch and axios are Sean's, unchanged.
 */
import { AxiosHeaders, type InternalAxiosRequestConfig } from "axios";

import { API_VERSION_PREFIX } from "../config";
import { isConfigurator } from "../deployment";
import { currentPlatformProject } from "../platform/currentProject";

export const PROJECT_HEADER = "X-AISC-Project";

const PID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A project route was about to be called with no current platform project. */
export class NoCurrentProject extends Error {
  constructor(url?: string) {
    super(`No project is open${url ? ` for ${url}` : ""}: open this tool from the project page.`);
    this.name = "NoCurrentProject";
  }
}

const apiBase = (): string => `${import.meta.env.VITE_API_URL ?? ""}${API_VERSION_PREFIX}`;

function pathOf(url: string): string {
  return url.split(/[?#]/, 1)[0];
}

/** Whether this URL is one of the engine's API routes. */
function isApiRoute(url: string): boolean {
  return url.startsWith(apiBase()) || url.startsWith(API_VERSION_PREFIX);
}

/** The routes the engine's door lets through without a project (I7.2). */
export function isProjectLess(method: string, url: string): boolean {
  const path = pathOf(url);
  const verb = method.toUpperCase();
  if ((verb === "GET" || verb === "HEAD") && /\/plugins$/.test(path)) return true;
  return /\/(me|me\/admin|app-name|docs|openapi\.json|audit)$/.test(path);
}

/** The current platform project, when it is a pid; anything else counts as none. */
function currentPid(): string | null {
  const project = currentPlatformProject();
  return project && PID.test(project) ? project.toLowerCase() : null;
}

/** The same headers, in the same shape, with the project header added. */
function withProject(headers: HeadersInit | undefined, pid: string): HeadersInit {
  if (headers instanceof Headers) {
    const copy = new Headers(headers);
    copy.set(PROJECT_HEADER, pid);
    return copy;
  }
  if (Array.isArray(headers)) {
    return [...headers.filter(([name]) => name.toLowerCase() !== PROJECT_HEADER.toLowerCase()), [PROJECT_HEADER, pid]];
  }
  return { ...(headers ?? {}), [PROJECT_HEADER]: pid };
}

/**
 * The project a caller named itself in the headers, when it is a pid.
 *
 * The install dialog targets a project that may not be this tab's (the one
 * last opened, or one chosen in the dialog): it names it, and that wins.
 */
function namedPid(headers: HeadersInit | undefined): string | null {
  if (!headers) return null;
  let value: string | null | undefined;
  if (headers instanceof Headers) value = headers.get(PROJECT_HEADER);
  else if (Array.isArray(headers)) value = headers.find(([k]) => k.toLowerCase() === PROJECT_HEADER.toLowerCase())?.[1];
  else {
    const rec = headers as Record<string, string>;
    const key = Object.keys(rec).find((k) => k.toLowerCase() === PROJECT_HEADER.toLowerCase());
    value = key ? rec[key] : null;
  }
  return value && PID.test(value) ? value.toLowerCase() : null;
}

/** The URL of whatever fetch was given: a string, a URL or a Request. */
function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * fetch through `base`, naming the current platform project, or the one the
 * caller named (I7.4). Only the engine's API routes are touched: any other URL
 * (the platform, MinIO, another host) goes out exactly as given.
 */
export async function projectFetch(base: typeof fetch, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = urlOf(input);
  if (!isConfigurator() || !isApiRoute(url)) return base(input, init);
  const given = init?.headers ?? (input instanceof Request ? input.headers : undefined);
  const pid = namedPid(given) ?? currentPid();
  if (pid) {
    return base(input, { ...init, headers: withProject(given, pid) });
  }
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  if (!isProjectLess(method, url)) {
    throw new NoCurrentProject(pathOf(url));
  }
  return base(input, init);
}

/** The same rule for axios (uploads that report their progress). */
export function projectHeaderInterceptor(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const url = config.url ?? "";
  if (!isConfigurator() || !isApiRoute(url)) return config;
  const headers = AxiosHeaders.from(config.headers);
  const named = headers.get(PROJECT_HEADER);
  const pid = (typeof named === "string" && PID.test(named) ? named.toLowerCase() : null) ?? currentPid();
  if (pid) {
    headers.set(PROJECT_HEADER, pid);
    config.headers = headers;
    return config;
  }
  if (!isProjectLess(config.method ?? "GET", url)) {
    throw new NoCurrentProject(pathOf(url));
  }
  return config;
}
