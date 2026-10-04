export default function Loading() {
  return (
    <main
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm text-slate-300">Loading the mentoring portal...</p>
    </main>
  );
}
