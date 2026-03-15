import { civilizations, techTreeTrainerOptions } from '../civilizations/civilizationsData.js'

const TRAINER_STATS_STORAGE_KEY = 'wololo_tech_tree_trainer_stats_v1'

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

function createDefaultTrainerStats() {
  return {
    civs: createDefaultCounters(civilizations),
    techs: createDefaultCounters(techTreeTrainerOptions, (option) => option.key),
  }
}

export function readTrainerStats() {
  const defaults = createDefaultTrainerStats()

  if (!hasBrowserStorage()) {
    return defaults
  }

  try {
    const rawValue = window.localStorage.getItem(TRAINER_STATS_STORAGE_KEY)
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
      techs: {
        ...defaults.techs,
        ...Object.fromEntries(
          Object.entries(parsedValue?.techs ?? {}).map(([id, counter]) => [id, normalizeCounter(counter)]),
        ),
      },
    }
  } catch {
    return defaults
  }
}

export function writeTrainerStats(nextStats) {
  if (!hasBrowserStorage()) {
    return
  }

  window.localStorage.setItem(TRAINER_STATS_STORAGE_KEY, JSON.stringify(nextStats))
}

function bumpCounter(counter, isCorrect) {
  const nextCounter = {
    total: toSafeNonNegativeInteger(counter?.total) + 1,
    correct: toSafeNonNegativeInteger(counter?.correct),
  }

  if (isCorrect) {
    nextCounter.correct += 1
  }

  return nextCounter
}

export function recordTrainerQuestionResult(question, isCorrect) {
  if (!question) {
    return
  }

  const nextStats = readTrainerStats()
  const correctCivIds = [...new Set(question.correctCivIds ?? [])]
  const questionTechKeys = [...new Set((question.options ?? []).map((option) => option.key).filter(Boolean))]

  correctCivIds.forEach((civId) => {
    nextStats.civs[civId] = bumpCounter(nextStats.civs[civId], isCorrect)
  })

  questionTechKeys.forEach((techKey) => {
    nextStats.techs[techKey] = bumpCounter(nextStats.techs[techKey], isCorrect)
  })

  writeTrainerStats(nextStats)
}

export const trackedCivilizations = civilizations.map(({ id, name, icon }) => ({
  id,
  name,
  icon,
}))

export const trackedTechOptions = techTreeTrainerOptions
  .map(({ key, label, icon, groupLabel }) => ({
    id: key,
    name: label,
    icon,
    groupLabel,
  }))
  .sort((left, right) => left.name.localeCompare(right.name))

export function getCounterPercent(counter) {
  const safeCounter = normalizeCounter(counter)
  if (safeCounter.total === 0) {
    return 0
  }

  return Math.round((safeCounter.correct / safeCounter.total) * 100)
}
