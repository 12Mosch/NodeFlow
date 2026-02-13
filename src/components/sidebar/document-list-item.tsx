import { useNavigate } from '@tanstack/react-router'
import { FileText } from 'lucide-react'
import type { Doc } from '../../../convex/_generated/dataModel'
import type { DocumentExamIndicator } from '@/lib/exams'
import { DocumentExamIndicatorView } from '@/components/exams/document-exam-indicator'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

interface DocumentListItemProps {
  document: Doc<'documents'>
  isActive: boolean
  examIndicator?: DocumentExamIndicator
}

export function DocumentListItem({
  document,
  isActive,
  examIndicator,
}: DocumentListItemProps) {
  const navigate = useNavigate({ from: '/doc/$docId' })

  const handleClick = () => {
    navigate({ to: '/doc/$docId', params: { docId: document._id } })
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={handleClick}
        isActive={isActive}
        tooltip={document.title || 'Untitled'}
        className="flex items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-sidebar-foreground/90 hover:border-sidebar-border/60 hover:bg-sidebar-accent/35 data-[active=true]:border-sidebar-border/80 data-[active=true]:bg-sidebar-accent/45"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sidebar-accent/50 text-sidebar-foreground/70">
          <FileText className="h-3.5 w-3.5 shrink-0" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate">{document.title || 'Untitled'}</span>
          <DocumentExamIndicatorView
            indicator={examIndicator}
            variant="sidebar"
          />
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
