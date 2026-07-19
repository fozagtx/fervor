# Torq — Product Engineering Context Profile

**Generated:** 2026-07-18  
**Track:** TxODDS Consumer & Fan Experiences (World Cup)  
**Live:** https://torq.up.railway.app · repo: github.com/fozagtx/fervor  
**Methods used:** BPFG Hackathon OS · Build-DeFi (integrate-vs-build) · Colosseum Copilot *(token missing — landscape from session evidence)*

---

## 1. Product identity (who we are)

| Axis | Statement |
|---|---|
| **One-liner** | Second-screen World Cup app that turns TxLINE consensus odds into a win-probability river fans can feel. |
| **Not** | A sportsbook, tipster, trading bot, or Candor clone. |
| **Hero object** | The wave (demargined 1X2 → live win %). |
| **Proof object** | On-chain scoreline verify via TxOracle (read-only). |
| **Game loop** | Beat the market (skill call vs feed, no wagering). |
| **Liveness** | Live SSE + replay at 10×/30×/60× + macOS Dynamic Island. |
| **Audience** | Fan with phone in hand during a match (primary). Judges / Earn reviewers (secondary). Streamers (B2B embed). |

### Brand / naming discipline
- **Name:** Torq (locked). Never old working titles or peer product names in UI or pitch.
- **Voice:** Fan language. No engineering copy (“SSE”, “hub”, “demargined”) in the product surface.
- **Signature:** green/indigo wave · Beat mascot · GoalBlast · drama meter.

---

## 2. Living question (BPFG)

> **Do World Cup fans want the market’s heartbeat as a second screen — or do they only want scores, and “odds” still feel like gambling even when no money moves?**

Open in two directions:
1. If yes → wave + drama + Beat-the-market is the product.
2. If no → we mis-positioned; proof/replay/social alone won’t save a trading-feeling UI.

**Primary audience:** Fan watching on TV/phone, not a bettor.  
**Filter out:** Arb traders, agent bankrolls, “prediction market” framing.

### Void language (almost-said needs)
- “Which game should I actually be watching right now?”
- “The score doesn’t feel like what’s happening.”
- “I want the room to feel the goal without opening five apps.”
- “Show me the match after it ended like I was there.”
- “Is this score even real?”

### Workaround today (what we automate)
| Workaround | Torq moment |
|---|---|
| Flip SofaScore + Twitter + group chat | One river + moments + GoalBlast |
| Screenshot recaps, delete losses | Shareable FT card + leaderboard that only moves forward |
| Miss the goal looking at phone | Island alert + stadium sound |
| “Trust me bro” score claims | One-tap TxOracle proof |

---

## 3. Expertise tour (what “expert” means here)

### A. Fan / second-screen expertise
- Drama ranking > raw odds
- Goal celebration is a ritual (sound + motion + share), not a toast
- Pre-match countdown and KO flip matter as much as in-play
- Replay is the judge-proof and the post-tournament life

### B. Market-data expertise (TxLINE)
- Use `Pct` — never reinvent odds math
- StatusId ≠ top-level GameState (known feed footgun)
- Historical archive + materialize = demo insurance
- Free tier on-chain subscribe is the sponsor story — keep it server-side

### C. Solana / “DeFi integrate” expertise (build-defi-protocol lens)
**Decision: Integrate, do not build a custom DeFi program.**

| Need | Choice | Why |
|---|---|---|
| Data access | TxLINE guest JWT → `subscribe` → activate | Sponsor path |
| Trust | `validateFixture` / `validateStatV2` view sims | Proof without custody |
| Fan wallet | Optional Phantom identity only | No value transfer |
| Custody / AMM / lending | **Out of scope** | Wrong track; security surface we don’t need |

Non-negotiable for this product: no user funds, no custom vault math, no oracle of our own.

### D. Hackathon / pitch expertise
- Prize description = rubric (Consumer & Fan Experiences)
- Demo golden path > feature count
- Live match tonight (FRA–ENG) is the money shot; replay is backup
- Name collision with a peer submission was a real risk — Torq is the fix

---

## 4. Shipped surface (truth table)

| Capability | Web | Island | Notes |
|---|---|---|---|
| Lobby + grid cards | ✅ | ✅ list | Dense grid shipped |
| Win-prob wave | ✅ WaveChart | ✅ expanded chart | Hydrate history for FT |
| Drama meter | ✅ | partial | Rows show drama in subtitle when high |
| Beat the market | ✅ | ❌ | Island is spectator, not player |
| GoalBlast / sound | ✅ | ✅ chime + kick | Mute on both |
| Pundit TTS | ✅ | ❌ | Web only |
| Replay auto-start | ✅ `?replay=1` | ✅ opens replay URL | |
| Moments feed + reactions | ✅ | ❌ | |
| Watch-with-me / embed | ✅ | ❌ | |
| Leaderboard | ✅ | ❌ | |
| Follow / favorites sync | ✅ + API | ✅ paste code | |
| On-chain proof | ✅ | ❌ | Deep link to proof on web |
| Demo video | ❌ | — | **Critical gap** |
| Submission polish | partial | — | Screenshots/docs need refresh |

---

## 5. Identity gaps we’re missing (ranked)

### P0 — kills the win if ignored
1. **Demo video not recorded** — Earn weights video heavily; live FRA–ENG (~5–6h) is the window.
2. **Product still feels “odds app” to some judges** — hero copy and first viewport must scream *fan second screen*, not trading.
3. **Island ↔ web parity of the wave** — if judges only see the notch without a clear river, the signature is invisible.

### P1 — expertise / identity holes
4. **No “why Torq is distinct” one-pager** in submission — name was fixed; differentiation story must be explicit (wave + drama + replay + proof + island).
5. **Beat the market invisible on island** — social proof of skill game doesn’t leave the browser.
6. **Proof is buried** — “provably real” is a sponsor-aligned differentiator; one-tap from lobby/FT card is weak today.
7. **Colosseum landscape not locked** — Copilot PAT missing; we can’t cite 5,400-project crowdedness for sports/fan products yet.

### P2 — void language not fully closed
8. **“Which game should I watch?”** — drama sorts lobby but isn’t the landing hero.
9. **Watch party depth** — share link exists; no live reaction sync during the match.
10. **Streamer distribution** — embed exists; no OBS one-click / docs in submission.
11. **Pre-match ritual** — countdown exists; no “lineup of the night” / pinned final-four rail.

### Explicit non-gaps (do not build tonight)
- FossaPay / Naira Shield wallet rails (different product)
- Custom lending/AMM/perps program
- Real-money betting
- Renaming back toward old working titles

---

## 6. Elder council snapshot (Detective ⇄ Decider)

**@Detective:** The living question isn’t validated with field quotes at pitch grade (≥3 places). We’re shipping on sponsor-shaped intuition. Risk: judges read “odds chart” and slot us as trading-tools leakage.

**@Decider:** Cut everything that isn’t the golden path for tonight:  
`Landing → lobby grid → FRA–ENG wave → GoalBlast → Beat call → proof → island hover → share card.`  
Record that. Submission text second. No new features after kickoff unless the stream dies.

**Through-line:** Close the void “the score doesn’t feel like the match” with the wave + GoalBlast in under 90 seconds on camera.

---

## 7. Demo spine (field language)

**User in first 10s:** Fan, TV on, phone in hand, group chat blowing up, doesn’t know which signal to trust.

**Aha:** The green line lurches before the replay on TV finishes — “oh, that’s the game.”

**Click path (≤90s)**
1. Open https://torq.up.railway.app/
2. Tap France vs England (or Replay if pre-KO)  
3. Point at the wave; wait for/trigger a moment  
4. GoalBlast or market shift + optional Beat call  
5. Proof badge tap  
6. Hover macOS island  

**Do not demo:** Wallet seed phrases, OpenAPI, bootstrap scripts, FossaPay.

**Backup:** France–Morocco / any FT at 60× replay.

---

## 8. Colosseum Copilot status

`TOKEN_STATUS: missing` — landscape search/compare not run.

To unlock winner/gap tables from 5,400+ Solana hackathon projects:
1. Get PAT at https://arena.colosseum.org/copilot  
2. Paste token (or `superstack copilot --token <pat>`)  
3. Re-run: search “sports odds fan second screen” + winner compare on consumer tags  

**Session-known peer:** another Earn companion (same World Cup companion framing) — our differentiation is Torq naming + drama + island + GoalBlast + on-chain score proof + Beat streak/leaderboard.

---

## 9. Build constraints (next 6 hours)

| Ship | Cut / backlog |
|---|---|
| Keep feed green; FRA–ENG wave live | New DeFi surfaces |
| Record demo during KO / first goal | More island features |
| Refresh submission screenshots + differentiation one-pager | FossaPay |
| Fix any layout/name regressions | Scope expansion |

---

## 10. Archive paths

| Artifact | Path |
|---|---|
| This profile | `docs/product-engineering-context.md` |
| Submission notes | `docs/submission.md` |
| Demo script | `docs/demo-script.md` |
