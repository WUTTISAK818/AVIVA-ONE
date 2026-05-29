import { IBM_Plex_Sans_Thai, Cormorant_Garamond } from "next/font/google";

export const avivaPlusFont = IBM_Plex_Sans_Thai({
  weight: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  display: "swap",
});

export const avivaPlusWordmarkFont = Cormorant_Garamond({
  weight: ["500", "600"],
  subsets: ["latin"],
  display: "swap",
});
