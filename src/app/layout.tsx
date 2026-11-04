import type { Metadata } from "next";
import { Archivo, Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";
import "./site.css";

// Archivo's width axis gives the condensed display voice; Atkinson Hyperlegible Next is the reading face.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" });
const atkinson = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-atkinson" });

export const metadata: Metadata = {
  title: "UNM Archery Club",
  description: "Book training sessions with the University of Nottingham Malaysia Archery Club.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${atkinson.variable}`}>
      <body>{children}</body>
    </html>
  );
}
