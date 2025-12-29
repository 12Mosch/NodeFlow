/**
 * FSRS-6 Algorithm Wrapper
 *
 * This module wraps the ts-fsrs package to provide a clean interface for
 * spaced repetition scheduling using the FSRS-6 algorithm.
 *
 * Key concepts:
 * - Retrievability (R): Probability of recalling info at a given time
 * - Stability (S): Time for R to drop to 90%
 * - Difficulty (D): Card complexity (1-10)
 *
 * Ratings:
 * - 1 (Again): Complete blackout, forgot the answer
 * - 2 (Hard): Significant difficulty recalling
 * - 3 (Good): Correct with some effort
 * - 4 (Easy): Perfect recall with no hesitation
 */

import {
  Rating,
  State,
  createEmptyCard,
  fsrs,
  generatorParameters,
} from 'ts-fsrs'
import type { Card, FSRSParameters, Grade, RecordLogItem } from 'ts-fsrs'

// FSRS-6 default parameters (21 values)
// Source: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
const FSRS_6_PARAMS: FSRSParameters = generatorParameters({
  w: [
    0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722,
    0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425,
    0.0912, 0.0658, 0.1542,
  ],
  // Target retention rate (90% is standard)
  request_retention: 0.9,
  // Maximum interval in days (about 2 years)
  maximum_interval: 730,
  // Enable FSRS-6 features
  enable_fuzz: true,
  enable_short_term: true,
})

// Create the FSRS scheduler instance
const scheduler = fsrs(FSRS_6_PARAMS)

/**
 * Card state as stored in the database
 */
export interface CardState {
  stability: number
  difficulty: number
  due: number // timestamp in ms
  lastReview: number | undefined
  reps: number
  lapses: number
  state: 'new' | 'learning' | 'review' | 'relearning'
  scheduledDays: number
  elapsedDays: number
}

/**
 * Review result after processing a rating
 */
export interface ReviewResult {
  card: CardState
  reviewLog: {
    rating: number
    state: 'new' | 'learning' | 'review' | 'relearning'
    scheduledDays: number
    elapsedDays: number
    stability: number
    difficulty: number
    reviewedAt: number
  }
}

/**
 * Maps our state string to ts-fsrs State enum
 */
function stateToFSRS(state: CardState['state']): State {
  switch (state) {
    case 'new':
      return State.New
    case 'learning':
      return State.Learning
    case 'review':
      return State.Review
    case 'relearning':
      return State.Relearning
  }
}

/**
 * Maps ts-fsrs State enum to our state string
 */
function fsrsToState(state: State): CardState['state'] {
  switch (state) {
    case State.New:
      return 'new'
    case State.Learning:
      return 'learning'
    case State.Review:
      return 'review'
    case State.Relearning:
      return 'relearning'
  }
}

/**
 * Maps rating number to ts-fsrs Rating enum
 */
function ratingToFSRS(rating: 1 | 2 | 3 | 4): Grade {
  switch (rating) {
    case 1:
      return Rating.Again
    case 2:
      return Rating.Hard
    case 3:
      return Rating.Good
    case 4:
      return Rating.Easy
  }
}

/**
 * Calculates the number of elapsed days between last review and now
 *
 * @param lastReviewDate - Date of last review (can be Date, timestamp, or null/undefined)
 * @param now - Current timestamp (defaults to now)
 * @returns Number of elapsed days, rounded to nearest integer
 */
function calculateElapsedDays(
  lastReviewDate: Date | number | null | undefined,
  now: Date = new Date(),
): number {
  if (!lastReviewDate) {
    return 0
  }

  const lastReview =
    lastReviewDate instanceof Date ? lastReviewDate : new Date(lastReviewDate)

  return Math.round(
    (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24),
  )
}

/**
 * Converts our CardState to ts-fsrs Card format
 *
 * @param cardState - Current card state
 * @param now - Current timestamp (defaults to now)
 */
function cardStateToFSRS(cardState: CardState, now: Date = new Date()): Card {
  // Calculate elapsed_days from dates (elapsed_days is deprecated but still required)
  const dueDate = new Date(cardState.due)
  const lastReviewDate = cardState.lastReview
    ? new Date(cardState.lastReview)
    : null

  // Calculate days between last review and now (or 0 if no last review)
  const elapsedDays = calculateElapsedDays(lastReviewDate, now)

  return {
    due: dueDate,
    stability: cardState.stability,
    difficulty: cardState.difficulty,
    elapsed_days: elapsedDays, // Deprecated but still required by library
    scheduled_days: cardState.scheduledDays,
    learning_steps: 0, // Learning step counter, managed by FSRS
    reps: cardState.reps,
    lapses: cardState.lapses,
    state: stateToFSRS(cardState.state),
    last_review: lastReviewDate || undefined,
  }
}

/**
 * Converts ts-fsrs Card to our CardState format
 *
 * @param card - ts-fsrs Card to convert
 * @param now - Current timestamp (defaults to now)
 */
function fsrsToCardState(card: Card, now: Date = new Date()): CardState {
  // Calculate elapsedDays from dates (elapsed_days is deprecated)
  const elapsedDays = calculateElapsedDays(card.last_review, now)

  return {
    stability: card.stability,
    difficulty: card.difficulty,
    due: card.due.getTime(),
    lastReview: card.last_review?.getTime(),
    reps: card.reps,
    lapses: card.lapses,
    state: fsrsToState(card.state),
    scheduledDays: card.scheduled_days,
    elapsedDays, // Calculated from dates instead of using deprecated field
  }
}

/**
 * Creates a new card state for a fresh flashcard
 */
export function createNewCardState(): CardState {
  const card = createEmptyCard()
  return fsrsToCardState(card)
}

/**
 * Process a review and return the updated card state
 *
 * @param cardState - Current card state
 * @param rating - User's rating (1=Again, 2=Hard, 3=Good, 4=Easy)
 * @param now - Current timestamp (defaults to now)
 * @returns Updated card state and review log
 */
export function processReview(
  cardState: CardState,
  rating: 1 | 2 | 3 | 4,
  now: Date = new Date(),
): ReviewResult {
  const card = cardStateToFSRS(cardState, now)
  const grade = ratingToFSRS(rating)

  // Get the scheduling result for this rating
  const result: RecordLogItem = scheduler.repeat(card, now)[grade]

  // Calculate elapsedDays from dates (elapsed_days is deprecated)
  const elapsedDays = calculateElapsedDays(cardState.lastReview, now)

  return {
    card: fsrsToCardState(result.card, now),
    reviewLog: {
      rating,
      state: cardState.state, // State before review
      scheduledDays: result.log.scheduled_days,
      elapsedDays, // Calculated from dates instead of using deprecated field
      stability: result.log.stability,
      difficulty: result.log.difficulty,
      reviewedAt: now.getTime(),
    },
  }
}

/**
 * Get the retrievability (probability of recall) for a card at a given time
 *
 * @param cardState - Current card state
 * @param now - Time to calculate retrievability for
 * @returns Retrievability as a number between 0 and 1
 */
export function getRetrievability(
  cardState: CardState,
  now: Date = new Date(),
): number {
  if (cardState.state === 'new') {
    return 0 // New cards have no retrievability
  }

  const card = cardStateToFSRS(cardState, now)
  const retrievability: number = scheduler.get_retrievability(
    card,
    now,
  ) as unknown as number
  return retrievability
}

/**
 * Preview the next review intervals for all possible ratings
 *
 * @param cardState - Current card state
 * @param now - Current timestamp
 * @returns Object with preview intervals for each rating
 */
export function previewIntervals(
  cardState: CardState,
  now: Date = new Date(),
): { again: number; hard: number; good: number; easy: number } {
  const card = cardStateToFSRS(cardState, now)
  const results = scheduler.repeat(card, now)

  return {
    again: results[Rating.Again].card.scheduled_days,
    hard: results[Rating.Hard].card.scheduled_days,
    good: results[Rating.Good].card.scheduled_days,
    easy: results[Rating.Easy].card.scheduled_days,
  }
}

/**
 * Check if a card is due for review
 *
 * @param cardState - Card state to check
 * @param now - Current timestamp (defaults to now)
 * @returns true if the card is due for review
 */
export function isDue(cardState: CardState, now: Date = new Date()): boolean {
  return cardState.due <= now.getTime()
}

/**
 * Get a human-readable interval string
 *
 * @param days - Number of days
 * @returns Human-readable string like "1d", "2w", "3mo"
 */
export function formatInterval(days: number): string {
  if (days < 1) {
    const minutes = Math.round(days * 24 * 60)
    if (minutes < 60) {
      return `${minutes}m`
    }
    const hours = Math.round(minutes / 60)
    return `${hours}h`
  }
  if (days < 7) {
    return `${Math.round(days)}d`
  }
  if (days < 30) {
    const weeks = Math.round(days / 7)
    return `${weeks}w`
  }
  if (days < 365) {
    const months = Math.round(days / 30)
    return `${months}mo`
  }
  const years = Math.round((days / 365) * 10) / 10
  return `${years}y`
}

// Export Rating for use in components
export { Rating }
