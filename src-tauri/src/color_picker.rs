use crate::{ColorInfo, LoupeData};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

static CURSOR_CHANGED: AtomicBool = AtomicBool::new(false);

/// Full-virtual-screen snapshot taken when area mode starts, so the selection
/// overlay tint is never part of the averaged region. Pixels are BGRA.
#[cfg(windows)]
struct AreaSnapshot {
    pixels: Vec<u8>,
    width: i32,
    height: i32,
    origin_x: i32,
    origin_y: i32,
}

#[cfg(windows)]
static AREA_SNAPSHOT: Mutex<Option<AreaSnapshot>> = Mutex::new(None);

#[cfg(windows)]
use windows::Win32::{
    Foundation::{COLORREF, POINT},
    Graphics::Gdi::{
        BitBlt, CreateBitmap, CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetDC,
        GetPixel, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, CLR_INVALID,
        DIB_RGB_COLORS, SRCCOPY,
    },
    UI::WindowsAndMessaging::{
        CreateIconIndirect, GetCursorPos, GetSystemMetrics, SetSystemCursor, SystemParametersInfoW,
        HCURSOR, ICONINFO, OCR_NORMAL, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN,
        SM_YVIRTUALSCREEN, SPI_SETCURSORS, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS,
    },
};

/// Get the current cursor position
#[cfg(windows)]
fn get_cursor_position() -> Result<(i32, i32), String> {
    unsafe {
        let mut point = POINT::default();
        GetCursorPos(&mut point).map_err(|e| format!("Failed to get cursor position: {}", e))?;
        Ok((point.x, point.y))
    }
}

/// Get the color of a pixel at the given screen coordinates
#[cfg(windows)]
fn get_pixel_color(x: i32, y: i32) -> Result<(u8, u8, u8), String> {
    unsafe {
        let hdc = GetDC(None);
        if hdc.is_invalid() {
            return Err("Failed to get device context".to_string());
        }

        let color = GetPixel(hdc, x, y);
        let _ = ReleaseDC(None, hdc);

        if color == COLORREF(CLR_INVALID) {
            return Err("Failed to get pixel color".to_string());
        }

        // COLORREF is in BGR format
        let color_val = color.0;
        let r = (color_val & 0xFF) as u8;
        let g = ((color_val >> 8) & 0xFF) as u8;
        let b = ((color_val >> 16) & 0xFF) as u8;

        Ok((r, g, b))
    }
}

/// Get the color at the current cursor position
#[cfg(windows)]
pub fn get_color_at_cursor() -> Result<ColorInfo, String> {
    let (x, y) = get_cursor_position()?;
    let (r, g, b) = get_pixel_color(x, y)?;

    Ok(ColorInfo {
        hex: format!("#{:02X}{:02X}{:02X}", r, g, b),
        rgb: [r, g, b],
        x,
        y,
    })
}

/// Set a custom cursor from the app icon during pick mode
#[cfg(windows)]
pub fn set_pick_cursor() {
    use std::ffi::c_void;
    use windows::Win32::Foundation::BOOL;

    // Load the 64x64 icon PNG embedded at compile time (bigger for visibility)
    let icon_bytes = include_bytes!("../icons/64x64.png");
    let img = match image::load_from_memory(icon_bytes) {
        Ok(img) => img.to_rgba8(),
        Err(e) => {
            eprintln!("Failed to load cursor icon: {}", e);
            return;
        }
    };

    let (w, h) = img.dimensions();
    let pixels = img.as_raw();

    unsafe {
        let hdc_screen = GetDC(None);

        // Create BITMAPINFO for 32-bit top-down DIB
        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = w as i32;
        bmi.bmiHeader.biHeight = -(h as i32); // negative = top-down
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = 0; // BI_RGB

        let mut bits_ptr: *mut c_void = std::ptr::null_mut();
        let color_bmp =
            match CreateDIBSection(hdc_screen, &bmi, DIB_RGB_COLORS, &mut bits_ptr, None, 0) {
                Ok(bmp) => bmp,
                Err(e) => {
                    eprintln!("Failed to create DIB section: {}", e);
                    ReleaseDC(None, hdc_screen);
                    return;
                }
            };

        if bits_ptr.is_null() {
            eprintln!("DIB section bits pointer is null");
            let _ = DeleteObject(color_bmp);
            ReleaseDC(None, hdc_screen);
            return;
        }

        // Copy RGBA pixels -> premultiplied BGRA (Windows format)
        let dst = std::slice::from_raw_parts_mut(bits_ptr as *mut u8, (w * h * 4) as usize);
        for i in 0..(w * h) as usize {
            let r = pixels[i * 4] as u32;
            let g = pixels[i * 4 + 1] as u32;
            let b = pixels[i * 4 + 2] as u32;
            let a = pixels[i * 4 + 3] as u32;
            // Premultiply alpha for Windows
            dst[i * 4] = (b * a / 255) as u8;
            dst[i * 4 + 1] = (g * a / 255) as u8;
            dst[i * 4 + 2] = (r * a / 255) as u8;
            dst[i * 4 + 3] = a as u8;
        }

        // Create monochrome AND mask (all zeros = fully opaque, alpha handles transparency)
        let mask_bmp = CreateBitmap(w as i32, h as i32, 1, 1, None);

        let icon_info = ICONINFO {
            fIcon: BOOL(0), // FALSE = this is a cursor, not an icon
            xHotspot: w / 2,
            yHotspot: h / 2,
            hbmMask: mask_bmp,
            hbmColor: color_bmp,
        };

        match CreateIconIndirect(&icon_info) {
            Ok(icon) => {
                let cursor = HCURSOR(icon.0);
                if SetSystemCursor(cursor, OCR_NORMAL).is_ok() {
                    CURSOR_CHANGED.store(true, Ordering::SeqCst);
                }
            }
            Err(e) => {
                eprintln!("Failed to create cursor: {}", e);
            }
        }

        // Cleanup bitmap handles (cursor owns copies)
        let _ = DeleteObject(mask_bmp);
        let _ = DeleteObject(color_bmp);
        ReleaseDC(None, hdc_screen);
    }
}

/// Restore the default system cursor
#[cfg(windows)]
pub fn restore_default_cursor() {
    if CURSOR_CHANGED.load(Ordering::SeqCst) {
        unsafe {
            let _ = SystemParametersInfoW(
                SPI_SETCURSORS,
                0,
                None,
                SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
            );
        }
        CURSOR_CHANGED.store(false, Ordering::SeqCst);
    }
}

/// Force-restore the default system cursor unconditionally.
/// Used on startup to recover from a previous crash/kill that left a custom cursor.
#[cfg(windows)]
pub fn restore_default_cursor_force() {
    unsafe {
        let _ = SystemParametersInfoW(
            SPI_SETCURSORS,
            0,
            None,
            SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
        );
    }
    CURSOR_CHANGED.store(false, Ordering::SeqCst);
}

/// Capture a small pixel grid centered on the cursor for the loupe.
/// Uses a single BitBlt of grid×grid pixels, so it is fast enough to poll.
#[cfg(windows)]
pub fn capture_loupe_grid(grid: u32) -> Result<LoupeData, String> {
    use std::ffi::c_void;

    let (cursor_x, cursor_y) = get_cursor_position()?;
    let half = (grid / 2) as i32;

    unsafe {
        let screen_dc = GetDC(None);
        if screen_dc.is_invalid() {
            return Err("Failed to get screen device context".to_string());
        }
        let mem_dc = CreateCompatibleDC(screen_dc);

        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = grid as i32;
        bmi.bmiHeader.biHeight = -(grid as i32); // negative = top-down
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = 0; // BI_RGB

        let mut bits_ptr: *mut c_void = std::ptr::null_mut();
        let bmp = CreateDIBSection(screen_dc, &bmi, DIB_RGB_COLORS, &mut bits_ptr, None, 0)
            .map_err(|e| {
                let _ = DeleteDC(mem_dc);
                ReleaseDC(None, screen_dc);
                format!("Failed to create DIB section: {}", e)
            })?;

        let old_bmp = SelectObject(mem_dc, bmp);
        let blit = BitBlt(
            mem_dc,
            0,
            0,
            grid as i32,
            grid as i32,
            screen_dc,
            cursor_x - half,
            cursor_y - half,
            SRCCOPY,
        );

        let mut colors = Vec::with_capacity((grid * grid) as usize);
        if blit.is_ok() && !bits_ptr.is_null() {
            let px = std::slice::from_raw_parts(bits_ptr as *const u8, (grid * grid * 4) as usize);
            for i in 0..(grid * grid) as usize {
                // DIB sections are BGRA
                let (b, g, r) = (px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
                colors.push(format!("#{:02X}{:02X}{:02X}", r, g, b));
            }
        }

        SelectObject(mem_dc, old_bmp);
        let _ = DeleteObject(bmp);
        let _ = DeleteDC(mem_dc);
        ReleaseDC(None, screen_dc);

        if colors.is_empty() {
            return Err("Failed to capture loupe region".to_string());
        }

        let center = colors[(half as u32 * grid + half as u32) as usize].clone();
        Ok(LoupeData {
            colors,
            hex: center,
            x: cursor_x,
            y: cursor_y,
        })
    }
}

/// Current physical cursor position in screen coordinates.
#[cfg(windows)]
pub fn cursor_pos() -> Result<(i32, i32), String> {
    get_cursor_position()
}

/// Capture the entire virtual screen into a snapshot. Called the instant before
/// the selection overlay is shown, so the overlay's dark tint is never captured.
#[cfg(windows)]
pub fn capture_area_snapshot() -> Result<(), String> {
    use std::ffi::c_void;

    unsafe {
        let origin_x = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let origin_y = GetSystemMetrics(SM_YVIRTUALSCREEN);
        let width = GetSystemMetrics(SM_CXVIRTUALSCREEN).max(1);
        let height = GetSystemMetrics(SM_CYVIRTUALSCREEN).max(1);

        let screen_dc = GetDC(None);
        if screen_dc.is_invalid() {
            return Err("Failed to get screen device context".to_string());
        }
        let mem_dc = CreateCompatibleDC(screen_dc);

        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = width;
        bmi.bmiHeader.biHeight = -height; // top-down
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = 0; // BI_RGB

        let mut bits_ptr: *mut c_void = std::ptr::null_mut();
        let bmp = CreateDIBSection(screen_dc, &bmi, DIB_RGB_COLORS, &mut bits_ptr, None, 0)
            .map_err(|e| {
                let _ = DeleteDC(mem_dc);
                ReleaseDC(None, screen_dc);
                format!("Failed to create DIB section: {}", e)
            })?;

        let old_bmp = SelectObject(mem_dc, bmp);
        let blit = BitBlt(
            mem_dc, 0, 0, width, height, screen_dc, origin_x, origin_y, SRCCOPY,
        );

        let mut pixels = Vec::new();
        if blit.is_ok() && !bits_ptr.is_null() {
            let px =
                std::slice::from_raw_parts(bits_ptr as *const u8, (width * height * 4) as usize);
            pixels = px.to_vec();
        }

        SelectObject(mem_dc, old_bmp);
        let _ = DeleteObject(bmp);
        let _ = DeleteDC(mem_dc);
        ReleaseDC(None, screen_dc);

        if pixels.is_empty() {
            return Err("Failed to capture screen snapshot".to_string());
        }

        *AREA_SNAPSHOT.lock().unwrap() = Some(AreaSnapshot {
            pixels,
            width,
            height,
            origin_x,
            origin_y,
        });
        Ok(())
    }
}

/// Average the pixels of the rectangle (two screen points) from the snapshot
/// captured at area-mode start. Falls back to an error if no snapshot exists.
#[cfg(windows)]
pub fn average_area_color(x1: i32, y1: i32, x2: i32, y2: i32) -> Result<(u8, u8, u8), String> {
    let guard = AREA_SNAPSHOT.lock().unwrap();
    let snap = guard.as_ref().ok_or("No screen snapshot available")?;

    // Convert screen coords to snapshot-relative, clamp to bounds
    let sx1 = (x1.min(x2) - snap.origin_x).clamp(0, snap.width - 1);
    let sy1 = (y1.min(y2) - snap.origin_y).clamp(0, snap.height - 1);
    let sx2 = (x1.max(x2) - snap.origin_x).clamp(0, snap.width - 1);
    let sy2 = (y1.max(y2) - snap.origin_y).clamp(0, snap.height - 1);

    let (mut r_sum, mut g_sum, mut b_sum, mut count) = (0u64, 0u64, 0u64, 0u64);
    for y in sy1..=sy2 {
        for x in sx1..=sx2 {
            let i = ((y * snap.width + x) * 4) as usize;
            // BGRA
            b_sum += snap.pixels[i] as u64;
            g_sum += snap.pixels[i + 1] as u64;
            r_sum += snap.pixels[i + 2] as u64;
            count += 1;
        }
    }

    if count == 0 {
        return Err("Empty selection".to_string());
    }
    Ok((
        (r_sum / count) as u8,
        (g_sum / count) as u8,
        (b_sum / count) as u8,
    ))
}

/// Drop the snapshot when area mode ends, freeing the buffer.
#[cfg(windows)]
pub fn clear_area_snapshot() {
    *AREA_SNAPSHOT.lock().unwrap() = None;
}

// Non-Windows fallback implementations
#[cfg(not(windows))]
pub fn get_color_at_cursor() -> Result<ColorInfo, String> {
    Err("Color picking is only supported on Windows".to_string())
}

#[cfg(not(windows))]
pub fn capture_loupe_grid(_grid: u32) -> Result<LoupeData, String> {
    Err("Loupe capture is only supported on Windows".to_string())
}

#[cfg(not(windows))]
pub fn cursor_pos() -> Result<(i32, i32), String> {
    Err("Area picking is only supported on Windows".to_string())
}

#[cfg(not(windows))]
pub fn capture_area_snapshot() -> Result<(), String> {
    Err("Area picking is only supported on Windows".to_string())
}

#[cfg(not(windows))]
pub fn average_area_color(_x1: i32, _y1: i32, _x2: i32, _y2: i32) -> Result<(u8, u8, u8), String> {
    Err("Area picking is only supported on Windows".to_string())
}

#[cfg(not(windows))]
pub fn clear_area_snapshot() {}

#[cfg(not(windows))]
pub fn set_pick_cursor() {}

#[cfg(not(windows))]
pub fn restore_default_cursor() {}

#[cfg(not(windows))]
pub fn restore_default_cursor_force() {}
