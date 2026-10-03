import http from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { Repository } from "@decaf-ts/core";
import { buildApp } from "./fakes/app";
import { ProcessStep } from "./fakes/models/ProcessStep";

jest.setTimeout(30000);

type SseEvent = { event: string; data: string };

type SseStream = {
  events: SseEvent[];
  close: () => void;
};

function openSse(
  port: number,
  path: string,
  headers: Record<string, string> = {}
): Promise<SseStream> {
  return new Promise((resolve, reject) => {
    const events: SseEvent[] = [];
    const req = http.get(
      { host: "127.0.0.1", port, path, headers },
      (res) => {
        let buffer = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          buffer += chunk;
          let index: number;
          while ((index = buffer.indexOf("\n\n")) >= 0) {
            const raw = buffer.slice(0, index);
            buffer = buffer.slice(index + 2);
            const event: SseEvent = { event: "message", data: "" };
            for (const line of raw.split("\n")) {
              if (line.startsWith("event:")) event.event = line.slice(6).trim();
              else if (line.startsWith("data:"))
                event.data += line.slice(5).trim();
            }
            events.push(event);
          }
        });
        resolve({ events, close: () => req.destroy() });
      }
    );
    req.on("error", reject);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 10000,
  stepMs = 25
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await delay(stepMs);
  }
  throw new Error("Timed out waiting for event condition");
}

async function post(
  port: number,
  path: string,
  headers: Record<string, string> = {},
  body?: unknown
): Promise<{ status: number; body: any }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: any;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

async function startBackend(subscriptionMode: boolean) {
  const built = await buildApp({
    // ProcessStep's routes now mount under `/process-step` (per-model kebab-case
    // base path), so its single-part-PK `GET /:id` no longer shadows the flat
    // `/events` stream route. The model is excluded here only to keep these
    // stream-fan-out tests focused on SSE; the no-shadow case is covered by the
    // dedicated test below.
    controllerExposure: { ProcessStep: false },
    observerOptions: {
      enableObserverEvents: true,
      subscriptionMode,
    },
  });
  const server = built.app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  return { built, server, port };
}

describe("Events SSE observables fan-out", () => {
  let built: any;
  let server: http.Server;
  let port: number;
  let streams: SseStream[] = [];

  afterEach(async () => {
    streams.forEach((stream) => stream.close());
    streams = [];
    await built?.decaf?.shutdown?.();
    if (server?.listening) {
      server.close();
      await once(server, "close");
    }
  });

  it("does not expose subscribe/unsubscribe endpoints in default mode", async () => {
    ({ built, server, port } = await startBackend(false));
    const subscribe = await post(port, "/events/subscribe");
    const unsubscribe = await post(port, "/events/unsubscribe");
    expect(subscribe.status).toBe(404);
    expect(unsubscribe.status).toBe(404);
  });

  it("serves /events while a single-segment model route is exposed", async () => {
    // SAA-109 F3: the SSE router is mounted before the generated model
    // routes. ProcessStep's single-part-PK `GET /:id` now mounts under
    // `/process-step`, so it must not shadow the flat `/events` route even when
    // ProcessStep is exposed.
    const exposed = await buildApp({
      observerOptions: {
        enableObserverEvents: true,
        subscriptionMode: false,
      },
    });
    built = exposed;
    server = exposed.app.listen(0, "127.0.0.1");
    await once(server, "listening");
    port = (server.address() as AddressInfo).port;

    const res = await fetch(`http://127.0.0.1:${port}/events`, {
      headers: { Accept: "text/event-stream" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    await res.body?.cancel();
  });

  it("broadcasts each event to every open stream in default mode", async () => {
    ({ built, server, port } = await startBackend(false));

    const streamA = await openSse(port, "/events");
    const streamB = await openSse(port, "/events");
    streams = [streamA, streamB];
    await delay(100);

    const record = new ProcessStep({
      id: `broadcast-${Math.random().toString(36).slice(2)}`,
      currentStep: 1,
      totalSteps: 1,
      label: "broadcast",
    });
    await Repository.forModel(ProcessStep).create(record);

    await waitFor(
      () => streamA.events.length >= 1 && streamB.events.length >= 1
    );
    for (const stream of [streamA, streamB]) {
      const data = JSON.parse(stream.events[0].data);
      expect(data[0]).toBe(ProcessStep.name);
      expect(data[1]).toBe("create");
      expect(data[2]).toBe(record.id);
    }
  });

  it("delivers events only to subscribed streams in subscription mode", async () => {
    ({ built, server, port } = await startBackend(true));

    const correlationId = `cid-${Math.random().toString(36).slice(2)}`;
    const subscribed = await openSse(port, "/events", {
      "x-correlation-id": correlationId,
    });
    const unsubscribed = await openSse(port, "/events", {
      "x-correlation-id": `other-${Math.random().toString(36).slice(2)}`,
    });
    streams = [subscribed, unsubscribed];
    await delay(100);

    const subscribe = await post(
      port,
      "/events/subscribe",
      { "x-correlation-id": correlationId },
      { topics: [ProcessStep.name] }
    );
    expect(subscribe.status).toBe(200);
    expect(subscribe.body.topics).toEqual([ProcessStep.name]);
    expect(subscribe.body.fingerprint).toBeDefined();

    const record = new ProcessStep({
      id: `sub-${Math.random().toString(36).slice(2)}`,
      currentStep: 1,
      totalSteps: 1,
      label: "subscribed",
    });
    await Repository.forModel(ProcessStep).create(record);

    await waitFor(() => subscribed.events.length >= 1);
    expect(unsubscribed.events).toHaveLength(0);

    const unsubscribe = await post(
      port,
      "/events/unsubscribe",
      { "x-correlation-id": correlationId }
    );
    expect(unsubscribe.status).toBe(200);
    expect(unsubscribe.body.unsubscribed).toBe(true);

    const second = new ProcessStep({
      id: `sub-${Math.random().toString(36).slice(2)}`,
      currentStep: 2,
      totalSteps: 2,
      label: "after-unsubscribe",
    });
    await Repository.forModel(ProcessStep).create(second);
    await delay(300);

    expect(subscribed.events).toHaveLength(1);
  });

  it("does not deliver subscription-mode events to a never-subscribed stream", async () => {
    ({ built, server, port } = await startBackend(true));

    const never = await openSse(port, "/events", {
      "x-correlation-id": `never-${Math.random().toString(36).slice(2)}`,
    });
    streams = [never];
    await delay(100);

    const record = new ProcessStep({
      id: `never-${Math.random().toString(36).slice(2)}`,
      currentStep: 1,
      totalSteps: 1,
      label: "never-subscribed",
    });
    await Repository.forModel(ProcessStep).create(record);
    await delay(500);

    expect(never.events).toHaveLength(0);
  });
});
