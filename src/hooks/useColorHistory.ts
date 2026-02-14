import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ColorEntry, ColorInfo } from "../types/color";
import { generateId } from "../utils/colorConvert";

const MAX_HISTORY = 100;

export function useColorHistory() {
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  // Load history on mount (only once)
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const loadHistory = async () => {
      try {
        setIsLoading(true);
        const history = await invoke<ColorEntry[]>("load_color_history");
        setColors(history);
        setError(null);
      } catch (err) {
        console.error("Failed to load history:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, []);

  const saveHistory = useCallback(async (newColors: ColorEntry[]) => {
    try {
      await invoke("save_color_history", { colors: newColors });
      setError(null);
    } catch (err) {
      console.error("Failed to save history:", err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const addColor = useCallback(
    async (colorInfo: ColorInfo) => {
      const newEntry: ColorEntry = {
        id: generateId(),
        hex: colorInfo.hex,
        rgb: colorInfo.rgb,
        timestamp: Date.now(),
      };

      setColors((prevColors) => {
        const newColors = [newEntry, ...prevColors].slice(0, MAX_HISTORY);
        // Save in background
        saveHistory(newColors);
        return newColors;
      });
    },
    [saveHistory]
  );

  const removeColor = useCallback(
    async (id: string) => {
      setColors((prevColors) => {
        const newColors = prevColors.filter((c) => c.id !== id);
        saveHistory(newColors);
        return newColors;
      });
    },
    [saveHistory]
  );

  const updateLabel = useCallback(
    async (id: string, label: string) => {
      setColors((prevColors) => {
        const newColors = prevColors.map((c) =>
          c.id === id ? { ...c, label: label || undefined } : c
        );
        saveHistory(newColors);
        return newColors;
      });
    },
    [saveHistory]
  );

  const clearHistory = useCallback(async () => {
    setColors([]);
    await saveHistory([]);
  }, [saveHistory]);

  const reload = useCallback(async () => {
    try {
      setIsLoading(true);
      const history = await invoke<ColorEntry[]>("load_color_history");
      setColors(history);
      setError(null);
    } catch (err) {
      console.error("Failed to reload history:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    colors,
    isLoading,
    error,
    addColor,
    removeColor,
    updateLabel,
    clearHistory,
    reload,
  };
}
