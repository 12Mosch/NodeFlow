import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Cleanup stale presence records every 60 seconds
crons.interval(
  'cleanup stale presence',
  { seconds: 60 },
  internal.presence.cleanupStalePresence,
)

export default crons
