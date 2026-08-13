#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;
use tauri_plugin_window_state::StateFlags;
use tokio::sync::oneshot;

/// Tracks in-flight `desktop_http_request` calls so the webview can abort them.
#[derive(Default)]
struct PendingHttpCancels {
    pending: Mutex<HashMap<String, oneshot::Sender<()>>>,
    /// Cancel arrived before the matching request registered its oneshot.
    cancelled: Mutex<HashSet<String>>,
}

impl PendingHttpCancels {
    fn register(&self, request_id: &str) -> Option<oneshot::Receiver<()>> {
        if self
            .cancelled
            .lock()
            .map(|mut set| set.remove(request_id))
            .unwrap_or(false)
        {
            return None;
        }
        let (tx, rx) = oneshot::channel();
        if let Ok(mut pending) = self.pending.lock() {
            pending.insert(request_id.to_string(), tx);
        }
        Some(rx)
    }

    fn finish(&self, request_id: &str) {
        if let Ok(mut pending) = self.pending.lock() {
            pending.remove(request_id);
        }
        if let Ok(mut cancelled) = self.cancelled.lock() {
            cancelled.remove(request_id);
        }
    }

    fn cancel(&self, request_id: &str) {
        let sender = self
            .pending
            .lock()
            .ok()
            .and_then(|mut pending| pending.remove(request_id));
        if let Some(tx) = sender {
            let _ = tx.send(());
            return;
        }
        if let Ok(mut cancelled) = self.cancelled.lock() {
            cancelled.insert(request_id.to_string());
        }
    }
}

/// Read cookies from tauri-plugin-http's on-disk jar (app cache `.cookies`)
/// that would apply to `url`, as name → value.
#[tauri::command]
fn list_http_jar_cookies(app: tauri::AppHandle, url: String) -> Result<HashMap<String, String>, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("cache dir: {e}"))?;
    let path = cache_dir.join(".cookies");
    let raw = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(HashMap::new()),
        Err(e) => return Err(format!("read .cookies: {e}")),
    };
    if raw.trim().is_empty() {
        return Ok(HashMap::new());
    }

    let host = url::Url::parse(&url)
        .map(|u| u.host_str().unwrap_or("").to_string())
        .unwrap_or_default();
    if host.is_empty() {
        return Ok(HashMap::new());
    }

    let entries: Vec<serde_json::Value> =
        serde_json::from_str(&raw).map_err(|e| format!("parse .cookies: {e}"))?;

    let mut out = HashMap::new();
    for entry in entries {
        if !cookie_domain_matches(entry.get("domain"), &host) {
            continue;
        }
        let Some(raw_cookie) = entry.get("raw_cookie").and_then(|v| v.as_str()) else {
            continue;
        };
        if let Some((name, value)) = parse_cookie_name_value(raw_cookie) {
            out.insert(name, value);
        }
    }
    Ok(out)
}

fn parse_cookie_name_value(raw_cookie: &str) -> Option<(String, String)> {
    let pair = raw_cookie.split(';').next()?.trim();
    let eq = pair.find('=')?;
    let name = pair[..eq].trim();
    if name.is_empty() {
        return None;
    }
    Some((name.to_string(), pair[eq + 1..].trim().to_string()))
}

fn cookie_domain_matches(domain: Option<&serde_json::Value>, host: &str) -> bool {
    let Some(domain) = domain else {
        return true;
    };
    let Some(obj) = domain.as_object() else {
        return true;
    };
    if let Some(host_only) = obj.get("HostOnly").and_then(|v| v.as_str()) {
        return host_only.eq_ignore_ascii_case(host);
    }
    if let Some(domain_name) = obj.get("Domain").and_then(|v| v.as_str()) {
        let domain_name = domain_name.trim_start_matches('.');
        if host.eq_ignore_ascii_case(domain_name) {
            return true;
        }
        let suffix = format!(".{}", domain_name.to_ascii_lowercase());
        return host.to_ascii_lowercase().ends_with(&suffix);
    }
    true
}

fn format_error_chain(err: &dyn std::error::Error) -> String {
    let mut parts = vec![err.to_string()];
    let mut source = err.source();
    let mut depth = 0;
    while let Some(inner) = source {
        let text = inner.to_string();
        if !text.is_empty() && parts.last().map(|p| !p.contains(&text)).unwrap_or(true) {
            parts.push(text);
        }
        source = inner.source();
        depth += 1;
        if depth >= 8 {
            break;
        }
    }
    parts.join(" — ")
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopHttpRequest {
    method: String,
    url: String,
    headers: Vec<(String, String)>,
    body: Option<Vec<u8>>,
    connect_timeout: Option<u64>,
    /// When true, accept invalid / self-signed certificates (and host mismatches).
    skip_ssl: bool,
    /// Correlates with `desktop_http_cancel` so mid-flight requests can abort.
    request_id: Option<String>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopHttpResponse {
    status: u16,
    status_text: String,
    headers: Vec<(String, String)>,
    url: String,
    body: Vec<u8>,
}

/// Serializable mirror of the updater plugin's check metadata so the frontend
/// can wrap the result in `@tauri-apps/plugin-updater`'s `Update` class and
/// reuse download/install.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopUpdateCheckMetadata {
    rid: tauri::ResourceId,
    current_version: String,
    version: String,
    date: Option<String>,
    body: Option<String>,
    raw_json: serde_json::Value,
}

/// Check a specific GitHub release tag's `latest.json` so the user can install
/// (or downgrade to) any published desktop build, not only `/releases/latest`.
#[tauri::command]
async fn check_desktop_update_for_tag<R: tauri::Runtime>(
    webview: tauri::Webview<R>,
    tag: String,
) -> Result<Option<DesktopUpdateCheckMetadata>, String> {
    use tauri_plugin_updater::UpdaterExt;

    let trimmed = tag.trim().trim_start_matches('v');
    if trimmed.is_empty() {
        return Err("Release tag is required".into());
    }
    let tag_with_v = format!("v{trimmed}");
    let endpoint = format!(
        "https://github.com/midrissi/4d-dataexplorer/releases/download/{tag_with_v}/latest.json"
    );
    let url = url::Url::parse(&endpoint).map_err(|e| format!("invalid updater endpoint: {e}"))?;

    let builder = webview
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| e.to_string())?
        .header("Accept", "application/octet-stream")
        .map_err(|e| e.to_string())?
        // Treat the requested tag as always installable (upgrade, downgrade, or reinstall).
        .version_comparator(|_current, _release| true);

    let updater = builder.build().map_err(|e| e.to_string())?;
    let update = updater.check().await.map_err(|e| e.to_string())?;

    let Some(update) = update else {
        return Ok(None);
    };

    let rid = webview.resources_table().add(update.clone());
    Ok(Some(DesktopUpdateCheckMetadata {
        rid,
        current_version: update.current_version.clone(),
        version: update.version.clone(),
        date: update.date.map(|d| d.to_string()),
        body: update.body.clone(),
        raw_json: update.raw_json.clone(),
    }))
}

const HTTP_CANCELLED: &str = "Request cancelled";

async fn send_desktop_http(request: DesktopHttpRequest) -> Result<DesktopHttpResponse, String> {
    let DesktopHttpRequest {
        method,
        url,
        headers,
        body,
        connect_timeout,
        skip_ssl,
        request_id: _,
    } = request;

    let parsed_url = url::Url::parse(&url).map_err(|e| format!("invalid url: {e}"))?;
    let method = reqwest::Method::from_bytes(method.as_bytes())
        .map_err(|e| format!("invalid method: {e}"))?;

    let mut builder = reqwest::Client::builder()
        // 4D local HTTPS is usually HTTP/1.1; avoid ALPN/h2 negotiation issues.
        .http1_only()
        .use_rustls_tls();
    if skip_ssl {
        // rustls: disables certificate verification (covers self-signed + hostname mismatch).
        // `danger_accept_invalid_hostnames` is native-tls-only and is not needed here.
        builder = builder.danger_accept_invalid_certs(true);
    }
    if let Some(timeout_ms) = connect_timeout {
        if timeout_ms > 0 {
            builder = builder.connect_timeout(Duration::from_millis(timeout_ms));
        }
    }

    let client = builder.build().map_err(|e| format_error_chain(&e))?;
    let mut req = client.request(method.clone(), parsed_url);

    // 4D rejects POSTs without Content-Length (411). Drop hop-by-hop / length
    // headers from the webview so we can set a known-length body ourselves —
    // Transfer-Encoding: chunked would omit Content-Length and trigger 411.
    let is_body_method = method != reqwest::Method::GET && method != reqwest::Method::HEAD;
    for (name, value) in headers {
        let lower = name.to_ascii_lowercase();
        if lower == "content-length" || lower == "transfer-encoding" {
            continue;
        }
        req = req.header(name, value);
    }
    if is_body_method {
        // Prefer a minimal JSON object over a zero-length body: some stacks omit
        // Content-Length: 0, and application/json + empty body is poorly supported.
        let body_bytes = match body {
            Some(bytes) if !bytes.is_empty() => bytes,
            _ => b"{}".to_vec(),
        };
        req = req.header("Content-Length", body_bytes.len().to_string());
        req = req.body(body_bytes);
    } else if let Some(bytes) = body {
        req = req.header("Content-Length", bytes.len().to_string());
        req = req.body(bytes);
    }

    let response = req.send().await.map_err(|e| format_error_chain(&e))?;
    let status = response.status();
    let final_url = response.url().to_string();
    let status_text = status.canonical_reason().unwrap_or("").to_string();
    let response_headers = response
        .headers()
        .iter()
        .filter_map(|(name, value)| {
            value
                .to_str()
                .ok()
                .map(|v| (name.as_str().to_string(), v.to_string()))
        })
        .collect::<Vec<_>>();
    let body = response
        .bytes()
        .await
        .map_err(|e| format_error_chain(&e))?
        .to_vec();

    Ok(DesktopHttpResponse {
        status: status.as_u16(),
        status_text,
        headers: response_headers,
        url: final_url,
        body,
    })
}

/// Desktop HTTP helper used when skip-SSL is required. Returns the full TLS/error
/// chain instead of the opaque "error sending request for url" plugin message.
#[tauri::command]
async fn desktop_http_request(
    cancels: tauri::State<'_, PendingHttpCancels>,
    request: DesktopHttpRequest,
) -> Result<DesktopHttpResponse, String> {
    let request_id = request.request_id.clone();
    let cancel_rx = request_id
        .as_deref()
        .and_then(|id| cancels.register(id));

    if request_id.is_some() && cancel_rx.is_none() {
        return Err(HTTP_CANCELLED.into());
    }

    let result = if let Some(rx) = cancel_rx {
        tokio::select! {
            result = send_desktop_http(request) => result,
            _ = rx => Err(HTTP_CANCELLED.into()),
        }
    } else {
        send_desktop_http(request).await
    };

    if let Some(id) = request_id.as_deref() {
        cancels.finish(id);
    }
    result
}

#[tauri::command]
fn desktop_http_cancel(
    cancels: tauri::State<'_, PendingHttpCancels>,
    request_id: String,
) -> Result<(), String> {
    let trimmed = request_id.trim();
    if trimmed.is_empty() {
        return Err("requestId is required".into());
    }
    cancels.cancel(trimmed);
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        // Persist and restore the window's size, position, maximized and
        // fullscreen state across launches. Visibility is intentionally NOT
        // managed here: the window stays hidden until the frontend has painted
        // the themed UI (see below), which avoids a white/unstyled flash.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    StateFlags::SIZE
                        | StateFlags::POSITION
                        | StateFlags::MAXIMIZED
                        | StateFlags::FULLSCREEN,
                )
                .build(),
        )
        .manage(PendingHttpCancels::default())
        .invoke_handler(tauri::generate_handler![
            list_http_jar_cookies,
            desktop_http_request,
            desktop_http_cancel,
            check_desktop_update_for_tag
        ])
        .setup(|app| {
            // Register desktop-only plugins used by the auto-updater. These are
            // gated behind a desktop cfg because the updater/process plugins are
            // not available on mobile targets.
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_process::init())?;
                // Releases are versioned as `<semver>-<gitsha>` (e.g. 1.3.3-a4b0436).
                // Git SHAs are not ordered, so treat any different remote version as
                // an update — `/releases/latest` is the source of truth.
                app.handle().plugin(
                    tauri_plugin_updater::Builder::new()
                        .default_version_comparator(|current, release| {
                            release.version.to_string() != current.to_string()
                        })
                        .build(),
                )?;
            }

            // The window is created hidden (see tauri.conf.json) and revealed by
            // the frontend once the theme is applied and the first frame is
            // painted. This safety net guarantees the window is never stuck
            // hidden if the frontend fails to reveal it (e.g. a render error).
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(3000));
                if let Some(window) = handle.get_webview_window("main") {
                    if !window.is_visible().unwrap_or(true) {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
