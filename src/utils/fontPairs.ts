export interface FontPair {
  heading: string;
  body: string;
}

/**
 * Curated Google Fonts heading/body pairings (names only — no font files are
 * bundled or loaded). Used by the Brand Kit font picker and included in exports.
 */
export const FONT_PAIRS: FontPair[] = [
  { heading: "Inter", body: "Inter" },
  { heading: "Poppins", body: "Inter" },
  { heading: "Playfair Display", body: "Source Sans Pro" },
  { heading: "Montserrat", body: "Merriweather" },
  { heading: "Space Grotesk", body: "Inter" },
  { heading: "DM Serif Display", body: "DM Sans" },
  { heading: "Archivo", body: "Roboto" },
  { heading: "Lora", body: "Lato" },
  { heading: "Fraunces", body: "Nunito Sans" },
  { heading: "Bricolage Grotesque", body: "Work Sans" },
  { heading: "Libre Franklin", body: "Libre Baskerville" },
  { heading: "Sora", body: "IBM Plex Sans" },
  { heading: "Cormorant Garamond", body: "Proza Libre" },
  { heading: "Outfit", body: "Karla" },
];
