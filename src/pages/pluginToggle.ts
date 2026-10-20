/**
 * Switching a test on or off (PATCH /plugins/{pid}/enabled). The engine's door asks for the realm's admin
 * role for it, as for removing one (apps/backend project_door.py), so a refusal is said as such rather than
 * taken for the plugin.
 */
export const ADMIN_TO_TOGGLE = "Switching a test on or off takes the admin role.";
const COULD_NOT_UPDATE = "Could not update plugin state.";

export async function updatePluginEnabled(apiUrl: string, pluginPid: string, enabled: boolean): Promise<unknown> {
  if (!pluginPid) throw new Error("Invalid plugin pid");
  const res = await fetch(`${apiUrl}/plugins/${pluginPid}/enabled`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (res.status === 403) throw new Error(ADMIN_TO_TOGGLE);
  if (!res.ok) throw new Error(COULD_NOT_UPDATE);
  return await res.json();
}
