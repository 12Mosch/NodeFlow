import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/callback')({
  component: CallbackPage,
})

function CallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-pulse text-lg font-medium text-foreground">
          Completing sign in...
        </div>
        <p className="text-sm text-muted-foreground">
          Please wait while we finalize your session.
        </p>
      </div>
    </div>
  )
}
