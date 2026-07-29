use tauri::{
  plugin::{Builder, TauriPlugin},
  Runtime,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_edge_to_edge);

/// Expand WKWebView under status bar / home indicator on iOS.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("edge-to-edge")
    .setup(|_app, api| {
      #[cfg(target_os = "ios")]
      {
        api.register_ios_plugin(init_plugin_edge_to_edge)?;
      }
      #[cfg(not(target_os = "ios"))]
      let _ = api;
      Ok(())
    })
    .build()
}
