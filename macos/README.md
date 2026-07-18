# Torq for Mac (notch / Dynamic Island)

Live World Cup scores + win% in the menu-bar notch. Reads the same public API as the site: https://fervor.up.railway.app

## Install (friends — no Xcode needed)

1. Get `Torq.app` (zip from you, or build below).
2. Unzip → drag `Torq.app` to **Applications** (or Desktop).
3. First launch: **right-click → Open** (unsigned app; macOS Gatekeeper).
4. Look for ⚽ in the menu bar. Hover the notch to expand.

Optional: copy the **island sync code** from the website (chip next to the wallet) → menu bar ⚽ → **Paste Follow Sync Code** so starred teams drive the notch.

## Build from source

Needs macOS + Xcode Command Line Tools (`xcode-select --install`).

```bash
git clone https://github.com/fozagtx/fervor.git
cd fervor/macos
./build.sh
open dist/Torq.app
```

Zip to share:

```bash
./build.sh
cd dist && ditto -c -k --sequesterRsrc --keepParent Torq.app Torq-mac.zip
```

Send `Torq-mac.zip`. Everyone’s island hits the same live Railway URL — no API keys on their machine.
