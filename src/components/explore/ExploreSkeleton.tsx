export function ExploreSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-24 rounded-2xl border border-border bg-surface" />
      <div className="grid gap-6 lg:grid-cols-[minmax(13rem,15rem)_1fr]">
        <div className="h-80 rounded-2xl border border-border bg-surface" />
        <div className="h-96 rounded-2xl border border-border bg-surface" />
      </div>
    </div>
  );
}
