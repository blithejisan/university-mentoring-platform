export function DashboardLoading() {
  return (
    <div
      role="status"
      aria-label="Loading dashboard"
      aria-busy="true"
      className="space-y-7"
    >
      <span className="sr-only">Loading dashboard...</span>
      <div className="skeleton-shimmer h-24 rounded-2xl sm:h-32" aria-hidden="true" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="skeleton-shimmer h-36 rounded-xl" aria-hidden="true" />
        <div className="skeleton-shimmer h-36 rounded-xl" aria-hidden="true" />
      </div>
      <div className="skeleton-shimmer h-64 rounded-xl" aria-hidden="true" />
    </div>
  );
}
