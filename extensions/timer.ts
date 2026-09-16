import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type TimerHandle = ReturnType<typeof setTimeout>;

type ScheduledTimer = {
  handle: TimerHandle;
  prompt: string;
  dueAt: number;
  delayText: string;
};

const timers = new Map<number, ScheduledTimer>();
let nextId = 1;

function parseDelay(delayText: string): number | undefined {
  const match = delayText.trim().match(/^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)$/i);
  if (!match) return undefined;

  const value = Number(match[1]);
  if (!Number.isSafeInteger(value) || value <= 0) return undefined;

  const unit = match[2].toLowerCase();
  if (unit.startsWith("s")) return value * 1_000;
  if (unit.startsWith("m")) return value * 60_000;
  if (unit.startsWith("h")) return value * 3_600_000;

  return undefined;
}

function formatRemaining(dueAt: number): string {
  const seconds = Math.max(0, Math.ceil((dueAt - Date.now()) / 1_000));
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  if (minutes < 60) return restSeconds === 0 ? `${minutes}m` : `${minutes}m ${restSeconds}s`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes === 0 ? `${hours}h` : `${hours}h ${restMinutes}m`;
}

function clearTimer(id: number): boolean {
  const timer = timers.get(id);
  if (!timer) return false;

  clearTimeout(timer.handle);
  timers.delete(id);
  return true;
}

function help(): string {
  return [
    "Usage:",
    "  /timer 10m check the build log",
    "  /timer list",
    "  /timer cancel 1",
    "  /timer clear",
  ].join("\n");
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("timer", {
    description: "In-session timers. Usage: /timer 10m check the build log, /timer list, /timer cancel 1, /timer clear",
    handler: async (args, ctx) => {
      const trimmed = args.trim();

      if (trimmed === "" || trimmed === "help") {
        ctx.ui.notify(help(), "info");
        return;
      }

      if (trimmed === "list" || trimmed === "ls") {
        if (timers.size === 0) {
          ctx.ui.notify("No active timers", "info");
          return;
        }

        const lines = [...timers.entries()].map(
          ([id, timer]) => `#${id}: ${formatRemaining(timer.dueAt)} left - ${timer.prompt}`,
        );
        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }

      if (trimmed === "clear") {
        const count = timers.size;
        for (const id of [...timers.keys()]) clearTimer(id);
        ctx.ui.notify(`Cancelled ${count} timer${count === 1 ? "" : "s"}`, "info");
        return;
      }

      const cancelMatch = trimmed.match(/^(cancel|rm|delete)\s+(\d+)$/);
      if (cancelMatch) {
        const id = Number(cancelMatch[2]);
        if (!clearTimer(id)) {
          ctx.ui.notify(`Timer not found: #${id}`, "error");
          return;
        }

        ctx.ui.notify(`Cancelled timer #${id}`, "info");
        return;
      }

      const separator = trimmed.search(/\s/);
      const delayText = separator === -1 ? trimmed : trimmed.slice(0, separator);
      const prompt = separator === -1 ? "" : trimmed.slice(separator).trim();
      const delay = parseDelay(delayText);

      if (delay === undefined || prompt.length === 0) {
        ctx.ui.notify(help(), "error");
        return;
      }

      const id = nextId++;
      const dueAt = Date.now() + delay;
      const handle = setTimeout(() => {
        timers.delete(id);
        pi.sendUserMessage(prompt, {
          deliverAs: "followUp",
          expandPromptTemplates: true,
        });
      }, delay);

      timers.set(id, { handle, prompt, dueAt, delayText });
      ctx.ui.notify(`Timer #${id}: ${delayText} - ${prompt}`, "info");
    },
  });

  pi.on("session_shutdown", () => {
    for (const id of [...timers.keys()]) clearTimer(id);
  });
}
