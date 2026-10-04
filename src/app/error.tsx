"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-semibold text-slate-100">This page couldn&apos;t load</h1>
      <p className="text-sm text-slate-300">
        The page encountered a temporary problem. Please try again.
      </p>
      {error.digest && (
        <p className="text-xs text-slate-500">Reference: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        Try again
      </button>
    </main>
  );
}
