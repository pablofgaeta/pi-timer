import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const originalDateNow = Date.now;

let now;
let nextHandle;
let scheduled;

function installFakeClock() {
  now = 0;
  nextHandle = 1;
  scheduled = new Map();

  Date.now = () => now;
  globalThis.setTimeout = (callback, delay) => {
    const handle = nextHandle++;
    scheduled.set(handle, { callback, dueAt: now + delay });
    return handle;
  };
  globalThis.clearTimeout = (handle) => {
    scheduled.delete(handle);
  };
}

function advance(milliseconds) {
  now += milliseconds;

  while (true) {
    const next = [...scheduled.entries()].find(([, timer]) => timer.dueAt <= now);
    if (!next) return;

    const [handle, timer] = next;
    scheduled.delete(handle);
    timer.callback();
  }
}

async function loadExtension() {
  const module = await import(`../extensions/timer.ts?test=${Date.now()}-${Math.random()}`);
  const notifications = [];
  const messages = [];
  let command;

  module.default({
    registerCommand: (name, options) => {
      assert.equal(name, "timer");
      command = options.handler;
    },
    sendUserMessage: (content, options) => {
      messages.push({ content, options });
    },
    on: () => {},
  });

  assert.equal(typeof command, "function");

  const run = async (args) => {
    await command(args, {
      ui: {
        notify: (content, level) => notifications.push({ content, level }),
      },
    });
  };

  return { run, notifications, messages };
}

beforeEach(() => {
  installFakeClock();
});

afterEach(() => {
  Date.now = originalDateNow;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
});

test("one-shot timers fire once and are removed", async () => {
  const timer = await loadExtension();

  await timer.run("1s ping");
  advance(1_000);
  advance(1_000);

  assert.deepEqual(timer.messages.map((message) => message.content), ["ping"]);

  await timer.run("list");
  assert.equal(timer.notifications.at(-1).content, "No active timers");
});

test("recurring timers fire until cancelled", async () => {
  const timer = await loadExtension();

  await timer.run("every 1s ping");
  advance(1_000);
  advance(1_000);
  advance(1_000);

  assert.deepEqual(timer.messages.map((message) => message.content), ["ping", "ping", "ping"]);

  await timer.run("list");
  assert.match(timer.notifications.at(-1).content, /#1: 1s left \(every 1s\) - ping/);

  await timer.run("cancel 1");
  advance(1_000);

  assert.deepEqual(timer.messages.map((message) => message.content), ["ping", "ping", "ping"]);
});
