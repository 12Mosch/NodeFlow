import { useNavigate, useParams, useRouterState } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Home,
  Loader2,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { AccountMenu } from '../account-menu'
import { DocumentListItem } from './document-list-item'
import { useDocumentExamIndicators } from '@/hooks/use-document-exam-indicators'
import { useDocumentList } from '@/hooks/use-document-list'
import { useIntersectionObserver } from '@/hooks/use-intersection-observer'
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { ScrollArea } from '@/components/ui/scroll-area'

export function DocumentSidebarContent() {
  const navigate = useNavigate()
  const params = useParams({ strict: false })
  const currentDocId = params.docId
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useDocumentList({ numItems: 50 })
  const createDocument = useMutation(api.documents.create)
  const topNavButtonClass = 'flex items-center gap-2'
  const isHomeActive = pathname === '/'
  const isAnalyticsActive = pathname.startsWith('/analytics')
  const isExamsActive = pathname.startsWith('/exams')
  const isLeechCardsActive = pathname.startsWith('/study-leeches')
  const documents = data?.pages.flatMap((p) => p.page) || []
  const { documentExamIndicatorById } = useDocumentExamIndicators(data?.pages)
  const sentinelRef = useIntersectionObserver({
    onIntersect: () => fetchNextPage(),
    enabled: !isCollapsed && hasNextPage && !isFetchingNextPage,
  })
  const handleCreateDocument = async () => {
    try {
      await (async () => {
        const id = await createDocument({})
        navigate({ to: '/doc/$docId', params: { docId: id } })
      })()
    } catch (error) {
      toast.error('Failed to create document. Please try again.')
      console.error('Error creating document:', error)
    }
  }
  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border/80 px-2.5 py-2">
        <div className="flex flex-col gap-1.5">
          <SidebarMenuButton
            onClick={handleCreateDocument}
            tooltip="New Document"
            className="h-9 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            <span>New Document</span>
          </SidebarMenuButton>
          <SidebarMenuButton
            onClick={() => navigate({ to: '/' })}
            tooltip="Home"
            isActive={isHomeActive}
            className={topNavButtonClass}
          >
            <Home className="h-4 w-4" />
            <span>Home</span>
          </SidebarMenuButton>
          <SidebarMenuButton
            onClick={() => navigate({ to: '/analytics' })}
            tooltip="Analytics"
            isActive={isAnalyticsActive}
            className={topNavButtonClass}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
          </SidebarMenuButton>
          <SidebarMenuButton
            onClick={() => navigate({ to: '/exams' })}
            tooltip="Exams"
            isActive={isExamsActive}
            className={topNavButtonClass}
          >
            <CalendarDays className="h-4 w-4" />
            <span>Exams</span>
          </SidebarMenuButton>
          <SidebarMenuButton
            onClick={() => navigate({ to: '/study-leeches' })}
            tooltip="Leech Cards"
            isActive={isLeechCardsActive}
            className={topNavButtonClass}
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Leech Cards</span>
          </SidebarMenuButton>
        </div>
      </SidebarHeader>

      {!isCollapsed && (
        <SidebarContent className="flex flex-col pt-1">
          <SidebarGroup className="flex flex-1 flex-col gap-2 p-2">
            <SidebarGroupLabel className="nf-meta-label h-auto px-2 py-1 text-sidebar-foreground/65">
              Documents
            </SidebarGroupLabel>
            <SidebarGroupContent className="flex flex-1 flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <SidebarMenu className="gap-1.5">
                  {isLoading ? (
                    <div className="flex items-center justify-center rounded-lg border border-sidebar-border/60 bg-sidebar-accent/20 py-8 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-sidebar-border/80 bg-sidebar-accent/10 px-2 py-8 text-center text-sm text-muted-foreground">
                      No documents yet
                    </div>
                  ) : (
                    <>
                      {documents.map((doc) => (
                        <DocumentListItem
                          key={doc._id}
                          document={doc}
                          isActive={doc._id === currentDocId}
                          examIndicator={documentExamIndicatorById.get(doc._id)}
                        />
                      ))}
                      {(hasNextPage || isFetchingNextPage) && (
                        <SidebarMenuItem>
                          {hasNextPage && (
                            <div ref={sentinelRef} className="h-1" />
                          )}
                          {isFetchingNextPage && (
                            <div className="flex items-center justify-center py-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          )}
                        </SidebarMenuItem>
                      )}
                    </>
                  )}
                </SidebarMenu>
              </ScrollArea>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      )}

      <SidebarFooter className="border-t border-sidebar-border/80 p-2">
        <AccountMenu />
      </SidebarFooter>
    </>
  )
}
