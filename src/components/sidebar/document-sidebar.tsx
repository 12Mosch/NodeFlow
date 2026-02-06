'use client'

import { DocumentSidebarContent } from './document-sidebar-content'
import { useSidebarState } from '@/hooks/use-sidebar-state'
import { Sidebar, SidebarProvider, SidebarRail } from '@/components/ui/sidebar'

interface DocumentSidebarProps {
  children: React.ReactNode
}

export function DocumentSidebar({ children }: DocumentSidebarProps) {
  const { isOpen, setOpen, isHydrated } = useSidebarState(false)

  // Always render SidebarProvider to ensure context is available for SidebarTrigger
  // Only render the actual Sidebar after hydration to avoid hydration mismatch
  return (
    <SidebarProvider open={isOpen} onOpenChange={setOpen}>
      {isHydrated && (
        <Sidebar
          collapsible="icon"
          className="border-r border-sidebar-border/80 bg-sidebar/95"
        >
          <DocumentSidebarContent />
          <SidebarRail />
        </Sidebar>
      )}
      {children}
    </SidebarProvider>
  )
}
