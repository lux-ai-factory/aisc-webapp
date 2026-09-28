/**
 * The web app's deployment mode, AISC_DEPLOYMENT for the whole engine.
 *
 * standalone: Sean's engine on its own (its login, its project wizard, its
 * tasks page). configurator: inside the Sandbox Configurator, where the
 * launcher owns projects and the gateway owns the session.
 *
 * The container writes the value into the bundle at start (env.sh substitutes
 * the placeholder .env gives VITE_DEPLOYMENT), so it is read when asked, not at import: a bad value then
 * reaches MyApp, which shows it on a blocking error page instead of a blank one.
 */
export type Deployment = "standalone" | "configurator";

/** The mode env.sh wrote into the bundle (VITE_DEPLOYMENT). Unset in a dev build means standalone. */
export function deploymentFrom(raw: string | undefined): Deployment {
  if (raw === undefined || raw === "") return "standalone";
  const value = raw.trim().toLowerCase();
  if (value === "standalone" || value === "configurator") return value;
  throw new Error(`AISC_DEPLOYMENT must be standalone or configurator, not ${JSON.stringify(raw)}`);
}

export const deployment = (): Deployment =>
  deploymentFrom(import.meta.env.VITE_DEPLOYMENT as string | undefined);
export const isConfigurator = (): boolean => deployment() === "configurator";
export const canCreateProjects = (): boolean => deployment() === "standalone";
export const showsLauncher = (): boolean => deployment() === "configurator";
export const showsCeleryTasks = (): boolean => deployment() === "standalone";
/** Standalone: the Plugins page lists every package on the index. Configurator: only what the
 *  project has installed; the hosted catalogue is the only place tests are found. */
export const listsPackageIndex = (): boolean => deployment() === "standalone";
