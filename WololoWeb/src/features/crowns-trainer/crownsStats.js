import { civilizations } from '../civilizations/civilizationsData.js'
import { crownTechs } from './crownsData.js'

const CROWNS_STATS_STORAGE_KEY = 'wololo_crowns_trainer_stats_v1'

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

function createDefaultCrownsStats() {
  return {
    civs: createDefaultCounters(civilizations),
    crowns: createDefaultCounters(crownTechs),
  }
}

export function readCrownsStats() {
  const defaults = createDefaultCrownsStats()

  if (!hasBrowserStorage()) {
    return defaults
  }

  try {
    const rawValue = window.localStorage.getItem(CROWNS_STATS_STORAGE_KEY)
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
      crowns: {
        ...defaults.crowns,
        ...Object.fromEntries(
          Object.entries(parsedValue?.crowns ?? {}).map(([id, counter]) => [id, normalizeCounter(counter)]),
        ),
      },
    }
  } catch {
    return defaults
  }
}

export function writeCrownsStats(nextStats) {
  if (!hasBrowserStorage()) {
    return
  }

  window.localStorage.setItem(CROWNS_STATS_STORAGE_KEY, JSON.stringify(nextStats))
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

export function recordCrownsQuestionResult(question, isCorrect) {
  if (!question) {
    return
  }

  const nextStats = readCrownsStats()
  const pairings = Array.isArray(question.correctPairings) ? question.correctPairings : []

  if (pairings.length > 0) {
    for (const pairing of pairings) {
      const civId = pairing?.civId
      const crownId = pairing?.crownId

      if (civId) {
        nextStats.civs[civId] = bumpCounter(nextStats.civs[civId], isCorrect)
      }
      if (crownId) {
        nextStats.crowns[crownId] = bumpCounter(nextStats.crowns[crownId], isCorrect)
      }
    }

    writeCrownsStats(nextStats)
    return
  }

  const correctCivId = question.correctCivId
  const crownId = question.crownTech?.id

  if (correctCivId) {
    nextStats.civs[correctCivId] = bumpCounter(nextStats.civs[correctCivId], isCorrect)
  }
  if (crownId) {
    nextStats.crowns[crownId] = bumpCounter(nextStats.crowns[crownId], isCorrect)
  }

  writeCrownsStats(nextStats)
}

export const trackedCrownCivilizations = civilizations.map(({ id, name, icon }) => ({
  id,
  name,
  icon,
}))

export const trackedCrownTechs = crownTechs.map((crownTech) => ({
  id: crownTech.id,
  name: crownTech.name,
  icon: crownTech.crownIcon,
  crownType: crownTech.crownType,
}))

export function getCounterPercent(counter) {
  const safeCounter = normalizeCounter(counter)
  if (safeCounter.total === 0) {
    return 0
  }

  return Math.round((safeCounter.correct / safeCounter.total) * 100)
}
