import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { PricingDisclaimer } from "@/components/common/pricing-disclaimer";

export const metadata: Metadata = {
  title: "cclog — Claude Code log explorer",
  description:
    "Visualize token usage, sub-agents, tools, MCP and skills across your Claude Code sessions.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Navbar />
        <main className="flex-1 px-6 py-6 max-w-[1400px] w-full mx-auto">{children}</main>
        <footer className="px-6 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <PricingDisclaimer />
        </footer>
      </body>
    </html>
  );
}
