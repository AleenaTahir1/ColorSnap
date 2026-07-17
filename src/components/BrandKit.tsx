import { useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { ColorEntry } from "../types/color";
import { useBrandKit, BRAND_ROLES } from "../hooks/useBrandKit";
import { FONT_PAIRS } from "../utils/fontPairs";
import { brandCss, brandScss, brandJson, brandTailwind, brandSheetHtml } from "../utils/brandKitExport";
import { contrastRatio, hexToRgb } from "../utils/contrast";
import { getContrastColor } from "../utils/colorConvert";

interface BrandKitProps {
  open: boolean;
  onClose: () => void;
  current: string | null;
  history: ColorEntry[];
}

const ROLE_LABELS: Record<string, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  neutral: "Neutral",
  background: "Background",
};

function normalizeHex(v: string): string | null {
  let s = v.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(s)) s = s.split("").map((c) => c + c).join("");
  return /^[0-9a-fA-F]{6}$/.test(s) ? `#${s.toUpperCase()}` : null;
}

const CODE_EXPORTS = [
  { key: "css", label: "CSS", gen: brandCss },
  { key: "scss", label: "SCSS", gen: brandScss },
  { key: "json", label: "JSON", gen: brandJson },
  { key: "tailwind", label: "Tailwind", gen: brandTailwind },
] as const;

export function BrandKit({ open, onClose, current, history }: BrandKitProps) {
  const { kit, setName, setRoleColor, setFonts, setNotes } = useBrandKit();
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const copyCode = async (key: string, code: string) => {
    await writeText(code);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const saveSheet = async () => {
    try {
      const path = await save({
        defaultPath: `${kit.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "brand"}-kit.html`,
        filters: [{ name: "HTML", extensions: ["html"] }],
      });
      if (path) {
        await invoke("write_file", { path, contents: brandSheetHtml(kit) });
        flash("Brand sheet saved");
      }
    } catch (e) {
      flash("Could not save the file");
    }
  };

  if (!open) return null;

  const hexOf = (role: string) => kit.colors.find((c) => c.role === role)?.hex ?? "";
  const bg = hexOf("background") || "#FFFFFF";
  const recent = [...new Set(history.map((c) => c.hex.toUpperCase()))].slice(0, 6);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-base)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] shrink-0 select-none">
        <button
          onClick={onClose}
          title="Back"
          className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-100 -ml-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-[14px] font-semibold">Brand Kit</h2>
      </div>

      <div className="flex-1 scroll-y px-4 py-4 space-y-5">
        {/* Name */}
        <input
          value={kit.name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Brand name"
          className="w-full bg-transparent text-[20px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />

        {/* Colors */}
        <section className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Colors</h3>
          {BRAND_ROLES.map((role) => {
            const hex = hexOf(role);
            return (
              <div key={role} className="flex items-center gap-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2">
                <div
                  className="w-9 h-9 rounded-md border border-[var(--border-hover)] shrink-0 flex items-center justify-center"
                  style={{ background: hex || "transparent" }}
                >
                  {!hex && (
                    <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                </div>
                <div className="w-[70px] shrink-0">
                  <div className="text-[12px] font-medium">{ROLE_LABELS[role]}</div>
                  <div className="text-[10px] font-mono text-[var(--text-muted)]">{hex || "unset"}</div>
                </div>
                <input
                  defaultValue={hex}
                  key={hex}
                  onBlur={(e) => {
                    const n = normalizeHex(e.target.value);
                    if (n) setRoleColor(role, n);
                    else if (!e.target.value.trim()) setRoleColor(role, "");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  placeholder="#RRGGBB"
                  className="flex-1 min-w-0 bg-[var(--bg-base)] border border-[var(--border)] rounded-md px-2 py-1.5 text-[11px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand-border)]"
                />
                {current && (
                  <button
                    onClick={() => setRoleColor(role, current.toUpperCase())}
                    title={`Use current ${current.toUpperCase()}`}
                    className="w-8 h-8 rounded-md border border-[var(--border-hover)] shrink-0 hover:scale-105 transition-transform duration-100"
                    style={{ background: current }}
                  />
                )}
              </div>
            );
          })}
          {recent.length > 0 && (
            <p className="text-[10px] text-[var(--text-muted)]">
              Tip: pick a color first, then tap the swatch on the right to assign it to a role.
            </p>
          )}
        </section>

        {/* Accessibility */}
        <section className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Readability on background</h3>
          <div className="space-y-1.5">
            {["primary", "secondary", "accent", "neutral"].map((role) => {
              const hex = hexOf(role);
              if (!hex) return null;
              const ratio = contrastRatio(hexToRgb(hex), hexToRgb(bg));
              const ok = ratio >= 4.5;
              const large = ratio >= 3;
              return (
                <div key={role} className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2">
                  <span className="flex items-center gap-2 text-[12px]">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: hex, color: getContrastColor(hexToRgb(hex)) }}>Aa</span>
                    {ROLE_LABELS[role]} on background
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-[var(--text-secondary)]">{ratio.toFixed(1)}:1</span>
                    <span className={`text-[10px] font-semibold ${ok ? "text-[var(--accent)]" : large ? "text-[#e0a83a]" : "text-[var(--danger)]"}`}>
                      {ok ? "AA" : large ? "Large only" : "Low"}
                    </span>
                  </span>
                </div>
              );
            })}
            {!hexOf("background") && (
              <p className="text-[11px] text-[var(--text-muted)]">Set a Background color to check readability.</p>
            )}
          </div>
        </section>

        {/* Fonts */}
        <section className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Font pairing</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {FONT_PAIRS.map((p) => {
              const active = kit.headingFont === p.heading && kit.bodyFont === p.body;
              return (
                <button
                  key={`${p.heading}-${p.body}`}
                  onClick={() => setFonts(p.heading, p.body)}
                  className={`text-left px-2.5 py-2 rounded-lg border transition-colors duration-100 ${
                    active
                      ? "border-[var(--brand-border)] bg-[var(--brand-soft)]"
                      : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]"
                  }`}
                >
                  <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{p.heading}</div>
                  <div className="text-[10px] text-[var(--text-muted)] truncate">{p.body}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Notes */}
        <section className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Notes</h3>
          <textarea
            value={kit.notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tagline, voice, do's and don'ts…"
            rows={3}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand-border)] resize-none"
          />
        </section>

        {/* Export */}
        <section className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Export</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {CODE_EXPORTS.map((exp) => (
              <button
                key={exp.key}
                onClick={() => copyCode(exp.key, exp.gen(kit))}
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--brand-border)] transition-colors duration-100 text-[12px] font-medium"
              >
                {exp.label}
                {copied === exp.key ? (
                  <svg className="w-3.5 h-3.5 text-[var(--brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                    <rect x="9" y="9" width="11" height="11" rx="2" />
                    <path d="M5 15V5a2 2 0 012-2h10" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={saveSheet}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--brand)] text-[var(--on-brand)] text-[12px] font-semibold hover:bg-[var(--brand-hover)] transition-colors duration-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
            </svg>
            Save brand sheet (HTML)
          </button>
          <p className="text-[10px] text-[var(--text-muted)]">A one-page HTML file with your colors and fonts, ready to send to your team.</p>
        </section>
      </div>

      {toast && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-[var(--bg-elevated)] border border-[var(--border-hover)] text-[var(--text-primary)] text-[12px] font-medium px-4 py-2 rounded-full shadow-lg shadow-black/30 animate-fade-in-up flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-[var(--brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}
    </div>
  );
}
