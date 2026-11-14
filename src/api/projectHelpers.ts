/**
 * The project's helper models (configurator only): the judges and attackers a plugin's helper input is
 * filled with. The platform keeps them under Manage > Helper models; the engine lists them by reference,
 * without their keys.
 */
import { API_VERSION_PREFIX } from "../config";
import { PluginInputValue } from "../models/models";

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

/** The models a test tool can run, as the platform lists them live with the tool's own connection (chat models
 *  first); none and the reason when they cannot be listed, so the form asks for the model's name. */
export async function getHelperModels(projectUuid: string, ref: string): Promise<{ models: string[]; error: string | null }> {
  if (!projectUuid) throw new Error("Invalid uuid");
  const base = `${import.meta.env.VITE_API_URL}${API_VERSION_PREFIX}`;
  const res = await fetch(`${base}/projects/${projectUuid}/helpers/models?ref=${encodeURIComponent(ref)}`);
  if (!res.ok) return { models: [], error: "The models could not be listed" };
  return (await res.json()) as { models: string[]; error: string | null };
}

/** The last run's helper model for an input, as the run form takes it, while the project still offers that
 *  helper for the input's role; null when it does not (or the helpers cannot be read), so it is picked again. */
export async function lastRunHelper(
  projectUuid: string,
  inputName: string,
  entry: { helper_ref?: string; value?: Record<string, unknown> },
): Promise<PluginInputValue | null> {
  if (!entry.helper_ref || !inputName.startsWith("helper:")) return null;
  const role = inputName.slice("helper:".length);
  try {
    const offered = await getProjectHelpers(projectUuid, role);
    if (!offered.some(h => h.ref === entry.helper_ref)) return null;
  } catch {
    return null;
  }
  return { name: inputName, input_type: "helper", helper_ref: entry.helper_ref, value: entry.value ?? {} };
}
