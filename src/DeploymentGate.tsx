import type { ReactNode } from "react";
import { deployment } from "./deployment";

/**
 * Nothing runs on a wrong AISC_DEPLOYMENT (spec 2026-09-27, Review Focus 1).
 *
 * The mode decides the login, the start page and whether requests name a
 * project, so guessing one would half-work in the wrong shape. A misspelled or
 * unsubstituted value shows this page, naming the variable, instead.
 */
export function DeploymentGate({ children }: { children: ReactNode }) {
  try {
    deployment();
  } catch (err) {
    return (
      <main role="alert" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "sans-serif", background: "#fff", color: "#111" }}>
        <div style={{ maxWidth: 640 }}>
          <h1 style={{ fontSize: 24 }}>The AI Assessment Sandbox cannot start</h1>
          <p>{(err as Error).message}.</p>
          <p>Set AISC_DEPLOYMENT to standalone or configurator, on the web app container too, and restart it.</p>
        </div>
      </main>
    );
  }
  return <>{children}</>;
}
