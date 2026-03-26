# Claude Code Refresh

Keep your Claude Code rate limit window alive by automatically pinging the CLI on a schedule.

## The Problem

Claude Code (Pro and Max plans) has a rate limit that resets on a rolling window — but the window only starts counting from your **first usage**. If you don't use Claude Code for several hours, you lose that idle time completely. When you finally sit down to work, your rate limit window starts fresh and you get less total usage during your session.

## The Solution

This app runs `claude -p hi` every ~4 hours in the background. That tiny ping costs almost nothing against your limit, but it **keeps the rolling window ticking** so that by the time you start your real work, old usage has already fallen off the window. The result: more available capacity when you actually need it.

## Features

- **Web dashboard** with real-time status, countdown timer, and live terminal output
- **Flexible scheduling** — set a fixed interval (e.g. every 4h 5m) or specific times of day
- **Ping history** tracking with status and duration
- **Optional password protection** via environment variable
- **English / Hebrew UI**
- **Docker-ready** with persistent storage

## Quick Start

### Local

```bash
npm install
npm start
```

Open `http://localhost:3000`

### Docker

```bash
docker build -t claude-code-refresh .
docker run -p 3000:3000 -v claude_data:/data claude-code-refresh
```

You'll need to authenticate Claude Code inside the container:

```bash
docker exec -it <container> claude login
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATA_DIR` | `./data` | Persistent data directory |
| `DASHBOARD_PASSWORD` | *(none)* | Set to enable login protection |

## How It Works

1. The scheduler triggers `claude -p hi` at your configured interval
2. Claude Code responds (keeping the rate limit window active)
3. The dashboard shows ping results, next scheduled ping, and full terminal logs
4. All config and history is persisted to disk so nothing is lost on restart

## Deploying

This is designed to run on any always-on server or container platform. You need:

- Node.js 20+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- A persistent volume for `/data` (stores config, history, and Claude credentials)
