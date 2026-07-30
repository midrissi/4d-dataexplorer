use serde::{Deserialize, Serialize};
use tauri::{
  plugin::{Builder, TauriPlugin},
  Runtime,
};

#[cfg(target_os = "android")]
use tauri::Manager;

#[cfg(target_os = "android")]
mod android {
  use serde::de::DeserializeOwned;
  use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
  };

  use super::{SaveToDownloadsPayload, WriteToUriPayload};

  const PLUGIN_IDENTIFIER: &str = "com.plugin.savebytes";

  pub struct SaveBytes<R: Runtime>(pub PluginHandle<R>);

  pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
  ) -> Result<SaveBytes<R>, Box<dyn std::error::Error>> {
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "SaveBytesPlugin")?;
    Ok(SaveBytes(handle))
  }

  impl<R: Runtime> SaveBytes<R> {
    pub fn save_to_downloads(&self, args: &SaveToDownloadsPayload) -> Result<(), String> {
      self
        .0
        .run_mobile_plugin::<()>("saveToDownloads", args)
        .map_err(|e| e.to_string())
    }

    pub fn write_to_uri(&self, args: &WriteToUriPayload) -> Result<(), String> {
      self
        .0
        .run_mobile_plugin::<()>("writeToUri", args)
        .map_err(|e| e.to_string())
    }
  }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveToDownloadsPayload {
  pub filename: String,
  pub mime_type: Option<String>,
  pub source_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteToUriPayload {
  pub uri: String,
  pub source_path: String,
}

#[cfg(target_os = "android")]
struct AndroidSaveBytes<R: Runtime>(android::SaveBytes<R>);

#[tauri::command]
#[cfg(target_os = "android")]
fn save_to_downloads<R: Runtime>(
  app: tauri::AppHandle<R>,
  filename: String,
  mime_type: Option<String>,
  source_path: String,
) -> Result<(), String> {
  app
    .state::<AndroidSaveBytes<R>>()
    .0
    .save_to_downloads(&SaveToDownloadsPayload {
      filename,
      mime_type,
      source_path,
    })
}

#[tauri::command]
#[cfg(not(target_os = "android"))]
fn save_to_downloads(
  _filename: String,
  _mime_type: Option<String>,
  _source_path: String,
) -> Result<(), String> {
  Err("save_to_downloads is only available on Android".into())
}

#[tauri::command]
#[cfg(target_os = "android")]
fn write_to_uri<R: Runtime>(
  app: tauri::AppHandle<R>,
  uri: String,
  source_path: String,
) -> Result<(), String> {
  app
    .state::<AndroidSaveBytes<R>>()
    .0
    .write_to_uri(&WriteToUriPayload { uri, source_path })
}

#[tauri::command]
#[cfg(not(target_os = "android"))]
fn write_to_uri(_uri: String, _source_path: String) -> Result<(), String> {
  Err("write_to_uri is only available on Android".into())
}

/// Save files via MediaStore / ContentResolver on Android (avoids 0-byte content:// writes).
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("save-bytes")
    .invoke_handler(tauri::generate_handler![save_to_downloads, write_to_uri])
    .setup(|app, api| {
      #[cfg(target_os = "android")]
      {
        let handle = android::init(app, api)?;
        app.manage(AndroidSaveBytes(handle));
      }
      #[cfg(not(target_os = "android"))]
      let _ = (app, api);
      Ok(())
    })
    .build()
}
