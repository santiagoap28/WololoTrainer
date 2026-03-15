import { civilizations } from '../civilizations/civilizationsData.js'
import { civilizationBonuses } from './bonusesData.js'

const BONUSES_STATS_STORAGE_KEY = 'wololo_bonuses_trainer_stats_v1'

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

function createDefaultBonusesStats() {
  return {
    civs: createDefaultCounters(civilizations),
    bonuses: createDefaultCounters(civilizationBonuses),
  }
}

export function readBonusesStats() {
  const defaults = createDefaultBonusesStats()

  if (!hasBrowserStorage()) {
    return defaults
  }

  try {
    const rawValue = window.localStorage.getItem(BONUSES_STATS_STORAGE_KEY)
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
      bonuses: {
        ...defaults.bonuses,
        ...Object.fromEntries(
          Object.entries(parsedValue?.bonuses ?? {}).map(([id, counter]) => [id, normalizeCounter(counter)]),
        ),
      },
    }
  } catch {
    return defaults
  }
}

export function writeBonusesStats(nextStats) {
  if (!hasBrowserStorage()) {
    return
  }

  window.localStorage.setItem(BONUSES_STATS_STORAGE_KEY, JSON.stringify(nextStats))
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

export function recordBonusesQuestionResult(question, isCorrect) {
  if (!question) {
    return
  }

  const nextStats = readBonusesStats()
  const civId = question.correctCivId
  const bonusId = question.bonus?.id

  if (civId) {
    nextStats.civs[civId] = bumpCounter(nextStats.civs[civId], isCorrect)
  }
  if (bonusId) {
    nextStats.bonuses[bonusId] = bumpCounter(nextStats.bonuses[bonusId], isCorrect)
  }

  writeBonusesStats(nextStats)
}

export const trackedBonusCivilizations = civilizations.map(({ id, name, icon }) => ({
  id,
  name,
  icon,
}))

export const trackedBonuses = civilizationBonuses.map((bonus) => ({
  id: bonus.id,
  name: bonus.text,
  icon: bonus.civilizationIcon,
  typeLabel: bonus.typeLabel,
}))

export function getCounterPercent(counter) {
  const safeCounter = normalizeCounter(counter)
  if (safeCounter.total === 0) {
    return 0
  }

  return Math.round((safeCounter.correct / safeCounter.total) * 100)
}
