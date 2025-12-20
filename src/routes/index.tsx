import { createFileRoute } from '@tanstack/react-router'
import { BlockTree } from '../components/block-editor'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <BlockTree />
    </div>
  )
}
