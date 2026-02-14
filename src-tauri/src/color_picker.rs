use crate::{ColorInfo, ZoomPreviewData};
use base64::{engine::general_purpose::STANDARD, Engine};
use std::io::Cursor;
use std::sync::atomic::{AtomicBool, Ordering};

static CURSOR_CHANGED: AtomicBool = AtomicBool::new(false);

#[cfg(windows)]
use windows::Win32::{
    Foundation::{COLORREF, POINT},
    Graphics::Gdi::{
        CreateBitmap, CreateDIBSection, DeleteObject, GetDC, GetPixel, ReleaseDC,
        BITMAPINFO, BITMAPINFOHEADER, CLR_INVALID, DIB_RGB_COLORS,
    },
    UI::WindowsAndMessaging::{
        CreateIconIndirect, GetCursorPos, SetSystemCursor, SystemParametersInfoW,
        HCURSOR, ICONINFO, OCR_NORMAL, SPI_SETCURSORS,
        SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS,
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
        let color_bmp = match CreateDIBSection(
            hdc_screen,
            &bmi,
            DIB_RGB_COLORS,
            &mut bits_ptr,
            None,
            0,
        ) {
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

/// Capture a zoom preview around the cursor
#[cfg(windows)]
pub fn capture_zoom_preview(size: u32) -> Result<ZoomPreviewData, String> {
    use xcap::Monitor;

    let (cursor_x, cursor_y) = get_cursor_position()?;
    let (r, g, b) = get_pixel_color(cursor_x, cursor_y)?;

    // Find the monitor containing the cursor
    let monitors = Monitor::all().map_err(|e| format!("Failed to get monitors: {}", e))?;

    let monitor = monitors
        .into_iter()
        .find(|m| {
            let x = m.x();
            let y = m.y();
            let w = m.width() as i32;
            let h = m.height() as i32;
            cursor_x >= x && cursor_x < x + w && cursor_y >= y && cursor_y < y + h
        })
        .ok_or_else(|| "Could not find monitor containing cursor".to_string())?;

    // Calculate capture region (centered on cursor)
    let half_size = (size / 2) as i32;
    let monitor_x = monitor.x();
    let monitor_y = monitor.y();
    let monitor_w = monitor.width() as i32;
    let monitor_h = monitor.height() as i32;

    // Convert cursor position to monitor-relative coordinates
    let rel_x = cursor_x - monitor_x;
    let rel_y = cursor_y - monitor_y;

    // Calculate capture bounds (clamped to monitor)
    let capture_x = (rel_x - half_size).max(0);
    let capture_y = (rel_y - half_size).max(0);
    let capture_w = size.min((monitor_w - capture_x) as u32);
    let capture_h = size.min((monitor_h - capture_y) as u32);

    // Capture the region
    let image = monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture screen: {}", e))?;

    // Crop to the region we want
    let cropped = image::imageops::crop_imm(
        &image,
        capture_x as u32,
        capture_y as u32,
        capture_w,
        capture_h,
    )
    .to_image();

    // Encode to PNG and then base64
    let mut png_data = Cursor::new(Vec::new());
    cropped
        .write_to(&mut png_data, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode image: {}", e))?;

    let base64_image = STANDARD.encode(png_data.into_inner());

    Ok(ZoomPreviewData {
        image_data: base64_image,
        center_color: ColorInfo {
            hex: format!("#{:02X}{:02X}{:02X}", r, g, b),
            rgb: [r, g, b],
            x: cursor_x,
            y: cursor_y,
        },
        width: capture_w,
        height: capture_h,
    })
}

// Non-Windows fallback implementations
#[cfg(not(windows))]
pub fn get_color_at_cursor() -> Result<ColorInfo, String> {
    Err("Color picking is only supported on Windows".to_string())
}

#[cfg(not(windows))]
pub fn capture_zoom_preview(_size: u32) -> Result<ZoomPreviewData, String> {
    Err("Zoom preview is only supported on Windows".to_string())
}

#[cfg(not(windows))]
pub fn set_pick_cursor() {}

#[cfg(not(windows))]
pub fn restore_default_cursor() {}
