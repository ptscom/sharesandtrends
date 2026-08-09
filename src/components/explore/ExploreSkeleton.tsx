export function ExploreSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-80 rounded-2xl border border-border bg-surface"
          />
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-border bg-surface" />
      <div className="h-96 rounded-2xl border border-border bg-surface" />
    </div>
  );
}
