const COMMANDS: &[&str] = &["save_to_downloads", "write_to_uri"];

fn main() {
  tauri_plugin::Builder::new(COMMANDS)
    .android_path("android")
    .build();
}
