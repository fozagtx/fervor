import AppKit
import WebKit

// Fervor island: the World Cup living in your notch.
// The window never moves; the island is a view animated by Core Animation,
// so every transition is fluid: a hover swell, a springy morph into the
// streaming scoreboard, and a goal pulse with Beat kicking to an 8-bit chime.

let BASE = ProcessInfo.processInfo.environment["FERVOR_URL"] ?? "https://fervor.up.railway.app"

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

    var isLive: Bool {
        let g = gameState.lowercased()
        return !(g.contains("sched") || g.contains("await") || g.contains("full")
                 || g.contains("final") || g.contains("ended") || g.contains("finish"))
            && probHome != nil
    }
}

// The stage is a fixed transparent window; only the island view animates.
// Geometry derives from the physical notch so the island reads as the
// notch itself growing: same top edge, wings past its sides, deep
// rounding on the bottom corners only.
struct Notch {
    let width: CGFloat
    let height: CGFloat
    let exists: Bool

    static func read() -> Notch {
        guard let screen = NSScreen.main else { return Notch(width: 200, height: 32, exists: false) }
        let top = screen.safeAreaInsets.top
        if top > 0 {
            let left = screen.auxiliaryTopLeftArea?.width ?? 0
            let right = screen.auxiliaryTopRightArea?.width ?? 0
            let w = screen.frame.width - left - right
            return Notch(width: max(120, w), height: top, exists: true)
        }
        return Notch(width: 200, height: 32, exists: false)
    }
}

let NOTCH = Notch.read()
// Collapsed: hugs the notch, wings extending past it, a content strip below.
let COLLAPSED = NSSize(width: max(NOTCH.width + 44, 340), height: NOTCH.height + 30)
let HOVERED = NSSize(width: COLLAPSED.width + 14, height: COLLAPSED.height + 3)
let EXPANDED = NSSize(width: max(COLLAPSED.width + 90, 432), height: NOTCH.height + 158)
let STAGE = NSSize(width: EXPANDED.width + 40, height: EXPANDED.height + 30)
let RADIUS_COLLAPSED: CGFloat = 12
let RADIUS_EXPANDED: CGFloat = 24

func islandRect(_ size: NSSize) -> NSRect {
    NSRect(x: (STAGE.width - size.width) / 2, y: STAGE.height - size.height,
           width: size.width, height: size.height)
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    var panel: NSPanel!
    var stage: NSView!
    var island: NSView!
    var mascotView: NSImageView!
    var label: NSTextField!
    var barTrack: NSView!
    var barHome = NSView()
    var barDraw = NSView()
    var barAway = NSView()
    var webView: WKWebView?
    var statusItem: NSStatusItem!

    var mascotIdle: NSImage?
    var mascotKick: NSImage?
    var goalSound: NSSound?

    var pollTimer: Timer?
    var expandTimer: Timer?
    var collapseTimer: Timer?
    var isExpanded = false
    var isHovering = false

    var currentFixture = 0
    var loadedFixture = 0
    var scores: [Int: String] = [:]
    var pinnedFixture = 0
    var pinnedUntil = Date.distantPast

    func applicationDidFinishLaunching(_ notification: Notification) {
        loadAssets()
        makeStatusItem()
        makeStage()
        enterFromNotch()
        refresh()
        pollTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            self?.refresh()
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

    func makeStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "⚽"
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Open Fervor", action: #selector(openSite), keyEquivalent: "o"))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit Fervor", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        menu.items[0].target = self
        statusItem.menu = menu
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
        panel.ignoresMouseEvents = false

        stage = NSView(frame: NSRect(origin: .zero, size: STAGE))
        stage.wantsLayer = true

        island = NSView(frame: islandRect(COLLAPSED))
        island.wantsLayer = true
        island.layer?.backgroundColor = NSColor.black.cgColor
        island.layer?.cornerRadius = RADIUS_COLLAPSED
        island.layer?.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        island.layer?.borderWidth = 0.5
        island.layer?.borderColor = NSColor(white: 1, alpha: 0.14).cgColor
        island.layer?.shadowColor = NSColor.black.cgColor
        island.layer?.shadowOpacity = 0.5
        island.layer?.shadowRadius = 14
        island.layer?.shadowOffset = CGSize(width: 0, height: -4)
        island.autoresizesSubviews = false
        stage.addSubview(island)

        mascotView = NSImageView(frame: NSRect(x: 12, y: 7, width: 20, height: 20))
        mascotView.image = mascotIdle
        mascotView.imageScaling = .scaleProportionallyUpOrDown
        island.addSubview(mascotView)

        label = NSTextField(labelWithString: "Fervor")
        label.font = NSFont.monospacedDigitSystemFont(ofSize: 13, weight: .semibold)
        label.textColor = .white
        label.alignment = .center
        label.frame = NSRect(x: 36, y: 8, width: COLLAPSED.width - 52, height: 18)
        island.addSubview(label)

        barTrack = NSView(frame: NSRect(x: 22, y: 3, width: COLLAPSED.width - 44, height: 3))
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
        island.addSubview(barTrack)

        let tracking = NSTrackingArea(
            rect: .zero,
            options: [.mouseEnteredAndExited, .mouseMoved, .activeAlways, .inVisibleRect],
            owner: self, userInfo: nil
        )
        island.addTrackingArea(tracking)
        let click = NSClickGestureRecognizer(target: self, action: #selector(toggleExpand))
        island.addGestureRecognizer(click)

        panel.contentView = stage
        placeWindow()
    }

    // MARK: fluid transitions (all Core Animation, never the window)

    func morph(to size: NSSize, radius: CGFloat, duration: TimeInterval,
               spring: Bool = true, then: (() -> Void)? = nil) {
        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = duration
            ctx.allowsImplicitAnimation = true
            ctx.timingFunction = spring
                ? CAMediaTimingFunction(controlPoints: 0.32, 1.25, 0.5, 1)
                : CAMediaTimingFunction(name: .easeOut)
            island.animator().frame = islandRect(size)
            island.layer?.cornerRadius = radius
        }, completionHandler: then)
    }

    func enterFromNotch() {
        var start = islandRect(COLLAPSED)
        start.origin.y = STAGE.height + 4
        island.frame = start
        panel.orderFrontRegardless()
        morph(to: COLLAPSED, radius: RADIUS_COLLAPSED, duration: 0.5)
    }

    @objc func mouseEntered(with event: NSEvent) {
        collapseTimer?.invalidate()
        isHovering = true
        guard !isExpanded else { return }
        // breathe toward the cursor immediately…
        morph(to: HOVERED, radius: RADIUS_COLLAPSED + 2, duration: 0.25)
        // …and open fully after a beat of intent
        expandTimer?.invalidate()
        expandTimer = Timer.scheduledTimer(withTimeInterval: 0.18, repeats: false) { [weak self] _ in
            self?.expand()
        }
    }

    @objc func mouseExited(with event: NSEvent) {
        isHovering = false
        expandTimer?.invalidate()
        if isExpanded {
            collapseTimer?.invalidate()
            collapseTimer = Timer.scheduledTimer(withTimeInterval: 0.3, repeats: false) { [weak self] _ in
                self?.collapse()
            }
        } else {
            morph(to: COLLAPSED, radius: RADIUS_COLLAPSED, duration: 0.3)
        }
    }

    @objc func toggleExpand() {
        isExpanded ? collapse() : expand()
    }

    func ensureWebView() {
        if webView == nil {
            let web = WKWebView(frame: NSRect(x: 8, y: 8, width: EXPANDED.width - 16, height: EXPANDED.height - NOTCH.height - 14))
            web.alphaValue = 0
            web.setValue(false, forKey: "drawsBackground")
            island.addSubview(web)
            webView = web
        }
        if loadedFixture != currentFixture, currentFixture != 0 {
            webView?.load(URLRequest(url: URL(string: "\(BASE)/mini/\(currentFixture)")!))
            loadedFixture = currentFixture
        }
    }

    func expand() {
        guard !isExpanded, currentFixture != 0 else { return }
        isExpanded = true
        ensureWebView()
        webView?.frame = NSRect(x: 8, y: 8, width: EXPANDED.width - 16, height: EXPANDED.height - NOTCH.height - 14)
        webView?.layer?.setAffineTransform(CGAffineTransform(scaleX: 0.97, y: 0.97))

        morph(to: EXPANDED, radius: RADIUS_EXPANDED, duration: 0.42)
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.28
            ctx.allowsImplicitAnimation = true
            label.animator().alphaValue = 0
            barTrack.animator().alphaValue = 0
            mascotView.animator().alphaValue = 0
        }
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.42
            ctx.allowsImplicitAnimation = true
            webView?.animator().alphaValue = 1
            webView?.layer?.setAffineTransform(.identity)
        }
    }

    func collapse() {
        guard isExpanded else { return }
        isExpanded = false
        morph(to: isHovering ? HOVERED : COLLAPSED,
              radius: isHovering ? RADIUS_COLLAPSED + 2 : RADIUS_COLLAPSED, duration: 0.34)
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.2
            ctx.allowsImplicitAnimation = true
            webView?.animator().alphaValue = 0
        }
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.3
            ctx.allowsImplicitAnimation = true
            label.animator().alphaValue = 1
            barTrack.animator().alphaValue = 1
            mascotView.animator().alphaValue = 1
        }
    }

    // MARK: data

    @objc func openSite() {
        NSWorkspace.shared.open(URL(string: currentFixture == 0 ? BASE : "\(BASE)/match/\(currentFixture)")!)
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
                    probAway: probs?["away"] as? Double
                ))
            }
            DispatchQueue.main.async { self.apply(matches) }
        }.resume()
    }

    func apply(_ matches: [MatchInfo]) {
        var goalMatch: MatchInfo? = nil
        for m in matches {
            let key = "\(m.scoreHome)-\(m.scoreAway)"
            if let prev = scores[m.fixtureId], prev != key, m.isLive {
                goalMatch = m
            }
            scores[m.fixtureId] = key
        }
        if let g = goalMatch {
            pinnedFixture = g.fixtureId
            pinnedUntil = Date().addingTimeInterval(60)
            celebrateGoal()
        }

        let live = matches.filter { $0.isLive }
        let upcoming = matches
            .filter { $0.gameState.lowercased().contains("sched") }
            .sorted { $0.startTime < $1.startTime }
        var pick = live.first ?? upcoming.first
        if Date() < pinnedUntil, let pinned = matches.first(where: { $0.fixtureId == pinnedFixture }) {
            pick = pinned
        }
        guard let pick else { return }

        let fixtureChanged = currentFixture != pick.fixtureId
        currentFixture = pick.fixtureId
        if isExpanded && fixtureChanged { ensureWebView() }

        let text: String
        if pick.isLive {
            let min = pick.minute.map { "\(Int($0))′" } ?? "LIVE"
            text = "\(flag(pick.home)) \(pick.scoreHome)–\(pick.scoreAway) \(flag(pick.away))  \(min)"
        } else {
            let fmt = DateFormatter()
            fmt.dateFormat = "HH:mm"
            let t = fmt.string(from: Date(timeIntervalSince1970: pick.startTime / 1000))
            text = "\(flag(pick.home)) vs \(flag(pick.away))  \(t)"
        }
        if label.stringValue != text { crossfadeLabel(to: text) }
        setProbs(home: pick.probHome, draw: pick.probDraw, away: pick.probAway)
    }

    func crossfadeLabel(to text: String) {
        guard !isExpanded else { label.stringValue = text; return }
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.12
            ctx.allowsImplicitAnimation = true
            label.animator().alphaValue = 0
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

    func celebrateGoal() {
        goalSound?.play()
        mascotView.image = mascotKick
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) { [weak self] in
            self?.mascotView.image = self?.mascotIdle
        }
        guard !isExpanded else { return }
        let big = NSSize(width: COLLAPSED.width + 44, height: COLLAPSED.height + 8)
        morph(to: big, radius: RADIUS_COLLAPSED + 3, duration: 0.2) {
            self.morph(to: self.isHovering ? HOVERED : COLLAPSED,
                       radius: self.isHovering ? RADIUS_COLLAPSED + 2 : RADIUS_COLLAPSED, duration: 0.34)
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
