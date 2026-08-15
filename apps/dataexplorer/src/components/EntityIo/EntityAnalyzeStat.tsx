export function EntityAnalyzeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-background/70 px-2 py-1.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 truncate font-medium font-mono text-sm tabular-nums" title={value}>
        {value}
      </p>
    </div>
  )
}
