<div align="center">

<img src="public/logo.svg" alt="ColorSnap Logo" width="120" />

# ColorSnap

**Screen color picker for Windows**

Pick any color from anywhere on your screen — not just browsers, not just apps.

[![Release](https://img.shields.io/github/v/release/AleenaTahir1/ColorSnap)](https://github.com/AleenaTahir1/ColorSnap/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/AleenaTahir1/ColorSnap/ci.yml)](https://github.com/AleenaTahir1/ColorSnap/actions)
[![License](https://img.shields.io/badge/license-Source%20Available-blue)](LICENSE.txt)

</div>

---

## Built for Designers

You work with colors all day. Matching a client's brand color from a PDF. Grabbing that exact blue from a competitor's website. Sampling a shade from an image in Photoshop. Finding the perfect accent from a Dribbble shot.

**The problem?** Browser extensions only work in browsers. Figma's eyedropper only works in Figma. Every tool is trapped in its own sandbox.

**ColorSnap breaks that wall.**

Press `Win+Shift+C` and pick any color from anywhere — your desktop wallpaper, a video playing in VLC, a color in an email, a pixel in a game. Anywhere. The hex code is instantly copied to your clipboard.

No switching apps. No screenshots. No color conversion tools. Just point and pick.

---

<div align="center">
<img src="screenshots/app.png" alt="ColorSnap App" width="380" />
</div>

---

## Features

- **Pick from anywhere** — Not limited to browsers or specific apps. Any pixel on your screen is fair game.
- **Instant hotkey** — Press `Win+Shift+C` from any app, anytime
- **Multiple formats** — Copy as HEX, RGB, or HSL with one click
- **Color history** — All picked colors are saved and browsable
- **Auto-copy** — Color values are copied to clipboard automatically
- **System tray** — Runs quietly in the background, always ready
- **Dark theme** — Clean, minimal UI that stays out of your way

---

## Installation

Download the latest release from the [Releases](https://github.com/AleenaTahir1/ColorSnap/releases) page:

- **`.msi`** — Standard Windows installer (recommended)
- **`.exe`** — NSIS installer

---

## How to Use

1. **Click "Pick a Color"** or press `Win+Shift+C`
2. **App hides** so you can see your full screen
3. **Move your cursor** to any color you want
4. **Press `Win+Shift+C` again** to capture the color
5. **Color is copied** to your clipboard automatically

Press `Esc` to cancel pick mode without capturing.

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Win+Shift+C` | Start pick mode / Capture color |
| `Esc` | Cancel pick mode |

### Color Formats

Right-click any color from history to copy in different formats:

- **HEX** — `#3B82F6`
- **RGB** — `rgb(59, 130, 246)`
- **HSL** — `hsl(217, 91%, 60%)`

---

## Development

### Requirements

- Node.js 18+
- Rust 1.70+
- Tauri 2 system dependencies

### Run Locally

```bash
git clone https://github.com/AleenaTahir1/ColorSnap.git
cd ColorSnap
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

### Project Structure

```
ColorSnap/
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # UI components
│   ├── hooks/              # Custom hooks
│   ├── types/              # TypeScript types
│   └── utils/              # Color conversion utilities
├── src-tauri/              # Backend (Rust)
│   ├── src/
│   │   ├── lib.rs          # App setup, commands, tray
│   │   ├── color_picker.rs # Screen capture, pixel reading
│   │   └── storage.rs      # Color history persistence
│   └── capabilities/       # Tauri 2 permissions
└── package.json
```

---

## Tech Stack

- **Frontend** — React 18, TypeScript, Tailwind CSS
- **Backend** — Rust, Tauri 2
- **Screen Capture** — Windows GDI API, xcap
- **Build** — Vite

---

## License

This project uses a **Source Available** license. See [LICENSE.txt](LICENSE.txt) for details.

- Free for personal and educational use
- Free to modify for personal use
- Commercial use requires permission

---

## Author

**Aleena Tahir**

- GitHub: [AleenaTahir1](https://github.com/AleenaTahir1)
