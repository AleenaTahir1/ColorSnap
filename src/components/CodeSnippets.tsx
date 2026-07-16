import { useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { codeFormats } from "../utils/codeFormats";

/** Copy-as-code shown as a compact stack of format buttons. */
export function CodeSnippets({ rgb }: { rgb: [number, number, number] }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = async (key: string, code: string) => {
    await writeText(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border)] p-2.5 space-y-2">
      <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
        </svg>
        Copy as code
      </span>

      <div className="grid grid-cols-2 gap-1.5">
        {codeFormats(rgb).map(({ key, label, code }) => {
          const done = copiedKey === key;
          return (
            <button
              key={key}
              onClick={() => handleCopy(key, code)}
              title={code}
              className={`group flex flex-col items-start gap-0.5 px-2.5 py-2 rounded-lg border text-left transition-colors duration-100 ${
                done
                  ? "border-[var(--brand-border)] bg-[var(--brand-soft)]"
                  : "border-[var(--border)] bg-[var(--bg-base)] hover:border-[var(--brand-border)] hover:bg-[var(--bg-elevated)]"
              }`}
            >
              <span className="flex items-center justify-between w-full">
                <span className="text-[11px] font-semibold text-[var(--text-primary)]">{label}</span>
                {done ? (
                  <svg className="w-3.5 h-3.5 text-[var(--brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--brand)] transition-colors duration-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <rect x="9" y="9" width="11" height="11" rx="2" />
                    <path d="M5 15V5a2 2 0 012-2h10" />
                  </svg>
                )}
              </span>
              <span className="font-mono text-[9.5px] text-[var(--text-muted)] truncate w-full">{code}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
