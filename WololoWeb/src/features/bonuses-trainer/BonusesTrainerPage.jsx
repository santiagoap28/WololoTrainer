import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { civilizations } from '../civilizations/civilizationsData.js'
import { getAllowedCivilizationsForDifficulty } from '../civilizations/civilizationDifficultyPools.js'
import { playMenuClickSound } from '../../shared/audio/uiSounds.js'
import { bonusesTrainerDifficulties, civilizationBonuses } from './bonusesData.js'
import { readHighscores, updateHighscore } from './highscores.js'
import { readBonusesStats, recordBonusesQuestionResult } from './bonusesStats.js'
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

const DEFAULT_BALANCE = {
  multipleChoice: {
    minOptions: 3,
    maxOptions: 4,
  },
  variantProbability: {
    multiple: 0.8,
    search: 0.2,
  },
}

const FALLBACK_BALANCE_BY_DIFFICULTY = {
  easy: DEFAULT_BALANCE,
  medium: {
    ...DEFAULT_BALANCE,
    multipleChoice: { minOptions: 3, maxOptions: 5 },
  },
  hard: {
    ...DEFAULT_BALANCE,
    multipleChoice: { minOptions: 4, maxOptions: 6 },
  },
  extreme: {
    ...DEFAULT_BALANCE,
    multipleChoice: { minOptions: 4, maxOptions: 7 },
  },
  legendary: {
    ...DEFAULT_BALANCE,
    multipleChoice: { minOptions: 5, maxOptions: 9 },
  },
}

const civilizationById = new Map(civilizations.map((civilization) => [civilization.id, civilization]))

function shuffle(items) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function sampleN(items, count) {
  return shuffle(items).slice(0, count)
}

function randomInRange(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
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
  const rawMultipleChoice = rawBalance?.multipleChoice ?? {}
  const rawVariantProbability = rawBalance?.variantProbability ?? {}
  const fallbackMultipleChoice = fallbackBalance.multipleChoice
  const fallbackVariantProbability = fallbackBalance.variantProbability ?? DEFAULT_BALANCE.variantProbability

  const multipleChoiceMinChoices = toChoiceCount(rawMultipleChoice.minOptions, fallbackMultipleChoice.minOptions, 2)
  const multipleChoiceMaxChoices = Math.max(
    multipleChoiceMinChoices,
    toChoiceCount(rawMultipleChoice.maxOptions, fallbackMultipleChoice.maxOptions, 2),
  )

  return {
    multipleChoiceMinChoices,
    multipleChoiceMaxChoices,
    variantProbability: {
      multiple: toProbability(rawVariantProbability.multiple, fallbackVariantProbability.multiple),
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
  const availableBonuses = civilizationBonuses.filter((bonus) => allowedCivilizationIds.has(bonus.civilizationId))

  return {
    allowedCivilizations,
    availableBonuses,
  }
}

function buildBonusesReviewProfile() {
  const stats = readBonusesStats()
  const civWeights = createCounterMissMap(stats.civs)
  const bonusWeights = createCounterMissMap(stats.bonuses)
  const hasFailures = hasAnyFailures(civWeights) || hasAnyFailures(bonusWeights)

  return {
    civWeights,
    bonusWeights,
    hasFailures,
  }
}

function getBonusReviewWeight(bonus, reviewProfile) {
  if (!reviewProfile?.hasFailures) {
    return 1
  }

  const civWeight = Number(reviewProfile.civWeights?.[bonus.civilizationId] ?? 0)
  const bonusWeight = Number(reviewProfile.bonusWeights?.[bonus.id] ?? 0)
  return 1 + civWeight * 2 + bonusWeight * 3
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

function pickVariant(variantProbability) {
  const weightedVariants = [
    { id: 'multiple', weight: Math.max(0, variantProbability.multiple ?? 0) },
    { id: 'search', weight: Math.max(0, variantProbability.search ?? 0) },
  ]
  const totalWeight = weightedVariants.reduce((sum, variant) => sum + variant.weight, 0)
  if (totalWeight <= 0) {
    return 'multiple'
  }

  let cursor = Math.random() * totalWeight
  for (const variant of weightedVariants) {
    cursor -= variant.weight
    if (cursor <= 0) {
      return variant.id
    }
  }

  return 'multiple'
}

function createMultipleChoiceQuestion(bonus, index, pools, balanceConfig, reviewProfile = null) {
  const choices = createCivChoices(
    bonus.civilizationId,
    pools.allowedCivilizations,
    balanceConfig.multipleChoiceMinChoices,
    balanceConfig.multipleChoiceMaxChoices,
    reviewProfile,
  )
  if (!choices) {
    return null
  }

  return {
    id: `${index}:${bonus.id}`,
    variant: 'multiple',
    prompt: 'Which civilization has this bonus?',
    bonus,
    correctCivId: bonus.civilizationId,
    choices,
    variantLabel: 'Multiple Choice',
  }
}

function createSearchQuestion(bonus, index) {
  return {
    id: `${index}:${bonus.id}:search`,
    variant: 'search',
    prompt: 'Search and select the civilization with this bonus.',
    bonus,
    correctCivId: bonus.civilizationId,
    variantLabel: 'Search',
  }
}

function createQuestion(bonus, index, pools, balanceConfig, reviewProfile = null) {
  const variant = pickVariant(balanceConfig.variantProbability)
  if (variant === 'search') {
    return createSearchQuestion(bonus, index)
  }

  const multipleChoiceQuestion = createMultipleChoiceQuestion(bonus, index, pools, balanceConfig, reviewProfile)
  if (multipleChoiceQuestion) {
    return multipleChoiceQuestion
  }

  return createSearchQuestion(bonus, index)
}

function generateQuestions(questionCount, pools, balanceConfig, reviewProfile = null) {
  if (pools.availableBonuses.length === 0) {
    return []
  }

  const questions = []
  const queue = shuffle(pools.availableBonuses)
  let queueIndex = 0
  let attempts = 0

  while (questions.length < questionCount && attempts < questionCount * 40) {
    attempts += 1

    let bonus = null
    if (reviewProfile?.hasFailures) {
      bonus = pickWeightedItem(
        pools.availableBonuses,
        (candidate) => getBonusReviewWeight(candidate, reviewProfile),
        pools.availableBonuses[0],
      )
    } else {
      if (queueIndex >= queue.length) {
        queue.push(...shuffle(pools.availableBonuses))
      }

      bonus = queue[queueIndex]
      queueIndex += 1
    }

    const question = createQuestion(bonus, questions.length, pools, balanceConfig, reviewProfile)
    if (question) {
      questions.push(question)
    }
  }

  return questions
}

export function BonusesTrainerPage() {
  const { difficulty } = useParams()
  const [searchParams] = useSearchParams()
  const difficultyConfig = useMemo(
    () => bonusesTrainerDifficulties.find((candidate) => candidate.id === difficulty) ?? null,
    [difficulty],
  )
  const isValidDifficulty = Boolean(difficultyConfig)
  const effectiveDifficultyId = isValidDifficulty ? difficulty : 'easy'
  const isReviewMode = isReviewModeEnabled(searchParams)
  const menuRoute = isReviewMode ? '/bonuses-trainer?mode=review' : '/bonuses-trainer'
  const reviewModeLabel = isReviewMode ? ' | Review' : ''
  const reviewProfile = useMemo(
    () => (isReviewMode ? buildBonusesReviewProfile() : { civWeights: {}, bonusWeights: {}, hasFailures: false }),
    [isReviewMode],
  )
  const balanceConfig = useMemo(() => getDifficultyBalance(effectiveDifficultyId), [effectiveDifficultyId])
  const difficultyPools = useMemo(() => buildDifficultyPools(effectiveDifficultyId), [effectiveDifficultyId])
  const targetQuestionCount = isReviewMode && !reviewProfile.hasFailures ? 1 : QUESTION_COUNT
  const initialQuestionCount = isReviewMode ? 1 : targetQuestionCount

  const [questions, setQuestions] = useState(() =>
    generateQuestions(initialQuestionCount, difficultyPools, balanceConfig, reviewProfile),
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selectedChoiceId, setSelectedChoiceId] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [selectedSearchCivId, setSelectedSearchCivId] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [locked, setLocked] = useState(false)
  const [hasMissed, setHasMissed] = useState(false)
  const [needsContinue, setNeedsContinue] = useState(false)
  const [pendingFinish, setPendingFinish] = useState(false)
  const [finished, setFinished] = useState(false)
  const [highscores, setHighscores] = useState(() => readHighscores())

  const timeoutRef = useRef(null)
  const audioContextRef = useRef(null)
  const currentQuestion = questions[currentIndex]
  const currentHighscore = isValidDifficulty ? highscores[difficulty] ?? 0 : 0
  const correctCiv = currentQuestion ? civilizationById.get(currentQuestion.correctCivId) : null
  const selectedSearchCivilization = selectedSearchCivId ? civilizationById.get(selectedSearchCivId) : null
  const isSearchVariant = currentQuestion?.variant === 'search'
  const choiceColumns = Math.max(2, Math.min(4, currentQuestion?.choices?.length ?? 4))
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
        isReviewMode ? buildBonusesReviewProfile() : reviewProfile,
      ),
    )
    setCurrentIndex(0)
    setScore(0)
    setSelectedChoiceId(null)
    setSearchInput('')
    setSelectedSearchCivId(null)
    setRevealed(false)
    setLocked(false)
    setHasMissed(false)
    setNeedsContinue(false)
    setPendingFinish(false)
    setFinished(false)
  }, [difficultyPools, balanceConfig, initialQuestionCount, isReviewMode, reviewProfile])

  if (!isValidDifficulty) {
    return <Navigate to="/bonuses-trainer" replace />
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

  const scheduleAdvance = (delayMs) => {
    clearPendingTimeout()

    timeoutRef.current = setTimeout(() => {
      setCurrentIndex((previousIndex) => previousIndex + 1)
      resetQuestionInteractionState()
    }, delayMs)
  }

  const generateSingleQuestion = () => {
    const generatedQuestions = generateQuestions(
      1,
      difficultyPools,
      balanceConfig,
      isReviewMode ? buildBonusesReviewProfile() : reviewProfile,
    )
    return generatedQuestions[0] ?? null
  }

  const queueNextQuestion = (delayMs) => {
    if (currentIndex + 1 >= questions.length) {
      const nextQuestion = generateSingleQuestion()
      if (nextQuestion) {
        setQuestions((currentQuestions) => [...currentQuestions, nextQuestion])
      } else {
        clearPendingTimeout()
        timeoutRef.current = setTimeout(() => {
          finishQuiz()
        }, delayMs)
        return
      }
    }

    scheduleAdvance(delayMs)
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

  const applyAnswerResult = (isCorrect) => {
    if (!currentQuestion) {
      return
    }

    recordBonusesQuestionResult(currentQuestion, isCorrect)
    playResultSound(isCorrect)

    const nextHasMissed = hasMissed || !isCorrect
    const answeredCount = currentIndex + 1
    const shouldFinish = isReviewMode
      ? answeredCount >= targetQuestionCount
      : answeredCount >= targetQuestionCount && nextHasMissed
    const nextScore = score + (isCorrect ? 1 : 0)

    if (isCorrect) {
      setScore((previousScore) => previousScore + 1)
    }
    setHasMissed(nextHasMissed)

    if (!isCorrect) {
      const nextHighscores = updateHighscore(difficulty, nextScore)
      setHighscores(nextHighscores)
      setNeedsContinue(true)
      setPendingFinish(shouldFinish)
      return
    }

    if (shouldFinish) {
      const nextHighscores = updateHighscore(difficulty, nextScore)
      setHighscores(nextHighscores)
      clearPendingTimeout()
      timeoutRef.current = setTimeout(() => {
        finishQuiz()
      }, 850)
      return
    }

    queueNextQuestion(850)
  }

  const onSelectChoice = (choiceId) => {
    if (!currentQuestion || currentQuestion.variant !== 'multiple' || locked || finished) {
      return
    }

    setSelectedChoiceId(choiceId)
    setRevealed(true)
    setLocked(true)
    applyAnswerResult(choiceId === currentQuestion.correctCivId)
  }

  const onSelectSearchChoice = (choiceId) => {
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
      onSelectSearchChoice(firstSuggestion.id)
    }
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

    queueNextQuestion(0)
  }

  const onRetry = () => {
    playMenuClickSound()
    clearPendingTimeout()
    setQuestions(
      generateQuestions(
        initialQuestionCount,
        difficultyPools,
        balanceConfig,
        isReviewMode ? buildBonusesReviewProfile() : reviewProfile,
      ),
    )
    setCurrentIndex(0)
    setScore(0)
    setHasMissed(false)
    resetQuestionInteractionState()
    setFinished(false)
  }

  if (questions.length === 0) {
    return (
      <main className="screen">
        <section className="panel tech-panel">
          <h1 className="section-title">Bonuses Trainer</h1>
          <p className="section-subtitle">Could not generate bonus questions for this difficulty balance.</p>
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
          <h1 className="section-title">Bonuses Trainer</h1>
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
          <h1 className="section-title">Bonuses Trainer</h1>
          <p className="section-subtitle">Loading question...</p>
        </section>
      </main>
    )
  }

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

        <h1 className="section-title">Bonuses Trainer</h1>
        <p className="section-subtitle">{currentQuestion.prompt}</p>

        <article className="question-card crowns-no-icon">
          <div>
            <p className="question-mode-indicator has-mode">
              <span className="question-mode-icon">+</span>
              <span>{currentQuestion.bonus.typeLabel}</span>
            </p>
            <p className="question-group">Bonus</p>
            <h2 className="question-label bonus-question-text">{currentQuestion.bonus.text}</h2>
            <p className="question-variant-label">{currentQuestion.variantLabel ?? 'Civilization Guess'}</p>
          </div>
        </article>

        {currentQuestion.variant === 'multiple' && (
          <div className="choices-grid" style={{ '--choice-columns': choiceColumns }}>
            {currentQuestion.choices.map((choice) => {
              const isSelected = selectedChoiceId === choice.id
              const isCorrectSelection = revealed && isSelected && choice.id === currentQuestion.correctCivId
              const isWrongSelection = revealed && isSelected && choice.id !== currentQuestion.correctCivId
              const revealCorrectAnswer =
                revealed &&
                isSelected === false &&
                selectedChoiceId !== null &&
                choice.id === currentQuestion.correctCivId

              return (
                <button
                  key={choice.id}
                  type="button"
                  className={`choice-button ${isCorrectSelection ? 'correct' : ''} ${
                    isWrongSelection ? 'wrong' : ''
                  } ${revealCorrectAnswer ? 'missed' : ''}`}
                  onClick={() => onSelectChoice(choice.id)}
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

        {currentQuestion.variant === 'search' && (
          <section className="bonuses-search-wrap">
            <label htmlFor="bonuses-search-input" className="bonuses-search-label">
              Search civilization
            </label>
            <input
              id="bonuses-search-input"
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
                      onClick={() => onSelectSearchChoice(civilization.id)}
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

        {needsContinue && (
          <>
            <button type="button" className="continue-after-miss-button" onClick={onContinueAfterMistake}>
              Continue
            </button>

            <section className="mistake-review-panel">
              <p className="mistake-review-title">Correct civilization:</p>
              <div className="mistake-review-grid">
                {correctCiv && (
                  <article className={`mistake-review-civ ${currentQuestion.variant === 'search' ? 'wrong' : ''}`}>
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
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  )
}
