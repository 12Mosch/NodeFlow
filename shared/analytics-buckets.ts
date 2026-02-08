export const DIFFICULTY_BUCKETS = [
  { label: '1-2', min: 1, max: 2 },
  { label: '3-4', min: 3, max: 4 },
  { label: '5-6', min: 5, max: 6 },
  { label: '7-8', min: 7, max: 8 },
  { label: '9-10', min: 9, max: 10 },
] as const

export type DifficultyBucketLabel = (typeof DIFFICULTY_BUCKETS)[number]['label']

const difficultyBucketLabelSet: ReadonlySet<string> = new Set(
  DIFFICULTY_BUCKETS.map((bucket) => bucket.label),
)

export function isDifficultyBucketLabel(
  value: string,
): value is DifficultyBucketLabel {
  return difficultyBucketLabelSet.has(value)
}
