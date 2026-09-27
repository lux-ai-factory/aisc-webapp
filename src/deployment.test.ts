import { describe, it, expect } from "vitest";
import { deploymentFrom } from "./deployment";

describe("the web app's deployment mode", () => {
  it("is standalone when the build says so or says nothing", () => {
    expect(deploymentFrom("standalone")).toBe("standalone");
    expect(deploymentFrom(undefined)).toBe("standalone");
  });
  it("is configurator when env.sh substituted it", () => {
    expect(deploymentFrom(" Configurator ")).toBe("configurator");
  });
  it("refuses anything else, and an unsubstituted placeholder", () => {
    expect(() => deploymentFrom("APP_DEPLOYMENT")).toThrow(/AISC_DEPLOYMENT/);
    expect(() => deploymentFrom("config")).toThrow(/standalone or configurator/);
  });
});

describe("the web app image", () => {
  it("defaults APP_DEPLOYMENT to standalone, so Sean's container without it starts as today", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const dockerfile = readFileSync(resolve(__dirname, "..", "Dockerfile"), "utf8");
    const serveStage = dockerfile.slice(dockerfile.lastIndexOf("FROM "));
    expect(serveStage).toMatch(/^ENV APP_DEPLOYMENT=standalone$/m);
  });
});

describe("the placeholders env.sh replaces", () => {
  // env.sh runs sed s|APP_<NAME>|<value>|g over every built .js file, so an
  // APP_ name anywhere in the source (a message, a string) is rewritten too.
  // Only .env defines them; the source reads import.meta.env.VITE_*.
  it("appear in no non-test source file under src/", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join, relative, resolve } = await import("node:path");
    const src = resolve(__dirname);
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) return walk(p);
        return /\.(ts|tsx|js|jsx|css|html)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [p] : [];
      });
    const hits = walk(src).flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => /APP_[A-Z]/.test(line))
        .map(({ i }) => `${relative(src, f)}:${i + 1}`),
    );
    expect(hits).toEqual([]);
  });
});
