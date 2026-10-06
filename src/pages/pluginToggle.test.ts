import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_TO_TOGGLE, updatePluginEnabled } from "./pluginToggle";

function answering(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("switching a test on or off", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the plugin the engine answered with", async () => {
    const fn = answering(200, { pid: "p1", enabled: false });
    expect(await updatePluginEnabled("/api/v1", "p1", false)).toEqual({ pid: "p1", enabled: false });
    expect(fn).toHaveBeenCalledWith("/api/v1/plugins/p1/enabled", expect.objectContaining({ method: "PATCH" }));
  });

  it("says it takes the admin role when the engine refuses (403), rather than taking the refusal for the plugin", async () => {
    answering(403, { detail: "the admin role is needed" });
    await expect(updatePluginEnabled("/api/v1", "p1", true)).rejects.toThrow(ADMIN_TO_TOGGLE);
    expect(ADMIN_TO_TOGGLE).toBe("Switching a test on or off takes the admin role.");
  });

  it("fails with the page's own message on any other error", async () => {
    answering(500, { detail: "boom" });
    await expect(updatePluginEnabled("/api/v1", "p1", true)).rejects.toThrow("Could not update plugin state.");
  });
});
