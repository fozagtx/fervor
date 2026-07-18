import AppKit
import WebKit

// Fervor for macOS: the match lives in your notch.
// A floating island hugs the top-center of the screen like a Dynamic
// Island: flags, score, minute and a live win-probability bar. Hovering
// expands it into the streaming mini scoreboard.

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

final class IslandView: NSView {
    let label = NSTextField(labelWithString: "⚽ Fervor")
    let barHome = NSView()
    let barDraw = NSView()
    let barAway = NSView()
    let barTrack = NSView()

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor
        layer?.cornerRadius = 14
        layer?.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner] // round bottom only
        layer?.borderWidth = 0.5
        layer?.borderColor = NSColor(white: 1, alpha: 0.12).cgColor

        label.font = NSFont.monospacedDigitSystemFont(ofSize: 13, weight: .semibold)
        label.textColor = .white
        label.alignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label)

        barTrack.wantsLayer = true
        barTrack.layer?.backgroundColor = NSColor(white: 1, alpha: 0.15).cgColor
        barTrack.layer?.cornerRadius = 1.5
        barTrack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(barTrack)
        for (bar, color) in [(barHome, NSColor(red: 0.06, green: 0.72, blue: 0.51, alpha: 1)),
                             (barDraw, NSColor(white: 0.55, alpha: 1)),
                             (barAway, NSColor(red: 0.51, green: 0.55, blue: 0.97, alpha: 1))] {
            bar.wantsLayer = true
            bar.layer?.backgroundColor = color.cgColor
            barTrack.addSubview(bar)
        }

        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: centerXAnchor),
            label.topAnchor.constraint(equalTo: topAnchor, constant: 6),
            barTrack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 18),
            barTrack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -18),
            barTrack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -7),
            barTrack.heightAnchor.constraint(equalToConstant: 3),
        ])
    }

    required init?(coder: NSCoder) { fatalError() }

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
        barHome.frame = NSRect(x: 0, y: 0, width: hw, height: 3)
        barDraw.frame = NSRect(x: hw, y: 0, width: dw, height: 3)
        barAway.frame = NSRect(x: hw + dw, y: 0, width: w - hw - dw, height: 3)
    }

    override func layout() {
        super.layout()
        setNeedsDisplay(bounds)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    var island: NSPanel!
    var islandView: IslandView!
    var webPanel: NSPanel?
    var statusItem: NSStatusItem!
    var timer: Timer?
    var currentFixture = 0
    var scores: [Int: String] = [:]
    var pinnedFixture = 0
    var pinnedUntil = Date.distantPast

    let collapsed = NSSize(width: 300, height: 34)
    let expanded = NSSize(width: 400, height: 170)

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Minimal status item for control (quit / open)
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "⚽"
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Open Fervor", action: #selector(openSite), keyEquivalent: "o"))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit Fervor", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        menu.items[0].target = self
        statusItem.menu = menu

        // The island: borderless always-on-top panel hugging the notch
        island = NSPanel(
            contentRect: NSRect(origin: .zero, size: collapsed),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        island.level = .statusBar
        island.isOpaque = false
        island.backgroundColor = .clear
        island.hasShadow = true
        island.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        island.isMovableByWindowBackground = false
        island.hidesOnDeactivate = false

        islandView = IslandView(frame: NSRect(origin: .zero, size: collapsed))
        island.contentView = islandView

        let tracking = NSTrackingArea(
            rect: .zero,
            options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
            owner: self,
            userInfo: nil
        )
        islandView.addTrackingArea(tracking)

        positionIsland()
        island.orderFrontRegardless()

        refresh()
        timer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            self?.refresh()
        }

        NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification,
            object: nil, queue: .main
        ) { [weak self] _ in self?.positionIsland() }
    }

    func positionIsland() {
        guard let screen = NSScreen.main else { return }
        let f = screen.frame
        let size = island.frame.size
        let x = f.midX - size.width / 2
        let y = f.maxY - size.height // flush with the very top, hugging the notch
        island.setFrame(NSRect(x: x, y: y, width: size.width, height: size.height), display: true)
    }

    @objc func mouseEntered(with event: NSEvent) { expand() }
    @objc func mouseExited(with event: NSEvent) { collapse() }

    func expand() {
        guard currentFixture != 0, webPanel == nil else { return }
        let panel = NSPanel(
            contentRect: NSRect(origin: .zero, size: expanded),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered, defer: false
        )
        panel.level = .statusBar
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]

        let container = NSView(frame: NSRect(origin: .zero, size: expanded))
        container.wantsLayer = true
        container.layer?.backgroundColor = NSColor.black.cgColor
        container.layer?.cornerRadius = 18
        container.layer?.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]

        let web = WKWebView(frame: container.bounds.insetBy(dx: 6, dy: 6))
        web.autoresizingMask = [.width, .height]
        web.load(URLRequest(url: URL(string: "\(BASE)/mini/\(currentFixture)")!))
        container.addSubview(web)

        let tracking = NSTrackingArea(
            rect: .zero,
            options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
            owner: self, userInfo: nil
        )
        container.addTrackingArea(tracking)

        panel.contentView = container
        if let screen = NSScreen.main {
            let f = screen.frame
            panel.setFrame(
                NSRect(x: f.midX - expanded.width / 2, y: f.maxY - expanded.height,
                       width: expanded.width, height: expanded.height),
                display: true
            )
        }
        panel.orderFrontRegardless()
        webPanel = panel
        island.orderOut(nil)
    }

    func collapse() {
        webPanel?.orderOut(nil)
        webPanel = nil
        positionIsland()
        island.orderFrontRegardless()
    }

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

            let live = matches.filter { $0.isLive }
            let upcoming = matches
                .filter { $0.gameState.lowercased().contains("sched") }
                .sorted { $0.startTime < $1.startTime }
            let pick = live.first ?? upcoming.first

            DispatchQueue.main.async {
                // Any goal anywhere: jump the island to that match
                var goalMatch: MatchInfo? = nil
                for m in matches {
                    let key = "\(m.scoreHome)-\(m.scoreAway)"
                    if let prev = self.scores[m.fixtureId], prev != key, m.isLive {
                        goalMatch = m
                    }
                    self.scores[m.fixtureId] = key
                }
                if let g = goalMatch {
                    self.pinnedFixture = g.fixtureId
                    self.pinnedUntil = Date().addingTimeInterval(60)
                    NSSound(named: "Glass")?.play()
                    self.pulseIsland()
                }

                var shown = pick
                if Date() < self.pinnedUntil,
                   let pinned = matches.first(where: { $0.fixtureId == self.pinnedFixture }) {
                    shown = pinned
                }
                guard let pick = shown else { return }
                self.currentFixture = pick.fixtureId
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
                self.islandView.label.stringValue = text
                self.islandView.setProbs(home: pick.probHome, draw: pick.probDraw, away: pick.probAway)

            }
        }.resume()
    }

    func pulseIsland() {
        guard let screen = NSScreen.main else { return }
        let f = screen.frame
        let bigger = NSSize(width: collapsed.width + 40, height: collapsed.height + 6)
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.18
            island.animator().setFrame(
                NSRect(x: f.midX - bigger.width / 2, y: f.maxY - bigger.height,
                       width: bigger.width, height: bigger.height),
                display: true
            )
        } completionHandler: {
            NSAnimationContext.runAnimationGroup { ctx in
                ctx.duration = 0.25
                self.island.animator().setFrame(
                    NSRect(x: f.midX - self.collapsed.width / 2, y: f.maxY - self.collapsed.height,
                           width: self.collapsed.width, height: self.collapsed.height),
                    display: true
                )
            }
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
