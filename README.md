# Fervor

A live World Cup second-screen app built on TxLINE's real-time consensus odds and the TxOracle program on Solana.

Fans open Fervor on their phone during a match and watch the game's heartbeat: a live win-probability river computed from the same demargined odds the bookmakers trade on, moments generated from market movement, a prediction game scored against the real feed, and full match replays after the whistle. Every scoreline is provable on-chain. No betting, no sign-up, no crypto knowledge required.

## How It Works

1. **Subscription:** the server obtains a guest JWT, sends a `subscribe` transaction to the TxLINE program on Solana devnet (free World Cup tier), signs the activation message with its wallet, and receives a long-lived API token. Fans never touch any of this.
2. **Ingestion:** a single hub process consumes TxLINE's odds and scores SSE streams, normalizes both into match state, and records every message to disk.
3. **The wave:** full-match `1X2_PARTICIPANT_RESULT` consensus odds become win probabilities directly from the feed's demargined `Pct` field and stream to every browser over one SSE endpoint.
4. **Moments:** goals, cards, VAR and penalties come from the scores feed; significant odds movement is detected as "market shift" moments, often before TV commentary reacts.
5. **Pulse calls:** fans call a team's win chance higher or lower over the next five match-minutes; calls settle against the live feed with points and streak multipliers.
6. **Replay:** finished matches re-stream through the identical pipeline at 10×/30×/60× from recorded or backfilled history, so the app stays fully alive after the tournament ends.
7. **Proof:** one tap fetches Merkle proofs from TxLINE and has the TxOracle program verify the fixture and the exact final scoreline as read-only simulations.

## Drama Score

```
Drama = MarketVolatility(0-60) + EventPulses(0-45, capped) + Closeness(0-10), capped at 100
```

- **Market volatility:** recency-weighted sum of win-probability movement over the last 10 minutes.
- **Event pulses:** goals, disallowed goals, penalties, red cards and market shifts each add a spike that decays over 8 minutes.
- **Closeness:** a tight three-way market raises the floor.

The score ranks the lobby ("which game should I be watching?") and feeds the full-time recap alongside the biggest five-minute market swing.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, React 19, TypeScript |
| UI | HeroUI, Tailwind CSS v4, Framer Motion, custom SVG charting |
| Data | TxLINE off-chain API (odds/scores SSE, snapshots, historical archive, validation proofs) |
| Chain | Solana devnet, @coral-xyz/anchor, TxOracle program (`validateFixture`, `validateStatV2`) |
| Wallet | Optional Phantom connect (identity only, no transactions) |
| Hosting | Railway (persistent Node process + volume for feed recordings) |

## Screenshots

### Landing
![Landing](docs/screenshots/landing.png)

### Match lobby
![Lobby](docs/screenshots/lobby.png)

### Finished match — full story
![Match story](docs/screenshots/match-story.png)

### Replay running at 60×
![Replay](docs/screenshots/replay.png)

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- A Solana devnet wallet keypair with a little SOL (only for the one-time subscribe transaction)

### Setup

```bash
pnpm install

# Option A: full flow — wallet signs the on-chain subscription at boot
export TXLINE_WALLET_PATH=_keys/wallet.json
pnpm bootstrap        # one-shot: subscribe → activate → verify streams

# Option B: pre-activated credentials (what the deployed server uses;
# the signing wallet never leaves your machine)
export TXLINE_JWT=...
export TXLINE_API_TOKEN=...

pnpm dev
```

Environment variables:

| Variable | Purpose |
|---|---|
| `TXLINE_NETWORK` | `devnet` (default) or `mainnet` |
| `TXLINE_WALLET_PATH` / `TXLINE_WALLET_SECRET` | keypair for the subscribe transaction |
| `TXLINE_JWT` + `TXLINE_API_TOKEN` | pre-activated credentials, skips the wallet entirely |
| `SOLANA_RPC_URL` | RPC endpoint (defaults to public devnet) |

## Key Features

- **Win-probability river:** live three-band chart (home/draw/away) with goals, VAR, penalties and market shifts pinned to the timeline; scrub to inspect any moment.
- **Drama meter:** 0–100 "how crazy is this match right now" on every live card and match header.
- **Match moments:** live ticker fusing scores-feed events with detected market shifts and their pp deltas.
- **Beat the market:** higher/lower calls settled against the real odds stream; points, streak multipliers, shareable record.
- **Replay engine:** per-viewer replays at 10×/30×/60× through the same pipeline as live; finished fixtures pre-warm at boot and full histories render instantly on match pages.
- **Full-time recap:** final score, drama peak, biggest five-minute swing, goals, your call record, one-tap share.
- **Pundit voice:** optional speech-synthesis narration of goals and market moves with market context in every line.
- **Provably real:** on-chain verification of fixture data and the exact final scoreline via TxOracle view simulations.
- **Wallet identity (optional):** Phantom connect saves the call record to a wallet; guest records adopt on first connect; never a transaction.
- **Restart-proof:** feed history rehydrates from disk on boot; stream watchdog reconnects silent feeds; known results ship in the bundle so cold boots show real scores instantly.
- **Light and dark themes:** light by default, persisted toggle.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/stream` | SSE: init snapshot + live increments for all matches |
| `GET /api/stream?fixture={id}` | SSE scoped to one match |
| `GET /api/stream?fixture={id}&replay=1&speed={n}` | per-connection replay session |
| `GET /api/matches` | current lobby state |
| `GET /api/history/{fixtureId}` | full recorded history of a finished match |
| `GET /api/verify/{fixtureId}` | on-chain fixture + scoreline proof (view simulation) |

## Project Structure

```
matchpulse/
├── app/
│   ├── page.tsx              # Landing
│   ├── matches/              # Lobby
│   ├── match/[id]/           # Match screen
│   └── api/                  # stream, matches, history, verify
├── components/               # PulseChart, MatchCard, ScoreHeader, PredictCard,
│                             # RecapCard, EventTicker, PunditVoice, ProofBadge,
│                             # DramaMeter, WalletButton, TopBar, Logo
├── lib/
│   ├── txline/               # config, auth, api, hub, normalize, replay, types
│   ├── drama.ts              # drama score + biggest swing
│   ├── stats.ts              # call-record storage (guest / wallet)
│   ├── flags.ts              # national-team flags
│   └── useMatchStream.ts     # client SSE hook
├── idl/                      # TxOracle IDL + types
├── scripts/                  # bootstrap + feed probes
├── seed-recordings/          # bundled real feed history
└── docs/                     # submission notes, screenshots
```

## Documentation

| Document | Description |
|---|---|
| [Submission Notes](docs/submission.md) | Product and technical highlights, TxLINE endpoints used, API feedback |
| [TxLINE Documentation](https://txline.txodds.com/documentation/quickstart) | Upstream data platform |

## License

MIT
