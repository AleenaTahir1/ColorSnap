import { useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { ColorEntry, ColorFormat } from "../types/color";
import { formatColor, getContrastColor } from "../utils/colorConvert";

interface ColorCardProps {
  color: ColorEntry;
  onDelete?: (id: string) => void;
  onSelect?: (color: ColorEntry) => void;
}

export function ColorCard({ color, onDelete, onSelect }: ColorCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const contrastColor = getContrastColor(color.rgb);

  const handleCopy = async (format: ColorFormat = "hex") => {
    const text = formatColor(color.rgb, format);
    await writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
    setShowMenu(false);
  };

  const handleClick = () => {
    onSelect?.(color);
  };

  return (
    <div className="relative group">
      <div
        className="aspect-square rounded-lg cursor-pointer transition-all duration-200 hover:scale-105 hover:z-10 flex items-center justify-center hover:ring-1 hover:ring-white/20"
        style={{
          backgroundColor: color.hex,
          boxShadow: `0 1px 6px ${color.hex}15`,
        }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu(true);
        }}
        title={color.hex}
      >
        {copied && (
          <svg
            className="w-3.5 h-3.5 animate-fade-in"
            fill="none"
            stroke={contrastColor}
            viewBox="0 0 24 24"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.(color.id);
        }}
        className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-full text-[var(--text-muted)] text-[9px] leading-none opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center justify-center hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] hover:border-[var(--danger)]/30 z-20"
      >
        ×
      </button>

      {/* Context menu */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute top-full left-0 mt-1.5 bg-[var(--bg-elevated)] rounded-lg shadow-xl shadow-black/30 z-50 py-1 min-w-[160px] border border-[var(--border-hover)] text-[11px] animate-slide-in">
            {(["hex", "rgb", "hsl"] as ColorFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => handleCopy(f)}
                className="w-full px-3 py-1.5 text-left text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-100 flex items-center justify-between gap-3"
              >
                <span>Copy {f.toUpperCase()}</span>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                  {formatColor(color.rgb, f)}
                </span>
              </button>
            ))}
            <div className="my-1 border-t border-[var(--border)]" />
            <button
              onClick={() => {
                onDelete?.(color.id);
                setShowMenu(false);
              }}
              className="w-full px-3 py-1.5 text-left text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors duration-100"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
