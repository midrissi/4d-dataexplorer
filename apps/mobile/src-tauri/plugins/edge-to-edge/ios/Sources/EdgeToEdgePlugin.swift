import SwiftRs
import Tauri
import UIKit
import WebKit

/// Expand WKWebView to the full window and disable automatic scroll insets.
/// CSS `--app-safe-*` (from `UIWindow.safeAreaInsets`) owns notch / home-indicator padding.
///
/// Do **not** swizzle `safeAreaInsets` to zero — that also zeros CSS env() and puts
/// chrome under the Dynamic Island.
class EdgeToEdgePlugin: Plugin {
  private weak var webview: WKWebView?
  private var observations: [NSObjectProtocol] = []
  private var displayLink: CADisplayLink?

  override func load(webview: WKWebView) {
    self.webview = webview

    UIScrollView.appearance().contentInsetAdjustmentBehavior = .never

    apply(to: webview)

    let delays: [TimeInterval] = [0, 0.05, 0.15, 0.35, 0.75, 1.5]
    for delay in delays {
      DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
        guard let webview = self?.webview else { return }
        self?.apply(to: webview)
      }
    }

    let center = NotificationCenter.default
    observations.append(
      center.addObserver(
        forName: UIApplication.didBecomeActiveNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        guard let webview = self?.webview else { return }
        self?.apply(to: webview)
      }
    )
    observations.append(
      center.addObserver(
        forName: UIDevice.orientationDidChangeNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        guard let webview = self?.webview else { return }
        self?.apply(to: webview)
      }
    )

    let link = CADisplayLink(target: self, selector: #selector(onDisplayTick))
    link.add(to: .main, forMode: .common)
    displayLink = link
    DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
      self?.displayLink?.invalidate()
      self?.displayLink = nil
    }
  }

  deinit {
    displayLink?.invalidate()
    for token in observations {
      NotificationCenter.default.removeObserver(token)
    }
  }

  @objc private func onDisplayTick() {
    guard let webview else { return }
    apply(to: webview)
  }

  private func apply(to webview: WKWebView) {
    let scroll = webview.scrollView
    scroll.contentInsetAdjustmentBehavior = .never
    scroll.contentInset = .zero
    scroll.scrollIndicatorInsets = .zero
    scroll.automaticallyAdjustsScrollIndicatorInsets = false
    if scroll.contentOffset != .zero {
      scroll.setContentOffset(.zero, animated: false)
    }

    var responder: UIResponder? = webview
    while let current = responder {
      if let vc = current as? UIViewController {
        vc.additionalSafeAreaInsets = .zero
        vc.edgesForExtendedLayout = .all
        vc.extendedLayoutIncludesOpaqueBars = true
        vc.viewRespectsSystemMinimumLayoutMargins = false
        vc.view.insetsLayoutMarginsFromSafeArea = false
        break
      }
      responder = current.next
    }

    let window =
      webview.window
      ?? UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first(where: \.isKeyWindow)

    if let window {
      var node: UIView? = webview
      while let view = node {
        view.insetsLayoutMarginsFromSafeArea = false
        if view.superview != nil {
          view.translatesAutoresizingMaskIntoConstraints = true
          let frameInSuperview = view.superview?.convert(window.bounds, from: window) ?? window.bounds
          if view.frame != frameInSuperview {
            view.frame = frameInSuperview
          }
          view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        }
        if view === window { break }
        node = view.superview
      }

      syncCssSafeArea(from: window.safeAreaInsets, webview: webview)
    } else if let container = webview.superview {
      webview.translatesAutoresizingMaskIntoConstraints = true
      webview.frame = container.bounds
      webview.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    }
  }

  private func syncCssSafeArea(from insets: UIEdgeInsets, webview: WKWebView) {
    let js = """
    (function(){
      var r = document.documentElement;
      r.style.setProperty('--app-safe-top', '\(insets.top)px');
      r.style.setProperty('--app-safe-bottom', '\(insets.bottom)px');
      r.dataset.webviewInset = 'full';
    })();
    """
    webview.evaluateJavaScript(js, completionHandler: nil)
  }
}

@_cdecl("init_plugin_edge_to_edge")
func initPlugin() -> Plugin {
  return EdgeToEdgePlugin()
}
