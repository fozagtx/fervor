import AppKit
import WebKit

// Fervor for macOS: the match in your menu bar.
// A status item shows the live score of the most interesting match;
// clicking it opens the island mini scoreboard, streaming live.

let BASE = ProcessInfo.processInfo.environment["FERVOR_URL"] ?? "https://fervor.up.railway.app"

struct MatchInfo {
    let fixtureId: Int
    let home: String
    let away: String
    let scoreHome: Int
    let scoreAway: Int
    let gameState: String
    let minute: Double?
    let startTime: Double
    let hasOdds: Bool
}

let FLAGS: [String: String] = [
    "Argentina": "🇦🇷", "Belgium": "🇧🇪", "Brazil": "🇧🇷", "Canada": "🇨🇦",
    "Colombia": "🇨🇴", "Egypt": "🇪🇬", "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "France": "🇫🇷",
    "Ghana": "🇬🇭", "Japan": "🇯🇵", "Mexico": "🇲🇽", "Morocco": "🇲🇦",
    "Netherlands": "🇳🇱", "Norway": "🇳🇴", "Paraguay": "🇵🇾", "Portugal": "🇵🇹",
    "Spain": "🇪🇸", "Switzerland": "🇨🇭", "USA": "🇺🇸",
]

func flag(_ team: String) -> String { FLAGS[team] ?? "" }

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem!
    var popover: NSPopover!
    var timer: Timer?
    var currentFixture: Int = 0

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "⚽ Fervor"
        statusItem.button?.action = #selector(togglePopover(_:))
        statusItem.button?.sendAction(on: [.leftMouseUp, .rightMouseUp])
        statusItem.button?.target = self

        popover = NSPopover()
        popover.behavior = .transient
        popover.contentSize = NSSize(width: 380, height: 150)

        refresh()
        timer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            self?.refresh()
        }
    }

    @objc func togglePopover(_ sender: NSStatusBarButton) {
        if let event = NSApp.currentEvent, event.type == .rightMouseUp {
            let menu = NSMenu()
            menu.addItem(NSMenuItem(title: "Open Fervor", action: #selector(openSite), keyEquivalent: "o"))
            menu.addItem(NSMenuItem.separator())
            menu.addItem(NSMenuItem(title: "Quit Fervor", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
            for item in menu.items { item.target = self }
            menu.items[2].target = NSApp
            statusItem.menu = menu
            statusItem.button?.performClick(nil)
            statusItem.menu = nil
            return
        }
        if popover.isShown {
            popover.performClose(sender)
        } else if currentFixture != 0 {
            let web = WKWebView(frame: NSRect(x: 0, y: 0, width: 380, height: 150))
            web.load(URLRequest(url: URL(string: "\(BASE)/mini/\(currentFixture)")!))
            let vc = NSViewController()
            vc.view = web
            popover.contentViewController = vc
            popover.show(relativeTo: sender.bounds, of: sender, preferredEdge: .minY)
        }
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
                matches.append(MatchInfo(
                    fixtureId: m["fixtureId"] as? Int ?? 0,
                    home: m["home"] as? String ?? "",
                    away: m["away"] as? String ?? "",
                    scoreHome: m["scoreHome"] as? Int ?? 0,
                    scoreAway: m["scoreAway"] as? Int ?? 0,
                    gameState: m["gameState"] as? String ?? "",
                    minute: m["minute"] as? Double,
                    startTime: m["startTime"] as? Double ?? 0,
                    hasOdds: !((m["probs"] as? [[String: Any]])?.isEmpty ?? true)
                ))
            }

            func isLive(_ m: MatchInfo) -> Bool {
                let g = m.gameState.lowercased()
                return !(g.contains("sched") || g.contains("await") || g.contains("full")
                         || g.contains("final") || g.contains("ended") || g.contains("finish"))
                    && m.hasOdds
            }

            let live = matches.filter(isLive)
            let upcoming = matches
                .filter { $0.gameState.lowercased().contains("sched") }
                .sorted { $0.startTime < $1.startTime }

            let pick = live.first ?? upcoming.first
            DispatchQueue.main.async {
                guard let pick else {
                    self.statusItem.button?.title = "⚽ Fervor"
                    return
                }
                self.currentFixture = pick.fixtureId
                if isLive(pick) {
                    let min = pick.minute.map { "\(Int($0))′" } ?? "LIVE"
                    self.statusItem.button?.title =
                        "\(flag(pick.home)) \(pick.scoreHome)–\(pick.scoreAway) \(flag(pick.away)) \(min)"
                } else {
                    let fmt = DateFormatter()
                    fmt.dateFormat = "HH:mm"
                    let time = fmt.string(from: Date(timeIntervalSince1970: pick.startTime / 1000))
                    self.statusItem.button?.title =
                        "\(flag(pick.home)) v \(flag(pick.away)) \(time)"
                }
            }
        }.resume()
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
