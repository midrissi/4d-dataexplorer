use std::collections::HashMap;
use std::time::Duration;
use tauri::Manager;

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
    skip_ssl: bool,
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

/// HTTP helper used when skip-SSL is required (same contract as desktop).
#[tauri::command]
async fn desktop_http_request(request: DesktopHttpRequest) -> Result<DesktopHttpResponse, String> {
    let DesktopHttpRequest {
        method,
        url,
        headers,
        body,
        connect_timeout,
        skip_ssl,
    } = request;

    let parsed_url = url::Url::parse(&url).map_err(|e| format!("invalid url: {e}"))?;
    let method = reqwest::Method::from_bytes(method.as_bytes())
        .map_err(|e| format!("invalid method: {e}"))?;

    let mut builder = reqwest::Client::builder()
        .http1_only()
        .use_rustls_tls();
    if skip_ssl {
        builder = builder.danger_accept_invalid_certs(true);
    }
    if let Some(timeout_ms) = connect_timeout {
        if timeout_ms > 0 {
            builder = builder.connect_timeout(Duration::from_millis(timeout_ms));
        }
    }

    let client = builder.build().map_err(|e| format_error_chain(&e))?;
    let mut req = client.request(method.clone(), parsed_url);

    let is_body_method = method != reqwest::Method::GET && method != reqwest::Method::HEAD;
    for (name, value) in headers {
        let lower = name.to_ascii_lowercase();
        if lower == "content-length" || lower == "transfer-encoding" {
            continue;
        }
        req = req.header(name, value);
    }
    if is_body_method {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Paint under status bar / home indicator; CSS env(safe-area-inset-*) handles padding.
    #[cfg(target_os = "ios")]
    {
        builder = builder.plugin(tauri_plugin_edge_to_edge::init());
    }

    builder
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            list_http_jar_cookies,
            desktop_http_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running Data Explorer mobile");
}
