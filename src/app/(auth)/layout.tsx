export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100svh-4.25rem)] w-full items-center justify-center bg-[#f5f6f0] px-4 py-10 sm:py-12">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}