import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/callback')({
  component: CallbackPage,
})

function CallbackPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-pulse text-foreground font-medium text-lg">
          Completing sign in...
        </div>
        <p className="text-muted-foreground text-sm">
          Please wait while we finalize your session.
        </p>
      </div>
    </div>
  )
}
