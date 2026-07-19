# Torq for Mac (notch / Dynamic Island)

Live World Cup scores + win% in the menu-bar notch. Reads the same public API as the site: https://torq.up.railway.app

## Direct download (DMG)

**Download:** https://github.com/fozagtx/fervor/releases/download/torq-mac/Torq.dmg

1. Open `Torq.dmg`
2. Drag **Torq** into **Applications**
3. First launch: **right-click → Open** (unsigned app; macOS Gatekeeper)
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

Make a DMG to share / re-upload to the release:

```bash
./build.sh
STAGE=$(mktemp -d)
cp -R dist/Torq.app "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname Torq -srcfolder "$STAGE" -ov -format UDZO dist/Torq.dmg
rm -rf "$STAGE"
```

Everyone’s island hits the same live Railway URL — no API keys on their machine.
