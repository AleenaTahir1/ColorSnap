import { useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { generateScale } from "../utils/colorConvert";

/** Tint→shade lightness strip of the displayed color; click a step to copy it. */
export function ShadeStrip({ rgb }: { rgb: [number, number, number] }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const shades = generateScale(rgb);

  const handleCopy = async (i: number, hex: string) => {
    await writeText(hex);
    setCopiedIdx(i);
    setTimeout(() => setCopiedIdx(null), 1200);
  };

  return (
    <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border)] px-3 py-2.5 space-y-2">
      <span className="block text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
        Shades &amp; tints
      </span>
      <div className="flex h-9 rounded-md overflow-hidden">
        {shades.map((hex, i) => (
          <button
            key={i}
            title={hex}
            onClick={() => handleCopy(i, hex)}
            className="flex-1 relative transition-all duration-150 hover:flex-[1.7] focus-visible:flex-[1.7]"
            style={{ backgroundColor: hex }}
          >
            {copiedIdx === i && (
              <svg
                className="absolute inset-0 m-auto w-3.5 h-3.5 mix-blend-difference text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
