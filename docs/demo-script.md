# Demo video script (target 4:30, hard cap 5:00)

Judging note says the video is weighted heavily and must clearly show product
experience, user flow, and core functionality. Record 1440p screen capture,
phone-width browser window (390px) centered, system audio ON for pundit voice.
If possible record the live segment during the bronze final / final; replay
mode is the fallback and also a feature to show off.

## 0:00–0:20 - Hook
Screen: home page, live cards with moving probability bars.
Line: "A World Cup match is two stories. The one on the pitch - and the one in
the market. Bookmakers watch the second one. Now fans can too. This is Torq."

## 0:20–1:10 - The river
Tap into a live (or replaying) match. Point at the three bands.
Line: "This is the match's heartbeat: live win probability, straight from
TxLINE's consensus odds - the same demargined prices the big operators use,
streamed to your phone. Green is home, indigo is away. When something happens,
you see the market react in seconds."

## 1:10–2:00 - Moments + pundit voice (AUDIO MOMENT)
Wait for / cue a goal or market shift in replay. Toggle Pundit voice ON first.
Let the voice call the goal on camera. Show the moment card with the pp delta.
Line: "The app watches the odds stream and narrates the money. Sometimes the
market moves before the TV commentators say a word - Torq tells you."

## 2:00–3:00 - Beat the market
Lock a Higher call, show the progress bar, show it settle (in replay at 30×
it settles in ~10s). Show streak chip + share.
Line: "And you can play against it. Higher or lower in five match minutes.
No money, no betting - just you against the sharpest brain in sports. Streaks
are shareable; this is the loop friends open every match."

## 3:00–3:50 - Replay (judge-focused)
Go home → Recent → open France vs Morocco → Replay at 60×. Show the real VAR
check, penalty, disallowed goal, France's goals, the river's surge.
Line: "Matches end. Torq doesn't. Every fixture replays through the
exact same live pipeline - this is the real France–Morocco semifinal,
minute by minute, from recorded TxLINE data. Try it yourself after the final."

## 3:50–4:30 - How + business
One slide or the README architecture block, 15 seconds max.
Line: "Under the hood: a Solana devnet subscription unlocks the feed - the
server signs a subscribe transaction, activates a token, and relays both SSE
streams to the browser. Fans never see a wallet. The business: freemium
alerts for fans, and the river as an embeddable widget for publishers -
downstream distribution for TxLINE itself."

## 4:30–4:50 - Close
Screen: home page + URL on screen.
Line: "Torq. Every match has a heartbeat - now you can feel it.
Live at https://torq.up.railway.app/, built on TxLINE."

## Shot checklist
- [ ] Pundit voice audible on a goal
- [ ] A market-shift moment card with delta chip
- [ ] Beat-the-market full cycle (lock → settle → streak)
- [ ] Replay of the real semifinal with the VAR/penalty sequence
- [ ] Deployed URL visible at the end
