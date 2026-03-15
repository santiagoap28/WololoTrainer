import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { civilizations, techTreeTrainerOptions } from '../civilizations/civilizationsData.js'
import { readHighscores, updateHighscore } from './highscores.js'
import { playMenuClickSound } from '../../shared/audio/uiSounds.js'
import { readTrainerStats, recordTrainerQuestionResult } from './trainerStats.js'
import { createCounterMissMap, hasAnyFailures, isReviewModeEnabled } from '../../shared/reviewMode.js'
import difficultyBalanceById from './trainer-balance.json'

const QUESTION_COUNT = 10
const MAX_CHOICES_PER_QUESTION = 30
const MAX_GRID_COLUMNS = 10
const MESO_CIV_IDS = new Set(['aztecs', 'incas', 'mayans'])
const UNIT_GROUP_KEYS = new Set(['barracks', 'stable', 'archeryRange'])
const MEDIUM_NON_UNIT_GROUP_KEYS = new Set(['blacksmithUpgrades', 'militaryUpgrades'])
const ADVANCED_GROUP_KEYS = new Set(['defenses', 'monastery', 'naval'])
const HARD_EXTRA_OPTION_KEYS = new Set([
  'defenses:bombard-cannon',
  'defenses:bombard-tower',
  'defenses:stone-wall',
  'defenses:guard-tower',
  'defenses:siege-engineers',
  'monastery:redemption',
  'monastery:sanctity',
  'monastery:block-printing',
])
const MIXED_REQUIREMENT_CHANCE = 0.78
const COMBINED_TECH_GROUPS = [
  {
    id: 'cavalry',
    optionKeys: [
      'militaryUpgrades:bloodlines',
      'stable:hussar',
      'stable:paladin',
      'militaryUpgrades:husbandry',
      'blacksmithUpgrades:blast-furnace',
      'blacksmithUpgrades:plate-barding-armor',
    ],
  },
  {
    id: 'archery-range',
    optionKeys: [
      'archeryRange:heavy-cavalry-archer',
      'archeryRange:arbalester',
      'blacksmithUpgrades:bracer',
      'militaryUpgrades:thumb-ring',
      'militaryUpgrades:parthian-tactics',
      'blacksmithUpgrades:ring-archer-armor',
      'militaryUpgrades:bloodlines',
      'militaryUpgrades:husbandry',
    ],
  },
  {
    id: 'infantry',
    optionKeys: [
      'barracks:champion',
      'barracks:halberdier',
      'militaryUpgrades:gambesons',
      'militaryUpgrades:squires',
      'blacksmithUpgrades:plate-mail-armor',
      'blacksmithUpgrades:blast-furnace',
    ],
  },
  {
    id: 'siege',
    optionKeys: [
      'militaryUpgrades:siege-onager',
      'defenses:bombard-cannon',
      'militaryUpgrades:siege-ram',
      'defenses:siege-engineers',
      'defenses:bombard-tower',
    ],
  },
  {
    id: 'defense',
    optionKeys: [
      'defenses:guard-tower',
      'defenses:keep',
      'defenses:bombard-tower',
      'defenses:fortified-wall',
      'defenses:masonry',
      'defenses:architecture',
      'defenses:hoardings',
    ],
  },
  {
    id: 'monastery',
    optionPredicate: (option) => option.groupKey === 'monastery',
  },
]

const DEFAULT_BALANCE_SETTINGS = {
  multipleChoice: {
    minOptions: 3,
    maxOptions: 6,
    probability: 0.8,
  },
  selectAll: {
    minOptions: 10,
    maxOptions: 16,
    minAnswers: 2,
    maxAnswers: 4,
    probability: 0.2,
  },
}

const FALLBACK_BALANCE_BY_DIFFICULTY = {
  easy: {
    multipleChoice: {
      minOptions: 3,
      maxOptions: 4,
      probability: 0.8,
    },
    selectAll: {
      minOptions: 8,
      maxOptions: 12,
      minAnswers: 2,
      maxAnswers: 3,
      probability: 0.2,
    },
  },
  medium: {
    multipleChoice: {
      minOptions: 3,
      maxOptions: 6,
      probability: 0.8,
    },
    selectAll: {
      minOptions: 10,
      maxOptions: 16,
      minAnswers: 2,
      maxAnswers: 4,
      probability: 0.2,
    },
  },
  hard: {
    multipleChoice: {
      minOptions: 4,
      maxOptions: 7,
      probability: 0.8,
    },
    selectAll: {
      minOptions: 12,
      maxOptions: 20,
      minAnswers: 2,
      maxAnswers: 5,
      probability: 0.2,
    },
  },
  extreme: {
    multipleChoice: {
      minOptions: 5,
      maxOptions: 10,
      probability: 0.8,
    },
    selectAll: {
      minOptions: 14,
      maxOptions: 32,
      minAnswers: 2,
      maxAnswers: 5,
      probability: 0.2,
    },
  },
  legendary: {
    multipleChoice: {
      minOptions: 6,
      maxOptions: 16,
      probability: 0.8,
    },
    selectAll: {
      minOptions: 16,
      maxOptions: 30,
      minAnswers: 2,
      maxAnswers: 6,
      probability: 0.2,
    },
  },
}

function toChoiceCount(value, fallbackValue) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallbackValue
  }

  const normalizedValue = Math.floor(numericValue)
  return Math.max(1, Math.min(MAX_CHOICES_PER_QUESTION, normalizedValue))
}

function toProbability(value, fallbackValue) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallbackValue
  }

  return Math.max(0, Math.min(1, numericValue))
}

function normalizeDifficultyBalance(rawBalance, fallbackBalance) {
  const rawMultipleChoice = rawBalance?.multipleChoice ?? {}
  const rawSelectAll = rawBalance?.selectAll ?? {}
  const fallbackMultipleChoice = fallbackBalance.multipleChoice
  const fallbackSelectAll = fallbackBalance.selectAll

  const multipleChoiceMinChoices = toChoiceCount(rawMultipleChoice.minOptions, fallbackMultipleChoice.minOptions)
  const multipleChoiceMaxChoices = Math.max(
    multipleChoiceMinChoices,
    toChoiceCount(rawMultipleChoice.maxOptions, fallbackMultipleChoice.maxOptions),
  )

  const selectAllMinChoices = toChoiceCount(rawSelectAll.minOptions, fallbackSelectAll.minOptions)
  const selectAllMaxChoices = Math.max(
    selectAllMinChoices,
    toChoiceCount(rawSelectAll.maxOptions, fallbackSelectAll.maxOptions),
  )

  const selectAllAnswerMin = toChoiceCount(rawSelectAll.minAnswers, fallbackSelectAll.minAnswers)
  const selectAllAnswerMax = Math.max(
    selectAllAnswerMin,
    toChoiceCount(rawSelectAll.maxAnswers, fallbackSelectAll.maxAnswers),
  )

  const multipleChoiceProbability = toProbability(rawMultipleChoice.probability, fallbackMultipleChoice.probability)
  const selectAllProbability = toProbability(rawSelectAll.probability, fallbackSelectAll.probability)

  return {
    multipleChoiceMinChoices,
    multipleChoiceMaxChoices,
    selectAllMinChoices,
    selectAllMaxChoices,
    selectAllAnswerMin,
    selectAllAnswerMax,
    multipleChoiceProbability,
    selectAllProbability,
  }
}

function getDifficultyBalance(difficultyId) {
  const fallbackBalance = FALLBACK_BALANCE_BY_DIFFICULTY[difficultyId] ?? DEFAULT_BALANCE_SETTINGS
  const rawBalance = difficultyBalanceById[difficultyId] ?? {}
  return normalizeDifficultyBalance(rawBalance, fallbackBalance)
}

const DIFFICULTY_CONFIG = {
  easy: {
    label: 'Easy',
    modeLabel: 'Units only',
    optionPredicate: (option) => UNIT_GROUP_KEYS.has(option.groupKey),
    techCountWeights: [1],
    ...getDifficultyBalance('easy'),
    allChoicesChanceMultiple: 0,
    allChoicesChanceSelectAll: 0,
    includeMesoForCavalry: false,
  },
  medium: {
    label: 'Medium',
    modeLabel: 'Units + Blacksmith + Military',
    optionPredicate: (option) =>
      UNIT_GROUP_KEYS.has(option.groupKey) || MEDIUM_NON_UNIT_GROUP_KEYS.has(option.groupKey),
    optionGroupWeights: {
      barracks: 0.6,
      stable: 0.6,
      archeryRange: 0.6,
      blacksmithUpgrades: 3.2,
      militaryUpgrades: 3.2,
    },
    techCountWeights: [1],
    ...getDifficultyBalance('medium'),
    allChoicesChanceMultiple: 0,
    allChoicesChanceSelectAll: 0,
    includeMesoForCavalry: false,
  },
  hard: {
    label: 'Hard',
    modeLabel: 'No units: Blacksmith + Military + key Defenses/Monastery',
    optionPredicate: (option) => {
      if (MEDIUM_NON_UNIT_GROUP_KEYS.has(option.groupKey)) {
        return true
      }

      return HARD_EXTRA_OPTION_KEYS.has(option.key)
    },
    techCountWeights: [1, 1, 1, 2],
    ...getDifficultyBalance('hard'),
    allChoicesChanceMultiple: 0,
    allChoicesChanceSelectAll: 0,
    includeMesoForCavalry: false,
  },
  extreme: {
    label: 'Extreme',
    modeLabel: 'All non-unit categories',
    optionPredicate: (option) => !UNIT_GROUP_KEYS.has(option.groupKey),
    techCountWeights: [1, 2, 3],
    ...getDifficultyBalance('extreme'),
    allChoicesChanceMultiple: 0,
    allChoicesChanceSelectAll: 0,
    includeMesoForCavalry: false,
  },
  legendary: {
    label: 'Legendary',
    modeLabel: 'Advanced categories only (Hard/Extreme scope), huge option pools',
    optionPredicate: (option) => ADVANCED_GROUP_KEYS.has(option.groupKey),
    techCountWeights: [1, 2, 3, 4],
    ...getDifficultyBalance('legendary'),
    allChoicesChanceMultiple: 0.12,
    allChoicesChanceSelectAll: 0.28,
    includeMesoForCavalry: true,
  },
}

function buildTechTreeReviewProfile() {
  const stats = readTrainerStats()
  const civWeights = createCounterMissMap(stats.civs)
  const techWeights = createCounterMissMap(stats.techs)
  const hasFailures = hasAnyFailures(civWeights) || hasAnyFailures(techWeights)

  return {
    civWeights,
    techWeights,
    hasFailures,
  }
}

function shuffle(items) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function sample(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function sampleN(items, count) {
  return shuffle(items).slice(0, count)
}

function getOptionWeight(option, quizConfig, reviewProfile = null) {
  const groupWeights = quizConfig.optionGroupWeights ?? {}
  const baseWeight = Math.max(0.01, groupWeights[option.groupKey] ?? 1)
  if (!reviewProfile?.hasFailures) {
    return baseWeight
  }

  const reviewWeight = Number(reviewProfile.techWeights?.[option.key] ?? 0)
  return baseWeight * (1 + reviewWeight * 2.5)
}

function sampleWeightedOption(options, quizConfig, reviewProfile = null) {
  if (options.length === 0) {
    return null
  }

  const totalWeight = options.reduce((sum, option) => sum + getOptionWeight(option, quizConfig, reviewProfile), 0)
  if (totalWeight <= 0) {
    return sample(options)
  }

  let cursor = Math.random() * totalWeight
  for (const option of options) {
    cursor -= getOptionWeight(option, quizConfig, reviewProfile)
    if (cursor <= 0) {
      return option
    }
  }

  return options[options.length - 1]
}

function randomInRange(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function isCavalryOption(option) {
  if (option.groupKey === 'stable') {
    return true
  }

  if (option.groupKey === 'militaryUpgrades' && ['bloodlines', 'husbandry'].includes(option.id)) {
    return true
  }

  if (option.groupKey === 'blacksmithUpgrades' && option.id.includes('barding')) {
    return true
  }

  const cavalryTokens = ['cavalry', 'camel', 'lancer', 'knight', 'paladin', 'hussar']
  return cavalryTokens.some((token) => option.id.includes(token))
}

function getEligibleCivilizations(options, quizConfig) {
  const hasCavalryRelatedOption = options.some((option) => isCavalryOption(option))
  if (quizConfig.includeMesoForCavalry || !hasCavalryRelatedOption) {
    return civilizations
  }

  return civilizations.filter((civilization) => !MESO_CIV_IDS.has(civilization.id))
}

function civilizationHasOption(civilization, option) {
  return Boolean(civilization[option.groupKey]?.includes(option.id))
}

function pickWeightedItem(weightedItems, fallbackItem = null) {
  const totalWeight = weightedItems.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight <= 0) {
    return fallbackItem ?? weightedItems[weightedItems.length - 1]?.item ?? null
  }

  let cursor = Math.random() * totalWeight
  for (const weightedItem of weightedItems) {
    cursor -= weightedItem.weight
    if (cursor <= 0) {
      return weightedItem.item
    }
  }

  return fallbackItem ?? weightedItems[weightedItems.length - 1]?.item ?? null
}

function resolveGroupOptions(group, availableOptions) {
  if (typeof group.optionPredicate === 'function') {
    return availableOptions.filter(group.optionPredicate)
  }

  const optionKeys = new Set(group.optionKeys ?? [])
  return availableOptions.filter((option) => optionKeys.has(option.key))
}

function getCombinedGroupPools(availableOptions, desiredCount) {
  return COMBINED_TECH_GROUPS.map((group) => {
    const groupOptions = resolveGroupOptions(group, availableOptions)
    return {
      id: group.id,
      options: groupOptions,
    }
  }).filter((group) => group.options.length >= Math.min(2, desiredCount))
}

function pickOptionsFromGroup(groupOptions, count, quizConfig, reviewProfile = null) {
  const selectedOptions = []
  let remainingOptions = [...groupOptions]

  while (selectedOptions.length < count && remainingOptions.length > 0) {
    const nextOption = sampleWeightedOption(remainingOptions, quizConfig, reviewProfile) ?? sample(remainingOptions)
    if (!nextOption) {
      break
    }

    selectedOptions.push(nextOption)
    remainingOptions = remainingOptions.filter((option) => option.key !== nextOption.key)
  }

  return selectedOptions
}

function pickQuestionOptionSet(options, quizConfig, desiredCount, reviewProfile = null) {
  if (options.length === 0) {
    return []
  }

  if (desiredCount <= 1) {
    const singleOption = sampleWeightedOption(options, quizConfig, reviewProfile)
    return singleOption ? [singleOption] : []
  }

  const combinedGroupPools = getCombinedGroupPools(options, desiredCount)
  if (combinedGroupPools.length > 0) {
    const weightedPools = combinedGroupPools.map((group) => ({
      item: group,
      weight: Math.max(0.01, group.options.length),
    }))
    const selectedGroup = pickWeightedItem(weightedPools, combinedGroupPools[0])
    const optionCount = Math.min(desiredCount, selectedGroup.options.length)
    const groupedOptions = pickOptionsFromGroup(selectedGroup.options, optionCount, quizConfig, reviewProfile)
    if (groupedOptions.length > 0) {
      return groupedOptions
    }
  }

  return pickOptionsFromGroup(options, desiredCount, quizConfig, reviewProfile)
}

function pickNegativeCount(totalOptionCount) {
  const maxNegativeCount = Math.min(Math.max(1, totalOptionCount - 1), Math.ceil(totalOptionCount * 0.66))
  const weightedCounts = []

  for (let negativeCount = 1; negativeCount <= maxNegativeCount; negativeCount += 1) {
    const countWeight = 1 / (negativeCount + 0.35)
    weightedCounts.push({
      item: negativeCount,
      weight: countWeight,
    })
  }

  return pickWeightedItem(weightedCounts, 1) ?? 1
}

function splitOptionsIntoRequirements(selectedOptions) {
  if (selectedOptions.length === 1) {
    return Math.random() < 0.5
      ? { mustHaveOptions: selectedOptions, mustNotHaveOptions: [] }
      : { mustHaveOptions: [], mustNotHaveOptions: selectedOptions }
  }

  if (Math.random() < MIXED_REQUIREMENT_CHANCE) {
    const negativeCount = pickNegativeCount(selectedOptions.length)
    const mustNotHaveOptions = sampleN(selectedOptions, negativeCount)
    const mustNotHaveKeys = new Set(mustNotHaveOptions.map((option) => option.key))
    const mustHaveOptions = selectedOptions.filter((option) => !mustNotHaveKeys.has(option.key))
    return {
      mustHaveOptions,
      mustNotHaveOptions,
    }
  }

  return Math.random() < 0.8
    ? { mustHaveOptions: selectedOptions, mustNotHaveOptions: [] }
    : { mustHaveOptions: [], mustNotHaveOptions: selectedOptions }
}

function pickQuestionRequirements(options, quizConfig, reviewProfile = null) {
  if (options.length === 0) {
    return null
  }

  const allowedTechCounts = (quizConfig.techCountWeights ?? [1]).filter(
    (techCount) => techCount >= 1 && techCount <= options.length,
  )
  const selectedTechCount = sample(allowedTechCounts.length > 0 ? allowedTechCounts : [1])

  const selectedOptions = pickQuestionOptionSet(options, quizConfig, selectedTechCount, reviewProfile)
  if (selectedOptions.length === 0) {
    return null
  }

  return splitOptionsIntoRequirements(selectedOptions)
}

function getRequirementMode(mustHaveOptions, mustNotHaveOptions) {
  if (mustHaveOptions.length > 0 && mustNotHaveOptions.length > 0) {
    return 'MIXED'
  }
  if (mustHaveOptions.length > 0) {
    return 'HAS'
  }
  return 'NOT_HAS'
}

function formatOptionLabels(options) {
  return options.map((option) => option.label).join(' + ')
}

function getRequirementTitle(mustHaveOptions, mustNotHaveOptions) {
  const titleParts = []

  if (mustHaveOptions.length > 0) {
    titleParts.push(`Has ${formatOptionLabels(mustHaveOptions)}`)
  }
  if (mustNotHaveOptions.length > 0) {
    titleParts.push(`Does not have ${formatOptionLabels(mustNotHaveOptions)}`)
  }

  return titleParts.join(' + ')
}

function getMultipleChoicePrompt(mustHaveOptions, mustNotHaveOptions) {
  const mode = getRequirementMode(mustHaveOptions, mustNotHaveOptions)
  const totalOptionCount = mustHaveOptions.length + mustNotHaveOptions.length

  if (mode === 'MIXED') {
    return 'Which civilization matches this HAVE / DOES NOT HAVE condition?'
  }

  if (mode === 'HAS') {
    return totalOptionCount === 1
      ? 'Which civilization HAS this tech tree option?'
      : 'Which civilization HAS all selected tech tree options?'
  }

  return totalOptionCount === 1
    ? 'Which civilization does NOT have this tech tree option?'
    : 'Which civilization does NOT have any selected tech tree options?'
}

function getSelectAllPrompt(mustHaveOptions, mustNotHaveOptions, answerCount) {
  const mode = getRequirementMode(mustHaveOptions, mustNotHaveOptions)
  const totalOptionCount = mustHaveOptions.length + mustNotHaveOptions.length

  if (mode === 'MIXED') {
    return `Select ${answerCount} civilizations that match this HAVE / DOES NOT HAVE condition.`
  }

  if (mode === 'HAS') {
    return totalOptionCount === 1
      ? `Select ${answerCount} civilizations that HAVE this tech tree option.`
      : `Select ${answerCount} civilizations that HAVE all selected tech tree options.`
  }

  return totalOptionCount === 1
    ? `Select ${answerCount} civilizations that do NOT have this tech tree option.`
    : `Select ${answerCount} civilizations that DO NOT have any selected tech tree options.`
}

function createPools(requirements, quizConfig) {
  const mustHaveOptions = requirements.mustHaveOptions ?? []
  const mustNotHaveOptions = requirements.mustNotHaveOptions ?? []
  const combinedOptions = [...mustHaveOptions, ...mustNotHaveOptions]

  const eligibleCivilizations = getEligibleCivilizations(combinedOptions, quizConfig)
  const matchingCivilizations = eligibleCivilizations.filter(
    (civilization) =>
      mustHaveOptions.every((option) => civilizationHasOption(civilization, option)) &&
      mustNotHaveOptions.every((option) => !civilizationHasOption(civilization, option)),
  )
  const matchingIds = new Set(matchingCivilizations.map((civilization) => civilization.id))
  const nonMatchingCivilizations = eligibleCivilizations.filter((civilization) => !matchingIds.has(civilization.id))

  return {
    eligibleCivilizations,
    matchingCivilizations,
    nonMatchingCivilizations,
    combinedOptions,
  }
}

function sampleWeightedCivilizations(civilizationsPool, count, reviewProfile = null) {
  if (!reviewProfile?.hasFailures) {
    return sampleN(civilizationsPool, count)
  }

  const pool = [...civilizationsPool]
  const selected = []

  while (pool.length > 0 && selected.length < count) {
    const weightedPool = pool.map((civilization) => ({
      item: civilization,
      weight: 1 + Number(reviewProfile.civWeights?.[civilization.id] ?? 0) * 3,
    }))
    const nextCivilization = pickWeightedItem(weightedPool, pool[pool.length - 1])
    if (!nextCivilization) {
      break
    }

    selected.push(nextCivilization)
    const selectedIndex = pool.findIndex((civilization) => civilization.id === nextCivilization.id)
    if (selectedIndex === -1) {
      break
    }
    pool.splice(selectedIndex, 1)
  }

  return selected
}

function buildMultipleChoiceQuestion(requirements, quizConfig, reviewProfile = null) {
  const { eligibleCivilizations, matchingCivilizations, nonMatchingCivilizations, combinedOptions } = createPools(
    requirements,
    quizConfig,
  )
  if (combinedOptions.length === 0) {
    return null
  }

  const minimumWrongChoices = Math.max(1, quizConfig.multipleChoiceMinChoices - 1)
  if (matchingCivilizations.length < 1 || nonMatchingCivilizations.length < minimumWrongChoices) {
    return null
  }

  const correctCiv = sampleWeightedCivilizations(matchingCivilizations, 1, reviewProfile)[0] ?? sample(matchingCivilizations)
  const availableWrongPool = nonMatchingCivilizations.filter((civilization) => civilization.id !== correctCiv.id)

  let choices = []
  const showAllChoices =
    quizConfig.allChoicesChanceMultiple > 0 && Math.random() < quizConfig.allChoicesChanceMultiple
  if (showAllChoices) {
    const cappedChoiceCount = Math.min(MAX_CHOICES_PER_QUESTION, availableWrongPool.length + 1)
    if (cappedChoiceCount < 2) {
      return null
    }

    choices = shuffle([correctCiv, ...sampleWeightedCivilizations(availableWrongPool, cappedChoiceCount - 1, reviewProfile)])
  } else {
    const maxChoiceCount = Math.min(
      MAX_CHOICES_PER_QUESTION,
      quizConfig.multipleChoiceMaxChoices,
      eligibleCivilizations.length,
      availableWrongPool.length + 1,
    )
    if (maxChoiceCount < 2) {
      return null
    }

    const minChoiceCount = Math.min(quizConfig.multipleChoiceMinChoices, maxChoiceCount)
    const choiceCount = randomInRange(minChoiceCount, maxChoiceCount)
    const wrongCount = choiceCount - 1

    const wrongChoices = sampleWeightedCivilizations(availableWrongPool, wrongCount, reviewProfile)
    if (wrongChoices.length < wrongCount) {
      return null
    }

    choices = shuffle([correctCiv, ...wrongChoices])
  }

  const mustHaveOptions = requirements.mustHaveOptions ?? []
  const mustNotHaveOptions = requirements.mustNotHaveOptions ?? []
  const mode = getRequirementMode(mustHaveOptions, mustNotHaveOptions)
  const optionKey = combinedOptions.map((option) => option.key).sort().join('+')
  const negativeKey = mustNotHaveOptions.map((option) => option.key).sort().join('+')
  return {
    id: `${optionKey}:not[${negativeKey}]:mc`,
    variant: 'multiple',
    mode,
    prompt: getMultipleChoicePrompt(mustHaveOptions, mustNotHaveOptions),
    options: combinedOptions,
    mustHaveOptions,
    mustNotHaveOptions,
    matchingCivs: matchingCivilizations.map((civilization) => ({
      id: civilization.id,
      name: civilization.name,
      icon: civilization.icon,
    })),
    correctCivIds: [correctCiv.id],
    choices: choices.map((civilization) => ({
      id: civilization.id,
      name: civilization.name,
      icon: civilization.icon,
    })),
  }
}

function buildSelectAllQuestion(requirements, quizConfig, reviewProfile = null) {
  const { matchingCivilizations, nonMatchingCivilizations, combinedOptions } = createPools(requirements, quizConfig)
  if (combinedOptions.length === 0 || matchingCivilizations.length === 0) {
    return null
  }

  const showAllChoices = quizConfig.allChoicesChanceSelectAll > 0 && Math.random() < quizConfig.allChoicesChanceSelectAll
  const answerPool = matchingCivilizations
  const otherPool = nonMatchingCivilizations
  const answerCountMin = Math.max(1, quizConfig.selectAllAnswerMin ?? 1)
  const answerCountMaxByConfig = Math.max(answerCountMin, quizConfig.selectAllAnswerMax ?? 5)
  const answerCountMax = Math.min(answerPool.length, answerCountMaxByConfig)
  if (answerCountMax < answerCountMin) {
    return null
  }

  const feasibleAnswerCounts = []
  for (let answerCount = answerCountMin; answerCount <= answerCountMax; answerCount += 1) {
    const maxChoicesForCount = Math.min(
      MAX_CHOICES_PER_QUESTION,
      quizConfig.selectAllMaxChoices,
      answerCount + otherPool.length,
    )
    const minChoicesForCount = Math.max(4, answerCount * 2)
    if (maxChoicesForCount >= minChoicesForCount) {
      feasibleAnswerCounts.push(answerCount)
    }
  }

  if (feasibleAnswerCounts.length === 0) {
    return null
  }

  const answerCount = sample(feasibleAnswerCounts)
  const maxChoices = Math.min(MAX_CHOICES_PER_QUESTION, quizConfig.selectAllMaxChoices, answerCount + otherPool.length)
  const minChoicesFloor = Math.max(4, answerCount * 2)
  const configuredMinChoices = quizConfig.selectAllMinChoices ?? minChoicesFloor
  const minChoices = Math.max(minChoicesFloor, Math.min(configuredMinChoices, maxChoices))
  if (minChoices > maxChoices) {
    return null
  }

  const totalChoices = showAllChoices ? maxChoices : randomInRange(minChoices, maxChoices)
  const wrongCount = totalChoices - answerCount
  if (wrongCount < answerCount || wrongCount > otherPool.length) {
    return null
  }

  const answers = sampleWeightedCivilizations(answerPool, answerCount, reviewProfile)
  const wrongs = sampleWeightedCivilizations(otherPool, wrongCount, reviewProfile)
  const choices = shuffle([...answers, ...wrongs])
  const mustHaveOptions = requirements.mustHaveOptions ?? []
  const mustNotHaveOptions = requirements.mustNotHaveOptions ?? []
  const mode = getRequirementMode(mustHaveOptions, mustNotHaveOptions)
  const optionKey = combinedOptions.map((option) => option.key).sort().join('+')
  const negativeKey = mustNotHaveOptions.map((option) => option.key).sort().join('+')

  return {
    id: `${optionKey}:not[${negativeKey}]:sa`,
    variant: 'selectAll',
    mode,
    prompt: getSelectAllPrompt(mustHaveOptions, mustNotHaveOptions, answers.length),
    options: combinedOptions,
    mustHaveOptions,
    mustNotHaveOptions,
    matchingCivs: answerPool.map((civilization) => ({
      id: civilization.id,
      name: civilization.name,
      icon: civilization.icon,
    })),
    correctCivIds: answers.map((civilization) => civilization.id),
    choices: choices.map((civilization) => ({
      id: civilization.id,
      name: civilization.name,
      icon: civilization.icon,
    })),
  }
}

function buildQuestion(requirements, quizConfig, reviewProfile = null) {
  if (!requirements) {
    return null
  }

  const multipleChoiceProbability = Math.max(0, Number(quizConfig.multipleChoiceProbability) || 0)
  const selectAllProbability = Math.max(0, Number(quizConfig.selectAllProbability) || 0)
  const probabilityTotal = multipleChoiceProbability + selectAllProbability
  const normalizedMultipleChoiceProbability =
    probabilityTotal > 0 ? multipleChoiceProbability / probabilityTotal : 0.5
  const preferMultipleChoice = Math.random() < normalizedMultipleChoiceProbability
  const primaryBuilder = preferMultipleChoice ? buildMultipleChoiceQuestion : buildSelectAllQuestion
  const fallbackBuilder = preferMultipleChoice ? buildSelectAllQuestion : buildMultipleChoiceQuestion

  return primaryBuilder(requirements, quizConfig, reviewProfile) ?? fallbackBuilder(requirements, quizConfig, reviewProfile)
}

function generateSingleQuestion(options, quizConfig, reviewProfile = null) {
  let guard = 0
  while (guard < 400 && options.length > 0) {
    guard += 1
    const requirements = pickQuestionRequirements(options, quizConfig, reviewProfile)
    const question = buildQuestion(requirements, quizConfig, reviewProfile)
    if (question) {
      return question
    }
  }

  return null
}

function generateQuestions(count, options, quizConfig, reviewProfile = null) {
  const questions = []

  let guard = 0
  while (questions.length < count && guard < 1600 && options.length > 0) {
    guard += 1
    const requirements = pickQuestionRequirements(options, quizConfig, reviewProfile)
    const question = buildQuestion(requirements, quizConfig, reviewProfile)
    if (question) {
      questions.push(question)
    }
  }

  return questions
}

export function TechTreeTrainerPage() {
  const { difficulty } = useParams()
  const [searchParams] = useSearchParams()
  const config = difficulty ? DIFFICULTY_CONFIG[difficulty] : null
  const isValidDifficulty = Boolean(config)
  const effectiveConfig = config ?? DIFFICULTY_CONFIG.easy
  const isReviewMode = isReviewModeEnabled(searchParams)
  const reviewProfile = useMemo(
    () => (isReviewMode ? buildTechTreeReviewProfile() : { civWeights: {}, techWeights: {}, hasFailures: false }),
    [isReviewMode],
  )
  const targetQuestionCount = isReviewMode && !reviewProfile.hasFailures ? 1 : QUESTION_COUNT
  const menuRoute = isReviewMode ? '/tech-tree-trainer?mode=review' : '/tech-tree-trainer'
  const reviewModeLabel = isReviewMode ? ' | Review' : ''

  const difficultyOptions = useMemo(
    () =>
      techTreeTrainerOptions.filter((option) => effectiveConfig.optionPredicate(option)),
    [effectiveConfig],
  )
  const initialQuestionCount = isReviewMode ? 1 : targetQuestionCount
  const [questions, setQuestions] = useState(() =>
    generateQuestions(initialQuestionCount, difficultyOptions, effectiveConfig, reviewProfile),
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selectedChoiceId, setSelectedChoiceId] = useState(null)
  const [selectedChoiceIds, setSelectedChoiceIds] = useState([])
  const [revealed, setRevealed] = useState(false)
  const [locked, setLocked] = useState(false)
  const [hasMissed, setHasMissed] = useState(false)
  const [needsContinue, setNeedsContinue] = useState(false)
  const [pendingFinish, setPendingFinish] = useState(false)
  const [finished, setFinished] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280))
  const timeoutRef = useRef(null)
  const audioContextRef = useRef(null)
  const currentQuestion = questions[currentIndex]
  const currentHighscore = isValidDifficulty ? readHighscores()[difficulty] ?? 0 : 0
  const questionOptions = currentQuestion?.options ?? []
  const mustHaveOptions =
    currentQuestion?.mustHaveOptions ??
    (currentQuestion?.mode === 'NOT_HAS' ? [] : questionOptions)
  const mustNotHaveOptions =
    currentQuestion?.mustNotHaveOptions ??
    (currentQuestion?.mode === 'NOT_HAS' ? questionOptions : [])
  const conditionBlocks = [
    ...(mustHaveOptions.length > 0 ? [{ key: 'has', title: 'HAVE', options: mustHaveOptions }] : []),
    ...(mustNotHaveOptions.length > 0
      ? [{ key: 'not-has', title: 'DOES NOT HAVE', options: mustNotHaveOptions }]
      : []),
  ]
  const hasMultipleQuestionOptions = questionOptions.length > 1
  const showsConditionBlocks = hasMultipleQuestionOptions && conditionBlocks.length > 0
  const hasMixedRequirements = mustHaveOptions.length > 0 && mustNotHaveOptions.length > 0
  const questionLabel = questionOptions.map((option) => option.label).join(' + ')
  const questionConditionTitle = getRequirementTitle(mustHaveOptions, mustNotHaveOptions)
  const questionGroupLabel = questionOptions.length === 1 ? questionOptions[0].groupLabel : `${questionOptions.length} Techs`
  const questionModeLabel =
    hasMixedRequirements ? 'MIXED' : mustNotHaveOptions.length > 0 ? 'DOES NOT HAVE' : 'HAS'
  const selectAllTargetCount = currentQuestion?.variant === 'selectAll' ? currentQuestion.correctCivIds.length : 0
  const selectAllLeftCount =
    currentQuestion?.variant === 'selectAll' ? Math.max(selectAllTargetCount - selectedChoiceIds.length, 0) : 0
  const matchingCivs = currentQuestion?.matchingCivs ?? []
  const mistakeExplanationText =
    hasMixedRequirements
      ? 'These civilizations match the full HAVE / DOES NOT HAVE condition:'
      : mustNotHaveOptions.length > 0
        ? questionOptions.length > 1
          ? 'These civilizations DO NOT HAVE any selected techs:'
          : 'These civilizations DO NOT HAVE this tech:'
        : questionOptions.length > 1
          ? 'These civilizations HAVE all selected techs:'
          : 'These civilizations HAVE this tech:'
  const choiceCount = currentQuestion?.choices.length ?? 0
  const panelWidthClass = choiceCount >= 22 ? 'tech-panel-expanded' : choiceCount >= 14 ? 'tech-panel-wide' : ''
  const baseChoiceColumns =
    choiceCount >= 30
      ? 10
      : choiceCount >= 24
        ? 10
        : choiceCount >= 18
          ? 9
          : choiceCount >= 14
            ? 8
            : choiceCount >= 10
              ? 7
              : choiceCount >= 6
                ? 6
                : 4
  const maxColumnsByViewport =
    viewportWidth < 760 ? 3 : viewportWidth < 980 ? 4 : viewportWidth < 1260 ? 6 : viewportWidth < 1600 ? 9 : 10
  const choiceColumns = Math.max(
    1,
    Math.min(
      baseChoiceColumns,
      maxColumnsByViewport,
      MAX_GRID_COLUMNS,
      choiceCount,
    ),
  )

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    },
    [],
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const onResize = () => {
      setViewportWidth(window.innerWidth)
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (!isValidDifficulty) {
    return <Navigate to="/tech-tree-trainer" replace />
  }

  const scheduleAdvance = (delayMs) => {
    timeoutRef.current = setTimeout(() => {
      setCurrentIndex((index) => index + 1)
      setSelectedChoiceId(null)
      setSelectedChoiceIds([])
      setRevealed(false)
      setLocked(false)
      setNeedsContinue(false)
      setPendingFinish(false)
    }, delayMs)
  }

  const finishQuestionFlow = () => {
    setFinished(true)
    setLocked(false)
    setNeedsContinue(false)
    setPendingFinish(false)
  }

  const queueNextQuestion = (delayMs) => {
    if (currentIndex + 1 >= questions.length) {
      const nextQuestion = generateSingleQuestion(
        difficultyOptions,
        effectiveConfig,
        isReviewMode ? buildTechTreeReviewProfile() : reviewProfile,
      )
      if (nextQuestion) {
        setQuestions((currentQuestions) => [...currentQuestions, nextQuestion])
      } else {
        timeoutRef.current = setTimeout(() => {
          finishQuestionFlow()
        }, delayMs)
        return
      }
    }

    scheduleAdvance(delayMs)
  }

  const applyAnswerResult = (isCorrect, delayMs) => {
    recordTrainerQuestionResult(currentQuestion, isCorrect)

    const nextHasMissed = hasMissed || !isCorrect
    const answeredCount = currentIndex + 1
    const shouldFinish = isReviewMode
      ? answeredCount >= targetQuestionCount
      : answeredCount >= targetQuestionCount && nextHasMissed
    const nextScore = score + (isCorrect ? 1 : 0)

    if (isCorrect) {
      setScore((currentScore) => currentScore + 1)
    }
    playResultSound(isCorrect)
    setHasMissed(nextHasMissed)

    if (!isCorrect) {
      updateHighscore(difficulty, nextScore)
      setNeedsContinue(true)
      setPendingFinish(shouldFinish)
      return
    }

    if (shouldFinish) {
      updateHighscore(difficulty, nextScore)
      timeoutRef.current = setTimeout(() => {
        finishQuestionFlow()
      }, delayMs)
      return
    }

    queueNextQuestion(delayMs)
  }

  const playResultSound = (isCorrect) => {
    const AudioContextClass = window.AudioContext || window['webkitAudioContext']
    if (!AudioContextClass) {
      return
    }

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass()
      }

      const audioContext = audioContextRef.current
      if (audioContext.state === 'suspended') {
        audioContext.resume()
      }

      const now = audioContext.currentTime
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()

      oscillator.type = isCorrect ? 'triangle' : 'sawtooth'
      oscillator.frequency.setValueAtTime(isCorrect ? 720 : 235, now)
      oscillator.frequency.exponentialRampToValueAtTime(isCorrect ? 980 : 155, now + 0.18)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (isCorrect ? 0.19 : 0.25))

      oscillator.connect(gain)
      gain.connect(audioContext.destination)
      oscillator.start(now)
      oscillator.stop(now + (isCorrect ? 0.2 : 0.26))
    } catch {
      // Audio is optional; ignore runtime audio errors.
    }
  }

  const onSelectMultipleChoice = (choiceId) => {
    if (!currentQuestion || locked || finished) {
      return
    }

    setSelectedChoiceId(choiceId)
    setRevealed(true)
    setLocked(true)

    const isCorrect = choiceId === currentQuestion.correctCivIds[0]
    applyAnswerResult(isCorrect, 1100)
  }

  const onCheckSelectAll = (choiceIds) => {
    if (!currentQuestion || locked || revealed) {
      return
    }

    const correctSet = new Set(currentQuestion.correctCivIds)
    const selectedSet = new Set(choiceIds)
    const allCorrectSelected = currentQuestion.correctCivIds.every((id) => selectedSet.has(id))
    const noWrongSelected = [...selectedSet].every((id) => correctSet.has(id))
    const isCorrect = allCorrectSelected && noWrongSelected

    setRevealed(true)
    setLocked(true)
    applyAnswerResult(isCorrect, 1650)
  }

  const onToggleSelectAllChoice = (choiceId) => {
    if (!currentQuestion || locked || revealed) {
      return
    }

    const requiredSelectionCount = currentQuestion.correctCivIds.length
    const alreadySelected = selectedChoiceIds.includes(choiceId)
    if (!alreadySelected && selectedChoiceIds.length >= requiredSelectionCount) {
      return
    }

    const nextChoiceIds = alreadySelected
      ? selectedChoiceIds.filter((currentId) => currentId !== choiceId)
      : [...selectedChoiceIds, choiceId]

    setSelectedChoiceIds(nextChoiceIds)

    if (nextChoiceIds.length === requiredSelectionCount) {
      onCheckSelectAll(nextChoiceIds)
    }
  }

  const onRetry = () => {
    playMenuClickSound()

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    setQuestions(
      generateQuestions(
        initialQuestionCount,
        difficultyOptions,
        effectiveConfig,
        isReviewMode ? buildTechTreeReviewProfile() : reviewProfile,
      ),
    )
    setCurrentIndex(0)
    setScore(0)
    setSelectedChoiceId(null)
    setSelectedChoiceIds([])
    setRevealed(false)
    setLocked(false)
    setHasMissed(false)
    setNeedsContinue(false)
    setPendingFinish(false)
    setFinished(false)
  }

  const onContinueAfterMistake = () => {
    playMenuClickSound()
    if (!needsContinue) {
      return
    }

    if (pendingFinish) {
      finishQuestionFlow()
      return
    }

    queueNextQuestion(0)
  }

  if (questions.length === 0) {
    return (
      <main className="screen">
        <section className="panel">
          <h1 className="section-title">Tech Tree Trainer</h1>
          <p className="section-subtitle">Could not generate questions for {config.label}{reviewModeLabel}.</p>
          <Link to={menuRoute} className="back-link">
            Back to Difficulty Menu
          </Link>
        </section>
      </main>
    )
  }

  if (finished) {
    return (
      <main className="screen">
        <section className="panel tech-panel">
          <h1 className="section-title">Tech Tree Trainer</h1>
          <p className="section-subtitle">
            {config.label} complete ({config.modeLabel}){reviewModeLabel}.
          </p>

          <div className="quiz-end-card">
            <p className="quiz-end-score">Score: {score}</p>
            <p className="section-subtitle">Highscore ({config.label}): {currentHighscore}</p>
            <div className="quiz-end-actions">
              <button type="button" className="method-card tech-action" onClick={onRetry}>
                Retry
              </button>
              <Link to={menuRoute} className="method-card tech-action" onClick={playMenuClickSound}>
                Back to Menu
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="screen">
      <section className={`panel tech-panel ${panelWidthClass}`}>
        <div className="top-bar quiz-top-bar">
          <Link to={menuRoute} className="back-link" onClick={playMenuClickSound}>
            Back to Difficulty Menu
          </Link>
          <p className="count-label quiz-stats">
            {config.label}{reviewModeLabel} | Question {currentIndex + 1} | Score {score}
          </p>
        </div>

        <h1 className="section-title">Tech Tree Trainer</h1>
        <p className="section-subtitle">{currentQuestion.prompt}</p>

        <article
          className={`question-card ${currentQuestion.variant === 'selectAll' ? 'with-right-counter' : ''} ${
            showsConditionBlocks ? 'multi-requirements' : ''
          }`}
        >
          {showsConditionBlocks ? (
            <div className="question-tech-conditions">
              {conditionBlocks.map((block) => (
                <section key={block.key} className="question-tech-condition">
                  <p
                    className={`question-mode-indicator question-tech-condition-title ${
                      block.key === 'has' ? 'has-mode' : 'not-has-mode'
                    }`}
                  >
                    <span className="question-mode-icon">{block.key === 'has' ? '+' : '-'}</span>
                    <span>{block.title}</span>
                  </p>
                  <div className="question-tech-icons single condition-line">
                    {block.options.map((option) => (
                      <div key={`${block.key}-${option.key}`} className="question-tech-chip">
                        <img
                          src={option.icon}
                          alt={`${option.label} icon`}
                          className="question-tech-icon"
                          onError={(event) => {
                            event.currentTarget.src = '/img/missing.png'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="question-tech-column">
              <div className="question-tech-icons single">
                {questionOptions.map((option) => (
                  <div key={option.key} className="question-tech-chip">
                    <img
                      src={option.icon}
                      alt={`${option.label} icon`}
                      className="question-tech-icon"
                      onError={(event) => {
                        event.currentTarget.src = '/img/missing.png'
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            {!showsConditionBlocks && (
              <p
                className={`question-mode-indicator ${
                  questionModeLabel === 'HAS' ? 'has-mode' : 'not-has-mode'
                }`}
              >
                <span className="question-mode-icon">{questionModeLabel === 'HAS' ? '+' : '-'}</span>
                <span>{questionModeLabel}</span>
              </p>
            )}
            <p className="question-group">{showsConditionBlocks ? 'Condition' : questionGroupLabel}</p>
            <h2 className="question-label">{showsConditionBlocks ? questionConditionTitle : questionLabel}</h2>
            <p className="question-variant-label">
              {currentQuestion.variant === 'multiple' ? 'Multiple Choice' : 'Select All'}
            </p>
          </div>

          {currentQuestion.variant === 'selectAll' && (
            <div className="select-all-left-badge">
              <span className="select-all-left-label">Left</span>
              <span className="select-all-left-value">{selectAllLeftCount}</span>
            </div>
          )}
        </article>

        {currentQuestion.variant === 'multiple' && (
          <div className="choices-grid" style={{ '--choice-columns': choiceColumns }}>
            {currentQuestion.choices.map((choice) => {
              const isSelected = selectedChoiceId === choice.id
              const isCorrectSelection = revealed && isSelected && choice.id === currentQuestion.correctCivIds[0]
              const isWrongSelection = revealed && isSelected && choice.id !== currentQuestion.correctCivIds[0]
              const revealCorrectAnswer =
                revealed &&
                selectedChoiceId !== null &&
                selectedChoiceId !== currentQuestion.correctCivIds[0] &&
                choice.id === currentQuestion.correctCivIds[0]

              return (
                <button
                  key={choice.id}
                  type="button"
                  className={`choice-button ${isCorrectSelection ? 'correct' : ''} ${
                    isWrongSelection ? 'wrong' : ''
                  } ${revealCorrectAnswer ? 'missed' : ''}`}
                  onClick={() => onSelectMultipleChoice(choice.id)}
                  disabled={locked}
                >
                  <img
                    src={choice.icon}
                    alt=""
                    className="choice-civ-icon"
                    onError={(event) => {
                      event.currentTarget.src = '/img/missing.png'
                    }}
                  />
                  <span>{choice.name}</span>
                </button>
              )
            })}
          </div>
        )}

        {currentQuestion.variant === 'selectAll' && (
          <>
            <div className="choices-grid" style={{ '--choice-columns': choiceColumns }}>
              {currentQuestion.choices.map((choice) => {
                const isSelected = selectedChoiceIds.includes(choice.id)
                const isCorrect = currentQuestion.correctCivIds.includes(choice.id)
                let stateClass = ''

                if (!revealed) {
                  stateClass = isSelected ? 'selected' : ''
                } else if (isSelected && isCorrect) {
                  stateClass = 'correct'
                } else if (isSelected && !isCorrect) {
                  stateClass = 'wrong'
                } else if (!isSelected && isCorrect) {
                  stateClass = 'missed'
                }

                return (
                  <button
                    key={choice.id}
                    type="button"
                    className={`choice-button ${stateClass}`}
                    onClick={() => onToggleSelectAllChoice(choice.id)}
                    disabled={locked || revealed}
                  >
                    <img
                      src={choice.icon}
                      alt=""
                      className="choice-civ-icon"
                      onError={(event) => {
                        event.currentTarget.src = '/img/missing.png'
                      }}
                    />
                    <span>{choice.name}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {needsContinue && (
          <>
            <button type="button" className="continue-after-miss-button" onClick={onContinueAfterMistake}>
              Continue
            </button>

            <section className="mistake-review-panel">
              <p className="mistake-review-title">{mistakeExplanationText}</p>
              <div className="mistake-review-grid">
                {matchingCivs.map((civilization) => (
                  <article key={civilization.id} className="mistake-review-civ">
                    <img
                      src={civilization.icon}
                      alt=""
                      className="mistake-review-civ-icon"
                      onError={(event) => {
                        event.currentTarget.src = '/img/missing.png'
                      }}
                    />
                    <span>{civilization.name}</span>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  )
}
