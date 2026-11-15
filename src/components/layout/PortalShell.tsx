"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasRolePath = /^\/(admin|moderator|mentor|student)(\/|$)/.test(pathname);
  const showSidebar = (hasRolePath && !pathname.startsWith("/pending-approval")) || pathname === "/profile";

  return (
    <div className="portal-shell flex min-h-screen w-full flex-col bg-background text-foreground">
      <Navbar />
      <div className={showSidebar ? "flex flex-1 flex-col md:flex-row" : "flex flex-1 flex-col"}>
        {showSidebar && <Sidebar />}
        <div className="flex min-w-0 flex-1 flex-col">
          <main
            className={
              showSidebar
                ? "min-w-0 flex-1 p-4 sm:p-6 lg:p-8"
                : "mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8"
            }
          >
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
