import { DAY_MS } from '@/lib/exams'

const now = new Date('2026-02-12T12:00:00.000Z').getTime()

function createDailyRetention(total: number, correct: number) {
  return Array.from({ length: 90 }, (_, index) => {
    const isRecent = index >= 83
    return {
      date: now - (89 - index) * DAY_MS,
      total: isRecent ? total : 0,
      correct: isRecent ? correct : 0,
      rate: isRecent && total > 0 ? 80 : null,
      rolling7: isRecent ? 82 : null,
      rolling30: isRecent ? 79 : null,
      rolling90: isRecent ? 77 : null,
    }
  })
}

function createHourlyPerformance(totalPerHour: number, rate: number | null) {
  return Array.from({ length: 24 }, (_, hourUtc) => ({
    hourUtc,
    total: totalPerHour,
    rate: totalPerHour > 0 ? rate : null,
  }))
}

function createForecast(count: number) {
  return Array.from({ length: 30 }, (_, index) => ({
    date: now + index * DAY_MS,
    count,
  }))
}

export const analyticsDashboardFixture = {
  retention: {
    daily: createDailyRetention(10, 8),
    byCardType: [
      {
        cardType: 'basic',
        total: 120,
        correct: 100,
        rate: 83.3,
      },
      {
        cardType: 'cloze',
        total: 90,
        correct: 70,
        rate: 77.8,
      },
    ],
    intervalBuckets: [
      { label: '0-1d', total: 30, correct: 20, rate: 66.7 },
      { label: '2-3d', total: 40, correct: 30, rate: 75 },
      { label: '4-7d', total: 50, correct: 42, rate: 84 },
      { label: '8-14d', total: 50, correct: 44, rate: 88 },
      { label: '15-30d', total: 20, correct: 16, rate: 80 },
      { label: '31-60d', total: 10, correct: 8, rate: 80 },
      { label: '61-120d', total: 5, correct: 4, rate: 80 },
      { label: '121d+', total: 2, correct: 1, rate: 50 },
    ],
    optimalInterval: {
      label: '8-14d',
      total: 50,
      correct: 44,
      rate: 88,
    },
  },
  difficulty: {
    buckets: [
      { label: '1-2', count: 5 },
      { label: '3-4', count: 9 },
      { label: '5-6', count: 6 },
      { label: '7-8', count: 4 },
      { label: '9-10', count: 1 },
    ],
    total: 25,
  },
  time: {
    avgTimePerCardMs: 22_000,
    totalStudyTimeMs: {
      daily: 18 * 60 * 1000,
      weekly: 2 * 60 * 60 * 1000,
      monthly: 9 * 60 * 60 * 1000,
    },
    hourlyPerformance: createHourlyPerformance(6, 82),
    peakHours: [
      { hourUtc: 14, total: 20, rate: 88 },
      { hourUtc: 15, total: 16, rate: 86 },
      { hourUtc: 20, total: 10, rate: 82 },
    ],
  },
  forecast: {
    duePerDay: createForecast(4),
    totalDueNext30: 120,
    averagePerDay: 4,
  },
  meta: {
    rangeDays: 90,
    rangeStart: now - 89 * DAY_MS,
    generatedAt: now,
    reviewLogsTruncated: false,
  },
}

export const analyticsEmptyDashboardFixture = {
  retention: {
    daily: createDailyRetention(0, 0),
    byCardType: [],
    intervalBuckets: [
      { label: '0-1d', total: 0, correct: 0, rate: null },
      { label: '2-3d', total: 0, correct: 0, rate: null },
      { label: '4-7d', total: 0, correct: 0, rate: null },
      { label: '8-14d', total: 0, correct: 0, rate: null },
      { label: '15-30d', total: 0, correct: 0, rate: null },
      { label: '31-60d', total: 0, correct: 0, rate: null },
      { label: '61-120d', total: 0, correct: 0, rate: null },
      { label: '121d+', total: 0, correct: 0, rate: null },
    ],
    optimalInterval: null,
  },
  difficulty: {
    buckets: [
      { label: '1-2', count: 0 },
      { label: '3-4', count: 0 },
      { label: '5-6', count: 0 },
      { label: '7-8', count: 0 },
      { label: '9-10', count: 0 },
    ],
    total: 0,
  },
  time: {
    avgTimePerCardMs: null,
    totalStudyTimeMs: {
      daily: 0,
      weekly: 0,
      monthly: 0,
    },
    hourlyPerformance: createHourlyPerformance(0, null),
    peakHours: [],
  },
  forecast: {
    duePerDay: createForecast(0),
    totalDueNext30: 0,
    averagePerDay: 0,
  },
  meta: {
    rangeDays: 90,
    rangeStart: now - 89 * DAY_MS,
    generatedAt: now,
    reviewLogsTruncated: false,
  },
}

export const difficultyBucketCardsFixture = {
  bucketLabel: '3-4',
  totalMatching: 1,
  cards: [
    {
      cardState: {
        _id: 'card_state_1',
        direction: 'forward',
        difficulty: 3.4,
        lapses: 1,
        due: now + DAY_MS,
      },
      block: {
        cardType: 'basic',
        cardFront: 'What is ATP?',
        cardBack: 'Cell energy molecule',
      },
      document: {
        _id: 'doc_1',
        title: 'Biology Notes',
      },
    },
  ],
}

export const emptyDifficultyBucketCardsFixture = {
  bucketLabel: '3-4',
  totalMatching: 0,
  cards: [],
}
