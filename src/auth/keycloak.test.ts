// @vitest-environment jsdom
//
// UNIT test for installAuthFetch: the wrapper must add a Bearer token to API requests
// and leave non-API requests untouched.
import { describe, it, expect, vi } from "vitest";
import keycloak, { installAuthFetch } from "./keycloak";

describe("installAuthFetch token injection", () => {
  it("adds Bearer to API requests but not to others", async () => {
    const API = "http://localhost:8000";
    const calls: Array<{ url: unknown; init: RequestInit }> = [];

    // fake the original fetch so we can inspect what it receives
    window.fetch = vi.fn(async (url: unknown, init: RequestInit = {}) => {
      calls.push({ url, init });
      return new Response("{}");
    }) as unknown as typeof fetch;

    // pretend a user is logged in with a token; stub the refresh
    (keycloak as unknown as { authenticated: boolean }).authenticated = true;
    (keycloak as unknown as { token: string }).token = "tok123";
    keycloak.updateToken = vi.fn(async () => true) as unknown as typeof keycloak.updateToken;

    installAuthFetch(API);

    await window.fetch(`${API}/v1/me`);          // API request -> should get the header
    await window.fetch("https://other.example/x"); // non-API -> should NOT

    const apiHeaders = (calls[0].init.headers || {}) as Record<string, string>;
    const otherHeaders = (calls[1].init.headers || {}) as Record<string, string>;

    expect(apiHeaders.Authorization).toBe("Bearer tok123");
    expect(otherHeaders.Authorization).toBeUndefined();
  });
});
