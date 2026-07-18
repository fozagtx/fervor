# Torq

A live World Cup **second-screen** app on [TxLINE](https://txline.txodds.com) consensus odds and Solana **TxOracle** — plus a **macOS Dynamic Island / notch companion** for live scores and win% without leaving your desktop.

Fans watch a win-probability **wave**, **Drama Score**, market-shift moments, **Beat the Market** (skill calls — no wagering), full replays, and one-tap on-chain score proof. No betting, no sign-up, no crypto required.

| | |
|---|---|
| **App** | https://fervor.up.railway.app |
| **Mac notch (DMG)** | [Download Torq.dmg](https://github.com/fozagtx/fervor/releases/download/torq-mac/Torq.dmg) |
| **Repo** | https://github.com/fozagtx/fervor |
| **Track** | TxODDS · Consumer & Fan Experiences |

> First second-screen that combines consensus-odds Drama Score + a playable mini-game + verifiable outcomes — without betting. Ships with a native **Mac notch** app.

## How It Works

1. **Server auth** — guest JWT → on-chain `subscribe` → API token (fans never see this).
2. **Hub** — TxLINE odds + scores SSE → normalize, record, fan out over one browser SSE.
3. **Wave** — demargined `Pct` → live home/draw/away win %.
4. **Play** — Beat the Market calls settle against the feed; moments + GoalBlast on big moves.
5. **Replay / proof** — same pipeline at 10×–60×; TxOracle verifies fixture + final score.

TxLINE endpoints + API feedback → [`docs/txline.md`](docs/txline.md)

## Tech Stack

| Layer | Technology |
|---|---|
| App | Next.js 16, React 19, TypeScript, HeroUI, Tailwind |
| Data | TxLINE SSE / snapshots / history / validation proofs |
| Chain | Solana devnet, Anchor, TxOracle (`validateFixture`, `validateStatV2`) |
| Wallet | Optional Phantom (identity only) |
| Native | macOS Dynamic Island (`macos/`) |
| Host | Railway |

## Screenshots

| Landing | Lobby |
|---|---|
| ![Landing](docs/screenshots/landing.png) | ![Lobby](docs/screenshots/lobby.png) |

| Match story | Replay |
|---|---|
| ![Match](docs/screenshots/match-story.png) | ![Replay](docs/screenshots/replay.png) |

## Quick Start

```bash
pnpm install
export TXLINE_JWT=...          # or TXLINE_WALLET_PATH + pnpm bootstrap
export TXLINE_API_TOKEN=...
pnpm dev                       # http://localhost:3000
```

Live smoke: `pnpm smoke`

## Mac notch companion

Torq includes a native **macOS Dynamic Island / menu-bar notch** app — same live TxLINE feed as the website (scores, win%, expand on hover).

| | |
|---|---|
| **Download** | [Torq.dmg](https://github.com/fozagtx/fervor/releases/download/torq-mac/Torq.dmg) |
| **Install** | Open DMG → drag Torq to Applications → right-click → Open |
| **Docs** | [`macos/README.md`](macos/README.md) |
| **Build** | `./macos/build.sh && open macos/dist/Torq.app` |

## Key Features

- Win-probability river + Drama Score + market-shift moments  
- Beat the Market streaks · Who wins crowd · Moments feed  
- Replay 10×/30×/60× · Pundit TTS · FT recap + share  
- On-chain score proof · PWA · `/embed` · `/watch`  
- **macOS Dynamic Island / notch companion** (DMG download above)  

## Docs

| Doc | What’s in it |
|---|---|
| [TxLINE integration](docs/txline.md) | Endpoints used + Earn API feedback |
| [Mac notch install](macos/README.md) | DMG download + island setup |
| [Submission / Earn paste](docs/submission.md) | Form answers, product notes |
| [Demo script](claudedocs/demo-script.md) | 5-min recording spine |
| [UX context](docs/ux-context-profile.md) | Fan language / north star |

## License

MIT
