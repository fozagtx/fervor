# Torq — Submission Notes

**Track:** TxODDS Consumer and Fan Experiences (World Cup Track)

**Live MVP (verified):** https://torq.up.railway.app  

> **Originality:** First second-screen that combines consensus-odds **Drama Score** + a playable **Beat the Market** mini-game + **verifiable on-chain outcomes** — without requiring betting.

## Earn form — ready to paste

X / Tweet fields omitted (none). Demo video URL still TBD (you record).

| Field | Value |
|---|---|
| Link to Your Submission | https://torq.up.railway.app |
| Project Title | Torq |
| Live MVP | https://torq.up.railway.app |
| Demo Video | _TBD — your Loom/YouTube_ |
| Repository | https://github.com/fozagtx/fervor |
| Technical Documentation | https://github.com/fozagtx/fervor/blob/main/README.md · [TxLINE notes](txline.md) · this file |

**Briefly explain your Project**

Torq is a World Cup second-screen app for fans with a phone in hand. It turns TxLINE consensus odds into a live win-probability “wave,” drama ranking, Beat-the-market skill calls (no wagering), GoalBlast moments, full match replay, a macOS Dynamic Island companion, and one-tap on-chain scoreline proof via TxOracle — so the market’s heartbeat is something you can feel, not a sportsbook.

**Originality for judges:** First second-screen that combines consensus odds Drama Score + a playable mini-game + verifiable outcomes without requiring betting.

**TxLINE experience:** paste from [`docs/txline.md`](txline.md) → *API feedback*.

**Anything Else?** macOS island (`macos/`), embed `/embed/[id]`, watch links `/watch/[id]`, PWA install, demo script [`docs/demo-script.md`](demo-script.md), live smoke `pnpm smoke`.

## Core idea

Most fans watch with a phone in their hand. The one thing the big operators always had that fans never did is the live market — the single most information-dense signal about a match. Torq turns TxLINE's consensus odds into a fan product: a live win-probability river you can feel the game through, moments generated from market movement, a prediction streak game scored against the real feed, and full match replays after the whistle.

## Mobile / PWA / accessibility (for judges)

- Mobile-first reel lobby + large tap targets; Add to Home Screen via `public/manifest.webmanifest`
- Guest mode by default — zero crypto friction; Phantom optional for identity only
- Controls labeled (`aria-label` on mute, theme, wallet, favorites); light default for outdoor use
- Live smoke: `pnpm smoke` against the public Railway URL

## Product highlights

- **Win-probability river** — the demargined Stable Price 1X2 market drawn as a living three-band chart. Goals, VAR, penalties and market shifts are pinned to the exact timeline moment.
- **Market-shift moments** — the app watches the odds stream and narrates when the money moves ("Market shift: France surging +8pp") even before anything shows on TV.
- **Beat the market** — pick higher/lower on a team's win chance five match-minutes out, settle against the actual feed, build streaks, share. Skill game; no wagering.
- **Replay engine** — every match is replayable at 10×/30×/60× through the exact same streaming pipeline as live. Judges reviewing after July 19 can relive the real semifinals, bronze final and final inside the app.
- **Pundit voice** — optional spoken commentary that fuses score and market context per event.
- **Provably real scorelines** — one tap fetches the goal-stat Merkle proofs and has the TxOracle program verify the exact final score (`validateStatV2` with equality predicates for both teams' goals) plus the fixture data, as read-only simulations. The scoreline a fan sees is proven on Solana, not just reported.
- **Optional wallet identity** — Phantom connect saves a fan's call record to their wallet; never a transaction, never required.

## Technical highlights

- Server-side Solana integration: guest JWT → on-chain `subscribe` (devnet, free World Cup tier) → signed activation → API token. Fans never touch a wallet.
- Node hub consumes both TxLINE SSE streams, normalizes them, detects market shifts, records every message, and relays to browsers over one SSE endpoint.
- Replay timelines backfill from `/scores/historical` plus the 5-minute odds archive and are materialized to disk; finished fixtures pre-warm at boot so replays start instantly.
- Custom SVG chart, HeroUI design system, mobile-first.

## Monetization path

1. **Freemium fan app** — free live scores and river; premium tier for personalized push alerts (your team's market swings), extra pundit voices, and ad-free.
2. **B2B embeddable widget** — the win-probability river as an embed for publishers and streamers (`/embed/[fixture]`), licensed per-seat; a natural downstream distribution channel for TxLINE data.
3. **Sponsorships** — moment cards ("Goal alert presented by …") in high-attention contexts.

## TxLINE

Full endpoint list + Earn API feedback → [`docs/txline.md`](txline.md)
