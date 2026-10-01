import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PortalShell } from "@/components/layout/PortalShell";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { NeuralBackground } from "@/components/ui/neural-background";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mentoring & Student Management Portal | GUB ADS",
  description: "Department of Artificial Intelligence & Data Science - Green University of Bangladesh",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth" suppressHydrationWarning>
      <body className={`${inter.className} theme-obsidian min-h-full bg-slate-900 text-slate-100 antialiased`}>
        <ThemeProvider>
          <NeuralBackground />
          <PortalShell>{children}</PortalShell>
        </ThemeProvider>
      </body>
    </html>
  );
}