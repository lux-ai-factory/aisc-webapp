// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

vi.mock('../deployment', async (orig) => ({ ...(await orig<typeof import('../deployment')>()), isConfigurator: () => true }));
import { installProjectHeader } from './installProjectHeader';

const PID = '9f2afa73-a818-4a27-b01d-f9f7773838c2';
const API = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;
let seen: { url: string; header: string | null }[] = [];
let uninstall: () => void = () => {};

beforeEach(() => {
  seen = [];
  sessionStorage.setItem('aisc_platform_project', PID);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(input), header: new Headers(init?.headers).get('X-AISC-Project') });
    return new Response('{}', { status: 200 });
  }));
  uninstall = installProjectHeader(globalThis);
});
afterEach(() => { uninstall(); vi.unstubAllGlobals(); sessionStorage.clear(); });

describe('the start-up wrapper', () => {
  it('names the open project on an engine API call made with plain fetch', async () => {
    await fetch(`${API}/projects/abc`);
    expect(seen[0].header).toBe(PID);
  });
  it('leaves other hosts alone (Review Focus 4)', async () => {
    await fetch('https://sandboxconfigurator.aifactory.lu/api/api/tool/');
    await fetch('http://localhost:9000/bucket/object');
    expect(seen.map((s) => s.header)).toEqual([null, null]);
  });
  it('lets a caller-named project win', async () => {
    const other = '5b0c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3';
    await fetch(`${API}/plugins`, { method: 'POST', headers: { 'X-AISC-Project': other } });
    expect(seen[0].header).toBe(other);
  });
  it('adds the header on the default axios instance too', async () => {
    const config = await (axios.interceptors.request as any).handlers.at(-1).fulfilled({ url: `${API}/components/x/data`, headers: {} });
    expect(new Headers(config.headers as any).get('X-AISC-Project') ?? config.headers.get?.('X-AISC-Project')).toBe(PID);
  });
});
