import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const poppins = Poppins({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-poppins" });

export const metadata: Metadata = {
  title: "UNM Archery Club",
  description: "Book training sessions with the University of Nottingham Malaysia Archery Club.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The theme lives in a cookie so the server renders the right colours first time.
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable} theme-${theme}`}>
      <body>{children}</body>
    </html>
  );
}
