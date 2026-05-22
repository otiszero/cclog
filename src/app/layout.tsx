import type { Metadata, Viewport } from "next";
import { Fira_Sans, Fira_Code } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { PricingDisclaimer } from "@/components/common/pricing-disclaimer";

const firaSans = Fira_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-fira-sans",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "cclog — Claude Code log explorer",
  description:
    "Visualize token usage, sub-agents, tools, MCP and skills across your Claude Code sessions.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0d" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${firaSans.variable} ${firaCode.variable}`}
    >
      <body
        className="min-h-full flex md:flex-row flex-col"
        style={{ fontFamily: "var(--font-fira-sans), var(--font-sans)" }}
      >
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <main
            id="main"
            className="flex-1 px-4 md:px-6 py-4 md:py-6 max-w-[1400px] w-full mx-auto"
          >
            {children}
          </main>
          <footer
            className="px-4 md:px-6 py-4 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            <PricingDisclaimer />
          </footer>
        </div>
      </body>
    </html>
  );
}
