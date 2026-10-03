import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { DecafRoleAuthHandler } from "../../src/auth/DecafAuthHandler";
import { buildApp } from "./fakes/app";
import { genStr } from "./fakes/utils";

jest.setTimeout(30000);

async function startBackend() {
  const built = await buildApp({
    authHandler: new DecafRoleAuthHandler(),
    observerOptions: {
      enableObserverEvents: true,
      subscriptionMode: true,
      authenticate: true,
    },
  });
  const server = built.app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  return { built, server, port };
}

async function subscribe(
  port: number,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  const res = await fetch(`http://127.0.0.1:${port}/events/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ topics: ["ProcessStep"] }),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

describe("SSE requester fingerprints (e2e)", () => {
  let built: any;
  let server: any;
  let port: number;

  beforeAll(async () => {
    ({ built, server, port } = await startBackend());
  });

  afterAll(async () => {
    await built?.decaf?.shutdown?.();
    if (server?.listening) {
      server.close();
      await once(server, "close");
    }
  });

  it("fingerprints an authenticated requester by user", async () => {
    const res = await subscribe(port, {
      Authorization: "Bearer admin",
      "x-correlation-id": `cid-${genStr(6)}`,
    });
    expect(res.status).toBe(200);
    expect(res.body.fingerprint.startsWith("user:")).toBe(true);
  });

  it("fingerprints an anonymous requester by correlation id", async () => {
    const res = await subscribe(port, {
      "x-correlation-id": `cid-${genStr(6)}`,
    });
    expect(res.status).toBe(200);
    expect(res.body.fingerprint.startsWith("cid:")).toBe(true);
  });

  it("falls back to a connection fingerprint with no identity", async () => {
    const res = await subscribe(port);
    expect(res.status).toBe(200);
    expect(res.body.fingerprint.startsWith("conn:")).toBe(true);
  });
});
