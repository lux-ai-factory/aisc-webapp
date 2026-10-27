/**
 * The project's helper models (configurator only): the judges and attackers a plugin's helper input is
 * filled with. The platform keeps them under Manage > Helper models; the engine lists them by reference,
 * without their keys.
 */
import { API_VERSION_PREFIX } from "../config";

export interface HelperModel {
  ref: string;
  label: string;
  roles: string[];
  endpoint_host: string;
}

/** The project's helper models allowed for a role. */
export async function getProjectHelpers(projectUuid: string, role: string): Promise<HelperModel[]> {
  if (!projectUuid) throw new Error("Invalid uuid");
  const base = `${import.meta.env.VITE_API_URL}${API_VERSION_PREFIX}`;
  const res = await fetch(`${base}/projects/${projectUuid}/helpers?role=${encodeURIComponent(role)}`);
  if (!res.ok) throw new Error("Helper models could not be loaded");
  return (await res.json()) as HelperModel[];
}
