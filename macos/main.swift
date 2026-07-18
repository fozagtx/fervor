import AppKit

// Torq island: the World Cup living in your notch.
// Collapsed, it wraps the physical notch with the featured score.
// Expanded, it becomes a native dashboard: one row per match with flags,
// scores, status chips and live dots, exactly the island grammar.

let BASE = ProcessInfo.processInfo.environment["TORQ_URL"] ?? "https://fervor.up.railway.app"

let FLAGS: [String: String] = [
    "Argentina": "🇦🇷", "Belgium": "🇧🇪", "Brazil": "🇧🇷", "Canada": "🇨🇦",
    "Colombia": "🇨🇴", "Egypt": "🇪🇬", "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "France": "🇫🇷",
    "Ghana": "🇬🇭", "Japan": "🇯🇵", "Mexico": "🇲🇽", "Morocco": "🇲🇦",
    "Netherlands": "🇳🇱", "Norway": "🇳🇴", "Paraguay": "🇵🇾", "Portugal": "🇵🇹",
    "Spain": "🇪🇸", "Switzerland": "🇨🇭", "USA": "🇺🇸",
]
func flag(_ team: String) -> String { FLAGS[team] ?? "⚽" }

struct MatchInfo {
    let fixtureId: Int
    let home: String
    let away: String
    let scoreHome: Int
    let scoreAway: Int
    let gameState: String
    let minute: Double?
    let startTime: Double
    let probHome: Double?
    let probDraw: Double?
    let probAway: Double?
    let series: [(h: Double, a: Double)]
    let drama: Int

    var isLive: Bool {
        let g = gameState.lowercased()
        return !(g.contains("sched") || g.contains("await") || g.contains("full")
                 || g.contains("final") || g.contains("ended") || g.contains("finish"))
            && probHome != nil
    }
    var isFinished: Bool {
        let g = gameState.lowercased()
        return g.contains("full") || g.contains("final") || g.contains("ended") || g.contains("finish")
    }

}

func countdownLabel(startTime: Double, now: Date = Date()) -> String? {
    let diff = startTime / 1000 - now.timeIntervalSince1970
    if diff <= 0 || diff > 72 * 3600 { return nil }
    if diff < 15 * 60 { return "KO soon" }
    let h = Int(diff) / 3600
    let m = (Int(diff) % 3600) / 60
    if h >= 24 { return "in \(h / 24)d \(h % 24)h" }
    if h > 0 { return "in \(h)h \(m)m" }
    return "in \(m)m"
}

struct Notch {
    let width: CGFloat
    let height: CGFloat

    static func read() -> Notch {
        guard let screen = NSScreen.main else { return Notch(width: 200, height: 32) }
        let top = screen.safeAreaInsets.top
        if top > 0 {
            let left = screen.auxiliaryTopLeftArea?.width ?? 0
            let right = screen.auxiliaryTopRightArea?.width ?? 0
            return Notch(width: max(120, screen.frame.width - left - right), height: top)
        }
        return Notch(width: 200, height: 32)
    }
}

let NOTCH = Notch.read()
let FILLET: CGFloat = 9
let COLLAPSED = NSSize(width: NOTCH.width + 156 + FILLET * 2, height: NOTCH.height)
let HOVERED = NSSize(width: COLLAPSED.width + 6, height: COLLAPSED.height + 6)
let EXPANDED_WIDTH: CGFloat = max(COLLAPSED.width + 180, 580)
let ROW_H: CGFloat = 36
let STAGE = NSSize(width: EXPANDED_WIDTH + 40, height: NOTCH.height + 640)

/// SportyBet-style decimal price from win % — display only, no stake.
func marketPrice(_ prob: Double?) -> String {
    guard let p = prob, p >= 1 else { return "—" }
    let d = min(25.0, max(1.01, 100.0 / p))
    return String(format: "%.2f", d)
}
let RADIUS_COLLAPSED: CGFloat = 10
let RADIUS_EXPANDED: CGFloat = 26

func islandRect(_ size: NSSize) -> NSRect {
    NSRect(x: (STAGE.width - size.width) / 2, y: STAGE.height - size.height,
           width: size.width, height: size.height)
}

/// Continuous notch curve: concave flares at the top, straight walls,
/// convex rounded corners at the bottom. Drawn in y-up view coordinates.
func notchPath(size: NSSize, bottomRadius: CGFloat) -> CGPath {
    let w = size.width
    let h = size.height
    let f = FILLET
    let b = min(bottomRadius, (h - f) > 0 ? bottomRadius : 4)
    let p = CGMutablePath()
    p.move(to: CGPoint(x: 0, y: h))
    // top-left concave flare: screen edge into the wall
    p.addArc(center: CGPoint(x: 0, y: h - f), radius: f,
             startAngle: .pi / 2, endAngle: 0, clockwise: true)
    // left wall down
    p.addLine(to: CGPoint(x: f, y: b))
    // bottom-left convex corner
    p.addArc(center: CGPoint(x: f + b, y: b), radius: b,
             startAngle: .pi, endAngle: .pi * 1.5, clockwise: false)
    // bottom edge
    p.addLine(to: CGPoint(x: w - f - b, y: 0))
    // bottom-right convex corner
    p.addArc(center: CGPoint(x: w - f - b, y: b), radius: b,
             startAngle: .pi * 1.5, endAngle: 0, clockwise: false)
    // right wall up
    p.addLine(to: CGPoint(x: w - f, y: h - f))
    // top-right concave flare
    p.addArc(center: CGPoint(x: w, y: h - f), radius: f,
             startAngle: .pi, endAngle: .pi / 2, clockwise: true)
    p.closeSubpath()
    return p
}

// MARK: - small native atoms

func chip(_ text: String, fg: NSColor, bg: NSColor) -> NSView {
    let label = NSTextField(labelWithString: text)
    label.font = NSFont.monospacedDigitSystemFont(ofSize: 10, weight: .semibold)
    label.textColor = fg
    label.sizeToFit()
    let pad: CGFloat = 7
    let v = NSView(frame: NSRect(x: 0, y: 0, width: label.frame.width + pad * 2, height: 18))
    v.wantsLayer = true
    v.layer?.backgroundColor = bg.cgColor
    v.layer?.cornerRadius = 9
    label.frame.origin = NSPoint(x: pad, y: 2)
    v.addSubview(label)
    return v
}

func pulsingDot(color: NSColor) -> NSView {
    let v = NSView(frame: NSRect(x: 0, y: 0, width: 7, height: 7))
    v.wantsLayer = true
    v.layer?.backgroundColor = color.cgColor
    v.layer?.cornerRadius = 3.5
    let anim = CABasicAnimation(keyPath: "opacity")
    anim.fromValue = 1.0
    anim.toValue = 0.35
    anim.duration = 0.9
    anim.autoreverses = true
    anim.repeatCount = .infinity
    v.layer?.add(anim, forKey: "beat")
    return v
}

// MARK: - stage: clicks pass through everywhere except the island

final class StageView: NSView {
    weak var hot: NSView?

    override func hitTest(_ point: NSPoint) -> NSView? {
        guard let hot else { return nil }
        let p = convert(point, to: hot)
        guard hot.bounds.contains(p) else { return nil }
        return hot.hitTest(p) ?? hot
    }
}

// MARK: - app

final class AppDelegate: NSObject, NSApplicationDelegate {
    var panel: NSPanel!
    var stage: StageView!
    var island: NSView!
    var hoverPoll: Timer?
    /// When true: full click-through — never expand, never steal browser scroll/clicks.
    var paused = UserDefaults.standard.bool(forKey: "torq.paused")
    var pauseMenuItem: NSMenuItem!
    var collapsedContent: NSView!
    var expandedContent: NSView!
    var mascotView: NSImageView!
    var footerMascot: NSImageView!
    var label: NSTextField!
    var barTrack: NSView!
    var barHome = NSView()
    var barDraw = NSView()
    var barAway = NSView()
    var statusItem: NSStatusItem!
    var maskLayer: CAShapeLayer!
    var strokeLayer: CAShapeLayer!

    var mascotIdle: NSImage?
    var mascotKick: NSImage?
    var goalSound: NSSound?
    var muteButton: NSButton!
    var muteMenuItem: NSMenuItem!

    var pollTimer: Timer?
    var expandTimer: Timer?
    var collapseTimer: Timer?
    var alertTimer: Timer?
    var isExpanded = false
    var isHovering = false
    var isAlerting = false
    var soundOn: Bool = UserDefaults.standard.object(forKey: "torq.soundOn") as? Bool ?? true

    var matchesCache: [MatchInfo] = []
    var rowFixtures: [NSView: Int] = [:]
    var starTeams: [NSView: String] = [:]
    var currentFixture = 0
    var scores: [Int: String] = [:]
    var lastProbs: [Int: (h: Double, d: Double, a: Double)] = [:]
    var pinnedFixture = 0
    var pinnedUntil = Date.distantPast
    var favorites: Set<String> = Set(UserDefaults.standard.stringArray(forKey: "torq.favorites") ?? [])
    var followId: String = UserDefaults.standard.string(forKey: "torq.followId") ?? ""
    var alertHeadline = ""
    var alertSub = ""
    struct CrowdInfo {
        var h: Int
        var d: Int
        var a: Int
        var total: Int
        var lockingNow: Int
        var heat: Int
        var fomoLine: String
    }
    /// Crowd tallies + FOMO from /api/who-wins
    var crowdCache: [Int: CrowdInfo] = [:]
    var crowdFetchedAt: [Int: Date] = [:]
    var myCalls: [Int: String] = [:] // fixtureId → home|draw|away
    var playerId: String = {
        if let existing = UserDefaults.standard.string(forKey: "torq.playerId"), existing.count >= 4 {
            return existing
        }
        let id = "fan-" + String((0..<8).map { _ in "abcdefghijklmnopqrstuvwxyz23456789".randomElement()! })
        UserDefaults.standard.set(id, forKey: "torq.playerId")
        return id
    }()
    var mascotKickTimer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        loadAssets()
        makeStatusItem()
        makeStage()
        startMascotIdleBounce()
        enterFromNotch()
        refresh()
        syncFollows()
        pollTimer = Timer.scheduledTimer(withTimeInterval: 4, repeats: true) { [weak self] _ in
            self?.refresh()
        }
        Timer.scheduledTimer(withTimeInterval: 45, repeats: true) { [weak self] _ in
            self?.syncFollows()
        }
        NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification,
            object: nil, queue: .main
        ) { [weak self] _ in self?.placeWindow() }
    }

    func loadAssets() {
        if let p = Bundle.main.path(forResource: "mascot-idle", ofType: "png") { mascotIdle = NSImage(contentsOfFile: p) }
        if let p = Bundle.main.path(forResource: "mascot-kick", ofType: "png") { mascotKick = NSImage(contentsOfFile: p) }
        if let p = Bundle.main.path(forResource: "goal", ofType: "wav") { goalSound = NSSound(contentsOfFile: p, byReference: true) }
    }

    func speakerSymbol(on: Bool) -> NSImage? {
        let name = on ? "speaker.wave.2.fill" : "speaker.slash.fill"
        let img = NSImage(systemSymbolName: name, accessibilityDescription: on ? "Sound on" : "Muted")
        img?.isTemplate = true
        return img
    }

    func refreshMuteUI() {
        muteButton?.image = speakerSymbol(on: soundOn)
        muteButton?.toolTip = soundOn ? "Mute stadium sounds" : "Unmute stadium sounds"
        muteButton?.contentTintColor = soundOn
            ? NSColor(white: 1, alpha: 0.75)
            : NSColor(red: 1, green: 0.45, blue: 0.4, alpha: 0.95)
        muteMenuItem?.title = soundOn ? "Mute Sounds" : "Unmute Sounds"
        if paused {
            statusItem?.button?.title = "⏸"
        } else {
            statusItem?.button?.title = soundOn ? "⚽" : "🔇"
        }
    }

    @objc func toggleMute() {
        soundOn.toggle()
        UserDefaults.standard.set(soundOn, forKey: "torq.soundOn")
        if !soundOn { goalSound?.stop() }
        refreshMuteUI()
    }

    func makeStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "⚽"
        let menu = NSMenu()
        let open = NSMenuItem(title: "Open Torq", action: #selector(openSite), keyEquivalent: "o")
        open.target = self
        menu.addItem(open)
        muteMenuItem = NSMenuItem(title: "Mute Sounds", action: #selector(toggleMute), keyEquivalent: "m")
        muteMenuItem.target = self
        menu.addItem(muteMenuItem)
        pauseMenuItem = NSMenuItem(title: "Pause Island (free browser)", action: #selector(togglePause), keyEquivalent: "p")
        pauseMenuItem.target = self
        menu.addItem(pauseMenuItem)
        let paste = NSMenuItem(title: "Paste Follow Sync Code…", action: #selector(pasteFollowCode), keyEquivalent: "f")
        paste.target = self
        menu.addItem(paste)
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit Torq", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        statusItem.menu = menu
        refreshMuteUI()
        refreshPauseUI()
    }

    func refreshPauseUI() {
        pauseMenuItem?.title = paused ? "Resume Island" : "Pause Island (free browser)"
        pauseMenuItem?.state = paused ? .on : .off
        statusItem?.button?.title = paused ? "⏸" : (soundOn ? "⚽" : "🔇")
    }

    @objc func togglePause() {
        paused.toggle()
        UserDefaults.standard.set(paused, forKey: "torq.paused")
        if paused {
            isHovering = false
            expandTimer?.invalidate()
            collapseTimer?.invalidate()
            if isExpanded { collapse() }
            panel?.ignoresMouseEvents = true
        }
        refreshPauseUI()
        refreshMuteUI()
    }

    @objc func pasteFollowCode() {
        let alert = NSAlert()
        alert.messageText = "Island follow sync"
        alert.informativeText = "Paste the sync code from the Torq web app (chip next to the wallet). Your starred teams will drive the notch."
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 220, height: 24))
        field.stringValue = followId
        field.placeholderString = "e.g. a3k9m2xq"
        alert.accessoryView = field
        alert.addButton(withTitle: "Save")
        alert.addButton(withTitle: "Clear")
        alert.addButton(withTitle: "Cancel")
        let res = alert.runModal()
        if res == .alertSecondButtonReturn {
            followId = ""
            UserDefaults.standard.removeObject(forKey: "torq.followId")
            return
        }
        guard res == .alertFirstButtonReturn else { return }
        followId = field.stringValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        UserDefaults.standard.set(followId, forKey: "torq.followId")
        syncFollows()
    }

    func syncFollows() {
        guard !followId.isEmpty, let url = URL(string: "\(BASE)/api/follows?id=\(followId)") else { return }
        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self, let data,
                  let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let teams = root["teams"] as? [String] else { return }
            DispatchQueue.main.async {
                self.favorites = Set(teams)
                UserDefaults.standard.set(Array(self.favorites), forKey: "torq.favorites")
                if self.isExpanded { _ = self.rebuildDashboard() }
                self.apply(self.matchesCache) // refresh compact pick
            }
        }.resume()
    }

    func saveFavorites() {
        UserDefaults.standard.set(Array(favorites), forKey: "torq.favorites")
    }

    func toggleFavorite(_ team: String) {
        if favorites.contains(team) { favorites.remove(team) } else { favorites.insert(team) }
        saveFavorites()
        if isExpanded { _ = rebuildDashboard() }
        apply(matchesCache)
    }

    func placeWindow() {
        guard let screen = NSScreen.main else { return }
        let f = screen.frame
        panel.setFrame(
            NSRect(x: f.midX - STAGE.width / 2, y: f.maxY - STAGE.height,
                   width: STAGE.width, height: STAGE.height),
            display: true
        )
    }

    func makeStage() {
        panel = NSPanel(
            contentRect: NSRect(origin: .zero, size: STAGE),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered, defer: false
        )
        panel.level = .statusBar
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.hidesOnDeactivate = false
        panel.acceptsMouseMovedEvents = true
        panel.ignoresMouseEvents = false

        stage = StageView(frame: NSRect(origin: .zero, size: STAGE))
        stage.wantsLayer = true

        island = NSView(frame: islandRect(COLLAPSED))
        island.wantsLayer = true
        island.layer?.backgroundColor = NSColor.black.cgColor
        let mask = CAShapeLayer()
        mask.path = notchPath(size: COLLAPSED, bottomRadius: RADIUS_COLLAPSED)
        island.layer?.mask = mask
        maskLayer = mask
        let stroke = CAShapeLayer()
        stroke.path = mask.path
        stroke.strokeColor = NSColor(white: 1, alpha: 0.14).cgColor
        stroke.fillColor = nil
        stroke.lineWidth = 1
        island.layer?.addSublayer(stroke)
        strokeLayer = stroke
        island.layer?.shadowColor = NSColor.black.cgColor
        island.layer?.shadowOpacity = 0.5
        island.layer?.shadowRadius = 14
        island.layer?.shadowOffset = CGSize(width: 0, height: -4)
        island.layer?.shadowPath = mask.path
        island.autoresizesSubviews = false
        stage.addSubview(island)
        stage.hot = island

        // Compact wings: mascot left of the camera, readout to its right
        collapsedContent = NSView(frame: NSRect(x: 0, y: 0, width: COLLAPSED.width, height: COLLAPSED.height))
        let wing = (COLLAPSED.width - NOTCH.width) / 2
        let midY = (COLLAPSED.height - 18) / 2
        mascotView = NSImageView(frame: NSRect(x: (wing - 18) / 2, y: midY, width: 18, height: 18))
        mascotView.image = mascotIdle
        mascotView.imageScaling = .scaleProportionallyUpOrDown
        mascotView.wantsLayer = true
        collapsedContent.addSubview(mascotView)

        label = NSTextField(labelWithString: "⚽")
        label.font = NSFont.monospacedDigitSystemFont(ofSize: 11, weight: .semibold)
        label.textColor = .white
        label.alignment = .center
        label.frame = NSRect(x: COLLAPSED.width - wing + 2, y: midY + 1, width: wing - 8, height: 15)
        collapsedContent.addSubview(label)

        barTrack = NSView(frame: NSRect(x: 22, y: 2, width: COLLAPSED.width - 44, height: 3))
        barTrack.isHidden = true
        barTrack.wantsLayer = true
        barTrack.layer?.backgroundColor = NSColor(white: 1, alpha: 0.15).cgColor
        barTrack.layer?.cornerRadius = 1.5
        for (bar, color) in [(barHome, NSColor(red: 0.06, green: 0.72, blue: 0.51, alpha: 1)),
                             (barDraw, NSColor(white: 0.55, alpha: 1)),
                             (barAway, NSColor(red: 0.51, green: 0.55, blue: 0.97, alpha: 1))] {
            bar.wantsLayer = true
            bar.layer?.backgroundColor = color.cgColor
            barTrack.addSubview(bar)
        }
        collapsedContent.addSubview(barTrack)
        island.addSubview(collapsedContent)

        // Expanded dashboard container (built per-expand)
        expandedContent = NSView(frame: .zero)
        expandedContent.alphaValue = 0
        island.addSubview(expandedContent)

        // Clicks only for mute / stars / open match — expand is hover-only
        let click = NSClickGestureRecognizer(target: self, action: #selector(islandClicked(_:)))
        island.addGestureRecognizer(click)

        panel.contentView = stage
        placeWindow()
        startHoverPolling()
    }

    /// Screen-space hover poll — reliable on nonactivating notch panels
    /// where NSTrackingArea often never fires.
    func startHoverPolling() {
        hoverPoll?.invalidate()
        hoverPoll = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
            self?.pollHover()
        }
        RunLoop.main.add(hoverPoll!, forMode: .common)
    }

    func islandScreenRect() -> CGRect {
        guard let window = island.window else { return .zero }
        let inWindow = island.convert(island.bounds, to: nil)
        return window.convertToScreen(inWindow)
    }

    func pollHover() {
        // Global mouse poll still works while ignoresMouseEvents == true.
        // Transparent STAGE must click-through or it blocks browser tabs/scroll
        // (and fights other notch apps). Only capture when the cursor is on the island.
        if paused {
            panel?.ignoresMouseEvents = true
            if isHovering { onHoverExit() }
            return
        }
        let mouse = NSEvent.mouseLocation
        // Tight pad — wide pads steal Chrome tab / URL bar clicks.
        let rect = islandScreenRect().insetBy(dx: -2, dy: -3)
        let inside = rect.contains(mouse)
        panel?.ignoresMouseEvents = !inside
        if inside, !isHovering {
            onHoverEnter()
        } else if !inside, isHovering {
            onHoverExit()
        }
    }

    // MARK: fluid transitions

    func morph(to size: NSSize, radius: CGFloat, duration: TimeInterval, then: (() -> Void)? = nil) {
        let newPath = notchPath(size: size, bottomRadius: radius)
        let timing = CAMediaTimingFunction(controlPoints: 0.32, 1.22, 0.5, 1)
        for layer in [maskLayer, strokeLayer] as [CAShapeLayer] {
            let anim = CABasicAnimation(keyPath: "path")
            anim.fromValue = layer.path
            anim.toValue = newPath
            anim.duration = duration
            anim.timingFunction = timing
            layer.add(anim, forKey: "shape")
            layer.path = newPath
        }
        island.layer?.shadowPath = newPath
        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = duration
            ctx.allowsImplicitAnimation = true
            ctx.timingFunction = timing
            island.animator().frame = islandRect(size)
        }, completionHandler: then)
    }

    func enterFromNotch() {
        var start = islandRect(COLLAPSED)
        start.origin.y = STAGE.height + 4
        island.frame = start
        panel.orderFrontRegardless()
        morph(to: COLLAPSED, radius: RADIUS_COLLAPSED, duration: 0.5)
    }

    func onHoverEnter() {
        guard !paused else { return }
        collapseTimer?.invalidate()
        collapseTimer = nil
        isHovering = true
        guard !isExpanded, !isAlerting else { return }
        morph(to: HOVERED, radius: RADIUS_COLLAPSED + 2, duration: 0.12)
        expandTimer?.invalidate()
        // Slightly longer delay so scrolling near the notch doesn't yank the dashboard open.
        expandTimer = Timer.scheduledTimer(withTimeInterval: 0.22, repeats: false) { [weak self] _ in
            guard let self, self.isHovering, !self.isExpanded, !self.paused else { return }
            self.expand()
        }
    }

    func onHoverExit() {
        isHovering = false
        expandTimer?.invalidate()
        expandTimer = nil
        if isAlerting { return }
        collapseTimer?.invalidate()
        // Leave hover → collapse back to the notch
        collapseTimer = Timer.scheduledTimer(withTimeInterval: 0.18, repeats: false) { [weak self] _ in
            guard let self, !self.isHovering, !self.isAlerting else { return }
            if self.isExpanded {
                self.collapse()
            } else {
                self.morph(to: COLLAPSED, radius: RADIUS_COLLAPSED, duration: 0.28)
            }
        }
    }

    @objc func islandClicked(_ g: NSClickGestureRecognizer) {
        // Expand/collapse is hover-only. Clicks only act on expanded controls.
        guard isExpanded else { return }
        let point = g.location(in: expandedContent)
        if let btn = muteButton, btn.frame.contains(point) {
            toggleMute()
            return
        }
        // 1X2 market tiles (tag 91xx)
        for sub in expandedContent.subviews {
            guard let btn = sub as? NSButton, (9101...9103).contains(btn.tag) else { continue }
            if btn.frame.contains(point), let raw = btn.identifier?.rawValue {
                let parts = raw.split(separator: ":")
                guard parts.count == 2, let fid = Int(parts[0]) else { continue }
                castCall(fixtureId: fid, side: String(parts[1]))
                return
            }
        }
        // Nested tiles inside the white slip card
        for card in expandedContent.subviews {
            let local = g.location(in: card)
            for sub in card.subviews {
                guard let btn = sub as? NSButton, (9101...9103).contains(btn.tag) else { continue }
                if btn.frame.contains(local), let raw = btn.identifier?.rawValue {
                    let parts = raw.split(separator: ":")
                    guard parts.count == 2, let fid = Int(parts[0]) else { continue }
                    castCall(fixtureId: fid, side: String(parts[1]))
                    return
                }
            }
        }
        for (row, fixture) in rowFixtures {
            let local = g.location(in: row)
            for sub in row.subviews {
                guard let btn = sub as? NSButton, btn.tag == 9001 else { continue }
                if btn.frame.contains(local), let raw = btn.identifier?.rawValue, let fid = Int(raw),
                   let m = matchesCache.first(where: { $0.fixtureId == fid }) {
                    let on = favorites.contains(m.home) || favorites.contains(m.away)
                    if on {
                        favorites.remove(m.home); favorites.remove(m.away)
                    } else {
                        favorites.insert(m.home); favorites.insert(m.away)
                    }
                    saveFavorites()
                    _ = rebuildDashboard()
                    apply(matchesCache)
                    return
                }
            }
            if row.frame.contains(point) {
                // Tap another fixture → pin it as the featured market (double-feel: short pin)
                if fixture != currentFixture {
                    pinnedFixture = fixture
                    pinnedUntil = Date().addingTimeInterval(90)
                    currentFixture = fixture
                    fetchCrowd(fixtureId: fixture)
                    let size = rebuildDashboard()
                    morph(to: size, radius: RADIUS_EXPANDED, duration: 0.22)
                    return
                }
                openMatch(fixture)
                return
            }
        }
    }

    // MARK: mascot motion (tasteful, not spammy)

    func startMascotIdleBounce() {
        guard let layer = mascotView.layer else { return }
        layer.removeAnimation(forKey: "bounce")
        let bounce = CABasicAnimation(keyPath: "transform.translation.y")
        bounce.fromValue = 0
        bounce.toValue = -2.5
        bounce.duration = 0.7
        bounce.autoreverses = true
        bounce.repeatCount = .infinity
        bounce.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        layer.add(bounce, forKey: "bounce")
    }

    func mascotCelebrate(seconds: TimeInterval = 1.6) {
        mascotKickTimer?.invalidate()
        mascotView.image = mascotKick
        footerMascot?.image = mascotKick
        // Tiny kick hop
        if let layer = mascotView.layer {
            let hop = CAKeyframeAnimation(keyPath: "transform.translation.y")
            hop.values = [0, -6, -1, -5, 0]
            hop.keyTimes = [0, 0.2, 0.45, 0.7, 1]
            hop.duration = 0.55
            layer.add(hop, forKey: "kickHop")
        }
        var flips = 0
        mascotKickTimer = Timer.scheduledTimer(withTimeInterval: 0.22, repeats: true) { [weak self] t in
            guard let self else { t.invalidate(); return }
            flips += 1
            let kick = flips % 2 == 1
            self.mascotView.image = kick ? self.mascotKick : self.mascotIdle
            self.footerMascot?.image = kick ? self.mascotKick : self.mascotIdle
            if Double(flips) * 0.22 >= seconds {
                t.invalidate()
                self.mascotView.image = self.mascotIdle
                self.footerMascot?.image = self.mascotIdle
                self.startMascotIdleBounce()
            }
        }
    }

    // MARK: who-wins / 1X2 calls

    func fomoLine(from root: [String: Any], lockingNow: Int, heat: Int, total: Int) -> String {
        if lockingNow > 0 { return "\(lockingNow) locking in right now — jump in" }
        if let recent = root["recent"] as? [[String: Any]], let first = recent.first {
            let side = first["side"] as? String ?? "home"
            let tag = first["tag"] as? String ?? "fan"
            let ago = first["ago"] as? Int ?? 0
            let agoTxt = ago < 5 ? "just now" : (ago < 60 ? "\(ago)s ago" : "\(ago / 60)m ago")
            return "fan_\(tag) locked \(side) · \(agoTxt)"
        }
        if heat >= 40 { return "Heat \(heat) — room is warming up" }
        if total >= 5 { return "\(total) fans already in — don't miss it" }
        return "Be first — lock a side before the room fills"
    }

    func parseCrowd(_ root: [String: Any]) -> CrowdInfo {
        let h = root["home"] as? Int ?? 0
        let d = root["draw"] as? Int ?? 0
        let a = root["away"] as? Int ?? 0
        let total = root["total"] as? Int ?? (h + d + a)
        let lockingNow = root["lockingNow"] as? Int ?? 0
        let heat = root["heat"] as? Int ?? 0
        return CrowdInfo(
            h: h, d: d, a: a, total: total,
            lockingNow: lockingNow, heat: heat,
            fomoLine: fomoLine(from: root, lockingNow: lockingNow, heat: heat, total: total)
        )
    }

    func fetchCrowd(fixtureId: Int, force: Bool = false) {
        guard fixtureId > 0 else { return }
        if !force, let at = crowdFetchedAt[fixtureId], Date().timeIntervalSince(at) < 8 { return }
        crowdFetchedAt[fixtureId] = Date()
        guard let url = URL(string: "\(BASE)/api/who-wins?fixture=\(fixtureId)") else { return }
        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self, let data,
                  let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
            let next = self.parseCrowd(root)
            DispatchQueue.main.async {
                let prev = self.crowdCache[fixtureId]
                self.crowdCache[fixtureId] = next
                if self.isExpanded, self.currentFixture == fixtureId,
                   prev?.h != next.h || prev?.d != next.d || prev?.a != next.a
                    || prev?.lockingNow != next.lockingNow || prev?.fomoLine != next.fomoLine {
                    _ = self.rebuildDashboard()
                }
            }
        }.resume()
    }

    func castCall(fixtureId: Int, side: String) {
        guard ["home", "draw", "away"].contains(side) else { return }
        myCalls[fixtureId] = side
        mascotCelebrate(seconds: 1.2)
        // Optimistic crowd bump + FOMO
        var c = crowdCache[fixtureId] ?? CrowdInfo(h: 0, d: 0, a: 0, total: 0, lockingNow: 1, heat: 20, fomoLine: "You just locked in")
        if side == "home" { c.h += 1 } else if side == "draw" { c.d += 1 } else { c.a += 1 }
        c.total = c.h + c.d + c.a
        c.lockingNow = max(1, c.lockingNow)
        c.fomoLine = "You're in — \(c.lockingNow) locking now"
        crowdCache[fixtureId] = c
        _ = rebuildDashboard()

        guard let url = URL(string: "\(BASE)/api/who-wins") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["fixtureId": fixtureId, "side": side, "player": playerId]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: req) { [weak self] data, _, _ in
            guard let self, let data,
                  let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
            DispatchQueue.main.async {
                self.crowdCache[fixtureId] = self.parseCrowd(root)
                if self.isExpanded { _ = self.rebuildDashboard() }
            }
        }.resume()
    }

    // MARK: the native dashboard — TikTok × SportyBet 1X2 market

    func rebuildDashboard() -> NSSize {
        expandedContent.subviews.forEach { $0.removeFromSuperview() }
        rowFixtures.removeAll()
        starTeams.removeAll()

        func favRank(_ m: MatchInfo) -> Int {
            (favorites.contains(m.home) ? 2 : 0) + (favorites.contains(m.away) ? 2 : 0) + (m.isLive ? 1 : 0)
        }
        let live = matchesCache.filter { $0.isLive }.sorted { favRank($0) > favRank($1) || $0.drama > $1.drama }
        let upcoming = matchesCache.filter { !$0.isLive && !$0.isFinished }
            .sorted { favRank($0) > favRank($1) || $0.startTime < $1.startTime }.prefix(3)
        let finished = matchesCache.filter { $0.isFinished }
            .sorted { $0.startTime > $1.startTime }.prefix(2)
        let shown: [MatchInfo] = Array((live + Array(upcoming) + Array(finished)).prefix(6))

        let width = EXPANDED_WIDTH
        let alertH: CGFloat = isAlerting ? 52 : 0
        let headerH: CGFloat = 28
        let featuredH: CGFloat = 52
        let marketH: CGFloat = 148
        let chartH: CGFloat = 92
        let footerH: CGFloat = 34
        let others = shown.filter { $0.fixtureId != currentFixture }
        let rowsH = CGFloat(min(4, others.count)) * ROW_H
        let contentH = alertH + headerH + featuredH + marketH + chartH + rowsH + footerH + 8
        let size = NSSize(width: width, height: NOTCH.height + contentH)

        expandedContent.frame = NSRect(x: 0, y: 0, width: width, height: contentH)
        var y = contentH

        if isAlerting {
            y -= alertH
            let banner = NSView(frame: NSRect(x: 8, y: y, width: width - 16, height: alertH - 6))
            banner.wantsLayer = true
            banner.layer?.backgroundColor = NSColor(red: 0.06, green: 0.55, blue: 0.38, alpha: 0.35).cgColor
            banner.layer?.cornerRadius = 12
            let title = NSTextField(labelWithString: alertHeadline)
            title.font = NSFont.systemFont(ofSize: 14, weight: .bold)
            title.textColor = .white
            title.frame = NSRect(x: 14, y: 22, width: width - 50, height: 18)
            banner.addSubview(title)
            let sub = NSTextField(labelWithString: alertSub)
            sub.font = NSFont.monospacedDigitSystemFont(ofSize: 11, weight: .medium)
            sub.textColor = NSColor(white: 1, alpha: 0.7)
            sub.frame = NSRect(x: 14, y: 6, width: width - 50, height: 14)
            banner.addSubview(sub)
            expandedContent.addSubview(banner)
        }

        y -= headerH
        footerMascot = NSImageView(frame: NSRect(x: 14, y: y + 4, width: 22, height: 22))
        footerMascot.image = mascotIdle
        footerMascot.imageScaling = .scaleProportionallyUpOrDown
        footerMascot.wantsLayer = true
        expandedContent.addSubview(footerMascot)
        // Soft bounce on header Beat
        if let layer = footerMascot.layer {
            let bounce = CABasicAnimation(keyPath: "transform.translation.y")
            bounce.fromValue = 0
            bounce.toValue = -2
            bounce.duration = 0.75
            bounce.autoreverses = true
            bounce.repeatCount = .infinity
            bounce.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            layer.add(bounce, forKey: "bounce")
        }

        let header = NSTextField(labelWithString: "1X2 MARKET · FREE CALL")
        header.font = NSFont.monospacedSystemFont(ofSize: 10, weight: .bold)
        header.textColor = NSColor(white: 1, alpha: 0.5)
        header.frame = NSRect(x: 42, y: y + 8, width: 220, height: 14)
        expandedContent.addSubview(header)
        if live.count > 0 {
            let liveChip = chip("● \(live.count) LIVE",
                                fg: NSColor(red: 0.2, green: 0.9, blue: 0.6, alpha: 1),
                                bg: NSColor(red: 0.06, green: 0.72, blue: 0.51, alpha: 0.18))
            liveChip.frame.origin = NSPoint(x: width - liveChip.frame.width - 18, y: y + 5)
            expandedContent.addSubview(liveChip)
        }

        let featured = shown.first(where: { $0.fixtureId == currentFixture })
            ?? shown.first(where: { $0.isLive })
            ?? shown.first

        // Featured scoreboard
        y -= featuredH
        if let f = featured {
            fetchCrowd(fixtureId: f.fixtureId)
            let board = NSView(frame: NSRect(x: 8, y: y, width: width - 16, height: featuredH - 6))
            let homeL = NSTextField(labelWithString: "\(flag(f.home)) \(f.home)")
            homeL.font = NSFont.systemFont(ofSize: 13, weight: .semibold)
            homeL.textColor = .white
            homeL.alignment = .right
            homeL.lineBreakMode = .byTruncatingTail
            homeL.frame = NSRect(x: 8, y: 14, width: (width - 16) / 2 - 44, height: 18)
            board.addSubview(homeL)
            let mid = f.isLive || f.isFinished ? "\(f.scoreHome)–\(f.scoreAway)" : "vs"
            let score = NSTextField(labelWithString: mid)
            score.font = NSFont.monospacedDigitSystemFont(ofSize: 22, weight: .bold)
            score.textColor = .white
            score.alignment = .center
            score.frame = NSRect(x: (width - 16) / 2 - 36, y: 10, width: 72, height: 26)
            board.addSubview(score)
            let awayL = NSTextField(labelWithString: "\(f.away) \(flag(f.away))")
            awayL.font = NSFont.systemFont(ofSize: 13, weight: .semibold)
            awayL.textColor = .white
            awayL.alignment = .left
            awayL.lineBreakMode = .byTruncatingTail
            awayL.frame = NSRect(x: (width - 16) / 2 + 40, y: 14, width: (width - 16) / 2 - 48, height: 18)
            board.addSubview(awayL)
            expandedContent.addSubview(board)

            // White SportyBet slip
            y -= marketH
            let slip = NSView(frame: NSRect(x: 8, y: y, width: width - 16, height: marketH - 8))
            slip.wantsLayer = true
            slip.layer?.backgroundColor = NSColor.white.cgColor
            slip.layer?.cornerRadius = 16
            slip.layer?.borderWidth = 1
            slip.layer?.borderColor = NSColor(white: 0.9, alpha: 1).cgColor

            let slipTitle = NSTextField(labelWithString: "Match result · 1X2")
            slipTitle.font = NSFont.systemFont(ofSize: 10, weight: .bold)
            slipTitle.textColor = NSColor(white: 0.25, alpha: 1)
            slipTitle.frame = NSRect(x: 12, y: marketH - 28, width: 160, height: 14)
            slip.addSubview(slipTitle)
            let crowd = crowdCache[f.fixtureId]
            let slipMeta = NSTextField(labelWithString: crowd.map { c in
                c.lockingNow > 0 ? "\(c.lockingNow) live · \(c.total) in" : "\(c.total) locked"
            } ?? "Free · no stake")
            slipMeta.font = NSFont.monospacedSystemFont(ofSize: 9, weight: .bold)
            slipMeta.textColor = (crowd?.lockingNow ?? 0) > 0
                ? NSColor(red: 0.8, green: 0.45, blue: 0.05, alpha: 1)
                : NSColor(white: 0.55, alpha: 1)
            slipMeta.alignment = .right
            slipMeta.frame = NSRect(x: slip.bounds.width - 150, y: marketH - 28, width: 138, height: 14)
            slip.addSubview(slipMeta)

            // FOMO ticker strip
            let fomoBg = NSView(frame: NSRect(x: 10, y: marketH - 52, width: slip.bounds.width - 20, height: 20))
            fomoBg.wantsLayer = true
            let hotFomo = (crowd?.lockingNow ?? 0) > 0 || (crowd?.heat ?? 0) >= 40
            fomoBg.layer?.backgroundColor = hotFomo
                ? NSColor(red: 1, green: 0.95, blue: 0.88, alpha: 1).cgColor
                : NSColor(white: 0.96, alpha: 1).cgColor
            fomoBg.layer?.cornerRadius = 8
            let fomoTxt = NSTextField(labelWithString: crowd?.fomoLine ?? "Be first — lock a side before the room fills")
            fomoTxt.font = NSFont.systemFont(ofSize: 10, weight: .semibold)
            fomoTxt.textColor = hotFomo
                ? NSColor(red: 0.55, green: 0.3, blue: 0.05, alpha: 1)
                : NSColor(white: 0.35, alpha: 1)
            fomoTxt.lineBreakMode = .byTruncatingTail
            fomoTxt.frame = NSRect(x: 8, y: 2, width: fomoBg.bounds.width - 16, height: 16)
            fomoBg.addSubview(fomoTxt)
            slip.addSubview(fomoBg)

            let tileW = (slip.bounds.width - 36) / 3
            let tileH: CGFloat = 68
            let tileY: CGFloat = 10
            let sides: [(String, String, String, Double?, Int)] = [
                ("home", "1", f.home, f.probHome, 9101),
                ("draw", "X", "Draw", f.probDraw, 9102),
                ("away", "2", f.away, f.probAway, 9103),
            ]
            let mine = myCalls[f.fixtureId]
            let totalCrowd = max(1, crowd?.total ?? 0)
            for (i, s) in sides.enumerated() {
                let (side, code, name, prob, tag) = s
                let selected = mine == side
                let btn = NSButton(frame: NSRect(x: 10 + CGFloat(i) * (tileW + 8), y: tileY, width: tileW, height: tileH))
                btn.bezelStyle = .shadowlessSquare
                btn.isBordered = false
                btn.wantsLayer = true
                btn.layer?.cornerRadius = 12
                btn.layer?.borderWidth = 2
                if selected {
                    btn.layer?.backgroundColor = NSColor(red: 0.92, green: 0.99, blue: 0.95, alpha: 1).cgColor
                    btn.layer?.borderColor = NSColor(red: 0.06, green: 0.72, blue: 0.51, alpha: 1).cgColor
                } else {
                    btn.layer?.backgroundColor = NSColor(white: 0.97, alpha: 1).cgColor
                    btn.layer?.borderColor = NSColor(white: 0.88, alpha: 1).cgColor
                }
                btn.tag = tag
                btn.identifier = NSUserInterfaceItemIdentifier("\(f.fixtureId):\(side)")
                btn.title = ""

                let codeL = NSTextField(labelWithString: code)
                codeL.font = NSFont.monospacedSystemFont(ofSize: 9, weight: .bold)
                codeL.textColor = NSColor(white: 0.5, alpha: 1)
                codeL.alignment = .center
                codeL.frame = NSRect(x: 0, y: 54, width: tileW, height: 12)
                btn.addSubview(codeL)

                let short = side == "draw" ? "Draw" : (name.split(separator: " ").first.map(String.init) ?? name)
                let nameL = NSTextField(labelWithString: side == "draw" ? "Draw" : "\(flag(name)) \(short)")
                nameL.font = NSFont.systemFont(ofSize: 10, weight: .semibold)
                nameL.textColor = NSColor(white: 0.15, alpha: 1)
                nameL.alignment = .center
                nameL.lineBreakMode = .byTruncatingTail
                nameL.frame = NSRect(x: 4, y: 40, width: tileW - 8, height: 14)
                btn.addSubview(nameL)

                let priceL = NSTextField(labelWithString: marketPrice(prob))
                priceL.font = NSFont.monospacedDigitSystemFont(ofSize: 18, weight: .bold)
                priceL.textColor = selected
                    ? NSColor(red: 0.02, green: 0.55, blue: 0.38, alpha: 1)
                    : (side == "home"
                       ? NSColor(red: 0.06, green: 0.55, blue: 0.38, alpha: 1)
                       : (side == "away"
                          ? NSColor(red: 0.35, green: 0.4, blue: 0.85, alpha: 1)
                          : NSColor(white: 0.35, alpha: 1)))
                priceL.alignment = .center
                priceL.frame = NSRect(x: 0, y: 18, width: tileW, height: 22)
                btn.addSubview(priceL)

                var fanPct = 0
                if let c = crowd, c.total > 0 {
                    let n = side == "home" ? c.h : (side == "draw" ? c.d : c.a)
                    fanPct = Int((Double(n) / Double(totalCrowd) * 100).rounded())
                }
                let fanL = NSTextField(labelWithString: crowd == nil ? "tap" : "\(fanPct)% fans")
                fanL.font = NSFont.monospacedSystemFont(ofSize: 9, weight: .medium)
                fanL.textColor = NSColor(white: 0.45, alpha: 1)
                fanL.alignment = .center
                fanL.frame = NSRect(x: 0, y: 4, width: tileW, height: 12)
                btn.addSubview(fanL)

                slip.addSubview(btn)
            }
            expandedContent.addSubview(slip)

            // Compact wave under the slip
            y -= chartH
            let chart = NSView(frame: NSRect(x: 8, y: y, width: width - 16, height: chartH - 6))
            chart.wantsLayer = true
            chart.layer?.backgroundColor = NSColor(white: 1, alpha: 0.06).cgColor
            chart.layer?.cornerRadius = 12
            if f.series.count > 3 {
                let inset: CGFloat = 10
                let cw = chart.bounds.width - inset * 2
                let ch = chart.bounds.height - inset * 2 - 14
                let pts = f.series
                let homeC = NSColor(red: 0.06, green: 0.72, blue: 0.51, alpha: 1)
                let awayC = NSColor(red: 0.51, green: 0.55, blue: 0.97, alpha: 1)
                func linePath(_ get: (Double, Double) -> Double) -> CGPath {
                    let p = CGMutablePath()
                    for (i, v) in pts.enumerated() {
                        let x = inset + cw * CGFloat(i) / CGFloat(max(1, pts.count - 1))
                        let yy = inset + ch * CGFloat(get(v.h, v.a) / 100.0)
                        if i == 0 { p.move(to: CGPoint(x: x, y: yy)) } else { p.addLine(to: CGPoint(x: x, y: yy)) }
                    }
                    return p
                }
                for (get, color) in [
                    ({ (h: Double, _: Double) in h }, homeC),
                    ({ (_: Double, a: Double) in a }, awayC),
                ] as [((Double, Double) -> Double, NSColor)] {
                    let line = CAShapeLayer()
                    line.path = linePath(get)
                    line.strokeColor = color.cgColor
                    line.fillColor = nil
                    line.lineWidth = 2.2
                    line.lineJoin = .round
                    chart.layer?.addSublayer(line)
                }
                let hh = f.probHome.map { Int($0) } ?? Int(pts.last!.h)
                let aa = f.probAway.map { Int($0) } ?? Int(pts.last!.a)
                let tag = NSTextField(labelWithString: "\(hh)% mkt  ·  wave  ·  \(aa)% mkt")
                tag.font = NSFont.monospacedSystemFont(ofSize: 9, weight: .semibold)
                tag.textColor = NSColor(white: 1, alpha: 0.55)
                tag.alignment = .center
                tag.frame = NSRect(x: 10, y: chart.bounds.height - 16, width: chart.bounds.width - 20, height: 12)
                chart.addSubview(tag)
            } else {
                let empty = NSTextField(labelWithString: "Wave opens nearer kick-off")
                empty.font = NSFont.systemFont(ofSize: 11, weight: .medium)
                empty.textColor = NSColor(white: 1, alpha: 0.35)
                empty.alignment = .center
                empty.frame = NSRect(x: 12, y: (chart.bounds.height - 16) / 2, width: chart.bounds.width - 24, height: 16)
                chart.addSubview(empty)
            }
            expandedContent.addSubview(chart)
        }

        // Other markets (tap to switch featured)
        for m in others.prefix(4) {
            y -= ROW_H
            let rowW = width - 16
            let row = NSView(frame: NSRect(x: 8, y: y, width: rowW, height: ROW_H - 4))
            row.wantsLayer = true
            row.layer?.backgroundColor = NSColor(white: 1, alpha: 0.05).cgColor
            row.layer?.cornerRadius = 9

            let star = NSButton(frame: NSRect(x: 4, y: 6, width: 20, height: 20))
            star.bezelStyle = .inline
            star.isBordered = false
            star.imagePosition = .imageOnly
            star.tag = 9001
            star.identifier = NSUserInterfaceItemIdentifier(String(m.fixtureId))
            let followed = favorites.contains(m.home) || favorites.contains(m.away)
            star.image = NSImage(systemSymbolName: followed ? "star.fill" : "star", accessibilityDescription: "Follow")
            star.contentTintColor = followed ? NSColor.systemYellow : NSColor(white: 1, alpha: 0.35)
            row.addSubview(star)

            let mid = m.isLive || m.isFinished ? "\(m.scoreHome)–\(m.scoreAway)" : "vs"
            let line = NSTextField(labelWithString: "\(flag(m.home)) \(m.home)  \(mid)  \(m.away) \(flag(m.away))")
            line.font = NSFont.systemFont(ofSize: 11, weight: .semibold)
            line.textColor = NSColor(white: 1, alpha: 0.85)
            line.lineBreakMode = .byTruncatingTail
            line.frame = NSRect(x: 28, y: 8, width: rowW - 100, height: 16)
            row.addSubview(line)

            let p1 = marketPrice(m.probHome)
            let tip = NSTextField(labelWithString: m.isLive ? p1 : (countdownLabel(startTime: m.startTime) ?? "soon"))
            tip.font = NSFont.monospacedDigitSystemFont(ofSize: 10, weight: .bold)
            tip.textColor = NSColor(red: 0.2, green: 0.9, blue: 0.6, alpha: 1)
            tip.alignment = .right
            tip.frame = NSRect(x: rowW - 72, y: 8, width: 62, height: 14)
            row.addSubview(tip)

            expandedContent.addSubview(row)
            rowFixtures[row] = m.fixtureId
        }

        let hint = NSTextField(labelWithString: "tap 1·X·2 · FOMO ticker · Beat cheers · tap row to switch")
        hint.font = NSFont.monospacedSystemFont(ofSize: 9, weight: .medium)
        hint.textColor = NSColor(white: 1, alpha: 0.35)
        hint.frame = NSRect(x: 16, y: 10, width: width - 70, height: 12)
        expandedContent.addSubview(hint)

        muteButton = NSButton(frame: NSRect(x: width - 44, y: 4, width: 28, height: 26))
        muteButton.bezelStyle = .inline
        muteButton.isBordered = false
        muteButton.imagePosition = .imageOnly
        muteButton.target = self
        muteButton.action = #selector(toggleMute)
        muteButton.wantsLayer = true
        muteButton.layer?.cornerRadius = 8
        muteButton.layer?.backgroundColor = NSColor(white: 1, alpha: 0.08).cgColor
        expandedContent.addSubview(muteButton)
        refreshMuteUI()

        return size
    }

    func expand() {
        guard !isExpanded, !matchesCache.isEmpty else { return }
        isExpanded = true
        let size = rebuildDashboard()
        // Phase 1: pour downward from the notch, barely wider
        let mid = NSSize(width: COLLAPSED.width + 36, height: size.height * 0.6)
        morph(to: mid, radius: 18, duration: 0.14) {
            // Phase 2: spring open to full width
            self.morph(to: size, radius: RADIUS_EXPANDED, duration: 0.34)
        }
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.22
            ctx.allowsImplicitAnimation = true
            collapsedContent.animator().alphaValue = 0
        }
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.4
            ctx.allowsImplicitAnimation = true
            expandedContent.animator().alphaValue = 1
        }
    }

    func collapse() {
        guard isExpanded else { return }
        isExpanded = false
        morph(to: isHovering ? HOVERED : COLLAPSED,
              radius: isHovering ? RADIUS_COLLAPSED + 2 : RADIUS_COLLAPSED, duration: 0.34)
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.18
            ctx.allowsImplicitAnimation = true
            expandedContent.animator().alphaValue = 0
        }
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.3
            ctx.allowsImplicitAnimation = true
            collapsedContent.animator().alphaValue = 1
        }
    }

    // MARK: data

    func openMatch(_ fixtureId: Int) {
        let finished = matchesCache.first(where: { $0.fixtureId == fixtureId })?.isFinished == true
        let path = finished
            ? "\(BASE)/match/\(fixtureId)?replay=1"
            : "\(BASE)/match/\(fixtureId)"
        if let url = URL(string: path) { NSWorkspace.shared.open(url) }
    }

    @objc func openSite() {
        if currentFixture == 0 {
            NSWorkspace.shared.open(URL(string: BASE)!)
        } else {
            openMatch(currentFixture)
        }
    }

    func refresh() {
        guard let url = URL(string: "\(BASE)/api/matches") else { return }
        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self, let data,
                  let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let list = root["matches"] as? [[String: Any]] else { return }

            var matches: [MatchInfo] = []
            for m in list {
                let probs = (m["probs"] as? [[String: Any]])?.last
                let rawSeries = (m["series"] as? [[String: Any]]) ?? []
                let series: [(h: Double, a: Double)] = rawSeries.compactMap { p in
                    guard let h = p["home"] as? Double, let a = p["away"] as? Double else { return nil }
                    return (h: h, a: a)
                }
                matches.append(MatchInfo(
                    fixtureId: m["fixtureId"] as? Int ?? 0,
                    home: m["home"] as? String ?? "",
                    away: m["away"] as? String ?? "",
                    scoreHome: m["scoreHome"] as? Int ?? 0,
                    scoreAway: m["scoreAway"] as? Int ?? 0,
                    gameState: m["gameState"] as? String ?? "",
                    minute: m["minute"] as? Double,
                    startTime: m["startTime"] as? Double ?? 0,
                    probHome: probs?["home"] as? Double,
                    probDraw: probs?["draw"] as? Double,
                    probAway: probs?["away"] as? Double,
                    series: series,
                    drama: m["drama"] as? Int ?? 0
                ))
            }
            DispatchQueue.main.async {
                self.apply(matches)
                self.hydrateWaves(matches)
            }
        }.resume()
    }

    /// Pull full market river for fixtures the list left empty (finished / thin series).
    func hydrateWaves(_ matches: [MatchInfo]) {
        let need = matches.filter { $0.series.count < 8 && ($0.isFinished || $0.probHome != nil) }.prefix(6)
        for m in need {
            guard let url = URL(string: "\(BASE)/api/history/\(m.fixtureId)") else { continue }
            URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
                guard let self, let data,
                      let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let probs = root["probs"] as? [[String: Any]], probs.count > 3 else { return }
                let stride = max(1, probs.count / 48)
                let series: [(h: Double, a: Double)] = probs.enumerated().compactMap { i, p in
                    guard i % stride == 0 || i == probs.count - 1,
                          let h = p["home"] as? Double, let a = p["away"] as? Double else { return nil }
                    return (h: h, a: a)
                }
                guard series.count > 3 else { return }
                DispatchQueue.main.async {
                    guard let idx = self.matchesCache.firstIndex(where: { $0.fixtureId == m.fixtureId }) else { return }
                    let old = self.matchesCache[idx]
                    let last = probs.last
                    self.matchesCache[idx] = MatchInfo(
                        fixtureId: old.fixtureId, home: old.home, away: old.away,
                        scoreHome: old.scoreHome, scoreAway: old.scoreAway,
                        gameState: old.gameState, minute: old.minute, startTime: old.startTime,
                        probHome: (last?["home"] as? Double) ?? old.probHome,
                        probDraw: (last?["draw"] as? Double) ?? old.probDraw,
                        probAway: (last?["away"] as? Double) ?? old.probAway,
                        series: series, drama: old.drama
                    )
                    if self.isExpanded { _ = self.rebuildDashboard() }
                    if self.currentFixture == m.fixtureId {
                        self.setProbs(home: self.matchesCache[idx].probHome,
                                      draw: self.matchesCache[idx].probDraw,
                                      away: self.matchesCache[idx].probAway)
                        self.barTrack.isHidden = false
                    }
                }
            }.resume()
        }
    }

    func apply(_ matches: [MatchInfo]) {
        matchesCache = matches

        var goalMatch: MatchInfo? = nil
        var scoredSide: String? = nil
        var marketDelta: Double? = nil
        for m in matches {
            let key = "\(m.scoreHome)-\(m.scoreAway)"
            if let prev = scores[m.fixtureId], prev != key, m.isLive {
                goalMatch = m
                let parts = prev.split(separator: "-").compactMap { Int($0) }
                if parts.count == 2 {
                    if m.scoreHome > parts[0] { scoredSide = m.home }
                    else if m.scoreAway > parts[1] { scoredSide = m.away }
                }
                if let prevP = lastProbs[m.fixtureId], let h = m.probHome, let a = m.probAway {
                    if scoredSide == m.home { marketDelta = h - prevP.h }
                    else if scoredSide == m.away { marketDelta = a - prevP.a }
                }
            }
            scores[m.fixtureId] = key
            if let h = m.probHome, let d = m.probDraw, let a = m.probAway {
                lastProbs[m.fixtureId] = (h, d, a)
            }
        }
        if let g = goalMatch {
            pinnedFixture = g.fixtureId
            pinnedUntil = Date().addingTimeInterval(60)
            showGoalAlert(match: g, scorer: scoredSide, delta: marketDelta)
        }

        if isExpanded && !isAlerting { _ = rebuildDashboard() }

        let live = matches.filter { $0.isLive }
        let upcoming = matches
            .filter { !$0.isLive && !$0.isFinished }
            .sorted { $0.startTime < $1.startTime }

        func prefer(_ m: MatchInfo) -> Int {
            var s = 0
            if favorites.contains(m.home) || favorites.contains(m.away) { s += 10 }
            if m.isLive { s += 20 }
            if m.series.count > 3 { s += 15 } // always surface the wave
            s += min(5, m.drama / 20)
            return s
        }

        var pool = live + upcoming
        if pool.allSatisfy({ $0.series.count <= 3 }) {
            pool += matches.filter { $0.isFinished && $0.series.count > 3 }
        }
        var pick = pool.max(by: { prefer($0) < prefer($1) })
        if Date() < pinnedUntil, let pinned = matches.first(where: { $0.fixtureId == pinnedFixture }) {
            pick = pinned
        }
        guard let pick else { return }
        currentFixture = pick.fixtureId

        let text: String
        if pick.isLive {
            let min = pick.minute.map { " \(Int($0))′" } ?? ""
            text = "\(pick.scoreHome)–\(pick.scoreAway)\(min)"
        } else if let cd = countdownLabel(startTime: pick.startTime) {
            text = cd
        } else {
            let fmt = DateFormatter()
            fmt.dateFormat = "HH:mm"
            text = fmt.string(from: Date(timeIntervalSince1970: pick.startTime / 1000))
        }
        if label.stringValue != text { crossfadeLabel(to: text) }
        setProbs(home: pick.probHome, draw: pick.probDraw, away: pick.probAway)
        // Compact win-prob bar only when live (hidden for KO countdown)
        barTrack.isHidden = !(pick.isLive && pick.probHome != nil)
    }

    func crossfadeLabel(to text: String) {
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.12
            ctx.allowsImplicitAnimation = true
            self.label.animator().alphaValue = 0
        } completionHandler: {
            self.label.stringValue = text
            NSAnimationContext.runAnimationGroup { ctx in
                ctx.duration = 0.18
                ctx.allowsImplicitAnimation = true
                self.label.animator().alphaValue = 1
            }
        }
    }

    func setProbs(home: Double?, draw: Double?, away: Double?) {
        guard let h = home, let d = draw, let a = away else {
            barTrack.isHidden = true
            return
        }
        barTrack.isHidden = false
        let w = barTrack.bounds.width
        let total = max(1, h + d + a)
        let hw = w * h / total
        let dw = w * d / total
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.6
            ctx.allowsImplicitAnimation = true
            barHome.frame = NSRect(x: 0, y: 0, width: hw, height: 3)
            barDraw.frame = NSRect(x: hw, y: 0, width: dw, height: 3)
            barAway.frame = NSRect(x: hw + dw, y: 0, width: w - hw - dw, height: 3)
        }
    }

    func showGoalAlert(match: MatchInfo, scorer: String?, delta: Double?) {
        if soundOn { goalSound?.play() }
        mascotCelebrate(seconds: 2.0)

        let who = scorer ?? "GOAL"
        alertHeadline = "GOOOAL! \(flag(who)) \(who)"
        let score = "\(match.home) \(match.scoreHome)–\(match.scoreAway) \(match.away)"
        if let d = delta {
            let sign = d >= 0 ? "+" : ""
            alertSub = "\(score)  ·  market \(sign)\(Int(d.rounded()))pp"
        } else {
            alertSub = score
        }
        isAlerting = true
        collapseTimer?.invalidate()
        if !isExpanded {
            expand()
        } else {
            let size = rebuildDashboard()
            morph(to: size, radius: RADIUS_EXPANDED, duration: 0.28)
        }

        alertTimer?.invalidate()
        alertTimer = Timer.scheduledTimer(withTimeInterval: 3.6, repeats: false) { [weak self] _ in
            guard let self else { return }
            self.isAlerting = false
            self.alertHeadline = ""
            self.alertSub = ""
            if self.isHovering {
                let size = self.rebuildDashboard()
                self.morph(to: size, radius: RADIUS_EXPANDED, duration: 0.3)
            } else {
                self.collapse()
            }
        }
    }
}


let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
