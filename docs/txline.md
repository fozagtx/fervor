# TxLINE Integration

How Torq uses TxLINE - endpoints, auth, and hackathon API feedback.

## Auth

Server-side only (fans never touch a wallet):

1. `POST /auth/guest/start` → guest JWT  
2. On-chain `subscribe` (devnet, free World Cup tier)  
3. `POST /api/token/activate` → long-lived API token  
4. Hub uses JWT + API token for all subsequent calls  

## Endpoints used

| Endpoint | Role in Torq |
|---|---|
| `POST /auth/guest/start` | Guest JWT |
| `POST /api/token/activate` | Activate API token after subscribe |
| `GET /api/fixtures/snapshot` | World Cup fixture list (`competitionId=72`) |
| `GET /api/odds/stream` (SSE) | Live consensus odds → win-prob wave |
| `GET /api/scores/stream` (SSE) | Goals, cards, VAR, status |
| `GET /api/odds/snapshot/{fixtureId}` | Point-in-time odds |
| `GET /api/scores/historical/{fixtureId}` | Replay / backfill scores |
| `GET /api/odds/updates/{epochDay}/{hourOfDay}/{interval}` | Historical odds archive for replays |
| `GET /api/fixtures/validation` + TxOracle `validateFixture` | On-chain fixture proof |
| `GET /api/scores/stat-validation` + TxOracle `validateStatV2` | On-chain final scoreline proof |

## What we do with the feed

- Map demargined `Pct` on full-match `1X2_PARTICIPANT_RESULT` → home/draw/away win % (no odds math).
- Detect market-shift moments from probability deltas.
- Compute **Drama Score** from volatility + event spikes + closeness.
- Settle **Beat the Market** calls against the live stream.
- Replay finished matches through the same hub pipeline at 10× / 30× / 60×.

## API feedback (Earn form)

**Liked most**
- Demargined `Pct` - consumer win-probability with zero odds math
- Free World Cup tier + on-chain subscribe / activate worked as documented
- No rate limiting - historical backfill was painless
- Runnable devnet examples - auth working in the first hour

**Friction**
- Spec camelCase vs live/historical PascalCase (`FixtureId`, `GameState`, …)
- Top-level `GameState` stayed “scheduled”; real state is in `StatusId`
- Period filters inconsistent (`MarketParameters` vs `MarketPeriod`)
- `/api/token/activate` returns `text/plain`; `/scores/historical` uses SSE-style `data:` framing on a plain GET
