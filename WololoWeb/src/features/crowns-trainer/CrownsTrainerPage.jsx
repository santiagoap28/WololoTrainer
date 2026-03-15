import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { civilizations } from '../civilizations/civilizationsData.js'
import { getAllowedCivilizationsForDifficulty } from '../civilizations/civilizationDifficultyPools.js'
import { playMenuClickSound } from '../../shared/audio/uiSounds.js'
import { crownTechs, crownsTrainerDifficulties } from './crownsData.js'
import { readHighscores, updateHighscore } from './highscores.js'
import { readCrownsStats, recordCrownsQuestionResult } from './crownsStats.js'
import {
  createCounterMissMap,
  hasAnyFailures,
  isReviewModeEnabled,
  pickWeightedItem,
  sampleWeightedWithoutReplacement,
} from '../../shared/reviewMode.js'
import balanceByDifficulty from './trainer-balance.json'

const QUESTION_COUNT = 10
const MAX_CHOICES_PER_QUESTION = 30

const CROWN_AGE_CHOICES = [
  { id: 'castle', label: 'Castle Age Crown', icon: '/img/Techs/unique_tech_1.png' },
  { id: 'imperial', label: 'Imperial Age Crown', icon: '/img/Techs/unique_tech_2.png' },
]

const DEFAULT_BALANCE = {
  multipleChoice: {
    minOptions: 3,
    maxOptions: 4,
  },
  combo: {
    minOptions: 3,
    maxOptions: 4,
  },
  matchPairs: {
    minOptions: 3,
    maxOptions: 4,
  },
  variantProbability: {
    civ: 0.6,
    age: 0.1,
    combo: 0.07,
    match: 0.08,
    search: 0.15,
  },
}

const FALLBACK_BALANCE_BY_DIFFICULTY = {
  easy: DEFAULT_BALANCE,
  medium: {
    ...DEFAULT_BALANCE,
    multipleChoice: { minOptions: 3, maxOptions: 5 },
    combo: { minOptions: 3, maxOptions: 5 },
    matchPairs: { minOptions: 3, maxOptions: 5 },
  },
  hard: {
    ...DEFAULT_BALANCE,
    multipleChoice: { minOptions: 4, maxOptions: 6 },
    combo: { minOptions: 4, maxOptions: 6 },
    matchPairs: { minOptions: 4, maxOptions: 6 },
  },
  extreme: {
    ...DEFAULT_BALANCE,
    multipleChoice: { minOptions: 4, maxOptions: 7 },
    combo: { minOptions: 4, maxOptions: 7 },
    matchPairs: { minOptions: 4, maxOptions: 6 },
  },
  legendary: {
    ...DEFAULT_BALANCE,
    multipleChoice: { minOptions: 5, maxOptions: 9 },
    combo: { minOptions: 5, maxOptions: 9 },
    matchPairs: { minOptions: 5, maxOptions: 6 },
  },
}

const civilizationById = new Map(civilizations.map((civilization) => [civilization.id, civilization]))
const crownAgeChoiceById = new Map(CROWN_AGE_CHOICES.map((choice) => [choice.id, choice]))

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

function randomInRange(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function getCrownAgeId(crownType) {
  return crownType === 'silver' ? 'castle' : 'imperial'
}

function toChoiceCount(value, fallbackValue, minValue = 2) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallbackValue
  }

  return Math.max(minValue, Math.min(MAX_CHOICES_PER_QUESTION, Math.floor(numericValue)))
}

function toProbability(value, fallbackValue) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallbackValue
  }

  return Math.max(0, Math.min(1, numericValue))
}

function normalizeDifficultyBalance(rawBalance, fallbackBalance) {
  const fallbackVariantProbability = fallbackBalance.variantProbability ?? DEFAULT_BALANCE.variantProbability
  const rawMultipleChoice = rawBalance?.multipleChoice ?? {}
  const rawCombo = rawBalance?.combo ?? {}
  const rawMatchPairs = rawBalance?.matchPairs ?? {}
  const rawVariantProbability = rawBalance?.variantProbability ?? {}
  const fallbackMultipleChoice = fallbackBalance.multipleChoice
  const fallbackCombo = fallbackBalance.combo
  const fallbackMatchPairs = fallbackBalance.matchPairs

  const multipleChoiceMinChoices = toChoiceCount(rawMultipleChoice.minOptions, fallbackMultipleChoice.minOptions, 2)
  const multipleChoiceMaxChoices = Math.max(
    multipleChoiceMinChoices,
    toChoiceCount(rawMultipleChoice.maxOptions, fallbackMultipleChoice.maxOptions, 2),
  )

  const comboMinChoices = toChoiceCount(rawCombo.minOptions, fallbackCombo.minOptions, 2)
  const comboMaxChoices = Math.max(comboMinChoices, toChoiceCount(rawCombo.maxOptions, fallbackCombo.maxOptions, 2))

  const matchMinPairs = toChoiceCount(rawMatchPairs.minOptions, fallbackMatchPairs.minOptions, 2)
  const matchMaxPairs = Math.max(matchMinPairs, toChoiceCount(rawMatchPairs.maxOptions, fallbackMatchPairs.maxOptions, 2))

  return {
    multipleChoiceMinChoices,
    multipleChoiceMaxChoices,
    comboMinChoices,
    comboMaxChoices,
    matchMinPairs,
    matchMaxPairs,
    variantProbability: {
      civ: toProbability(rawVariantProbability.civ, fallbackVariantProbability.civ),
      age: toProbability(rawVariantProbability.age, fallbackVariantProbability.age),
      combo: toProbability(rawVariantProbability.combo, fallbackVariantProbability.combo),
      match: toProbability(rawVariantProbability.match, fallbackVariantProbability.match),
      search: toProbability(rawVariantProbability.search, fallbackVariantProbability.search),
    },
  }
}

function getDifficultyBalance(difficultyId) {
  const fallbackBalance = FALLBACK_BALANCE_BY_DIFFICULTY[difficultyId] ?? DEFAULT_BALANCE
  const rawBalance = balanceByDifficulty[difficultyId] ?? {}
  return normalizeDifficultyBalance(rawBalance, fallbackBalance)
}

function buildDifficultyPools(difficultyId) {
  const allowedCivilizations = getAllowedCivilizationsForDifficulty(difficultyId)
  const allowedCivilizationIds = new Set(allowedCivilizations.map((civilization) => civilization.id))
  const availableCrownTechs = crownTechs.filter((crownTech) => allowedCivilizationIds.has(crownTech.civilizationId))
  const crownTechsByCivilizationId = availableCrownTechs.reduce((result, crownTech) => {
    if (!result[crownTech.civilizationId]) {
      result[crownTech.civilizationId] = []
    }

    result[crownTech.civilizationId].push(crownTech)
    return result
  }, {})
  const matchEligibleCivilizationIds = Object.entries(crownTechsByCivilizationId)
    .filter(([civilizationId, civilizationTechs]) => civilizationById.has(civilizationId) && civilizationTechs.length > 0)
    .map(([civilizationId]) => civilizationId)

  return {
    allowedCivilizations,
    availableCrownTechs,
    crownTechsByCivilizationId,
    matchEligibleCivilizationIds,
  }
}

function buildCrownsReviewProfile() {
  const stats = readCrownsStats()
  const civWeights = createCounterMissMap(stats.civs)
  const crownWeights = createCounterMissMap(stats.crowns)
  const hasFailures = hasAnyFailures(civWeights) || hasAnyFailures(crownWeights)

  return {
    civWeights,
    crownWeights,
    hasFailures,
  }
}

function getCrownReviewWeight(crownTech, reviewProfile) {
  if (!reviewProfile?.hasFailures) {
    return 1
  }

  const civWeight = Number(reviewProfile.civWeights?.[crownTech.civilizationId] ?? 0)
  const crownWeight = Number(reviewProfile.crownWeights?.[crownTech.id] ?? 0)
  return 1 + civWeight * 2 + crownWeight * 3
}

function pickVariant(variantProbability) {
  const weightedVariants = [
    { id: 'search', weight: Math.max(0, variantProbability.search ?? 0) },
    { id: 'match', weight: Math.max(0, variantProbability.match ?? 0) },
    { id: 'combo', weight: Math.max(0, variantProbability.combo ?? 0) },
    { id: 'age', weight: Math.max(0, variantProbability.age ?? 0) },
    { id: 'civ', weight: Math.max(0, variantProbability.civ ?? 0) },
  ]
  const totalWeight = weightedVariants.reduce((sum, variant) => sum + variant.weight, 0)
  if (totalWeight <= 0) {
    return 'civ'
  }

  let cursor = Math.random() * totalWeight
  for (const variant of weightedVariants) {
    cursor -= variant.weight
    if (cursor <= 0) {
      return variant.id
    }
  }

  return 'civ'
}

function createCivChoices(correctCivId, civilizationPool, minChoices, maxChoices, reviewProfile = null) {
  const correctCiv = civilizationById.get(correctCivId)
  if (!correctCiv) {
    return null
  }

  const wrongPool = civilizationPool.filter((civilization) => civilization.id !== correctCivId)
  if (wrongPool.length < 1) {
    return null
  }

  const cappedMaxChoices = Math.min(maxChoices, civilizationPool.length)
  const cappedMinChoices = Math.min(Math.max(2, minChoices), cappedMaxChoices)
  const desiredChoiceCount = randomInRange(cappedMinChoices, cappedMaxChoices)
  const actualChoiceCount = Math.min(desiredChoiceCount, wrongPool.length + 1)
  if (actualChoiceCount < 2) {
    return null
  }

  const wrongChoices = reviewProfile?.hasFailures
    ? sampleWeightedWithoutReplacement(
      wrongPool,
      actualChoiceCount - 1,
      (civilization) => 1 + Number(reviewProfile.civWeights?.[civilization.id] ?? 0) * 2,
    )
    : sampleN(wrongPool, actualChoiceCount - 1)
  return shuffle([correctCiv, ...wrongChoices]).map(({ id, name, icon }) => ({
    id,
    name,
    icon,
  }))
}

function createTechQuestion(crownTech, index, variant, pools, balanceConfig, reviewProfile = null) {
  const correctCivId = crownTech.civilizationId
  const correctAgeId = getCrownAgeId(crownTech.crownType)

  if (variant === 'age') {
    return {
      id: `${index}:${crownTech.id}:age`,
      variant: 'age',
      prompt: 'Which crown age does this unique tech belong to?',
      crownTech,
      correctCivId,
      correctAgeId,
      choices: CROWN_AGE_CHOICES,
      variantLabel: 'Age Guess',
    }
  }

  if (variant === 'combo') {
    const civChoices = createCivChoices(
      correctCivId,
      pools.allowedCivilizations,
      balanceConfig.comboMinChoices,
      balanceConfig.comboMaxChoices,
      reviewProfile,
    )
    if (!civChoices) {
      return null
    }

    return {
      id: `${index}:${crownTech.id}:combo`,
      variant: 'combo',
      prompt: 'Select both the civilization and the crown age.',
      crownTech,
      correctCivId,
      correctAgeId,
      civChoices,
      ageChoices: CROWN_AGE_CHOICES,
      variantLabel: 'Civ + Age Combo',
    }
  }

  if (variant === 'search') {
    return {
      id: `${index}:${crownTech.id}:search`,
      variant: 'search',
      prompt: 'Search and select the civilization with this crown tech.',
      crownTech,
      correctCivId,
      correctAgeId,
      variantLabel: 'Search',
    }
  }

  const civChoices = createCivChoices(
    correctCivId,
    pools.allowedCivilizations,
    balanceConfig.multipleChoiceMinChoices,
    balanceConfig.multipleChoiceMaxChoices,
    reviewProfile,
  )
  if (!civChoices) {
    return null
  }

  return {
    id: `${index}:${crownTech.id}:civ`,
    variant: 'civ',
    prompt: 'Which civilization has this crown tech?',
    crownTech,
    correctCivId,
    correctAgeId,
    choices: civChoices,
    variantLabel: 'Civilization Guess',
  }
}

function createMatchQuestion(index, pools, balanceConfig, reviewProfile = null) {
  const maxPairCount = Math.min(balanceConfig.matchMaxPairs, pools.matchEligibleCivilizationIds.length)
  if (maxPairCount < 2) {
    return null
  }

  const minPairCount = Math.min(Math.max(2, balanceConfig.matchMinPairs), maxPairCount)
  const pairCount = randomInRange(minPairCount, maxPairCount)
  const selectedCivilizationIds = reviewProfile?.hasFailures
    ? sampleWeightedWithoutReplacement(
      pools.matchEligibleCivilizationIds,
      pairCount,
      (civilizationId) => 1 + Number(reviewProfile.civWeights?.[civilizationId] ?? 0) * 2,
    )
    : sampleN(pools.matchEligibleCivilizationIds, pairCount)
  const pairings = selectedCivilizationIds
    .map((civilizationId) => {
      const civilization = civilizationById.get(civilizationId)
      const civilizationTechs = pools.crownTechsByCivilizationId[civilizationId] ?? []
      const crownTech = civilizationTechs.length > 0 ? sample(civilizationTechs) : null
      if (!civilization || !crownTech) {
        return null
      }

      return {
        civilizationId,
        civilizationName: civilization.name,
        civilizationIcon: civilization.icon,
        crownId: crownTech.id,
        crownName: crownTech.name,
        crownIcon: crownTech.crownIcon,
      }
    })
    .filter(Boolean)

  if (pairings.length < 2) {
    return null
  }

  return {
    id: `${index}:match:${pairings.length}`,
    variant: 'match',
    prompt: '',
    variantLabel: 'Match The Pairs',
    pairCount: pairings.length,
    crownChoices: shuffle(
      pairings.map((pairing) => ({
        id: pairing.crownId,
        name: pairing.crownName,
        icon: pairing.crownIcon,
      })),
    ),
    civChoices: shuffle(
      pairings.map((pairing) => ({
        id: pairing.civilizationId,
        name: pairing.civilizationName,
        icon: pairing.civilizationIcon,
      })),
    ),
    crownToCivId: Object.fromEntries(pairings.map((pairing) => [pairing.crownId, pairing.civilizationId])),
    civToCrownId: Object.fromEntries(pairings.map((pairing) => [pairing.civilizationId, pairing.crownId])),
    correctPairings: pairings.map((pairing) => ({
      civId: pairing.civilizationId,
      crownId: pairing.crownId,
    })),
  }
}

function generateQuestions(questionCount, pools, balanceConfig, reviewProfile = null) {
  if (pools.availableCrownTechs.length === 0) {
    return []
  }

  const questions = []
  const queue = shuffle(pools.availableCrownTechs)
  let queueIndex = 0
  let attempts = 0

  while (questions.length < questionCount && attempts < questionCount * 80) {
    attempts += 1
    const variant = pickVariant(balanceConfig.variantProbability)

    let question = null
    if (variant === 'match') {
      question = createMatchQuestion(questions.length, pools, balanceConfig, reviewProfile)
    } else {
      let crownTech = null
      if (reviewProfile?.hasFailures) {
        crownTech = pickWeightedItem(
          pools.availableCrownTechs,
          (candidate) => getCrownReviewWeight(candidate, reviewProfile),
          pools.availableCrownTechs[0],
        )
      } else {
        if (queueIndex >= queue.length) {
          queue.push(...shuffle(pools.availableCrownTechs))
        }

        crownTech = queue[queueIndex]
        queueIndex += 1
      }

      question = createTechQuestion(crownTech, questions.length, variant, pools, balanceConfig, reviewProfile)
    }

    if (question) {
      questions.push(question)
    }
  }

  return questions
}

function getMistakeTitleByVariant(variant) {
  if (variant === 'age') {
    return 'Correct crown age:'
  }
  if (variant === 'combo') {
    return 'Correct combination:'
  }
  if (variant === 'match') {
    return 'Wrong match. Red shows your wrong pair and orange shows the correct counterpart.'
  }
  return 'Correct civilization:'
}

export function CrownsTrainerPage() {
  const { difficulty } = useParams()
  const [searchParams] = useSearchParams()
  const difficultyConfig = useMemo(
    () => crownsTrainerDifficulties.find((candidate) => candidate.id === difficulty) ?? null,
    [difficulty],
  )
  const isValidDifficulty = Boolean(difficultyConfig)
  const effectiveDifficultyId = isValidDifficulty ? difficulty : 'easy'
  const isReviewMode = isReviewModeEnabled(searchParams)
  const reviewProfile = useMemo(
    () => (isReviewMode ? buildCrownsReviewProfile() : { civWeights: {}, crownWeights: {}, hasFailures: false }),
    [isReviewMode],
  )
  const targetQuestionCount = isReviewMode && !reviewProfile.hasFailures ? 1 : QUESTION_COUNT
  const initialQuestionCount = isReviewMode ? 1 : QUESTION_COUNT
  const menuRoute = isReviewMode ? '/crowns-trainer?mode=review' : '/crowns-trainer'
  const reviewModeLabel = isReviewMode ? ' | Review' : ''
  const balanceConfig = useMemo(() => getDifficultyBalance(effectiveDifficultyId), [effectiveDifficultyId])
  const difficultyPools = useMemo(() => buildDifficultyPools(effectiveDifficultyId), [effectiveDifficultyId])

  const [questions, setQuestions] = useState(() =>
    generateQuestions(initialQuestionCount, difficultyPools, balanceConfig, reviewProfile),
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selectedChoiceId, setSelectedChoiceId] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [selectedSearchCivId, setSelectedSearchCivId] = useState(null)
  const [selectedComboCivId, setSelectedComboCivId] = useState(null)
  const [selectedComboAgeId, setSelectedComboAgeId] = useState(null)
  const [selectedMatchCrownId, setSelectedMatchCrownId] = useState(null)
  const [selectedMatchCivId, setSelectedMatchCivId] = useState(null)
  const [matchedCrownIds, setMatchedCrownIds] = useState([])
  const [matchedCivIds, setMatchedCivIds] = useState([])
  const [failedMatchFeedback, setFailedMatchFeedback] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [locked, setLocked] = useState(false)
  const [needsContinue, setNeedsContinue] = useState(false)
  const [pendingFinish, setPendingFinish] = useState(false)
  const [finished, setFinished] = useState(false)
  const [highscores, setHighscores] = useState(() => readHighscores())

  const timeoutRef = useRef(null)
  const audioContextRef = useRef(null)
  const currentQuestion = questions[currentIndex]
  const currentHighscore = isValidDifficulty ? highscores[difficulty] ?? 0 : 0
  const correctCiv = currentQuestion ? civilizationById.get(currentQuestion.correctCivId) : null
  const correctAge = currentQuestion ? crownAgeChoiceById.get(currentQuestion.correctAgeId) : null
  const descriptionText = currentQuestion?.crownTech?.description?.trim() || 'No description available for this tech.'
  const isMatchVariant = currentQuestion?.variant === 'match'
  const isSearchVariant = currentQuestion?.variant === 'search'
  const selectedSearchCivilization = selectedSearchCivId ? civilizationById.get(selectedSearchCivId) : null
  const searchSuggestions = useMemo(() => {
    if (!isSearchVariant) {
      return []
    }

    const normalizedInput = searchInput.trim().toLowerCase()
    const matchingCivilizations = normalizedInput
      ? civilizations.filter((civilization) => civilization.name.toLowerCase().includes(normalizedInput))
      : civilizations

    return shuffle(matchingCivilizations).slice(0, 12)
  }, [isSearchVariant, searchInput])

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
    const onStorage = () => {
      setHighscores(readHighscores())
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    setQuestions(
      generateQuestions(
        initialQuestionCount,
        difficultyPools,
        balanceConfig,
        isReviewMode ? buildCrownsReviewProfile() : reviewProfile,
      ),
    )
    setCurrentIndex(0)
    setScore(0)
    setSelectedChoiceId(null)
    setSearchInput('')
    setSelectedSearchCivId(null)
    setSelectedComboCivId(null)
    setSelectedComboAgeId(null)
    setSelectedMatchCrownId(null)
    setSelectedMatchCivId(null)
    setMatchedCrownIds([])
    setMatchedCivIds([])
    setFailedMatchFeedback(null)
    setRevealed(false)
    setLocked(false)
    setNeedsContinue(false)
    setPendingFinish(false)
    setFinished(false)
  }, [difficultyPools, balanceConfig, initialQuestionCount, isReviewMode, reviewProfile])

  if (!isValidDifficulty) {
    return <Navigate to="/crowns-trainer" replace />
  }

  const clearPendingTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const resetQuestionInteractionState = () => {
    setSelectedChoiceId(null)
    setSearchInput('')
    setSelectedSearchCivId(null)
    setSelectedComboCivId(null)
    setSelectedComboAgeId(null)
    setSelectedMatchCrownId(null)
    setSelectedMatchCivId(null)
    setMatchedCrownIds([])
    setMatchedCivIds([])
    setFailedMatchFeedback(null)
    setRevealed(false)
    setLocked(false)
    setNeedsContinue(false)
    setPendingFinish(false)
  }

  const finishQuiz = () => {
    setFinished(true)
    setLocked(false)
    setNeedsContinue(false)
    setPendingFinish(false)
  }

  const scheduleNextQuestion = (delayMs) => {
    clearPendingTimeout()

    timeoutRef.current = setTimeout(() => {
      if (currentIndex + 1 >= questions.length) {
        const nextQuestion = generateQuestions(
          1,
          difficultyPools,
          balanceConfig,
          isReviewMode ? buildCrownsReviewProfile() : reviewProfile,
        )[0]
        if (nextQuestion) {
          setQuestions((currentQuestions) => [...currentQuestions, nextQuestion])
        } else {
          finishQuiz()
          return
        }
      }

      setCurrentIndex((previousIndex) => previousIndex + 1)
      resetQuestionInteractionState()
    }, delayMs)
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
      // Audio feedback is optional.
    }
  }

  const applyAnswerResult = (isCorrect) => {
    if (!currentQuestion) {
      return
    }

    recordCrownsQuestionResult(currentQuestion, isCorrect)
    playResultSound(isCorrect)

    const nextScore = score + (isCorrect ? 1 : 0)
    const answeredCount = currentIndex + 1
    const shouldFinish = answeredCount >= targetQuestionCount

    if (isCorrect) {
      setScore((previousScore) => previousScore + 1)
    }

    if (shouldFinish) {
      const nextHighscores = updateHighscore(difficulty, nextScore)
      setHighscores(nextHighscores)

      if (isCorrect) {
        scheduleNextQuestion(1100)
      } else {
        setNeedsContinue(true)
        setPendingFinish(true)
      }
      return
    }

    if (isCorrect) {
      scheduleNextQuestion(950)
    } else {
      setNeedsContinue(true)
      setPendingFinish(false)
    }
  }

  const onSelectSingleChoice = (choiceId, expectedChoiceId) => {
    if (!currentQuestion || locked || finished) {
      return
    }

    setSelectedChoiceId(choiceId)
    setRevealed(true)
    setLocked(true)
    applyAnswerResult(choiceId === expectedChoiceId)
  }

  const onSelectSearchCiv = (choiceId) => {
    if (!currentQuestion || currentQuestion.variant !== 'search' || locked || finished) {
      return
    }

    const selectedCivilization = civilizationById.get(choiceId)
    if (!selectedCivilization) {
      return
    }

    setSelectedSearchCivId(choiceId)
    setSearchInput(selectedCivilization.name)
    setRevealed(true)
    setLocked(true)
    applyAnswerResult(choiceId === currentQuestion.correctCivId)
  }

  const onSearchInputKeyDown = (event) => {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    const firstSuggestion = searchSuggestions[0]
    if (firstSuggestion) {
      onSelectSearchCiv(firstSuggestion.id)
    }
  }

  const onSelectCombo = (nextCivId, nextAgeId) => {
    if (!currentQuestion || currentQuestion.variant !== 'combo' || locked || finished || revealed) {
      return
    }

    if (!nextCivId || !nextAgeId) {
      return
    }

    setRevealed(true)
    setLocked(true)
    applyAnswerResult(nextCivId === currentQuestion.correctCivId && nextAgeId === currentQuestion.correctAgeId)
  }

  const onSelectComboCiv = (choiceId) => {
    if (!currentQuestion || currentQuestion.variant !== 'combo' || locked || finished || revealed) {
      return
    }

    setSelectedComboCivId(choiceId)
    onSelectCombo(choiceId, selectedComboAgeId)
  }

  const onSelectComboAge = (choiceId) => {
    if (!currentQuestion || currentQuestion.variant !== 'combo' || locked || finished || revealed) {
      return
    }

    setSelectedComboAgeId(choiceId)
    onSelectCombo(selectedComboCivId, choiceId)
  }

  const onSelectMatch = (nextCrownId, nextCivId) => {
    if (!currentQuestion || currentQuestion.variant !== 'match' || locked || finished || revealed) {
      return
    }
    if (!nextCrownId || !nextCivId) {
      return
    }

    const correctCivId = currentQuestion.crownToCivId[nextCrownId]
    const correctCrownId = currentQuestion.civToCrownId[nextCivId]
    if (correctCivId === nextCivId) {
      const nextMatchedCrownIds = matchedCrownIds.includes(nextCrownId)
        ? matchedCrownIds
        : [...matchedCrownIds, nextCrownId]
      const nextMatchedCivIds = matchedCivIds.includes(nextCivId) ? matchedCivIds : [...matchedCivIds, nextCivId]

      setMatchedCrownIds(nextMatchedCrownIds)
      setMatchedCivIds(nextMatchedCivIds)
      setSelectedMatchCrownId(null)
      setSelectedMatchCivId(null)

      if (nextMatchedCrownIds.length >= currentQuestion.pairCount) {
        setRevealed(true)
        setLocked(true)
        applyAnswerResult(true)
      }
      return
    }

    setFailedMatchFeedback({
      selectedCrownId: nextCrownId,
      selectedCivId: nextCivId,
      correctCivId,
      correctCrownId,
    })
    setRevealed(true)
    setLocked(true)
    applyAnswerResult(false)
  }

  const onSelectMatchCrown = (choiceId) => {
    if (!currentQuestion || currentQuestion.variant !== 'match' || locked || finished || revealed) {
      return
    }
    if (matchedCrownIds.includes(choiceId)) {
      return
    }

    setSelectedMatchCrownId(choiceId)
    onSelectMatch(choiceId, selectedMatchCivId)
  }

  const onSelectMatchCiv = (choiceId) => {
    if (!currentQuestion || currentQuestion.variant !== 'match' || locked || finished || revealed) {
      return
    }
    if (matchedCivIds.includes(choiceId)) {
      return
    }

    setSelectedMatchCivId(choiceId)
    onSelectMatch(selectedMatchCrownId, choiceId)
  }

  const onContinueAfterMistake = () => {
    playMenuClickSound()
    if (!needsContinue) {
      return
    }

    if (pendingFinish) {
      finishQuiz()
      return
    }

    scheduleNextQuestion(0)
  }

  const onRetry = () => {
    playMenuClickSound()
    clearPendingTimeout()
    setQuestions(
      generateQuestions(
        initialQuestionCount,
        difficultyPools,
        balanceConfig,
        isReviewMode ? buildCrownsReviewProfile() : reviewProfile,
      ),
    )
    setCurrentIndex(0)
    setScore(0)
    resetQuestionInteractionState()
    setFinished(false)
  }

  if (questions.length === 0) {
    return (
      <main className="screen">
        <section className="panel tech-panel">
          <h1 className="section-title">Crowns Trainer</h1>
          <p className="section-subtitle">Could not generate crown-tech questions for this difficulty balance.</p>
          <Link to={menuRoute} className="back-link" onClick={playMenuClickSound}>
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
          <h1 className="section-title">Crowns Trainer</h1>
          <p className="section-subtitle">{difficultyConfig.title} complete{reviewModeLabel}.</p>

          <div className="quiz-end-card">
            <p className="quiz-end-score">Score: {score}</p>
            <p className="section-subtitle">Highscore ({difficultyConfig.title}): {currentHighscore}</p>
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

  if (!currentQuestion) {
    return (
      <main className="screen">
        <section className="panel tech-panel">
          <h1 className="section-title">Crowns Trainer</h1>
          <p className="section-subtitle">Loading question...</p>
        </section>
      </main>
    )
  }

  const singleCorrectChoiceId =
    currentQuestion.variant === 'age' ? currentQuestion.correctAgeId : currentQuestion.correctCivId
  const questionModeIndicator =
    currentQuestion.variant === 'age'
      ? 'Crown Age'
      : currentQuestion.variant === 'combo'
        ? 'Dual Guess'
        : currentQuestion.variant === 'search'
          ? 'Search'
        : 'Civilization'
  const questionIcon =
    currentQuestion.variant === 'age' ? currentQuestion.crownTech.civilizationIcon : currentQuestion.crownTech?.crownIcon
  const questionGroupLabel = currentQuestion.variant === 'age' ? 'Civilization shown' : 'Unique Tech'

  return (
    <main className="screen">
      <section className="panel tech-panel">
        <div className="top-bar quiz-top-bar">
          <Link to={menuRoute} className="back-link" onClick={playMenuClickSound}>
            Back to Difficulty Menu
          </Link>
          <p className="count-label quiz-stats">
            {difficultyConfig.title}{reviewModeLabel} | Question {currentIndex + 1} | Score {score}
          </p>
        </div>

        <h1 className="section-title">Crowns Trainer</h1>
        <p className="section-subtitle">
          {isMatchVariant ? 'Match each crown tech with its civilization.' : currentQuestion.prompt}
        </p>

        {isMatchVariant ? (
          <article className="question-card crowns-no-icon">
            <div>
              <p className="question-mode-indicator has-mode">
                <span className="question-mode-icon">+</span>
                <span>Match The Pairs</span>
              </p>
              <p className="question-group">{currentQuestion.pairCount} Pairs</p>
              <h2 className="question-label">Crowns and Civilizations</h2>
              <p className="question-variant-label">{currentQuestion.variantLabel}</p>
            </div>
          </article>
        ) : (
          <article className={`question-card ${currentQuestion.variant === 'combo' ? 'crowns-no-icon' : ''}`}>
            {currentQuestion.variant !== 'combo' && (
              <div className="question-tech-column">
                <div className="question-tech-icons single">
                  <div className="question-tech-chip">
                    <img
                      src={questionIcon}
                      alt=""
                      className="question-tech-icon"
                      onError={(event) => {
                        event.currentTarget.src = '/img/missing.png'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="question-mode-indicator has-mode">
                <span className="question-mode-icon">+</span>
                <span>{questionModeIndicator}</span>
              </p>
              <p className="question-group">{questionGroupLabel}</p>
              <h2 className="question-label">{currentQuestion.crownTech.name}</h2>
              <p className="question-variant-label">{currentQuestion.variantLabel}</p>
              <p className="crown-tech-description">{descriptionText}</p>
            </div>
          </article>
        )}

        {(currentQuestion.variant === 'civ' || currentQuestion.variant === 'age') && (
          <div className="choices-grid" style={{ '--choice-columns': currentQuestion.variant === 'age' ? 2 : 4 }}>
            {currentQuestion.choices.map((choice) => {
              const isSelected = selectedChoiceId === choice.id
              const isCorrectSelection = revealed && isSelected && choice.id === singleCorrectChoiceId
              const isWrongSelection = revealed && isSelected && choice.id !== singleCorrectChoiceId
              const revealCorrectAnswer =
                revealed && isSelected === false && selectedChoiceId !== null && choice.id === singleCorrectChoiceId

              return (
                <button
                  key={choice.id}
                  type="button"
                  className={`choice-button ${isCorrectSelection ? 'correct' : ''} ${
                    isWrongSelection ? 'wrong' : ''
                  } ${revealCorrectAnswer ? 'missed' : ''}`}
                  onClick={() => onSelectSingleChoice(choice.id, singleCorrectChoiceId)}
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
                  <span>{choice.name ?? choice.label}</span>
                </button>
              )
            })}
          </div>
        )}

        {currentQuestion.variant === 'search' && (
          <section className="bonuses-search-wrap">
            <label htmlFor="crowns-search-input" className="bonuses-search-label">
              Search civilization
            </label>
            <input
              id="crowns-search-input"
              type="text"
              className="bonuses-search-input"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={onSearchInputKeyDown}
              autoComplete="off"
              placeholder="Type a civilization name..."
              disabled={locked}
            />

            {!locked && (
              <div className="bonuses-search-list">
                {searchSuggestions.length === 0 ? (
                  <p className="bonuses-search-empty">No civilizations match your search.</p>
                ) : (
                  searchSuggestions.map((civilization) => (
                    <button
                      key={civilization.id}
                      type="button"
                      className="bonuses-search-option"
                      onClick={() => onSelectSearchCiv(civilization.id)}
                    >
                      <img
                        src={civilization.icon}
                        alt=""
                        className="bonuses-search-option-icon"
                        onError={(event) => {
                          event.currentTarget.src = '/img/missing.png'
                        }}
                      />
                      <span>{civilization.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {revealed && selectedSearchCivilization && (
              <article
                className={`mistake-review-civ bonuses-search-selection ${
                  selectedSearchCivId === currentQuestion.correctCivId ? 'correct' : 'wrong'
                }`}
              >
                <img
                  src={selectedSearchCivilization.icon}
                  alt=""
                  className="mistake-review-civ-icon"
                  onError={(event) => {
                    event.currentTarget.src = '/img/missing.png'
                  }}
                />
                <span>{selectedSearchCivilization.name}</span>
              </article>
            )}
          </section>
        )}

        {currentQuestion.variant === 'combo' && (
          <div className="crowns-combo-answer-grid">
            <section className="crowns-answer-column">
              <p className="crowns-answer-column-title">Civilization</p>
              <div className="choices-grid" style={{ '--choice-columns': 2 }}>
                {currentQuestion.civChoices.map((choice) => {
                  const isSelected = selectedComboCivId === choice.id
                  const isCorrect = choice.id === currentQuestion.correctCivId
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
                      onClick={() => onSelectComboCiv(choice.id)}
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
            </section>

            <section className="crowns-answer-column">
              <p className="crowns-answer-column-title">Crown Age</p>
              <div className="choices-grid" style={{ '--choice-columns': 2 }}>
                {currentQuestion.ageChoices.map((choice) => {
                  const isSelected = selectedComboAgeId === choice.id
                  const isCorrect = choice.id === currentQuestion.correctAgeId
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
                      onClick={() => onSelectComboAge(choice.id)}
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
                      <span>{choice.label}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        )}

        {currentQuestion.variant === 'match' && (
          <div className="crowns-match-grid">
            <section className="crowns-answer-column crowns-match-column">
              <p className="crowns-answer-column-title">Crowns ({matchedCrownIds.length}/{currentQuestion.pairCount})</p>
              <div className="crowns-match-list">
                {currentQuestion.crownChoices.map((choice) => {
                  const isMatched = matchedCrownIds.includes(choice.id)
                  const isSelected = selectedMatchCrownId === choice.id
                  let stateClass = ''

                  if (isMatched) {
                    stateClass = 'correct'
                  } else if (revealed && failedMatchFeedback) {
                    if (choice.id === failedMatchFeedback.selectedCrownId) {
                      stateClass = 'wrong'
                    } else if (choice.id === failedMatchFeedback.correctCrownId) {
                      stateClass = 'missed'
                    }
                  } else if (isSelected) {
                    stateClass = 'selected'
                  }

                  return (
                    <button
                      key={choice.id}
                      type="button"
                      className={`choice-button crowns-match-button ${stateClass}`}
                      onClick={() => onSelectMatchCrown(choice.id)}
                      disabled={locked || isMatched}
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
            </section>

            <section className="crowns-answer-column crowns-match-column">
              <p className="crowns-answer-column-title">
                Civilizations ({matchedCivIds.length}/{currentQuestion.pairCount})
              </p>
              <div className="crowns-match-list">
                {currentQuestion.civChoices.map((choice) => {
                  const isMatched = matchedCivIds.includes(choice.id)
                  const isSelected = selectedMatchCivId === choice.id
                  let stateClass = ''

                  if (isMatched) {
                    stateClass = 'correct'
                  } else if (revealed && failedMatchFeedback) {
                    if (choice.id === failedMatchFeedback.selectedCivId) {
                      stateClass = 'wrong'
                    } else if (choice.id === failedMatchFeedback.correctCivId) {
                      stateClass = 'missed'
                    }
                  } else if (isSelected) {
                    stateClass = 'selected'
                  }

                  return (
                    <button
                      key={choice.id}
                      type="button"
                      className={`choice-button crowns-match-button ${stateClass}`}
                      onClick={() => onSelectMatchCiv(choice.id)}
                      disabled={locked || isMatched}
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
            </section>
          </div>
        )}

        {needsContinue && (
          <>
            <button type="button" className="continue-after-miss-button" onClick={onContinueAfterMistake}>
              Continue
            </button>

            <section className="mistake-review-panel">
              <p className="mistake-review-title">{getMistakeTitleByVariant(currentQuestion.variant)}</p>
              {currentQuestion.variant !== 'match' && (
                <div className="mistake-review-grid">
                  {currentQuestion.variant !== 'age' && correctCiv && (
                    <article className="mistake-review-civ">
                      <img
                        src={correctCiv.icon}
                        alt=""
                        className="mistake-review-civ-icon"
                        onError={(event) => {
                          event.currentTarget.src = '/img/missing.png'
                        }}
                      />
                      <span>{correctCiv.name}</span>
                    </article>
                  )}

                  {(currentQuestion.variant === 'age' || currentQuestion.variant === 'combo') && correctAge && (
                    <article className="mistake-review-civ">
                      <img
                        src={correctAge.icon}
                        alt=""
                        className="mistake-review-civ-icon"
                        onError={(event) => {
                          event.currentTarget.src = '/img/missing.png'
                        }}
                      />
                      <span>{correctAge.label}</span>
                    </article>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  )
}
