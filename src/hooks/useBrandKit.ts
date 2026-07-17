import { useSyncExternalStore, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { BrandKit } from "../types/color";

export const BRAND_ROLES = ["primary", "secondary", "accent", "neutral", "background"];

const EMPTY: BrandKit = {
  name: "My brand",
  colors: BRAND_ROLES.map((role) => ({ role, hex: "" })),
  headingFont: "",
  bodyFont: "",
  notes: "",
};

/** Single persisted brand kit, shared across the app via a module-level store. */
let kit: BrandKit = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loaded) {
    loaded = true;
    invoke<BrandKit | null>("load_brand_kit")
      .then((saved) => {
        if (saved) {
          // Ensure every role slot exists even if the schema grew
          const byRole = new Map(saved.colors.map((c) => [c.role, c.hex]));
          kit = {
            ...saved,
            colors: BRAND_ROLES.map((role) => ({ role, hex: byRole.get(role) ?? "" })),
          };
          emit();
        }
      })
      .catch((err) => console.error("Failed to load brand kit:", err));
  }
  return () => listeners.delete(listener);
}

function commit(next: BrandKit) {
  kit = next;
  emit();
  invoke("save_brand_kit", { kit: next }).catch((err) =>
    console.error("Failed to save brand kit:", err)
  );
}

export function useBrandKit() {
  const current = useSyncExternalStore(subscribe, () => kit);

  const setName = useCallback((name: string) => commit({ ...kit, name }), []);
  const setRoleColor = useCallback(
    (role: string, hex: string) =>
      commit({ ...kit, colors: kit.colors.map((c) => (c.role === role ? { ...c, hex } : c)) }),
    []
  );
  const setFonts = useCallback(
    (headingFont: string, bodyFont: string) => commit({ ...kit, headingFont, bodyFont }),
    []
  );
  const setNotes = useCallback((notes: string) => commit({ ...kit, notes }), []);

  return { kit: current, setName, setRoleColor, setFonts, setNotes };
}
