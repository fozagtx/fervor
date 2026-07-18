# Match Pulse

**Every match has a heartbeat.** Match Pulse is a second-screen web app for the FIFA World Cup that turns TxLINE's real-time consensus betting odds into a live, fan-readable experience: a win-probability river that moves with the game, market-shift moments, a prediction streak game, and a pundit voice that narrates what the market is thinking.

No betting. No crypto knowledge required from the fan. Solana and TxLINE power everything under the hood.

## What it does

- **Win-probability river** — TxLINE's demargined Stable Price consensus odds, streamed live and drawn as a flowing three-band chart (home / draw / away). Goals, red cards and big market moves are pinned to the timeline.
- **Match moments** — a live ticker that detects significant odds swings ("Market shift: France surging +8.1pp") alongside goals and game-state changes.
- **Beat the market** — call whether a team's win chance will be higher or lower five match-minutes from now, settle against the real feed, build a streak, share your record. A skill game against the bookmakers' brain — no wagering.
- **Replay any match** — every feed message is recorded; finished matches replay through the identical pipeline at 10×/30×/60×. The app stays fully alive after the tournament ends.
- **Pundit voice** — optional narration of goals and market shifts via speech synthesis, fusing score and odds context into each line.

## How TxLINE powers it

The server (never the browser) authenticates and subscribes:

1. `POST /auth/guest/start` — guest JWT
2. On-chain `subscribe(serviceLevel, weeks)` on the TxLINE Solana program (devnet, free World Cup tier), signed and paid by the app's wallet
3. `POST /api/token/activate` — signs `txSig:leagues:jwt` with the wallet key, receives the long-lived API token
4. Data flows with `Authorization: Bearer <jwt>` + `X-Api-Token`

### TxLINE endpoints used

| Endpoint | Use |
|---|---|
| `POST /auth/guest/start` | guest session JWT (renewed on 401) |
| `POST /api/token/activate` | API token after on-chain subscribe |
| `GET /api/fixtures/snapshot?competitionId=&startEpochDay=` | World Cup fixture list |
| `GET /api/odds/stream` (SSE) | live consensus odds → win probabilities |
| `GET /api/scores/stream` (SSE) | live scores, game states, minutes |
| `GET /api/odds/snapshot/{fixtureId}` | backfill on startup |
| `GET /api/scores/historical/{fixtureId}` | replay timelines |

The odds payload's `Pct` field (demargined percentages per price name) is used directly as win probability — no margin math needed, which is one of the nicest properties of the Stable Price feed.

## Architecture

```
TxLINE SSE (odds + scores)
        │
        ▼
  MatchHub (Node, single process)
  · normalizes odds → prob points, scores → events
  · detects market shifts
  · records every message to JSONL (replay source)
        │ in-process pub/sub
        ▼
  /api/stream (SSE relay) ──► browser (React)
  /api/stream?replay=1&speed=30 ──► per-viewer replay session
```

- **Next.js 16** (App Router), React 19, Tailwind v4, HeroUI
- **@coral-xyz/anchor** for the on-chain subscribe transaction
- Single long-lived Node process; the browser only ever talks to the app's own SSE endpoint

## Running locally

```bash
pnpm install

# wallet with a little devnet SOL for the subscribe transaction
# (JSON secret-key array, e.g. from solana-keygen)
export TXLINE_WALLET_PATH=_keys/wallet.json

# optional: TXLINE_NETWORK=mainnet | devnet (default devnet)
pnpm bootstrap   # one-shot: subscribe → activate → verify streams
pnpm dev
```

`TXLINE_SIM=1 pnpm dev` runs a self-contained simulator (no credentials needed) for UI development.

## Judging after the tournament

Live matches end, the app does not: open any finished match and press **Replay** to re-run its full recorded market timeline at up to 60× through the exact same streaming pipeline the live view uses.
