fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default().build()) // 👈 ESTE ES EL IMPORTANTE
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}