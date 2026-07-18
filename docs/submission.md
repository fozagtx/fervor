# Torq — Submission Notes

**Track:** TxODDS Consumer and Fan Experiences (World Cup Track)

**Live MVP (verified):** https://fervor.up.railway.app  

> **Originality:** First second-screen that combines consensus-odds **Drama Score** + a playable **Beat the Market** mini-game + **verifiable on-chain outcomes** — without requiring betting.

## Earn form — ready to paste

X / Tweet fields omitted (none). Demo video URL still TBD (you record).

| Field | Value |
|---|---|
| Link to Your Submission | https://fervor.up.railway.app |
| Project Title | Torq |
| Live MVP | https://fervor.up.railway.app |
| Demo Video | _TBD — your Loom/YouTube_ |
| Repository | https://github.com/fozagtx/fervor |
| Technical Documentation | https://github.com/fozagtx/fervor/blob/main/README.md · this file |

**Briefly explain your Project**

Torq is a World Cup second-screen app for fans with a phone in hand. It turns TxLINE consensus odds into a live win-probability “wave,” drama ranking, Beat-the-market skill calls (no wagering), GoalBlast moments, full match replay, a macOS Dynamic Island companion, and one-tap on-chain scoreline proof via TxOracle — so the market’s heartbeat is something you can feel, not a sportsbook.

**Originality for judges:** First second-screen that combines consensus odds Drama Score + a playable mini-game + verifiable outcomes without requiring betting.

**Anything Else?** macOS island (`macos/`), embed `/embed/[id]`, watch links `/watch/[id]`, PWA install, demo script `claudedocs/demo-script.md`, live smoke `pnpm smoke`.

Same block lives in the root [README](../README.md#world-cup-track-submission).

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

## TxLINE endpoints used

- `POST /auth/guest/start`
- `POST /api/token/activate`
- `GET /api/fixtures/snapshot?competitionId=72&startEpochDay=…`
- `GET /api/odds/stream` (SSE)
- `GET /api/scores/stream` (SSE)
- `GET /api/odds/snapshot/{fixtureId}?asOf=…`
- `GET /api/scores/historical/{fixtureId}`
- `GET /api/odds/updates/{epochDay}/{hourOfDay}/{interval}`
- `GET /api/fixtures/validation` + on-chain `validateFixture` (view simulation)
- `GET /api/scores/stat-validation` + on-chain `validateStatV2` (view simulation)

## API feedback

What we liked most:

- **The `Pct` field is a gift.** Demargined percentages per price name means a consumer win-probability product needs zero odds math. This is the single best property of the feed.
- Free tier with a real on-chain subscription flow was smooth end to end; guest JWT + activation worked exactly as documented.
- No rate limiting made the historical odds backfill (dozens of interval pages per match) painless.
- The runnable devnet examples repo saved hours; auth was working within the first hour because of it.

Where we hit friction:

- **Spec vs. feed casing:** the OpenAPI spec documents scores fields in camelCase (`fixtureId`, `gameState`, `scoreSoccer`) but the live feed and historical endpoint emit PascalCase (`FixtureId`, `GameState`, `Score`). Cost us a rewrite of the normalizer.
- **Top-level `GameState` on scores messages never changes** (stayed "scheduled" through an entire finished match). The real state lives in `StatusId`. Documenting the StatusId enum (2=1st half, 3=HT, 4=2nd half, 5/100=ended…) would help a lot.
- **Period sub-markets are flagged inconsistently:** "half=1" appears in `MarketParameters` on the live odds stream but in `MarketPeriod` in the interval archive. Filtering full-match 1X2 requires checking both.
- `/api/token/activate` returns `text/plain` while most of the API is JSON; easy to mis-parse.
- `/scores/historical/{fixtureId}` responds with SSE-style `data:` framing on a plain GET; a JSON array (or documenting the framing) would be friendlier.
