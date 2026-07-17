import { BrandKit } from "../types/color";
import { hexToRgb, contrastRatio } from "./contrast";

const assigned = (kit: BrandKit) => kit.colors.filter((c) => c.hex);

export function brandCss(kit: BrandKit): string {
  return `:root {\n${assigned(kit)
    .map((c) => `  --color-${c.role}: ${c.hex.toUpperCase()};`)
    .join("\n")}\n}`;
}

export function brandScss(kit: BrandKit): string {
  return assigned(kit)
    .map((c) => `$color-${c.role}: ${c.hex.toUpperCase()};`)
    .join("\n");
}

export function brandJson(kit: BrandKit): string {
  return JSON.stringify(
    {
      name: kit.name,
      colors: Object.fromEntries(
        assigned(kit).map((c) => {
          const [r, g, b] = hexToRgb(c.hex);
          return [c.role, { hex: c.hex.toUpperCase(), rgb: [r, g, b] }];
        })
      ),
      fonts: { heading: kit.headingFont, body: kit.bodyFont },
    },
    null,
    2
  );
}

export function brandTailwind(kit: BrandKit): string {
  return `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${assigned(
    kit
  )
    .map((c) => `        ${c.role}: '${c.hex.toUpperCase()}',`)
    .join("\n")}\n      },\n    },\n  },\n};`;
}

const fontFamilyParam = (name: string) => name.trim().replace(/\s+/g, "+");

/** A self-contained, shareable one-page brand sheet (HTML). */
export function brandSheetHtml(kit: BrandKit): string {
  const colors = assigned(kit);
  const fonts = [kit.headingFont, kit.bodyFont].filter(Boolean);
  const fontsLink = fonts.length
    ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts
        .map((f) => `family=${fontFamilyParam(f)}:wght@400;600;700`)
        .join("&")}&display=swap">`
    : "";
  const heading = kit.headingFont || "system-ui";
  const body = kit.bodyFont || "system-ui";

  const swatches = colors
    .map((c) => {
      const [r, g, b] = hexToRgb(c.hex);
      const onWhite = contrastRatio(hexToRgb(c.hex), [255, 255, 255]);
      const textOnWhiteOk = onWhite >= 4.5;
      return `
      <div class="swatch">
        <div class="chip" style="background:${c.hex}"></div>
        <div class="meta">
          <div class="role">${c.role}</div>
          <div class="hex">${c.hex.toUpperCase()}</div>
          <div class="rgb">rgb(${r}, ${g}, ${b})</div>
          <div class="note">${textOnWhiteOk ? "AA as text on white" : "use for fills, not small text on white"}</div>
        </div>
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${kit.name} — Brand Kit</title>
${fontsLink}
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: '${body}', system-ui, sans-serif; color: #1a1a1a; background: #fafaf8; padding: 48px 40px; }
  .wrap { max-width: 820px; margin: 0 auto; }
  h1 { font-family: '${heading}', system-ui, serif; font-size: 40px; margin-bottom: 6px; }
  .sub { color: #777; font-size: 14px; margin-bottom: 40px; }
  h2 { font-family: '${heading}', system-ui, serif; font-size: 18px; margin: 36px 0 16px; border-bottom: 1px solid #e6e6e0; padding-bottom: 8px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; }
  .swatch { border: 1px solid #e6e6e0; border-radius: 12px; overflow: hidden; background: #fff; }
  .chip { height: 80px; }
  .meta { padding: 10px 12px; }
  .role { font-size: 12px; text-transform: capitalize; font-weight: 700; }
  .hex { font-family: ui-monospace, monospace; font-size: 12px; margin-top: 2px; }
  .rgb { font-family: ui-monospace, monospace; font-size: 11px; color: #888; }
  .note { font-size: 10px; color: #aaa; margin-top: 4px; }
  .fonts { display: flex; gap: 40px; flex-wrap: wrap; }
  .font-block .label { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #999; }
  .font-h { font-family: '${heading}', system-ui, serif; font-size: 30px; }
  .font-b { font-family: '${body}', system-ui, sans-serif; font-size: 18px; }
  .notes { font-size: 15px; line-height: 1.6; color: #444; white-space: pre-wrap; }
  footer { margin-top: 48px; font-size: 11px; color: #bbb; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>${kit.name}</h1>
    <div class="sub">Brand kit</div>

    <h2>Colors</h2>
    <div class="grid">${swatches || "<p>No colors assigned.</p>"}</div>

    <h2>Typography</h2>
    <div class="fonts">
      <div class="font-block">
        <div class="label">Heading — ${heading}</div>
        <div class="font-h">Ag The quick brown fox</div>
      </div>
      <div class="font-block">
        <div class="label">Body — ${body}</div>
        <div class="font-b">The quick brown fox jumps over the lazy dog.</div>
      </div>
    </div>
${
  kit.notes.trim()
    ? `
    <h2>Notes</h2>
    <div class="notes">${kit.notes.replace(/</g, "&lt;")}</div>`
    : ""
}
    <footer>Made with Pixnib</footer>
  </div>
</body>
</html>`;
}
