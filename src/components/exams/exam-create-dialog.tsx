import { useEffect, useState } from 'react'
import { useConvex, useMutation } from 'convex/react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { toast } from 'sonner'
import { CalendarDays, Loader2 } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { ExamDocumentSelector } from './exam-document-selector'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DOCUMENTS_PER_PAGE = 50

type DocumentPage = {
  page: Array<Doc<'documents'>>
  continueCursor: string | null
  isDone: boolean
}

// Predefined color options
const EXAM_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Yellow', value: '#eab308' },
]

interface ExamCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingExamId?: Id<'exams'> | null
  onSuccess?: () => void
}

export function ExamCreateDialog({
  open,
  onOpenChange,
  editingExamId,
  onSuccess,
}: ExamCreateDialogProps) {
  const [title, setTitle] = useState('')
  const [examDate, setExamDate] = useState('')
  const [selectedColor, setSelectedColor] = useState<string | undefined>()
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<
    Array<Id<'documents'>>
  >([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createExam = useMutation(api.exams.create)
  const updateExam = useMutation(api.exams.update)
  const setDocuments = useMutation(api.exams.setDocuments)
  const convex = useConvex()

  // Fetch documents for selector with pagination
  const {
    data: documentsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['documents', 'list', 'exam-selector', DOCUMENTS_PER_PAGE],
    queryFn: async ({ pageParam }) => {
      return await convex.query(api.documents.list, {
        paginationOpts: {
          numItems: DOCUMENTS_PER_PAGE,
          cursor: pageParam,
        },
      })
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: DocumentPage) =>
      lastPage.isDone ? null : lastPage.continueCursor,
    enabled: open,
  })

  // Fetch existing exam data if editing
  const { data: existingExam } = useQuery({
    ...convexQuery(
      api.exams.get,
      editingExamId ? { examId: editingExamId } : 'skip',
    ),
    enabled: !!editingExamId,
  })

  const documents = documentsData?.pages.flatMap((page) => page.page) ?? []

  // Populate form when editing
  useEffect(() => {
    if (editingExamId && existingExam) {
      setTitle(existingExam.title)
      setExamDate(formatDateForInput(existingExam.examDate))
      setSelectedColor(existingExam.color ?? undefined)
      setSelectedDocumentIds(existingExam.documents.map((d) => d._id))
    } else if (!editingExamId) {
      // Reset form for new exam
      setTitle('')
      setExamDate('')
      setSelectedColor(undefined)
      setSelectedDocumentIds([])
    }
  }, [editingExamId, existingExam, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error('Please enter an exam title')
      return
    }

    if (!examDate) {
      toast.error('Please select an exam date')
      return
    }

    const examDateMs = new Date(examDate).getTime()
    if (examDateMs <= Date.now()) {
      toast.error('Exam date must be in the future')
      return
    }

    setIsSubmitting(true)

    try {
      if (editingExamId) {
        const previousExam = await convex.query(api.exams.get, {
          examId: editingExamId,
        })
        if (!previousExam) {
          throw new Error('Exam not found. Please refresh and try again.')
        }
        const previousDocumentIds = previousExam.documents.map((doc) => doc._id)

        // Update existing exam
        await updateExam({
          examId: editingExamId,
          title: title.trim(),
          examDate: examDateMs,
          color: selectedColor,
        })

        try {
          await setDocuments({
            examId: editingExamId,
            documentIds: selectedDocumentIds,
          })
        } catch (setDocumentsError) {
          try {
            await updateExam({
              examId: editingExamId,
              title: previousExam.title,
              examDate: previousExam.examDate,
              color: previousExam.color,
            })
            await setDocuments({
              examId: editingExamId,
              documentIds: previousDocumentIds,
            })
          } catch (rollbackError) {
            console.error(
              'Failed to rollback exam after document update error:',
              {
                setDocumentsError,
                rollbackError,
              },
            )
            throw new Error(
              'Failed to update exam documents, and rollback also failed. Please refresh and check your exam.',
            )
          }

          throw new Error(
            'Failed to update exam documents. Changes were reverted.',
          )
        }

        toast.success('Exam updated')
      } else {
        // Create new exam
        await createExam({
          title: title.trim(),
          examDate: examDateMs,
          color: selectedColor,
          documentIds: selectedDocumentIds,
        })

        toast.success('Exam created')
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error saving exam:', error)
      toast.error(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>
              {editingExamId ? 'Edit Exam' : 'Create New Exam'}
            </DialogTitle>
            <DialogDescription>
              {editingExamId
                ? 'Update your exam details and linked documents.'
                : 'Set up an exam to prioritize flashcard review. Cards from linked documents will appear first in your study queue.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="title">Exam Title</Label>
              <Input
                id="title"
                placeholder="e.g., Biology Final, History Midterm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="examDate">Exam Date</Label>
              <div className="relative">
                <CalendarDays className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="examDate"
                  type="datetime-local"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="pl-8"
                  min={formatDateForInput(Date.now())}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {EXAM_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      selectedColor === color.value
                        ? 'border-foreground ring-2 ring-ring ring-offset-2'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() =>
                      setSelectedColor(
                        selectedColor === color.value ? undefined : color.value,
                      )
                    }
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Link Documents</Label>
              <ExamDocumentSelector
                documents={documents}
                selectedIds={selectedDocumentIds}
                onSelectionChange={setSelectedDocumentIds}
                hasMore={hasNextPage}
                isFetchingMore={isFetchingNextPage}
                onLoadMore={fetchNextPage}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingExamId ? 'Save Changes' : 'Create Exam'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formatDateForInput(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Failed to save exam'
}
