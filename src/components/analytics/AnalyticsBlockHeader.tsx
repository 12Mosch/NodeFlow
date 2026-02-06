type AnalyticsBlockHeaderProps = {
  title: string
  description: string
}

function AnalyticsBlockHeader({
  title,
  description,
}: AnalyticsBlockHeaderProps) {
  return (
    <div className="space-y-1">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export { AnalyticsBlockHeader }
