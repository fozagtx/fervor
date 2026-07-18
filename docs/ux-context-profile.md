# Torq — UX Context Profile

**Prompt:** Imagine TikTok and SportyBet built a prediction market together.  
**Product:** Torq (TxODDS Consumer & Fan Experiences)  
**Locked:** No real money. No stakes. Skill calls + crowd FOMO + live market signal.

---

## 1. One-line product

Swipe a match. Tap a side. Feel the room and the market move — like a sportsbook slip inside a TikTok feed, without gambling.

---

## 2. Parent DNA (what we steal / what we refuse)

| From | Steal | Refuse |
|---|---|---|
| **TikTok** | Full-bleed vertical snap · one unit per viewport · side action rail · swipe = next market · thumb-first | Endless comment doomscroll · creator chrome noise |
| **SportyBet** | 1X2 market tiles · big tap targets · live minute · “odds” as glanceable numbers · pick → confirm energy | Cashier · stake input · cashout · KYC · betslip wallet |
| **Torq** | TxLINE win % as truth · wave as proof of movement · Who wins crowd · Beat the market streak · Solana score proof | Sportsbook copy · “place bet” language · dark casino vibe |

---

## 3. User experience (golden path)

1. **Land on white reel** — first fixture fills the phone. No lobby grid. No essay.
2. **Read the board in &lt;1s** — flags, score/vs, LIVE or countdown.
3. **See the market as 1X2 tiles** — Home / Draw / Away show SportyBet-style decimal “prices” derived from live win % (display only).
4. **Tap a tile** — lock a free call. Tile lights up. Crowd % updates. FOMO line if you’re against the room.
5. **Glance the wave** — compact river under the slip proves the number is alive.
6. **Swipe up** — next fixture / next market. Same muscle memory as TikTok.
7. **Side rail** — star team · open full match · share. Never leave the reel for the core loop.
8. **Optional deep dive** — Watch live / Replay opens the full match screen (Beat the market, proof, ticker).

---

## 4. Screen architecture

| Surface | Job | Scroll model |
|---|---|---|
| `/` and `/matches` | Prediction reel (primary) | `snap-y` · 1 match = 100dvh |
| `/match/[id]` | Deep watch + Beat + proof | Normal scroll OK |
| `/feed` | Moment clips | Already TikTok snap |
| **macOS island** | Same 1X2 slip + wave on hover-expand | Native AppKit · Beat bounce/kick |

**Primary object per slide:** the **1X2 market slip**, not a blog card.

---

## 5. Interaction rules

- Thumb zone = bottom 40% for picks + CTA.
- One primary question per slide: **Who wins?**
- Numbers must feel SportyBet-native: decimals like `1.82` / `3.40` / `4.10` (from win %), plus crowd %.
- Never say “bet”, “stake”, “odds to win money”. Say **call**, **lock in**, **market**, **crowd**.
- Instant feedback on tap (&lt;100ms optimistic UI).
- White canvas by default — clean sportsbook daylight, not night-mode casino.

---

## 6. Visual direction

- **Default theme:** white / light. Dark is opt-in only.
- Surfaces: `#FFFFFF` stage, soft green accent (Torq), indigo for away line.
- Market tiles: large, high-contrast, SportyBet “selection” energy when locked.
- Density: workstation-enough for three tiles; never a dashboard of six widgets in the first viewport.

---

## 7. Success metrics (feel)

- User locks a call before reading any paragraph.
- User swipes ≥3 fixtures in first session.
- User can explain: “It’s like SportyBet picks, but free, and it scrolls like TikTok.”

---

## 8. Non-goals

- Real-money markets, AMM, staking, tipster paywalls.
- Renaming back to Match Pulse / Pulse*.
- Multi-market parlays on the reel (keep 1X2 only on the slide).
