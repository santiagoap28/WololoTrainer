import { civilizations } from '../civilizations/civilizationsData.js'

const CIVILIZATION_TRAINER_STATS_STORAGE_KEY = 'wololo_civilization_trainer_stats_v1'

function hasBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function toSafeNonNegativeInteger(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0
  }

  return Math.floor(numericValue)
}

function normalizeCounter(counter) {
  const total = toSafeNonNegativeInteger(counter?.total)
  const correct = Math.min(total, toSafeNonNegativeInteger(counter?.correct))
  return { total, correct }
}

function createDefaultCounters(items, keySelector = (item) => item.id) {
  return Object.fromEntries(items.map((item) => [keySelector(item), { total: 0, correct: 0 }]))
}

function createDefaultCivilizationTrainerStats() {
  return {
    civs: createDefaultCounters(civilizations),
  }
}

export function readCivilizationTrainerStats() {
  const defaults = createDefaultCivilizationTrainerStats()

  if (!hasBrowserStorage()) {
    return defaults
  }

  try {
    const rawValue = window.localStorage.getItem(CIVILIZATION_TRAINER_STATS_STORAGE_KEY)
    if (!rawValue) {
      return defaults
    }

    const parsedValue = JSON.parse(rawValue)
    return {
      civs: {
        ...defaults.civs,
        ...Object.fromEntries(
          Object.entries(parsedValue?.civs ?? {}).map(([id, counter]) => [id, normalizeCounter(counter)]),
        ),
      },
    }
  } catch {
    return defaults
  }
}

export function writeCivilizationTrainerStats(nextStats) {
  if (!hasBrowserStorage()) {
    return
  }

  window.localStorage.setItem(CIVILIZATION_TRAINER_STATS_STORAGE_KEY, JSON.stringify(nextStats))
}

export function recordCivilizationTrainerResult(civilizationId, correctAnswers, totalAnswers) {
  if (!civilizationId) {
    return
  }

  const safeCorrectAnswers = toSafeNonNegativeInteger(correctAnswers)
  const safeTotalAnswers = Math.max(safeCorrectAnswers, toSafeNonNegativeInteger(totalAnswers))
  if (safeTotalAnswers <= 0) {
    return
  }

  const nextStats = readCivilizationTrainerStats()
  const currentCounter = normalizeCounter(nextStats.civs[civilizationId])
  nextStats.civs[civilizationId] = {
    total: currentCounter.total + safeTotalAnswers,
    correct: currentCounter.correct + safeCorrectAnswers,
  }

  writeCivilizationTrainerStats(nextStats)
}

export const trackedCivilizationTrainerCivilizations = civilizations.map(({ id, name, icon }) => ({
  id,
  name,
  icon,
}))

export function getCounterPercent(counter) {
  const safeCounter = normalizeCounter(counter)
  if (safeCounter.total === 0) {
    return 0
  }

  return Math.round((safeCounter.correct / safeCounter.total) * 100)
}
