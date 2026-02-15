const now = new Date('2026-02-12T12:00:00.000Z').getTime()

export const documentFixture = {
  _id: 'doc_1',
  title: 'Biology Notes',
  _creationTime: now,
}

export const secondDocumentFixture = {
  _id: 'doc_2',
  title: 'Chemistry Review',
  _creationTime: now + 1,
}

export const flashcardsFixture = [
  {
    _id: 'block_1',
    documentId: 'doc_1',
    isCard: true,
    cardFront: 'What is ATP?',
    cardBack: 'Adenosine triphosphate',
  },
]

export const blocksFixture = [
  {
    _id: 'block_text_1',
    documentId: 'doc_1',
    textContent: 'Cellular respiration overview',
  },
]

export const documentListFixture = [documentFixture, secondDocumentFixture]

export function createDocumentPagesFixture() {
  return {
    pages: [
      {
        page: documentListFixture,
        continueCursor: null,
        isDone: true,
      },
    ],
    pageParams: [null],
  }
}

export function buildDocumentListResult({
  state,
}: {
  state: 'success' | 'loading' | 'error' | 'empty'
}) {
  const base = {
    fetchNextPage: () => Promise.resolve(undefined),
    hasNextPage: false,
    isFetchingNextPage: false,
  }

  if (state === 'loading') {
    return {
      ...base,
      isPending: true,
      isError: false,
      data: undefined,
    }
  }

  if (state === 'error') {
    return {
      ...base,
      isPending: false,
      isError: true,
      data: undefined,
    }
  }

  if (state === 'empty') {
    return {
      ...base,
      isPending: false,
      isError: false,
      data: {
        pages: [
          {
            page: [],
            continueCursor: null,
            isDone: true,
          },
        ],
        pageParams: [null],
      },
    }
  }

  return {
    ...base,
    isPending: false,
    isError: false,
    data: createDocumentPagesFixture(),
  }
}
