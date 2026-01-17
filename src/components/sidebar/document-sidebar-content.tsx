import { useNavigate, useParams } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { Home, Loader2, Plus } from 'lucide-react'
import * as Sentry from '@sentry/tanstackstart-react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { AccountMenu } from '../account-menu'
import { DocumentListItem } from './document-list-item'
import { useDocumentList } from '@/hooks/use-document-list'
import { Button } from '@/components/ui/button'
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
  const navigate = useNavigate({ from: '/doc/$docId' })
  const params = useParams({ strict: false })
  const currentDocId = params.docId
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useDocumentList({ numItems: 50 })

  const createDocument = useMutation(api.documents.create)

  const documents = data?.pages.flatMap((p) => p.page) || []

  const handleCreateDocument = async () => {
    try {
      await Sentry.startSpan(
        { name: 'DocumentSidebar.createDocument', op: 'ui.interaction' },
        async () => {
          const id = await createDocument({})
          navigate({ to: '/doc/$docId', params: { docId: id } })
        },
      )
    } catch (error) {
      Sentry.captureException(error)
      toast.error('Failed to create document. Please try again.')
      console.error('Error creating document:', error)
    }
  }

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border p-2">
        <div className="flex flex-col gap-1">
          <SidebarMenuButton
            onClick={handleCreateDocument}
            tooltip="New Document"
            className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            <span>New Document</span>
          </SidebarMenuButton>
          <SidebarMenuButton
            onClick={() => navigate({ to: '/' })}
            tooltip="Home"
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            <span>Home</span>
          </SidebarMenuButton>
        </div>
      </SidebarHeader>

      {!isCollapsed && (
        <SidebarContent className="flex flex-col">
          <SidebarGroup className="flex flex-1 flex-col">
            <SidebarGroupLabel>Documents</SidebarGroupLabel>
            <SidebarGroupContent className="flex flex-1 flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <SidebarMenu>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                      No documents yet
                    </div>
                  ) : (
                    <>
                      {documents.map((doc) => (
                        <DocumentListItem
                          key={doc._id}
                          document={doc}
                          isActive={doc._id === currentDocId}
                        />
                      ))}
                      {hasNextPage && (
                        <SidebarMenuItem>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                            className="w-full"
                          >
                            {isFetchingNextPage ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading...
                              </>
                            ) : (
                              'Load more'
                            )}
                          </Button>
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

      <SidebarFooter className="border-t border-sidebar-border">
        <AccountMenu />
      </SidebarFooter>
    </>
  )
}
