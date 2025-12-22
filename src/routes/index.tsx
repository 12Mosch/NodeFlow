import { Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { BlockTree } from '../components/block-editor'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense fallback={<div className="p-8">Loading blocks...</div>}>
        <BlockTree />
      </Suspense>
    </div>
  )
}
