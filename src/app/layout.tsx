import type { Metadata } from "next";
import { Caveat, Inter, Unbounded } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin", "latin-ext"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "Usability Cafe — test your concept for the price of a coffee",
  description:
    "Designers post concept designs, testers record think-aloud sessions, and results arrive already analyzed.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${unbounded.variable} ${caveat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
