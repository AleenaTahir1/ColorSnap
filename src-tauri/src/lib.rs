mod color_picker;
mod storage;

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

// Global state for pick mode
static PICK_MODE_ACTIVE: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorInfo {
    pub hex: String,
    pub rgb: [u8; 3],
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorEntry {
    pub id: String,
    pub hex: String,
    pub rgb: [u8; 3],
    pub timestamp: u64,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZoomPreviewData {
    pub image_data: String, // Base64 encoded PNG
    pub center_color: ColorInfo,
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
fn get_color_at_cursor() -> Result<ColorInfo, String> {
    color_picker::get_color_at_cursor()
}

#[tauri::command]
fn capture_zoom_preview(size: u32) -> Result<ZoomPreviewData, String> {
    color_picker::capture_zoom_preview(size)
}

#[tauri::command]
async fn save_color_history(app: tauri::AppHandle, colors: Vec<ColorEntry>) -> Result<(), String> {
    storage::save_color_history(&app, &colors).await
}

#[tauri::command]
async fn load_color_history(app: tauri::AppHandle) -> Result<Vec<ColorEntry>, String> {
    storage::load_color_history(&app).await
}

#[tauri::command]
fn start_pick_mode(app: tauri::AppHandle) -> Result<(), String> {
    PICK_MODE_ACTIVE.store(true, Ordering::SeqCst);

    // Hide the main window so user can see the screen
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }

    // Set custom cursor
    color_picker::set_pick_cursor();

    // Emit event to frontend
    let _ = app.emit("pick-mode-started", ());

    Ok(())
}

#[tauri::command]
fn stop_pick_mode(app: tauri::AppHandle) -> Result<(), String> {
    PICK_MODE_ACTIVE.store(false, Ordering::SeqCst);

    // Restore default cursor
    color_picker::restore_default_cursor();

    // Show the main window
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }

    // Emit event to frontend
    let _ = app.emit("pick-mode-stopped", ());

    Ok(())
}

#[tauri::command]
fn is_pick_mode_active() -> bool {
    PICK_MODE_ACTIVE.load(Ordering::SeqCst)
}

#[tauri::command]
fn pick_color_now(app: tauri::AppHandle) -> Result<ColorInfo, String> {
    // Get the color at current cursor position
    let color = color_picker::get_color_at_cursor()?;

    // Stop pick mode
    PICK_MODE_ACTIVE.store(false, Ordering::SeqCst);

    // Restore default cursor
    color_picker::restore_default_cursor();

    // Show the main window
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }

    // Emit the picked color
    let _ = app.emit("color-picked", color.clone());

    Ok(color)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    // Win+Shift+C to toggle pick mode or pick color
                    let pick_shortcut =
                        Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyC);

                    if shortcut == &pick_shortcut && event.state == ShortcutState::Pressed {
                        if PICK_MODE_ACTIVE.load(Ordering::SeqCst) {
                            // If already in pick mode, pick the color
                            if let Ok(color) = color_picker::get_color_at_cursor() {
                                PICK_MODE_ACTIVE.store(false, Ordering::SeqCst);

                                // Restore default cursor
                                color_picker::restore_default_cursor();

                                let _ = app.emit("color-picked", color);

                                // Show window
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        } else {
                            // Start pick mode
                            PICK_MODE_ACTIVE.store(true, Ordering::SeqCst);
                            let _ = app.emit("pick-mode-started", ());

                            // Hide window
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }

                            // Set custom cursor
                            color_picker::set_pick_cursor();
                        }
                    }

                    // Escape to cancel pick mode
                    let escape_shortcut = Shortcut::new(None, Code::Escape);
                    if shortcut == &escape_shortcut
                        && event.state == ShortcutState::Pressed
                        && PICK_MODE_ACTIVE.load(Ordering::SeqCst)
                    {
                        PICK_MODE_ACTIVE.store(false, Ordering::SeqCst);

                        // Restore default cursor
                        color_picker::restore_default_cursor();

                        let _ = app.emit("pick-mode-stopped", ());

                        // Show window
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Register global shortcuts
            let pick_shortcut =
                Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyC);
            app.global_shortcut().register(pick_shortcut)?;

            let escape_shortcut = Shortcut::new(None, Code::Escape);
            app.global_shortcut().register(escape_shortcut)?;

            // Setup system tray
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let pick_item =
                MenuItem::with_id(app, "pick", "Pick Color (Win+Shift+C)", true, None::<&str>)?;
            let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&pick_item, &show_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("ColorSnap - Win+Shift+C to pick color")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        // Restore cursor before quitting
                        color_picker::restore_default_cursor();
                        app.exit(0);
                    }
                    "pick" => {
                        PICK_MODE_ACTIVE.store(true, Ordering::SeqCst);
                        let _ = app.emit("pick-mode-started", ());
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                        // Set custom cursor
                        color_picker::set_pick_cursor();
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_color_at_cursor,
            capture_zoom_preview,
            save_color_history,
            load_color_history,
            start_pick_mode,
            stop_pick_mode,
            is_pick_mode_active,
            pick_color_now,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
