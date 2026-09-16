# pi-timer

One in-session timer command for Pi.

Timers are intentionally not durable. They are cancelled when the Pi session shuts down, reloads, or switches sessions.

## Install from this checkout

```bash
pi install /home/pablo/workspace/gh/pablofgaeta/pi-timer
```

Then run this inside Pi:

```text
/reload
```

## Command

```text
/timer 10m check the build log
/timer list
/timer cancel 1
/timer clear
```

Aliases inside `/timer`:

```text
/timer ls
/timer rm 1
/timer delete 1
```

Supported delay units: `s`, `sec`, `seconds`, `m`, `min`, `minutes`, `h`, `hr`, `hours`.

When a timer fires, the extension sends the scheduled text as a follow-up user message with prompt-template and slash-command expansion enabled.
