import AppKit

// Fervor island: the World Cup living in your notch.
// Collapsed, it wraps the physical notch with the featured score.
// Expanded, it becomes a native dashboard: one row per match with flags,
// scores, status chips and live dots, exactly the island grammar.

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
    let series: [(h: Double, a: Double)]

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
let COLLAPSED = NSSize(width: max(NOTCH.width + 44, 340), height: NOTCH.height + 30)
let HOVERED = NSSize(width: COLLAPSED.width, height: COLLAPSED.height + 4)
let EXPANDED_WIDTH: CGFloat = max(COLLAPSED.width + 180, 560)
let ROW_H: CGFloat = 42
let STAGE = NSSize(width: EXPANDED_WIDTH + 40, height: NOTCH.height + 420)
let RADIUS_COLLAPSED: CGFloat = 12
let RADIUS_EXPANDED: CGFloat = 26

func islandRect(_ size: NSSize) -> NSRect {
    NSRect(x: (STAGE.width - size.width) / 2, y: STAGE.height - size.height,
           width: size.width, height: size.height)
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
    v.layer?.add(anim, forKey: "pulse")
    return v
}

// MARK: - app

final class AppDelegate: NSObject, NSApplicationDelegate {
    var panel: NSPanel!
    var stage: NSView!
    var island: NSView!
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

    var mascotIdle: NSImage?
    var mascotKick: NSImage?
    var goalSound: NSSound?

    var pollTimer: Timer?
    var expandTimer: Timer?
    var collapseTimer: Timer?
    var isExpanded = false
    var isHovering = false

    var matchesCache: [MatchInfo] = []
    var rowFixtures: [NSView: Int] = [:]
    var currentFixture = 0
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

        // Collapsed strip content
        collapsedContent = NSView(frame: NSRect(x: 0, y: 0, width: COLLAPSED.width, height: 30))
        mascotView = NSImageView(frame: NSRect(x: 12, y: 6, width: 20, height: 20))
        mascotView.image = mascotIdle
        mascotView.imageScaling = .scaleProportionallyUpOrDown
        collapsedContent.addSubview(mascotView)

        label = NSTextField(labelWithString: "Fervor")
        label.font = NSFont.monospacedDigitSystemFont(ofSize: 13, weight: .semibold)
        label.textColor = .white
        label.alignment = .center
        label.frame = NSRect(x: 36, y: 7, width: COLLAPSED.width - 52, height: 18)
        collapsedContent.addSubview(label)

        barTrack = NSView(frame: NSRect(x: 22, y: 2, width: COLLAPSED.width - 44, height: 3))
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

        let tracking = NSTrackingArea(
            rect: .zero,
            options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
            owner: self, userInfo: nil
        )
        island.addTrackingArea(tracking)
        let click = NSClickGestureRecognizer(target: self, action: #selector(islandClicked(_:)))
        island.addGestureRecognizer(click)

        panel.contentView = stage
        placeWindow()
    }

    // MARK: fluid transitions

    func morph(to size: NSSize, radius: CGFloat, duration: TimeInterval, then: (() -> Void)? = nil) {
        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = duration
            ctx.allowsImplicitAnimation = true
            ctx.timingFunction = CAMediaTimingFunction(controlPoints: 0.32, 1.22, 0.5, 1)
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
        morph(to: HOVERED, radius: RADIUS_COLLAPSED + 2, duration: 0.25)
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
            collapseTimer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: false) { [weak self] _ in
                self?.collapse()
            }
        } else {
            morph(to: COLLAPSED, radius: RADIUS_COLLAPSED, duration: 0.3)
        }
    }

    @objc func islandClicked(_ g: NSClickGestureRecognizer) {
        if isExpanded {
            let point = g.location(in: expandedContent)
            for (row, fixture) in rowFixtures where row.frame.contains(point) {
                NSWorkspace.shared.open(URL(string: "\(BASE)/match/\(fixture)")!)
                return
            }
            collapse()
        } else {
            expand()
        }
    }

    // MARK: the native dashboard

    func rebuildDashboard() -> NSSize {
        expandedContent.subviews.forEach { $0.removeFromSuperview() }
        rowFixtures.removeAll()

        let live = matchesCache.filter { $0.isLive }
        let upcoming = matchesCache.filter { !$0.isLive && !$0.isFinished }
            .sorted { $0.startTime < $1.startTime }.prefix(3)
        let finished = matchesCache.filter { $0.isFinished }
            .sorted { $0.startTime > $1.startTime }.prefix(2)
        let shown: [MatchInfo] = live + Array(upcoming) + Array(finished)

        let width = EXPANDED_WIDTH
        let headerH: CGFloat = 30
        let footerH: CGFloat = 34
        let featured = shown.first { $0.fixtureId == currentFixture } ?? shown.first
        let chartH: CGFloat = (featured?.series.count ?? 0) > 3 ? 74 : 0
        let rowsH = CGFloat(shown.count) * ROW_H
        let contentH = headerH + chartH + rowsH + footerH + 10
        let size = NSSize(width: width, height: NOTCH.height + contentH)

        expandedContent.frame = NSRect(x: 0, y: 0, width: width, height: contentH)

        var y = contentH - headerH

        // Header: FERVOR · WORLD CUP
        let header = NSTextField(labelWithString: "FERVOR · WORLD CUP")
        header.font = NSFont.monospacedSystemFont(ofSize: 10, weight: .bold)
        header.textColor = NSColor(white: 1, alpha: 0.45)
        header.frame = NSRect(x: 20, y: y + 8, width: 300, height: 14)
        expandedContent.addSubview(header)
        if live.count > 0 {
            let liveChip = chip("● \(live.count) LIVE",
                                fg: NSColor(red: 0.2, green: 0.9, blue: 0.6, alpha: 1),
                                bg: NSColor(red: 0.06, green: 0.72, blue: 0.51, alpha: 0.18))
            liveChip.frame.origin = NSPoint(x: width - liveChip.frame.width - 18, y: y + 6)
            expandedContent.addSubview(liveChip)
        }

        // Real-time market chart for the featured match
        if chartH > 0, let f = featured {
            y -= chartH
            let chart = NSView(frame: NSRect(x: 8, y: y, width: width - 16, height: chartH - 6))
            chart.wantsLayer = true
            chart.layer?.backgroundColor = NSColor(white: 1, alpha: 0.05).cgColor
            chart.layer?.cornerRadius = 10

            let inset: CGFloat = 10
            let cw = chart.bounds.width - inset * 2
            let ch = chart.bounds.height - inset * 2
            func path(_ get: (( h: Double, a: Double)) -> Double) -> CGPath {
                let p = CGMutablePath()
                let pts = f.series
                for (i, v) in pts.enumerated() {
                    let x = inset + cw * CGFloat(i) / CGFloat(max(1, pts.count - 1))
                    let yy = inset + ch * CGFloat(get(v) / 100.0)
                    if i == 0 { p.move(to: CGPoint(x: x, y: yy)) } else { p.addLine(to: CGPoint(x: x, y: yy)) }
                }
                return p
            }
            for (get, color) in [
                ({ (v: (h: Double, a: Double)) in v.h }, NSColor(red: 0.06, green: 0.72, blue: 0.51, alpha: 1)),
                ({ (v: (h: Double, a: Double)) in v.a }, NSColor(red: 0.51, green: 0.55, blue: 0.97, alpha: 1)),
            ] {
                let line = CAShapeLayer()
                line.path = path(get)
                line.strokeColor = color.cgColor
                line.fillColor = nil
                line.lineWidth = 2
                line.lineJoin = .round
                line.lineCap = .round
                chart.layer?.addSublayer(line)
            }
            let tag = NSTextField(labelWithString: "\(flag(f.home)) \(f.home) vs \(f.away) \(flag(f.away)) · live market")
            tag.font = NSFont.monospacedSystemFont(ofSize: 9, weight: .medium)
            tag.textColor = NSColor(white: 1, alpha: 0.4)
            tag.frame = NSRect(x: 12, y: chart.bounds.height - 16, width: chart.bounds.width - 20, height: 12)
            chart.addSubview(tag)
            expandedContent.addSubview(chart)
        }

        for m in shown {
            y -= ROW_H
            let row = NSView(frame: NSRect(x: 8, y: y, width: width - 16, height: ROW_H - 4))
            row.wantsLayer = true
            row.layer?.backgroundColor = NSColor(white: 1, alpha: 0.05).cgColor
            row.layer?.cornerRadius = 10

            let title = NSTextField(labelWithString: "\(flag(m.home)) \(m.home)   \(flag(m.away)) \(m.away)")
            title.font = NSFont.systemFont(ofSize: 12, weight: .semibold)
            title.textColor = .white
            title.lineBreakMode = .byTruncatingTail
            title.frame = NSRect(x: 12, y: 19, width: width - 200, height: 16)
            row.addSubview(title)

            let sub: String
            if m.isLive, let h = m.probHome, let a = m.probAway {
                let min = m.minute.map { "\(Int($0))′ · " } ?? ""
                sub = "\(min)\(m.home) \(Int(h))% · \(m.away) \(Int(a))%"
            } else if m.isFinished {
                sub = "Full time"
            } else {
                let fmt = DateFormatter()
                fmt.dateFormat = "EEE HH:mm"
                sub = fmt.string(from: Date(timeIntervalSince1970: m.startTime / 1000))
            }
            let subtitle = NSTextField(labelWithString: sub)
            subtitle.font = NSFont.monospacedDigitSystemFont(ofSize: 10, weight: .regular)
            subtitle.textColor = NSColor(white: 1, alpha: 0.45)
            subtitle.lineBreakMode = .byTruncatingTail
            subtitle.frame = NSRect(x: 12, y: 4, width: width - 200, height: 13)
            row.addSubview(subtitle)

            let score = NSTextField(labelWithString: m.isLive || m.isFinished ? "\(m.scoreHome)–\(m.scoreAway)" : "vs")
            score.font = NSFont.monospacedDigitSystemFont(ofSize: 15, weight: .bold)
            score.textColor = .white
            score.alignment = .right
            score.frame = NSRect(x: width - 170, y: 11, width: 56, height: 18)
            row.addSubview(score)

            let status: NSView
            if m.isLive {
                let min = m.minute.map { "\(Int($0))′" } ?? "LIVE"
                status = chip(min, fg: NSColor(red: 0.2, green: 0.9, blue: 0.6, alpha: 1),
                              bg: NSColor(red: 0.06, green: 0.72, blue: 0.51, alpha: 0.2))
                let dot = pulsingDot(color: NSColor(red: 0.2, green: 0.9, blue: 0.6, alpha: 1))
                dot.frame.origin = NSPoint(x: width - 34, y: 16)
                row.addSubview(dot)
            } else if m.isFinished {
                status = chip("FT", fg: NSColor(white: 1, alpha: 0.55), bg: NSColor(white: 1, alpha: 0.1))
            } else {
                status = chip("SOON", fg: NSColor(red: 0.65, green: 0.7, blue: 1, alpha: 1),
                              bg: NSColor(red: 0.51, green: 0.55, blue: 0.97, alpha: 0.18))
            }
            status.frame.origin = NSPoint(x: width - 104, y: 11)
            row.addSubview(status)

            expandedContent.addSubview(row)
            rowFixtures[row] = m.fixtureId
        }

        // Footer: Beat + hint
        footerMascot = NSImageView(frame: NSRect(x: 16, y: 7, width: 20, height: 20))
        footerMascot.image = mascotIdle
        footerMascot.imageScaling = .scaleProportionallyUpOrDown
        expandedContent.addSubview(footerMascot)
        let hint = NSTextField(labelWithString: "click a match to open · fervor.up.railway.app")
        hint.font = NSFont.monospacedSystemFont(ofSize: 9, weight: .medium)
        hint.textColor = NSColor(white: 1, alpha: 0.35)
        hint.frame = NSRect(x: 44, y: 10, width: width - 60, height: 12)
        expandedContent.addSubview(hint)

        return size
    }

    func expand() {
        guard !isExpanded, !matchesCache.isEmpty else { return }
        isExpanded = true
        let size = rebuildDashboard()
        // Phase 1: pour downward from the notch, barely wider
        let mid = NSSize(width: COLLAPSED.width + 36, height: size.height * 0.6)
        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = 0.14
            ctx.allowsImplicitAnimation = true
            ctx.timingFunction = CAMediaTimingFunction(name: .easeIn)
            self.island.animator().frame = islandRect(mid)
            self.island.layer?.cornerRadius = 18
        }, completionHandler: {
            // Phase 2: spring open to full width
            self.morph(to: size, radius: RADIUS_EXPANDED, duration: 0.34)
        })
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
                    series: series
                ))
            }
            DispatchQueue.main.async { self.apply(matches) }
        }.resume()
    }

    func apply(_ matches: [MatchInfo]) {
        matchesCache = matches

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

        if isExpanded { _ = rebuildDashboard() }

        let live = matches.filter { $0.isLive }
        let upcoming = matches
            .filter { !$0.isLive && !$0.isFinished }
            .sorted { $0.startTime < $1.startTime }
        var pick = live.first ?? upcoming.first
        if Date() < pinnedUntil, let pinned = matches.first(where: { $0.fixtureId == pinnedFixture }) {
            pick = pinned
        }
        guard let pick else { return }
        currentFixture = pick.fixtureId

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

    func celebrateGoal() {
        goalSound?.play()
        mascotView.image = mascotKick
        footerMascot?.image = mascotKick
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) { [weak self] in
            self?.mascotView.image = self?.mascotIdle
            self?.footerMascot?.image = self?.mascotIdle
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
