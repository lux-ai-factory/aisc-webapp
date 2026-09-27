import { describe, it, expect } from "vitest";
import {
  currentPlatformProject,
  lastPlatformProject,
  rememberLastPlatformProject,
  projectForPlatformUrl,
  projectPageUrl,
  projectsUrl,
} from "./currentProject";

const A = "3f2b8c1e-0d4a-4e7b-9a55-1c2d3e4f5a6b";
const B = "701ef4b8-057d-4a93-8b30-9b19052c881e";

const store = (): Storage => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
};

describe("the platform project the engine was opened from", () => {
  it("is the one in the URL", () => {
    expect(currentPlatformProject(`?project=${A}`, store())).toBe(A);
  });

  it("is remembered once, so navigating inside the app keeps it", () => {
    const s = store();
    currentPlatformProject(`?project=${A}`, s);
    expect(currentPlatformProject("", s)).toBe(A);
  });

  it("is simply absent when the engine is opened on its own", () => {
    expect(currentPlatformProject("", store())).toBeNull();
  });

  it("survives a browser that refuses storage", () => {
    const hostile = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
    } as unknown as Storage;
    expect(currentPlatformProject(`?project=${A}`, hostile)).toBe(A);
    expect(currentPlatformProject("", hostile)).toBeNull();
  });
});

// The project is chosen once, on the launcher. Every call the engine makes for
// its workspaces therefore asks for that project's, so the app cannot show a
// second project list and cannot be a second place the choice is made.
describe("the projects call the engine makes", () => {
  it("asks for the workspaces of the project it was opened on", () => {
    expect(projectsUrl("http://localhost/api/v1", "abc")).toBe(
      "http://localhost/api/v1/projects?platform_project_id=abc",
    );
  });

  it("asks for all of them when the engine is used on its own", () => {
    expect(projectsUrl("http://localhost/api/v1", null)).toBe(
      "http://localhost/api/v1/projects",
    );
  });

  it("escapes what it puts in the query", () => {
    expect(projectsUrl("/api/v1", "a b&c")).toBe("/api/v1/projects?platform_project_id=a%20b%26c");
  });
});

// Opened inside a project, the engine has no project of its own to choose or
// create: it asks for this service's row for that project and works on it.
describe("the engine's row for the project it was opened on", () => {
  it("is asked for by the platform project, not created by a person", () => {
    expect(projectForPlatformUrl("http://localhost/api/v1", "abc-123")).toBe(
      "http://localhost/api/v1/projects/for-platform/abc-123",
    );
  });

  it("escapes what it puts in the path", () => {
    expect(projectForPlatformUrl("/api/v1", "a/b")).toBe("/api/v1/projects/for-platform/a%2Fb");
  });
});

// Every tool has a way back to the project page on the launcher, where the
// other five steps are.
describe("the way back to the project", () => {
  it("is that project's page on the launcher", () => {
    expect(projectPageUrl("http://localhost:8100/", "abc")).toBe("http://localhost:8100/p/abc");
  });

  it("is the launcher itself when no project is known", () => {
    expect(projectPageUrl("http://localhost:8100/", null)).toBe("http://localhost:8100");
  });

  it("does not care how the launcher URL was written", () => {
    expect(projectPageUrl("http://localhost:8100///", "abc")).toBe("http://localhost:8100/p/abc");
  });
});

// The catalogue opens the engine in a new tab, with no project: the install
// dialog then goes to the project last opened in this browser.
describe("the project last opened in this browser", () => {
  it("is written whenever a ?project= is read", () => {
    const tab = store();
    const browser = store();
    currentPlatformProject(`?project=${A}`, tab, browser);
    expect(lastPlatformProject(browser)).toBe(A);
    currentPlatformProject("", tab, browser);
    currentPlatformProject(`?project=${B}`, store(), browser);
    expect(lastPlatformProject(browser)).toBe(B);
  });

  it("is absent until one is opened", () => {
    expect(lastPlatformProject(store())).toBeNull();
  });

  it("survives a browser that refuses storage", () => {
    const hostile = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
    } as unknown as Storage;
    expect(() => rememberLastPlatformProject(A, hostile)).not.toThrow();
    expect(lastPlatformProject(hostile)).toBeNull();
    expect(currentPlatformProject(`?project=${A}`, store(), hostile)).toBe(A);
  });
});

// Only a pid is a project: anything else in ?project= or in storage is no
// project, so the URL and the X-AISC-Project header can never name two.
describe("a project that is not a pid", () => {
  it("in ?project= leaves both storages untouched and counts as absent", () => {
    const tab = store();
    const browser = store();
    expect(currentPlatformProject("?project=foo", tab, browser)).toBeNull();
    expect(tab.getItem("aisc_platform_project")).toBeNull();
    expect(browser.getItem("aisc_last_platform_project")).toBeNull();
  });

  it("in ?project= falls back to the tab's stored project", () => {
    const tab = store();
    const browser = store();
    currentPlatformProject(`?project=${A}`, tab, browser);
    expect(currentPlatformProject("?project=foo", tab, browser)).toBe(A);
    expect(lastPlatformProject(browser)).toBe(A);
  });

  it("stored as the browser's last project is no last project", () => {
    const browser = store();
    browser.setItem("aisc_last_platform_project", "foo");
    expect(lastPlatformProject(browser)).toBeNull();
  });
});
