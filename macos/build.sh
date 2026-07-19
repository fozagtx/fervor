#!/bin/bash
# Builds Torq.app, an unsigned menu-bar app for macOS.
set -euo pipefail
cd "$(dirname "$0")"

APP=dist/Torq.app
rm -rf dist
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

swiftc -O -o "$APP/Contents/MacOS/Torq" main.swift -framework AppKit -framework WebKit

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Torq</string>
  <key>CFBundleIdentifier</key><string>app.torq.menubar</string>
  <key>CFBundleExecutable</key><string>Torq</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.1</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
  <key>CFBundleIconFile</key><string>AppIcon</string>
</dict>
</plist>
PLIST

# Mascot frames and the 8-bit chime
cp assets/mascot-idle.png assets/mascot-kick.png assets/goal.wav "$APP/Contents/Resources/" 2>/dev/null || true

# App icon from the shared mark
if command -v iconutil >/dev/null && [ -f ../public/icon-512.png ]; then
  mkdir -p AppIcon.iconset
  for s in 16 32 128 256 512; do
    sips -z $s $s ../public/icon-512.png --out "AppIcon.iconset/icon_${s}x${s}.png" >/dev/null
  done
  iconutil -c icns AppIcon.iconset -o "$APP/Contents/Resources/AppIcon.icns"
  rm -rf AppIcon.iconset
fi

echo "Built $APP"
