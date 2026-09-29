import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata = {
  title: "Lab Report Generator | GUB ADS",
};

export default async function LabReportGeneratorPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role !== "STUDENT") redirect("/");

  const generatorHtml = await readFile(
    join(process.cwd(), "src/features/lab-report-generator/labweb.html"),
    "utf8"
  );

  return (
    <div className="mx-auto w-full space-y-4">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-sm font-medium text-[#34724f]">Student utility</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Lab Report Generator</h1>
      </header>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <iframe
          title="Lab Report Generator"
          srcDoc={generatorHtml}
          className="block h-[calc(100dvh-13rem)] min-h-[44rem] w-full border-0"
        />
      </div>
    </div>
  );
}