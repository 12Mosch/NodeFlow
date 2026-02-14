import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { format } from 'date-fns'
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  Calendar as CalendarIcon,
  Clock3,
  MoreHorizontal,
  Pencil,
  Trash2,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ModeToggle } from '@/components/mode-toggle'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentList } from '@/hooks/use-document-list'
import {
  DOCUMENT_HEADER_INDICATOR_QUERY_PREFIX,
  LIST_DOCUMENT_INDICATORS_QUERY_PREFIX,
} from '@/lib/exam-query-keys'
import { formatExamCountdown, formatExamDateTime } from '@/lib/exams'
import { cn } from '@/lib/utils'

type ExamsTab = 'active' | 'past' | 'archived'

type EditorState = {
  title: string
  examDate: Date | undefined
  examTime: string
  notes: string
  documentIds: Set<Id<'documents'>>
}

const ALL_EXAMS_QUERY = convexQuery(api.exams.list, {
  includeArchived: true,
  includePast: true,
})
const STUDY_OVERVIEW_TOTALS_QUERY = convexQuery(
  api.exams.getStudyOverviewTotals,
  {},
)
const EXAM_EDITOR_DOCUMENTS_PER_PAGE = 50

function createEmptyEditorState(): EditorState {
  return {
    title: '',
    examDate: undefined,
    examTime: '',
    notes: '',
    documentIds: new Set(),
  }
}

function toEditorDateTimeValue(timestamp: number) {
  const date = new Date(timestamp)
  const examDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return {
    examDate,
    examTime: `${hours}:${minutes}`,
  }
}

function fromEditorDateTimeValue(examDate: Date | undefined, examTime: string) {
  if (!examDate) return null
  const match = /^(\d{2}):(\d{2})$/.exec(examTime)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }

  const timestamp = new Date(
    examDate.getFullYear(),
    examDate.getMonth(),
    examDate.getDate(),
    hours,
    minutes,
    0,
    0,
  ).getTime()

  return Number.isNaN(timestamp) ? null : timestamp
}

export const Route = createFileRoute('/exams')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(ALL_EXAMS_QUERY)
  },
  component: ExamsPage,
})

function ExamsPage() {
  const router = useRouter()
  const handleBackNavigation = () => {
    try {
      if (router.history.length > 1) {
        router.history.back()
        return
      }
    } catch {
      // Fall through to root navigation when history access fails.
    }
    void router.navigate({ to: '/' })
  }
  const queryClient = useQueryClient()
  const { data: exams } = useSuspenseQuery(ALL_EXAMS_QUERY)
  type ExamListItem = (typeof exams)[number]

  const [tab, setTab] = useState<ExamsTab>('active')
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isExamDatePopoverOpen, setIsExamDatePopoverOpen] = useState(false)
  const [editingExamId, setEditingExamId] = useState<Id<'exams'> | null>(null)
  const [editorState, setEditorState] = useState<EditorState>(
    createEmptyEditorState(),
  )
  const [isSaving, setIsSaving] = useState(false)
  const isSavingRef = useRef(false)
  const [busyExamId, setBusyExamId] = useState<Id<'exams'> | null>(null)
  const [examToDelete, setExamToDelete] = useState<Id<'exams'> | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  const documentsQuery = useDocumentList({
    numItems: EXAM_EDITOR_DOCUMENTS_PER_PAGE,
    enabled: isEditorOpen,
  })
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = documentsQuery

  const documents = useMemo(
    () => documentsQuery.data?.pages.flatMap((page) => page.page) ?? [],
    [documentsQuery.data],
  )
  const isLoadingInitialDocuments =
    documentsQuery.isPending && documents.length === 0
  const normalizeNotesForCreate = (notes: string | undefined) => {
    if (notes === undefined) return undefined
    const trimmed = notes.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  const normalizeNotesForUpdate = (notes: string | undefined) => {
    if (notes === undefined) return undefined
    const trimmed = notes.trim()
    return trimmed.length > 0 ? trimmed : ''
  }
  const sortExamsByExamAt = (items: Array<ExamListItem>) =>
    [...items].sort((a, b) => a.examAt - b.examAt)
  const setAllExamsCache = (
    updater: (current: Array<ExamListItem>) => Array<ExamListItem>,
  ) => {
    queryClient.setQueryData<Array<ExamListItem>>(
      ALL_EXAMS_QUERY.queryKey,
      (current) => updater(current ?? []),
    )
  }
  const createExam = useMutation(api.exams.create).withOptimisticUpdate(
    (_localStore, args) => {
      const now = Date.now()
      const dedupedDocumentIds = Array.from(new Set(args.documentIds))
      const optimisticExam: ExamListItem = {
        _id: `optimistic-exam-${now}-${Math.random().toString(36).slice(2)}` as Id<'exams'>,
        _creationTime: now,
        userId: '__optimistic-user__' as Id<'users'>,
        title: args.title.trim(),
        examAt: args.examAt,
        notes: normalizeNotesForCreate(args.notes),
        archivedAt: undefined,
        createdAt: now,
        updatedAt: now,
        documentIds: dedupedDocumentIds,
        linkedDocumentCount: dedupedDocumentIds.length,
      }
      setAllExamsCache((current) =>
        sortExamsByExamAt([...current, optimisticExam]),
      )
    },
  )
  const updateExam = useMutation(api.exams.update).withOptimisticUpdate(
    (_localStore, args) => {
      const now = Date.now()
      const dedupedDocumentIds =
        args.documentIds === undefined
          ? undefined
          : Array.from(new Set(args.documentIds))
      setAllExamsCache((current) =>
        sortExamsByExamAt(
          current.map((exam) =>
            exam._id === args.examId
              ? {
                  ...exam,
                  title:
                    args.title === undefined ? exam.title : args.title.trim(),
                  examAt: args.examAt ?? exam.examAt,
                  notes:
                    args.notes === undefined
                      ? exam.notes
                      : normalizeNotesForUpdate(args.notes),
                  documentIds: dedupedDocumentIds ?? exam.documentIds,
                  linkedDocumentCount:
                    dedupedDocumentIds === undefined
                      ? exam.linkedDocumentCount
                      : dedupedDocumentIds.length,
                  updatedAt: now,
                }
              : exam,
          ),
        ),
      )
    },
  )
  const archiveExam = useMutation(api.exams.archive).withOptimisticUpdate(
    (_localStore, args) => {
      const now = Date.now()
      setAllExamsCache((current) =>
        current.map((exam) =>
          exam._id === args.examId
            ? {
                ...exam,
                archivedAt: now,
                updatedAt: now,
              }
            : exam,
        ),
      )
    },
  )
  const unarchiveExam = useMutation(api.exams.unarchive).withOptimisticUpdate(
    (_localStore, args) => {
      const now = Date.now()
      setAllExamsCache((current) =>
        current.map((exam) =>
          exam._id === args.examId
            ? {
                ...exam,
                archivedAt: undefined,
                updatedAt: now,
              }
            : exam,
        ),
      )
    },
  )
  const removeExam = useMutation(api.exams.remove).withOptimisticUpdate(
    (_localStore, args) => {
      setAllExamsCache((current) =>
        current.filter((exam) => exam._id !== args.examId),
      )
    },
  )
  const { activeExams, pastExams, archivedExams } = useMemo(() => {
    const active: Array<(typeof exams)[number]> = []
    const past: Array<(typeof exams)[number]> = []
    const archived: Array<(typeof exams)[number]> = []

    for (const exam of exams) {
      if (exam.archivedAt !== undefined) {
        archived.push(exam)
      } else if (exam.examAt > nowMs) {
        active.push(exam)
      } else {
        past.push(exam)
      }
    }

    return {
      activeExams: active,
      pastExams: past,
      archivedExams: archived,
    }
  }, [exams, nowMs])
  const editingExam =
    editingExamId !== null
      ? (exams.find((exam) => exam._id === editingExamId) ?? null)
      : null

  const invalidateExamQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ALL_EXAMS_QUERY.queryKey }),
      queryClient.invalidateQueries({
        queryKey: STUDY_OVERVIEW_TOTALS_QUERY.queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: LIST_DOCUMENT_INDICATORS_QUERY_PREFIX,
      }),
      queryClient.invalidateQueries({
        queryKey: DOCUMENT_HEADER_INDICATOR_QUERY_PREFIX,
      }),
    ])
  }

  const openCreateEditor = () => {
    setEditingExamId(null)
    setEditorState(createEmptyEditorState())
    setIsExamDatePopoverOpen(false)
    setIsEditorOpen(true)
  }

  const openEditEditor = (exam: (typeof exams)[number]) => {
    const { examDate, examTime } = toEditorDateTimeValue(exam.examAt)
    setEditingExamId(exam._id)
    setEditorState({
      title: exam.title,
      examDate,
      examTime,
      notes: exam.notes ?? '',
      documentIds: new Set(exam.documentIds),
    })
    setIsExamDatePopoverOpen(false)
    setIsEditorOpen(true)
  }

  const handleToggleDocument = (documentId: Id<'documents'>) => {
    setEditorState((prev) => {
      const nextDocumentIds = new Set(prev.documentIds)
      if (nextDocumentIds.has(documentId)) {
        nextDocumentIds.delete(documentId)
      } else {
        nextDocumentIds.add(documentId)
      }
      return { ...prev, documentIds: nextDocumentIds }
    })
  }
  const handleLoadMoreDocuments = () => {
    if (!hasNextPage || isFetchingNextPage) return
    void fetchNextPage()
  }

  const handleSaveEditor = async () => {
    if (isSavingRef.current) return
    isSavingRef.current = true
    setIsSaving(true)

    let previousExams: Array<ExamListItem> | undefined
    try {
      const title = editorState.title.trim()
      if (!title) {
        toast.error('Exam title is required.')
        return
      }
      const examAt = fromEditorDateTimeValue(
        editorState.examDate,
        editorState.examTime,
      )
      if (examAt === null) {
        toast.error('Please select a valid exam date and time.')
        return
      }
      previousExams = queryClient.getQueryData<Array<ExamListItem>>(
        ALL_EXAMS_QUERY.queryKey,
      )
      if (editingExam) {
        await updateExam({
          examId: editingExam._id,
          title,
          examAt,
          notes: editorState.notes,
          documentIds: Array.from(editorState.documentIds),
        })
        toast.success('Exam updated.')
      } else {
        await createExam({
          title,
          examAt,
          notes: editorState.notes,
          documentIds: Array.from(editorState.documentIds),
        })
        toast.success('Exam created.')
      }
      setIsEditorOpen(false)
      setEditingExamId(null)
      setEditorState(createEmptyEditorState())
      await invalidateExamQueries()
    } catch (error) {
      if (previousExams !== undefined) {
        queryClient.setQueryData(ALL_EXAMS_QUERY.queryKey, previousExams)
      }
      console.error('Failed to save exam:', error)
      toast.error('Failed to save exam.')
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }

  const handleToggleArchive = async (exam: (typeof exams)[number]) => {
    const previousExams = queryClient.getQueryData<Array<ExamListItem>>(
      ALL_EXAMS_QUERY.queryKey,
    )
    setBusyExamId(exam._id)
    try {
      if (exam.archivedAt !== undefined) {
        await unarchiveExam({ examId: exam._id })
        toast.success('Exam restored.')
      } else {
        await archiveExam({ examId: exam._id })
        toast.success('Exam archived.')
      }
      await invalidateExamQueries()
    } catch (error) {
      queryClient.setQueryData(ALL_EXAMS_QUERY.queryKey, previousExams)
      console.error('Failed to archive exam:', error)
      toast.error('Failed to update exam archive status.')
    } finally {
      setBusyExamId(null)
    }
  }

  const handleDelete = async () => {
    if (!examToDelete) return
    const previousExams = queryClient.getQueryData<Array<ExamListItem>>(
      ALL_EXAMS_QUERY.queryKey,
    )
    setBusyExamId(examToDelete)
    try {
      await removeExam({ examId: examToDelete })
      toast.success('Exam deleted.')
      setExamToDelete(null)
      await invalidateExamQueries()
    } catch (error) {
      queryClient.setQueryData(ALL_EXAMS_QUERY.queryKey, previousExams)
      console.error('Failed to delete exam:', error)
      toast.error('Failed to delete exam.')
    } finally {
      setBusyExamId(null)
    }
  }

  const renderExamList = (items: typeof exams) => {
    if (items.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-border/70 bg-card/30 px-4 py-10 text-center text-sm text-muted-foreground">
          No exams in this section.
        </div>
      )
    }
    return (
      <div className="space-y-2">
        {items.map((exam) => {
          const daysUntil = formatExamCountdown(exam.examAt, nowMs)
          return (
            <div
              key={exam._id}
              className="grid gap-3 rounded-xl border border-border/70 bg-card/70 px-4 py-3 shadow-xs md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_96px_auto] md:items-center"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {exam.title}
                </p>
                {exam.notes && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {exam.notes}
                  </p>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatExamDateTime(exam.examAt)}
              </div>
              <div className="text-sm text-muted-foreground">
                {daysUntil ?? '—'}
              </div>
              <div className="text-sm text-muted-foreground">
                {exam.linkedDocumentCount}
              </div>
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" />}
                    disabled={busyExamId === exam._id}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Exam actions</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => openEditEditor(exam)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleArchive(exam)}>
                      {exam.archivedAt !== undefined ? (
                        <>
                          <Undo2 className="h-4 w-4" />
                          Unarchive
                        </>
                      ) : (
                        <>
                          <Archive className="h-4 w-4" />
                          Archive
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setExamToDelete(exam._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
      <header className="sticky top-0 z-50 -mx-4 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={handleBackNavigation}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="hidden h-4 w-px bg-border sm:block" />
            <div className="flex min-w-0 items-center gap-2">
              <CalendarDays className="h-5 w-5 shrink-0 text-muted-foreground" />
              <h1 className="truncate text-base font-semibold sm:text-lg">
                Exams
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Button size="sm" onClick={openCreateEditor}>
              New Exam
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 py-6 sm:py-8">
        <Tabs value={tab} onValueChange={(value) => setTab(value as ExamsTab)}>
          <TabsList>
            <TabsTrigger value="active">
              Active ({activeExams.length})
            </TabsTrigger>
            <TabsTrigger value="past">Past ({pastExams.length})</TabsTrigger>
            <TabsTrigger value="archived">
              Archived ({archivedExams.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-4">
            {renderExamList(activeExams)}
          </TabsContent>
          <TabsContent value="past" className="mt-4">
            {renderExamList(pastExams)}
          </TabsContent>
          <TabsContent value="archived" className="mt-4">
            {renderExamList(archivedExams)}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader className="gap-1 pr-10 pb-1">
            <DialogTitle className="text-base leading-6">
              {editingExam ? 'Edit exam' : 'Create exam'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="exam-title" className="text-sm font-medium">
                Title
              </label>
              <Input
                id="exam-title"
                value={editorState.title}
                onChange={(event) =>
                  setEditorState((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
                placeholder="Biology Midterm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="exam-at-date" className="text-sm font-medium">
                Exam date and time
              </label>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
                <Popover
                  open={isExamDatePopoverOpen}
                  onOpenChange={setIsExamDatePopoverOpen}
                >
                  <PopoverTrigger
                    render={
                      <Button
                        id="exam-at-date"
                        type="button"
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !editorState.examDate && 'text-muted-foreground',
                        )}
                      />
                    }
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {editorState.examDate
                      ? format(editorState.examDate, 'PPP')
                      : 'Pick a date'}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown"
                      navLayout="around"
                      selected={editorState.examDate}
                      onSelect={(selectedDate) => {
                        setEditorState((prev) => ({
                          ...prev,
                          examDate: selectedDate
                            ? new Date(
                                selectedDate.getFullYear(),
                                selectedDate.getMonth(),
                                selectedDate.getDate(),
                              )
                            : undefined,
                        }))
                        setIsExamDatePopoverOpen(false)
                      }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
                <div className="relative">
                  <label htmlFor="exam-at-time" className="sr-only">
                    Exam time
                  </label>
                  <Input
                    id="exam-at-time"
                    type="time"
                    step="60"
                    value={editorState.examTime}
                    onChange={(event) =>
                      setEditorState((prev) => ({
                        ...prev,
                        examTime: event.target.value,
                      }))
                    }
                    className="pr-9"
                  />
                  <Clock3 className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="exam-notes" className="text-sm font-medium">
                Notes
              </label>
              <textarea
                id="exam-notes"
                value={editorState.notes}
                onChange={(event) =>
                  setEditorState((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                placeholder="Optional context"
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Linked documents</p>
              {documentsQuery.isError ? (
                <p className="text-sm text-destructive">
                  Failed to load documents.
                </p>
              ) : isLoadingInitialDocuments ? (
                <p className="text-sm text-muted-foreground">
                  Loading documents...
                </p>
              ) : documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No documents available yet.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border/70 p-3">
                    {documents.map((document) => (
                      <label
                        key={document._id}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={editorState.documentIds.has(document._id)}
                          onCheckedChange={() =>
                            handleToggleDocument(document._id)
                          }
                        />
                        <span className="truncate">
                          {document.title || 'Untitled'}
                        </span>
                      </label>
                    ))}
                  </div>
                  {(hasNextPage || isFetchingNextPage) && (
                    <div className="flex items-center gap-3">
                      {hasNextPage && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleLoadMoreDocuments}
                          disabled={isFetchingNextPage}
                        >
                          Load more
                        </Button>
                      )}
                      {isFetchingNextPage && (
                        <p className="text-sm text-muted-foreground">
                          Loading more...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-border/60 pt-4">
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEditor} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingExam ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={examToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setExamToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete exam?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the exam and all document links.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
