import { useMemo } from 'react'
import { localDayKey, todaysPlanSeed } from '../lib/brain-games'
import { resolveTrainingPlan, useBrainStore } from '../stores/brain-store'

export function useTrainingLineup() {
  const progress = useBrainStore((s) => s.progress)
  const draft = useBrainStore((s) => s.trainingDraft)
  const shuffle = useBrainStore((s) => s.shuffleTraining)
  const today = localDayKey()
  const seed = todaysPlanSeed(progress, today)
  const plan = useMemo(() => resolveTrainingPlan(progress, draft, seed), [progress, draft, seed])
  return { plan, progress, today, shuffle }
}
