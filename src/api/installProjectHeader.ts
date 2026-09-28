import axios from "axios";
import { projectFetch, projectHeaderInterceptor } from "./projectHeader";

/** Configurator only: every engine API call names the open project (X-AISC-Project), without
 *  Sean's components knowing (adapt plan 2026-09-28, item 4). */
export function installProjectHeader(target: typeof globalThis = globalThis): () => void {
  const original = target.fetch.bind(target);
  target.fetch = ((input: RequestInfo | URL, init?: RequestInit) => projectFetch(original, input, init)) as typeof fetch;
  const id = axios.interceptors.request.use(projectHeaderInterceptor);
  return () => {
    target.fetch = original;
    axios.interceptors.request.eject(id);
  };
}
