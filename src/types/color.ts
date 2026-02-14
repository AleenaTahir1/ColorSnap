export interface ColorInfo {
  hex: string;
  rgb: [number, number, number];
  x: number;
  y: number;
}

export interface ColorEntry {
  id: string;
  hex: string;
  rgb: [number, number, number];
  timestamp: number;
  label?: string;
}

export interface ZoomPreviewData {
  image_data: string; // Base64 encoded PNG
  center_color: ColorInfo;
  width: number;
  height: number;
}

export type ColorFormat = "hex" | "rgb" | "rgba" | "hsl" | "css-var";
