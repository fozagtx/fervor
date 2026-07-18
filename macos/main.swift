import AppKit
import WebKit

// Fervor island: the World Cup living in your notch.
// One panel that morphs, Dynamic Island style: springs open on hover into
// the streaming scoreboard, pulses when anyone scores, with Beat the
// mascot kicking along to an 8-bit chime.

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

let COLLAPSED = NSSize(width: 320, height: 38)
let EXPANDED = NSSize(width: 420, height: 184)

final class AppDelegate: NSObject, NSApplicationDelegate {
    var panel: NSPanel!
    var container: NSView!
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

    var currentFixture = 0
    var loadedFixture = 0
    var scores: [Int: String] = [:]
    var pinnedFixture = 0
    var pinnedUntil = Date.distantPast

    // MARK: launch

    func applicationDidFinishLaunching(_ notification: Notification) {
        loadAssets()
        makeStatusItem()
        makeIsland()
        enterFromNotch()
        refresh()
        pollTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            self?.refresh()
        }
        NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification,
            object: nil, queue: .main
        ) { [weak self] _ in self?.seat(animated: false) }
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

    func makeIsland() {
        panel = NSPanel(
            contentRect: NSRect(origin: .zero, size: COLLAPSED),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered, defer: false
        )
        panel.level = .statusBar
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.hidesOnDeactivate = false

        container = NSView(frame: NSRect(origin: .zero, size: COLLAPSED))
        container.wantsLayer = true
        container.layer?.backgroundColor = NSColor.black.cgColor
        container.layer?.cornerRadius = 15
        container.layer?.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        container.layer?.borderWidth = 0.5
        container.layer?.borderColor = NSColor(white: 1, alpha: 0.14).cgColor
        container.autoresizesSubviews = false

        mascotView = NSImageView(frame: NSRect(x: 10, y: 9, width: 20, height: 20))
        mascotView.image = mascotIdle
        mascotView.imageScaling = .scaleProportionallyUpOrDown
        container.addSubview(mascotView)

        label = NSTextField(labelWithString: "Fervor")
        label.font = NSFont.monospacedDigitSystemFont(ofSize: 13, weight: .semibold)
        label.textColor = .white
        label.alignment = .center
        label.frame = NSRect(x: 34, y: 11, width: COLLAPSED.width - 48, height: 18)
        container.addSubview(label)

        barTrack = NSView(frame: NSRect(x: 20, y: 5, width: COLLAPSED.width - 40, height: 3))
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
        container.addSubview(barTrack)

        let tracking = NSTrackingArea(
            rect: .zero,
            options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
            owner: self, userInfo: nil
        )
        container.addTrackingArea(tracking)
        let click = NSClickGestureRecognizer(target: self, action: #selector(toggleExpand))
        container.addGestureRecognizer(click)

        panel.contentView = container
    }

    // MARK: geometry + entrance

    func targetFrame(_ size: NSSize) -> NSRect {
        guard let screen = NSScreen.main else { return NSRect(origin: .zero, size: size) }
        let f = screen.frame
        return NSRect(x: f.midX - size.width / 2, y: f.maxY - size.height,
                      width: size.width, height: size.height)
    }

    func seat(animated: Bool) {
        let frame = targetFrame(isExpanded ? EXPANDED : COLLAPSED)
        if animated {
            NSAnimationContext.runAnimationGroup { ctx in
                ctx.duration = 0.3
                panel.animator().setFrame(frame, display: true)
            }
        } else {
            panel.setFrame(frame, display: true)
        }
    }

    /// Slide down from behind the notch on launch.
    func enterFromNotch() {
        let final = targetFrame(COLLAPSED)
        var hidden = final
        hidden.origin.y = final.maxY // fully above the screen edge
        panel.setFrame(hidden, display: false)
        panel.orderFrontRegardless()
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.45
            ctx.timingFunction = CAMediaTimingFunction(controlPoints: 0.2, 1.25, 0.5, 1)
            panel.animator().setFrame(final, display: true)
        }
    }

    // MARK: hover intent + morph

    @objc func mouseEntered(with event: NSEvent) {
        collapseTimer?.invalidate()
        guard !isExpanded else { return }
        expandTimer?.invalidate()
        expandTimer = Timer.scheduledTimer(withTimeInterval: 0.12, repeats: false) { [weak self] _ in
            self?.expand()
        }
    }

    @objc func mouseExited(with event: NSEvent) {
        expandTimer?.invalidate()
        guard isExpanded else { return }
        collapseTimer?.invalidate()
        collapseTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: false) { [weak self] _ in
            self?.collapse()
        }
    }

    @objc func toggleExpand() {
        isExpanded ? collapse() : expand()
    }

    func ensureWebView() {
        if webView == nil {
            let web = WKWebView(frame: NSRect(x: 8, y: 8, width: EXPANDED.width - 16, height: EXPANDED.height - 16))
            web.alphaValue = 0
            web.setValue(false, forKey: "drawsBackground")
            container.addSubview(web)
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
        webView?.frame = NSRect(x: 8, y: 8, width: EXPANDED.width - 16, height: EXPANDED.height - 16)

        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.36
            ctx.allowsImplicitAnimation = true
            ctx.timingFunction = CAMediaTimingFunction(controlPoints: 0.3, 1.28, 0.55, 1) // spring overshoot
            panel.animator().setFrame(targetFrame(EXPANDED), display: true)
            container.layer?.cornerRadius = 22
            label.animator().alphaValue = 0
            barTrack.animator().alphaValue = 0
            mascotView.animator().alphaValue = 0
            webView?.animator().alphaValue = 1
        }
    }

    func collapse() {
        guard isExpanded else { return }
        isExpanded = false
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.28
            ctx.allowsImplicitAnimation = true
            ctx.timingFunction = CAMediaTimingFunction(name: .easeOut)
            panel.animator().setFrame(targetFrame(COLLAPSED), display: true)
            container.layer?.cornerRadius = 15
            label.animator().alphaValue = 1
            barTrack.animator().alphaValue = 1
            mascotView.animator().alphaValue = 1
            webView?.animator().alphaValue = 0
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
        // Every goal, anywhere, takes over the island
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
            label.animator().alphaValue = 0
        } completionHandler: {
            self.label.stringValue = text
            NSAnimationContext.runAnimationGroup { ctx in
                ctx.duration = 0.18
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
            ctx.duration = 0.5
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
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.18
            ctx.timingFunction = CAMediaTimingFunction(controlPoints: 0.3, 1.4, 0.6, 1)
            panel.animator().setFrame(targetFrame(big), display: true)
        } completionHandler: {
            NSAnimationContext.runAnimationGroup { ctx in
                ctx.duration = 0.3
                ctx.timingFunction = CAMediaTimingFunction(name: .easeOut)
                self.panel.animator().setFrame(self.targetFrame(COLLAPSED), display: true)
            }
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
