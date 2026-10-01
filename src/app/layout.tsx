import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

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
    <html lang="en" className="h-full scroll-smooth">
      <body className={`${inter.className} min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased`}>
        {/* Global Glassmorphism Header Navbar */}
        <Navbar />

        {/* Main Application Canvas */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>

        {/* Enterprise Deep Navy Footer */}
        <Footer />
      </body>
    </html>
  );
}