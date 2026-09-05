import SwiftUI
import WebKit
import UniformTypeIdentifiers

// TellaVision runs as its own bundled web app inside a WKWebView.
//
// Assets are served through a CUSTOM SCHEME rather than file:// on purpose.
// A file:// origin gives WKWebView an opaque origin, where localStorage and
// IndexedDB are unreliable — and the whole design (saved layouts, the catalog
// overlay, imported reference drawings) depends on them persisting.
private let kScheme = "tellavision"
private let kOrigin = "\(kScheme)://app/"

final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        // "tellavision://app/vendor/pdf.min.js" -> "vendor/pdf.min.js"
        var rel = url.path
        if rel.hasPrefix("/") { rel.removeFirst() }
        if rel.isEmpty { rel = "index.html" }

        guard let base = Bundle.main.resourceURL?.appendingPathComponent("web", isDirectory: true) else {
            task.didFailWithError(URLError(.fileDoesNotExist)); return
        }
        let fileURL = base.appendingPathComponent(rel)
        guard let data = try? Data(contentsOf: fileURL) else {
            task.didFailWithError(URLError(.fileDoesNotExist)); return
        }
        let mime: String = {
            switch fileURL.pathExtension.lowercased() {
            case "html": return "text/html"
            case "js":   return "text/javascript"
            case "css":  return "text/css"
            case "png":  return "image/png"
            case "json": return "application/json"
            case "svg":  return "image/svg+xml"
            default:     return "application/octet-stream"
            }
        }()
        let resp = URLResponse(url: url, mimeType: mime, expectedContentLength: data.count, textEncodingName: "utf-8")
        task.didReceive(resp)
        task.didReceive(data)
        task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

struct WebHost: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: kScheme)
        cfg.websiteDataStore = .default()                 // persistent localStorage + IndexedDB
        cfg.userContentController.add(context.coordinator, name: "tvExport")
        cfg.allowsInlineMediaPlayback = true

        let web = WKWebView(frame: .zero, configuration: cfg)
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.043, green: 0.086, blue: 0.133, alpha: 1) // #0B1622
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif
        context.coordinator.web = web
        web.navigationDelegate = context.coordinator
        web.load(URLRequest(url: URL(string: kOrigin + "index.html")!))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    // MARK: - export bridge
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        weak var web: WKWebView?
        private var pdfWeb: WKWebView?          // retained while rendering

        // DEBUG-only launch sanity check. The export bridge failing is silent by
        // nature — a[download] simply does nothing — so confirm at startup that
        // the page can see the handler and that the engine self-tests passed.
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            #if DEBUG
            let probe = """
            JSON.stringify({
              bridge: !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.tvExport),
              tests: (document.querySelector('.diag-badge')||{}).textContent || null,
              react: window.React ? window.React.version : null,
              origin: location.origin
            })
            """
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                webView.evaluateJavaScript(probe) { value, error in
                    NSLog("[TellaVision] startup check: %@", (value as? String) ?? "error: \(String(describing: error))")
                }
            }
            #endif
        }

        func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "tvExport",
                  let body = message.body as? [String: Any],
                  let filename = body["filename"] as? String,
                  let payload = body["payload"] as? String else { return }
            let encoding = (body["encoding"] as? String) ?? "text"

            switch encoding {
            case "dataurl":                      // PNG arrives as a data: URL
                guard let comma = payload.firstIndex(of: ","),
                      let data = Data(base64Encoded: String(payload[payload.index(after: comma)...])) else { return }
                share(data: data, filename: filename)
            case "html":                         // PDF: render the sheet natively
                renderPDF(html: payload, filename: filename)
            default:
                share(data: Data(payload.utf8), filename: filename)
            }
        }

        /// window.print() is a no-op in a WKWebView, so the PDF is produced here
        /// from the same HTML the browser build prints.
        private func renderPDF(html: String, filename: String) {
            let w = WKWebView(frame: CGRect(x: 0, y: 0, width: 816, height: 1056)) // 8.5x11 @96dpi
            pdfWeb = w
            w.navigationDelegate = PDFDone { [weak self] in
                let cfg = WKPDFConfiguration()
                w.createPDF(configuration: cfg) { result in
                    self?.pdfWeb = nil
                    if case .success(let data) = result { self?.share(data: data, filename: filename) }
                }
            }
            w.loadHTMLString(html, baseURL: nil)
        }

        private func share(data: Data, filename: String) {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
            do { try data.write(to: url, options: .atomic) } catch { return }
            guard let root = topViewController() else { return }
            let av = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            // iPad requires an anchor for the popover
            if let pop = av.popoverPresentationController, let v = web {
                pop.sourceView = v
                pop.sourceRect = CGRect(x: v.bounds.midX, y: v.bounds.maxY - 40, width: 1, height: 1)
                pop.permittedArrowDirections = [.down]
            }
            root.present(av, animated: true)
        }

        private func topViewController() -> UIViewController? {
            let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene
            var vc = scene?.keyWindow?.rootViewController
            while let p = vc?.presentedViewController { vc = p }
            return vc
        }
    }

    /// Tiny navigation delegate that fires once the print HTML has laid out.
    final class PDFDone: NSObject, WKNavigationDelegate {
        private let done: () -> Void
        init(_ done: @escaping () -> Void) { self.done = done }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: done)  // let webfonts settle
        }
    }
}
