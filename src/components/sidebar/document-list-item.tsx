import { useNavigate } from '@tanstack/react-router'
import { FileText } from 'lucide-react'
import type { Doc } from '../../../convex/_generated/dataModel'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

interface DocumentListItemProps {
  document: Doc<'documents'>
  isActive: boolean
}

export function DocumentListItem({
  document,
  isActive,
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
        className="flex items-center gap-2"
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{document.title || 'Untitled'}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
