import type { Metadata, Viewport } from "next";
import { Archivo, Atkinson_Hyperlegible_Next, JetBrains_Mono, VT323 } from "next/font/google";
import { Fx } from "@/components/fx";
// The palette goes first: swap this one import to re-colour the site (src/app/palettes/*.css).
import "./palettes/f3-visor-mist.css";
import "./globals.css";
import "./site.css";
import "./signs.css";

// Archivo's width axis gives the condensed display voice; Atkinson Hyperlegible Next is the reading face.
// VT323 sets the terminal labels (dates, prices, counts); JetBrains Mono draws the glyphs inside CRT bands.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" });
const atkinson = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-atkinson" });
const vt323 = VT323({ subsets: ["latin"], weight: "400", variable: "--font-vt323" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: "800", variable: "--font-jetbrains", preload: false });

export const metadata: Metadata = {
  title: "UNM Archery Club",
  description: "Book training sessions with the University of Nottingham Malaysia Archery Club.",
};

export const viewport: Viewport = { themeColor: "#08130e" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${atkinson.variable} ${vt323.variable} ${jetbrains.variable}`}>
      <body>
        {children}
        <Fx />
      </body>
    </html>
  );
}
