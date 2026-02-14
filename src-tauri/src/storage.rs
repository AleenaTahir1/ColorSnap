use crate::ColorEntry;
use std::path::PathBuf;
use tauri::Manager;

const HISTORY_FILE: &str = "color_history.json";

fn get_storage_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Ensure directory exists
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    Ok(app_data_dir.join(HISTORY_FILE))
}

pub async fn save_color_history(
    app: &tauri::AppHandle,
    colors: &[ColorEntry],
) -> Result<(), String> {
    let path = get_storage_path(app)?;
    let json = serde_json::to_string_pretty(colors)
        .map_err(|e| format!("Failed to serialize colors: {}", e))?;

    std::fs::write(&path, json).map_err(|e| format!("Failed to write history file: {}", e))?;

    Ok(())
}

pub async fn load_color_history(app: &tauri::AppHandle) -> Result<Vec<ColorEntry>, String> {
    let path = get_storage_path(app)?;

    if !path.exists() {
        return Ok(Vec::new());
    }

    let json =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read history file: {}", e))?;

    let colors: Vec<ColorEntry> =
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse history file: {}", e))?;

    Ok(colors)
}
