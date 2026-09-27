import { describe, it, expect, vi } from "vitest";
import { whoTheGatewaySays, gatewaySignIn, gatewaySignOut } from "./gatewaySession";

// The gateway holds the session, refreshes it and passes the token it has. So
// when this page has no token of its own, it is not signed out: it asks the API
// who it is, and the answer comes from a token the engine verified.
describe("who the gateway says this is", () => {
  it("is whoever the engine verified", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ username: "user", roles: ["primary-user"] }),
    });

    expect(await whoTheGatewaySays("http://localhost/api/v1", fetchImpl)).toEqual({
      username: "user",
      roles: ["primary-user"],
    });
    expect(fetchImpl.mock.calls[0][0]).toBe("http://localhost/api/v1/me");
  });

  it("is nobody when the request is refused", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    expect(await whoTheGatewaySays("http://localhost/api/v1", fetchImpl)).toBeNull();
  });

  it("is nobody when the engine is not verifying anything", async () => {
    // With auth switched off the engine answers, but there is no user behind
    // the request: saying "signed in" then would be a lie on the screen.
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ username: null, roles: [], auth_disabled: true }),
    });
    expect(await whoTheGatewaySays("http://localhost/api/v1", fetchImpl)).toBeNull();
  });

  it("is nobody when the engine cannot be reached", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await whoTheGatewaySays("http://localhost/api/v1", fetchImpl)).toBeNull();
  });
});

// Signing in and out is the gateway's, not this page's: one sign-in at the top
// covers every module, so both go to oauth2-proxy on this same origin.
describe("signing in and out at the gateway", () => {
  it("signs in at the gateway and comes back to the page it left", () => {
    const go = vi.fn();
    gatewaySignIn({ pathname: "/project/demo", search: "?tab=2" }, go);
    expect(go).toHaveBeenCalledWith("/oauth2/start?rd=%2Fproject%2Fdemo%3Ftab%3D2");
  });

  it("signs out at the gateway", () => {
    const go = vi.fn();
    gatewaySignOut(go);
    expect(go).toHaveBeenCalledWith("/oauth2/sign_out?rd=%2F");
  });
});
