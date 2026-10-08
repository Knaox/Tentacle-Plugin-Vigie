/*
 * Ce qu'il faut pour appeler une route de Vigie et observer le réseau, sans
 * Fastify ni services réels : un faux `app` qui garde les gestionnaires, et un
 * `fetch` qui note chaque appel et répond selon des règles du test.
 */

type Handler = (request: unknown, reply: FakeReply) => unknown;

export interface FakeReply {
  statusCode: number;
  payload: unknown;
  status(code: number): FakeReply;
  send(payload: unknown): FakeReply;
}

function reply(): FakeReply {
  const r: FakeReply = {
    statusCode: 200,
    payload: undefined,
    status(code) { r.statusCode = code; return r; },
    send(payload) { r.payload = payload; return r; },
  };
  return r;
}

export function fakeApp() {
  const routes = new Map<string, Handler>();
  const add = (method: string) => (path: string, a: unknown, b?: unknown) => {
    routes.set(`${method} ${path}`, (typeof a === "function" ? a : b) as Handler);
  };
  const app = {
    get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE"), patch: add("PATCH"),
    addHook: () => {},
  };
  async function call(method: string, path: string, req: { params?: object; body?: unknown; user: object }) {
    const handler = routes.get(`${method} ${path}`);
    if (!handler) throw new Error(`route absente : ${method} ${path}`);
    const r = reply();
    const result = await handler({ params: {}, query: {}, headers: {}, ...req }, r);
    return { status: r.statusCode, body: r.payload ?? result };
  }
  return { app, call };
}

export interface FetchCall { method: string; url: string; body?: string }
type Rule = (call: FetchCall) => Response | Promise<Response> | null | undefined;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Remplace `fetch` ; la première règle qui répond gagne, sinon 404. */
export function stubFetch(rules: Rule[]) {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const call: FetchCall = {
      method: (init?.method ?? "GET").toUpperCase(),
      url: String(input),
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    calls.push(call);
    for (const rule of rules) {
      const res = await rule(call);
      if (res) return res;
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}
