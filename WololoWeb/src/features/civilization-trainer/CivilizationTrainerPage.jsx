import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { crownTechs } from '../crowns-trainer/crownsData.js'
import { civilizations, techTreeTrainerOptions } from '../civilizations/civilizationsData.js'
import { getAllowedCivilizationIdsForDifficulty } from '../civilizations/civilizationDifficultyPools.js'
import {
  playCorrectSound,
  playMenuClickSound,
  playSectionFailSound,
  playSectionSuccessSound,
  playWrongSound,
} from '../../shared/audio/uiSounds.js'
import {
  allCivilizationTrainerBonuses,
  civilizationBonusSheets,
  civilizationTrainerDifficulties,
} from './civilizationTrainerData.js'
import { readHighscores, updateHighscore } from './highscores.js'
import { readCivilizationTrainerStats, recordCivilizationTrainerResult } from './civilizationTrainerStats.js'
import { createCounterMissMap, hasAnyFailures, isReviewModeEnabled, pickWeightedItem } from '../../shared/reviewMode.js'

const BONUS_ATTEMPTS = 5
const CROWN_ATTEMPTS = 3

const DIFFICULTY_RANK = {
  easy: 0,
  medium: 1,
  hard: 2,
  extreme: 3,
  legendary: 4,
}

const UNIT_GROUP_KEYS = new Set(['barracks', 'stable', 'archeryRange'])
const EXCLUDED_UNIT_TYPE_OPTION_KEYS = new Set(['stable:steppe-lancer', 'archeryRange:elephant-archer'])

const civilizationById = new Map(civilizations.map((civilization) => [civilization.id, civilization]))

const unitTypeOptions = techTreeTrainerOptions.filter(
  (option) => UNIT_GROUP_KEYS.has(option.groupKey) && !EXCLUDED_UNIT_TYPE_OPTION_KEYS.has(option.key),
)
const blacksmithOptions = techTreeTrainerOptions.filter((option) => option.groupKey === 'blacksmithUpgrades')
const militaryUpgradeOptions = techTreeTrainerOptions.filter((option) => option.groupKey === 'militaryUpgrades')
const defenseOptions = techTreeTrainerOptions.filter((option) => option.groupKey === 'defenses')
const monasteryOptions = techTreeTrainerOptions.filter((option) => option.groupKey === 'monastery')
const SEARCH_SUGGESTION_LIMIT = 14

const UNIT_TYPE_COLUMNS = [
  {
    title: 'ARCHERY RANGE',
    optionKeys: [
      'archeryRange:crossbowman',
      'archeryRange:arbalester',
      'archeryRange:elite-skirmisher',
      'archeryRange:cavalry-archer',
      'archeryRange:heavy-cavalry-archer',
    ],
  },
  {
    title: 'BARRACKS',
    optionKeys: [
      'barracks:two-handed-swordsman',
      'barracks:champion',
      'barracks:pikeman',
      'barracks:halberdier',
      'barracks:fire-lancer',
    ],
  },
  {
    title: 'STABLE',
    optionKeys: [
      'stable:light-cavalry',
      'stable:hussar',
      'stable:knight',
      'stable:cavalier',
      'stable:paladin',
      'stable:camel',
      'stable:heavy-camel',
      'stable:battle-elephant',
      'stable:elite-battle-elephant',
    ],
  },
]

const BLACKSMITH_TECH_COLUMNS = [
  {
    optionKeys: ['blacksmithUpgrades:bracer'],
  },
  {
    optionKeys: ['blacksmithUpgrades:iron-casting', 'blacksmithUpgrades:blast-furnace'],
  },
  {
    optionKeys: ['blacksmithUpgrades:chain-mail-armor', 'blacksmithUpgrades:plate-mail-armor'],
  },
  {
    optionKeys: ['blacksmithUpgrades:chain-barding-armor', 'blacksmithUpgrades:plate-barding-armor'],
  },
  {
    optionKeys: ['blacksmithUpgrades:leather-archer-armor', 'blacksmithUpgrades:ring-archer-armor'],
  },
]

const TECH_SECTION_LAYOUT_BY_ID = {
  'unit-types': UNIT_TYPE_COLUMNS,
  blacksmith: BLACKSMITH_TECH_COLUMNS,
}

const AUTO_SELECT_DEPENDENCIES_BY_KEY = new Map([
  ['archeryRange:arbalester', ['archeryRange:crossbowman']],
  ['archeryRange:heavy-cavalry-archer', ['archeryRange:cavalry-archer']],
  ['barracks:champion', ['barracks:two-handed-swordsman']],
  ['barracks:halberdier', ['barracks:pikeman']],
  ['stable:hussar', ['stable:light-cavalry']],
  ['stable:cavalier', ['stable:knight']],
  ['stable:paladin', ['stable:knight', 'stable:cavalier']],
  ['stable:heavy-camel', ['stable:camel']],
  ['stable:elite-battle-elephant', ['stable:battle-elephant']],
  ['blacksmithUpgrades:blast-furnace', ['blacksmithUpgrades:iron-casting']],
  ['blacksmithUpgrades:plate-mail-armor', ['blacksmithUpgrades:chain-mail-armor']],
  ['blacksmithUpgrades:plate-barding-armor', ['blacksmithUpgrades:chain-barding-armor']],
  ['blacksmithUpgrades:ring-archer-armor', ['blacksmithUpgrades:leather-archer-armor']],
])

const allCrownDescriptionEntries = crownTechs
  .map((crownTech) => ({
    id: `${crownTech.civilizationId}:${crownTech.crownType === 'silver' ? 'castle' : 'imperial'}`,
    civilizationId: crownTech.civilizationId,
    crownType: crownTech.crownType === 'silver' ? 'castle' : 'imperial',
    text: String(crownTech.description ?? crownTech.name ?? '')
      .replace(/\s+/g, ' ')
      .trim(),
  }))
  .filter((entry) => entry.text.length > 0)

function buildDifficultyPool(difficultyId) {
  const allowedCivilizationIds = getAllowedCivilizationIdsForDifficulty(difficultyId)
  const sheets = civilizationBonusSheets.filter((sheet) => allowedCivilizationIds.has(sheet.civilizationId))
  return sheets.length > 0 ? sheets : civilizationBonusSheets
}

function pickRandomSheet(sheets) {
  if (!Array.isArray(sheets) || sheets.length === 0) {
    return null
  }

  return sheets[Math.floor(Math.random() * sheets.length)]
}

function buildCivilizationTrainerReviewProfile() {
  const stats = readCivilizationTrainerStats()
  const civWeights = createCounterMissMap(stats.civs)
  const hasFailures = hasAnyFailures(civWeights)

  return {
    civWeights,
    hasFailures,
  }
}

function pickSheetForSession(sheets, reviewProfile = null) {
  if (!Array.isArray(sheets) || sheets.length === 0) {
    return null
  }

  if (!reviewProfile?.hasFailures) {
    return pickRandomSheet(sheets)
  }

  return pickWeightedItem(
    sheets,
    (sheet) => 1 + Number(reviewProfile.civWeights?.[sheet.civilizationId] ?? 0) * 3,
    sheets[0],
  )
}

function normalizeForSearch(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function shuffle(items) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }

  return result
}

function matchesSearchEntry(entry, normalizedInput) {
  const normalizedText = normalizeForSearch(entry.text)
  if (!normalizedText || !normalizedInput) {
    return false
  }

  return normalizedText.includes(normalizedInput)
}

function buildTechSectionsForDifficulty(difficultyId) {
  const rank = DIFFICULTY_RANK[difficultyId] ?? 0
  const sections = [
    {
      id: 'unit-types',
      title: 'Unit Types',
      options: unitTypeOptions,
    },
  ]

  if (rank >= 1) {
    sections.push(
      {
        id: 'blacksmith',
        title: 'Blacksmith Techs',
        options: blacksmithOptions,
      },
      {
        id: 'military-upgrades',
        title: 'Military Upgrades',
        options: militaryUpgradeOptions,
      },
    )
  }

  if (rank >= 2) {
    sections.push(
      {
        id: 'defense',
        title: 'Defense',
        options: defenseOptions,
      },
      {
        id: 'monastery',
        title: 'Monastery',
        options: monasteryOptions,
      },
    )
  }

  return sections.filter((section) => section.options.length > 0)
}

function shouldIncludeCrownSection(difficultyId) {
  return difficultyId === 'medium' || difficultyId === 'hard' || difficultyId === 'extreme'
}

function civilizationHasOption(civilization, option) {
  return Boolean(civilization?.[option.groupKey]?.includes(option.id))
}

function BonusesSection({ activeSheet, onComplete }) {
  const [searchInput, setSearchInput] = useState('')
  const [foundBonusIds, setFoundBonusIds] = useState([])
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [incorrectAnswers, setIncorrectAnswers] = useState(0)
  const [attemptsLeft, setAttemptsLeft] = useState(BONUS_ATTEMPTS)
  const [lastSelection, setLastSelection] = useState(null)

  const foundBonusIdSet = useMemo(() => new Set(foundBonusIds), [foundBonusIds])
  const remainingBonuses = Math.max(0, activeSheet.totalBonusCount - foundBonusIds.length)
  const sectionFinished = attemptsLeft <= 0 || remainingBonuses <= 0
  const hasFailed = attemptsLeft <= 0 && remainingBonuses > 0
  const sectionScore = correctAnswers + attemptsLeft

  const searchSuggestions = useMemo(() => {
    const normalizedInput = normalizeForSearch(searchInput)
    if (!normalizedInput) {
      return []
    }

    const matchingEntries = allCivilizationTrainerBonuses.filter((entry) =>
      matchesSearchEntry(entry, normalizedInput),
    )
    return shuffle(matchingEntries).slice(0, SEARCH_SUGGESTION_LIMIT)
  }, [searchInput])

  const onSelectSuggestion = (entry) => {
    if (!entry || sectionFinished) {
      return
    }

    const isCorrectEntry = entry.civilizationId === activeSheet.civilizationId && !foundBonusIdSet.has(entry.id)
    setLastSelection({ id: entry.id, status: isCorrectEntry ? 'correct' : 'wrong' })

    if (!isCorrectEntry) {
      playWrongSound()
      setIncorrectAnswers((previousValue) => previousValue + 1)
      setAttemptsLeft((previousValue) => Math.max(0, previousValue - 1))
      return
    }

    playCorrectSound()
    setFoundBonusIds((previousIds) => [...previousIds, entry.id])
    setCorrectAnswers((previousValue) => previousValue + 1)
    setSearchInput('')
  }

  const onSearchInputKeyDown = (event) => {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    const firstSuggestion = searchSuggestions[0]
    if (firstSuggestion) {
      onSelectSuggestion(firstSuggestion)
    }
  }

  return (
    <>
      <p className="section-subtitle">
        {hasFailed
          ? 'Bonus attempts reached zero. Missing answers are revealed in orange.'
          : sectionFinished
            ? 'Bonuses complete.'
            : 'Find all civ and team bonuses for this civilization.'}
      </p>

      <article className="question-card with-right-counter">
        <div className="select-all-left-badge">
          <span className="select-all-left-label">Attempts</span>
          <span className="select-all-left-value">{attemptsLeft}</span>
        </div>

        <div className="question-tech-column">
          <div className="question-tech-icons single">
            <div className="question-tech-chip">
              <img
                src={activeSheet.civilizationIcon}
                alt=""
                className="question-tech-icon"
                onError={(event) => {
                  event.currentTarget.src = '/img/missing.png'
                }}
              />
            </div>
          </div>
        </div>

        <div>
          <p className="question-mode-indicator has-mode">
            <span className="question-mode-icon">+</span>
            <span>Bonuses</span>
          </p>
          <p className="question-group">Civilization</p>
          <h2 className="question-label">{activeSheet.civilizationName}</h2>
          <p className="question-variant-label">Bonuses remaining: {remainingBonuses}</p>
        </div>
      </article>

      <section className="civilization-trainer-sheet">
        <h2 className="civilization-trainer-sheet-title">{activeSheet.civilizationName.toUpperCase()}</h2>

        <article className="civilization-trainer-section">
          <h3>Civ Bonuses</h3>
          <ul className="civilization-trainer-lines">
            {activeSheet.civBonuses.map((bonus) => {
              const isFound = foundBonusIdSet.has(bonus.id)
              const isRevealedOnFailure = !isFound && hasFailed
              return (
                <li
                  key={bonus.id}
                  className={`civilization-trainer-line ${
                    isFound ? 'found' : isRevealedOnFailure ? 'revealed-missed' : 'missing'
                  }`}
                >
                  {isFound || isRevealedOnFailure ? bonus.text : '-'}
                </li>
              )
            })}
          </ul>
        </article>

        <article className="civilization-trainer-section">
          <h3>Team Bonus</h3>
          <ul className="civilization-trainer-lines">
            {activeSheet.teamBonuses.map((bonus) => {
              const isFound = foundBonusIdSet.has(bonus.id)
              const isRevealedOnFailure = !isFound && hasFailed
              return (
                <li
                  key={bonus.id}
                  className={`civilization-trainer-line ${
                    isFound ? 'found' : isRevealedOnFailure ? 'revealed-missed' : 'missing'
                  }`}
                >
                  {isFound || isRevealedOnFailure ? bonus.text : '-'}
                </li>
              )
            })}
          </ul>
        </article>
      </section>

      {!sectionFinished && (
        <section className="bonuses-search-wrap">
          <label htmlFor="civilization-trainer-bonuses-search-input" className="bonuses-search-label">
            Search bonus text
          </label>
          <input
            id="civilization-trainer-bonuses-search-input"
            type="text"
            className="bonuses-search-input"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value)
              setLastSelection(null)
            }}
            onKeyDown={onSearchInputKeyDown}
            autoComplete="off"
            placeholder="Type any part of a civ or team bonus..."
          />

          <div className="bonuses-search-list civilization-trainer-search-list">
            {searchInput.trim().length === 0 ? (
              <p className="bonuses-search-empty">Hint: only the remaining count is shown.</p>
            ) : searchSuggestions.length === 0 ? (
              <p className="bonuses-search-empty">No close matches for this search.</p>
            ) : (
              searchSuggestions.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`bonuses-search-option civilization-trainer-search-option ${
                    lastSelection?.id === entry.id && lastSelection?.status === 'correct'
                      ? 'is-correct'
                      : lastSelection?.id === entry.id && lastSelection?.status === 'wrong'
                        ? 'is-wrong'
                        : foundBonusIdSet.has(entry.id)
                          ? 'is-found'
                          : ''
                  }`}
                  onClick={() => onSelectSuggestion(entry)}
                  disabled={foundBonusIdSet.has(entry.id)}
                >
                  <span className="civilization-trainer-search-text">{entry.text}</span>
                </button>
              ))
            )}
          </div>
        </section>
      )}

      {sectionFinished && (
        <section className="quiz-end-card civilization-trainer-results">
          <p className="quiz-end-score">Section Score: {sectionScore}</p>
          <p className="section-subtitle">Correct answers: {correctAnswers}</p>
          <p className="section-subtitle">Attempts left: {attemptsLeft}</p>
          <div className="quiz-end-actions civilization-trainer-results-actions">
            <button
              type="button"
              className="method-card tech-action"
              onClick={() =>
                {
                  if (hasFailed) {
                    playSectionFailSound()
                  } else {
                    playSectionSuccessSound()
                  }
                  onComplete({
                    id: 'bonuses',
                    title: 'Bonuses',
                    score: sectionScore,
                    correct: correctAnswers,
                    incorrect: incorrectAnswers,
                  })
                }
              }
            >
              Continue
            </button>
          </div>
        </section>
      )}
    </>
  )
}

function CrownsDescriptionSection({ civilizationId, civilizationIcon, civilizationName, onComplete }) {
  const requiredEntries = useMemo(() => {
    const entries = allCrownDescriptionEntries.filter((entry) => entry.civilizationId === civilizationId)
    const byType = new Map(entries.map((entry) => [entry.crownType, entry]))
    return ['castle', 'imperial'].map((type) => byType.get(type)).filter(Boolean)
  }, [civilizationId])

  const [searchInput, setSearchInput] = useState('')
  const [foundEntryIds, setFoundEntryIds] = useState([])
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [incorrectAnswers, setIncorrectAnswers] = useState(0)
  const [attemptsLeft, setAttemptsLeft] = useState(requiredEntries.length > 0 ? CROWN_ATTEMPTS : 0)
  const [lastSelection, setLastSelection] = useState(null)

  const foundEntryIdSet = useMemo(() => new Set(foundEntryIds), [foundEntryIds])
  const remainingDescriptions = Math.max(0, requiredEntries.length - foundEntryIds.length)
  const sectionFinished = remainingDescriptions <= 0 || attemptsLeft <= 0
  const hasFailed = attemptsLeft <= 0 && remainingDescriptions > 0
  const sectionScore = correctAnswers + attemptsLeft

  const searchSuggestions = useMemo(() => {
    const normalizedInput = normalizeForSearch(searchInput)
    if (!normalizedInput) {
      return []
    }

    const matchingEntries = allCrownDescriptionEntries.filter((entry) =>
      matchesSearchEntry(entry, normalizedInput),
    )
    return shuffle(matchingEntries).slice(0, SEARCH_SUGGESTION_LIMIT)
  }, [searchInput])

  const onSelectSuggestion = (entry) => {
    if (!entry || sectionFinished) {
      return
    }

    const isCorrectEntry = entry.civilizationId === civilizationId && !foundEntryIdSet.has(entry.id)
    setLastSelection({ id: entry.id, status: isCorrectEntry ? 'correct' : 'wrong' })

    if (!isCorrectEntry) {
      playWrongSound()
      setIncorrectAnswers((previousValue) => previousValue + 1)
      setAttemptsLeft((previousValue) => Math.max(0, previousValue - 1))
      return
    }

    playCorrectSound()
    setFoundEntryIds((previousIds) => [...previousIds, entry.id])
    setCorrectAnswers((previousValue) => previousValue + 1)
    setSearchInput('')
  }

  const onSearchInputKeyDown = (event) => {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    const firstSuggestion = searchSuggestions[0]
    if (firstSuggestion) {
      onSelectSuggestion(firstSuggestion)
    }
  }

  const castleEntry = requiredEntries.find((entry) => entry.crownType === 'castle') ?? null
  const imperialEntry = requiredEntries.find((entry) => entry.crownType === 'imperial') ?? null

  return (
    <>
      <p className="section-subtitle">
        {hasFailed
          ? 'Crown attempts reached zero. Missing descriptions are revealed in orange.'
          : sectionFinished
            ? 'Crown descriptions complete.'
            : 'Find both unique-tech descriptions for this civilization.'}
      </p>

      <article className="question-card with-right-counter">
        <div className="select-all-left-badge">
          <span className="select-all-left-label">Attempts</span>
          <span className="select-all-left-value">{attemptsLeft}</span>
        </div>

        <div className="question-tech-column">
          <div className="question-tech-icons single">
            <div className="question-tech-chip">
              <img
                src={civilizationIcon}
                alt=""
                className="question-tech-icon"
                onError={(event) => {
                  event.currentTarget.src = '/img/missing.png'
                }}
              />
            </div>
          </div>
        </div>

        <div>
          <p className="question-mode-indicator has-mode">
            <span className="question-mode-icon">+</span>
            <span>Crown Descriptions</span>
          </p>
          <p className="question-group">Civilization</p>
          <h2 className="question-label">{civilizationName}</h2>
          <p className="question-variant-label">Descriptions remaining: {remainingDescriptions}</p>
        </div>
      </article>

      <section className="civilization-trainer-sheet">
        <h2 className="civilization-trainer-sheet-title">CROWN DESCRIPTIONS</h2>

        <article className="civilization-trainer-section">
          <h3>Castle Crown</h3>
          <ul className="civilization-trainer-lines">
            {castleEntry ? (
              <li
                className={`civilization-trainer-line ${
                  foundEntryIdSet.has(castleEntry.id)
                    ? 'found'
                    : hasFailed
                      ? 'revealed-missed'
                      : 'missing'
                }`}
              >
                {foundEntryIdSet.has(castleEntry.id) || hasFailed ? castleEntry.text : '-'}
              </li>
            ) : (
              <li className="civilization-trainer-line missing">-</li>
            )}
          </ul>
        </article>

        <article className="civilization-trainer-section">
          <h3>Imperial Crown</h3>
          <ul className="civilization-trainer-lines">
            {imperialEntry ? (
              <li
                className={`civilization-trainer-line ${
                  foundEntryIdSet.has(imperialEntry.id)
                    ? 'found'
                    : hasFailed
                      ? 'revealed-missed'
                      : 'missing'
                }`}
              >
                {foundEntryIdSet.has(imperialEntry.id) || hasFailed ? imperialEntry.text : '-'}
              </li>
            ) : (
              <li className="civilization-trainer-line missing">-</li>
            )}
          </ul>
        </article>
      </section>

      {!sectionFinished && (
        <section className="bonuses-search-wrap">
          <label htmlFor="civilization-trainer-crowns-search-input" className="bonuses-search-label">
            Search crown description
          </label>
          <input
            id="civilization-trainer-crowns-search-input"
            type="text"
            className="bonuses-search-input"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value)
              setLastSelection(null)
            }}
            onKeyDown={onSearchInputKeyDown}
            autoComplete="off"
            placeholder="Type any part of a crown description..."
          />

          <div className="bonuses-search-list civilization-trainer-search-list">
            {searchInput.trim().length === 0 ? (
              <p className="bonuses-search-empty">Type to see possible description matches.</p>
            ) : searchSuggestions.length === 0 ? (
              <p className="bonuses-search-empty">No close matches for this search.</p>
            ) : (
              searchSuggestions.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`bonuses-search-option civilization-trainer-search-option ${
                    lastSelection?.id === entry.id && lastSelection?.status === 'correct'
                      ? 'is-correct'
                      : lastSelection?.id === entry.id && lastSelection?.status === 'wrong'
                        ? 'is-wrong'
                        : foundEntryIdSet.has(entry.id)
                          ? 'is-found'
                          : ''
                  }`}
                  onClick={() => onSelectSuggestion(entry)}
                  disabled={foundEntryIdSet.has(entry.id)}
                >
                  <span className="civilization-trainer-search-text">{entry.text}</span>
                </button>
              ))
            )}
          </div>
        </section>
      )}

      {sectionFinished && (
        <section className="quiz-end-card civilization-trainer-results">
          <p className="quiz-end-score">Section Score: {sectionScore}</p>
          <p className="section-subtitle">Correct answers: {correctAnswers}</p>
          <p className="section-subtitle">Attempts left: {attemptsLeft}</p>
          <div className="quiz-end-actions civilization-trainer-results-actions">
            <button
              type="button"
              className="method-card tech-action"
              onClick={() =>
                {
                  if (hasFailed) {
                    playSectionFailSound()
                  } else {
                    playSectionSuccessSound()
                  }
                  onComplete({
                    id: 'crowns',
                    title: 'Crown Descriptions',
                    score: sectionScore,
                    correct: correctAnswers,
                    incorrect: incorrectAnswers,
                  })
                }
              }
            >
              Continue
            </button>
          </div>
        </section>
      )}
    </>
  )
}

function getSectionLayoutColumns(sectionId, optionByKey) {
  const layoutColumns = TECH_SECTION_LAYOUT_BY_ID[sectionId]
  if (!layoutColumns) {
    return []
  }

  return layoutColumns
    .map((column, index) => ({
      id: `${sectionId}-column-${index}`,
      title: column.title ?? '',
      options: (column.optionKeys ?? []).map((optionKey) => optionByKey.get(optionKey)).filter(Boolean),
    }))
    .filter((column) => column.options.length > 0)
}

function TechSelectionSection({ civilization, sectionConfig, onComplete }) {
  const [selectedOptionKeys, setSelectedOptionKeys] = useState([])
  const [locked, setLocked] = useState(false)

  const sectionOptionKeySet = useMemo(
    () => new Set(sectionConfig.options.map((option) => option.key)),
    [sectionConfig.options],
  )
  const optionByKey = useMemo(
    () => new Map(sectionConfig.options.map((option) => [option.key, option])),
    [sectionConfig.options],
  )
  const layoutColumns = useMemo(
    () => getSectionLayoutColumns(sectionConfig.id, optionByKey),
    [optionByKey, sectionConfig.id],
  )
  const layoutOptionKeySet = useMemo(
    () => new Set(layoutColumns.flatMap((column) => column.options.map((option) => option.key))),
    [layoutColumns],
  )
  const extraOptions = useMemo(
    () => sectionConfig.options.filter((option) => !layoutOptionKeySet.has(option.key)),
    [layoutOptionKeySet, sectionConfig.options],
  )
  const renderedColumns = useMemo(() => {
    if (layoutColumns.length === 0) {
      return []
    }

    if (extraOptions.length === 0) {
      return layoutColumns
    }

    return [
      ...layoutColumns,
      {
        id: `${sectionConfig.id}-column-extra`,
        title: '',
        options: extraOptions,
      },
    ]
  }, [extraOptions, layoutColumns, sectionConfig.id])

  const selectedSet = useMemo(() => new Set(selectedOptionKeys), [selectedOptionKeys])
  const requiredSet = useMemo(
    () =>
      new Set(
        sectionConfig.options
          .filter((option) => civilizationHasOption(civilization, option))
          .map((option) => option.key),
      ),
    [civilization, sectionConfig.options],
  )

  const correctCount = sectionConfig.options.filter(
    (option) => selectedSet.has(option.key) && requiredSet.has(option.key),
  ).length
  const wrongSelectedCount = sectionConfig.options.filter(
    (option) => selectedSet.has(option.key) && !requiredSet.has(option.key),
  ).length
  const missedRequiredCount = sectionConfig.options.filter(
    (option) => !selectedSet.has(option.key) && requiredSet.has(option.key),
  ).length
  const incorrectCount = wrongSelectedCount + missedRequiredCount
  const sectionScore = correctCount - incorrectCount

  const choiceCount = sectionConfig.options.length
  const choiceColumns =
    choiceCount >= 24
      ? 8
      : choiceCount >= 18
        ? 7
        : choiceCount >= 12
          ? 6
          : choiceCount >= 8
            ? 5
            : 4
  const hasCustomColumnLayout = renderedColumns.length > 0

  const onToggleChoice = (optionKey) => {
    if (locked) {
      return
    }

    setSelectedOptionKeys((previousKeys) => {
      const isAlreadySelected = previousKeys.includes(optionKey)
      if (isAlreadySelected) {
        return previousKeys.filter((currentKey) => currentKey !== optionKey)
      }

      const nextSelectedSet = new Set([...previousKeys, optionKey])
      const dependencyKeys = AUTO_SELECT_DEPENDENCIES_BY_KEY.get(optionKey) ?? []
      dependencyKeys.forEach((dependencyKey) => {
        if (sectionOptionKeySet.has(dependencyKey)) {
          nextSelectedSet.add(dependencyKey)
        }
      })

      return [...nextSelectedSet]
    })
  }

  const onLockSection = () => {
    setLocked(true)
    if (incorrectCount === 0) {
      playSectionSuccessSound()
      return
    }

    playSectionFailSound()
  }

  const getStateClass = (option) => {
    const isSelected = selectedSet.has(option.key)
    const isRequired = requiredSet.has(option.key)

    if (!locked) {
      return isSelected ? 'selected' : ''
    }
    if (isSelected && isRequired) {
      return 'correct'
    }
    if (isSelected && !isRequired) {
      return 'wrong'
    }
    if (!isSelected && isRequired) {
      return 'missed'
    }

    return ''
  }

  const renderOptionButton = (option, extraClassName = '') => (
    <button
      key={option.key}
      type="button"
      className={`choice-button ${extraClassName} ${getStateClass(option)}`.trim()}
      onClick={() => onToggleChoice(option.key)}
      disabled={locked}
    >
      <img
        src={option.icon}
        alt=""
        className="choice-civ-icon"
        onError={(event) => {
          event.currentTarget.src = '/img/missing.png'
        }}
      />
      <span>{option.label}</span>
    </button>
  )

  return (
    <>
      <p className="section-subtitle">Select every tech this civilization has, then press Lock.</p>

      <article className="question-card crowns-no-icon">
        <div>
          <p className="question-mode-indicator has-mode">
            <span className="question-mode-icon">+</span>
            <span>{sectionConfig.title}</span>
          </p>
          <p className="question-group">Civilization</p>
          <h2 className="question-label">{civilization.name}</h2>
          <p className="question-variant-label">
            Correct = green, Wrong selection = red, Missed required = orange
          </p>
        </div>
      </article>

      {hasCustomColumnLayout ? (
        <div
          className={`civilization-tech-columns ${
            sectionConfig.id === 'unit-types'
              ? 'unit-types'
              : sectionConfig.id === 'blacksmith'
                ? 'blacksmith'
                : ''
          }`}
        >
          {renderedColumns.map((column) => (
            <section key={column.id} className="civilization-tech-column">
              {column.title ? <h3 className="civilization-tech-column-title">{column.title}</h3> : null}
              <div className="civilization-tech-column-options">
                {column.options.map((option) => renderOptionButton(option, 'civilization-tech-choice'))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="choices-grid" style={{ '--choice-columns': choiceColumns }}>
          {sectionConfig.options.map((option) => renderOptionButton(option))}
        </div>
      )}

      {!locked && (
        <button type="button" className="continue-after-miss-button" onClick={onLockSection}>
          Lock
        </button>
      )}

      {locked && (
        <section className="quiz-end-card civilization-trainer-results">
          <p className="quiz-end-score">Section Score: {sectionScore}</p>
          <p className="section-subtitle">Correct answers: {correctCount}</p>
          <p className="section-subtitle">Incorrect answers: {incorrectCount}</p>
          <div className="quiz-end-actions civilization-trainer-results-actions">
            <button
              type="button"
              className="method-card tech-action"
              onClick={() =>
                onComplete({
                  id: sectionConfig.id,
                  title: sectionConfig.title,
                  score: sectionScore,
                  correct: correctCount,
                  incorrect: incorrectCount,
                })
              }
            >
              Continue
            </button>
          </div>
        </section>
      )}
    </>
  )
}

function CivilizationTrainerSession({ difficultyConfig, difficultyPool, isReviewMode, reviewProfile }) {
  const [activeSheet] = useState(() => pickSheetForSession(difficultyPool, reviewProfile))
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [sectionResults, setSectionResults] = useState([])
  const [finished, setFinished] = useState(false)
  const [highscores, setHighscores] = useState(() => readHighscores())
  const menuRoute = isReviewMode ? '/civilization-trainer?mode=review' : '/civilization-trainer'
  const reviewModeLabel = isReviewMode ? ' | Review' : ''

  const activeCivilization = activeSheet ? civilizationById.get(activeSheet.civilizationId) ?? null : null
  const techSections = useMemo(() => buildTechSectionsForDifficulty(difficultyConfig.id), [difficultyConfig.id])
  const sectionDefinitions = useMemo(() => {
    const definitions = [{ id: 'bonuses', kind: 'bonuses', title: 'Bonuses' }]

    if (shouldIncludeCrownSection(difficultyConfig.id)) {
      definitions.push({ id: 'crowns', kind: 'crowns', title: 'Crown Descriptions' })
    }

    techSections.forEach((section) => {
      definitions.push({
        id: section.id,
        kind: 'tech',
        title: section.title,
        config: section,
      })
    })

    return definitions
  }, [difficultyConfig.id, techSections])

  const totalScore = sectionResults.reduce((sum, result) => sum + result.score, 0)
  const totalCorrect = sectionResults.reduce((sum, result) => sum + result.correct, 0)
  const totalIncorrect = sectionResults.reduce((sum, result) => sum + result.incorrect, 0)
  const currentHighscore = highscores[difficultyConfig.id] ?? 0
  const currentSection = sectionDefinitions[currentSectionIndex]

  useEffect(() => {
    const onStorage = () => {
      setHighscores(readHighscores())
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  if (!activeSheet) {
    return (
      <main className="screen">
        <section className="panel tech-panel">
          <h1 className="section-title">Civilization Trainer</h1>
          <p className="section-subtitle">Could not load civilization bonus data for this difficulty.</p>
          <Link to={menuRoute} className="back-link" onClick={playMenuClickSound}>
            Back to Difficulty Menu
          </Link>
        </section>
      </main>
    )
  }

  const onSectionComplete = (result) => {
    const nextResults = [...sectionResults, result]
    const nextCorrect = nextResults.reduce((sum, sectionResult) => sum + sectionResult.correct, 0)
    const nextIncorrect = nextResults.reduce((sum, sectionResult) => sum + sectionResult.incorrect, 0)
    const isLastSection = nextResults.length >= sectionDefinitions.length

    setSectionResults(nextResults)

    if (isLastSection) {
      const nextTotalScore = nextResults.reduce((sum, sectionResult) => sum + sectionResult.score, 0)
      const nextHighscores = updateHighscore(difficultyConfig.id, nextTotalScore)
      setHighscores(nextHighscores)
      setFinished(true)
      recordCivilizationTrainerResult(activeSheet.civilizationId, nextCorrect, nextCorrect + nextIncorrect)
      return
    }

    setCurrentSectionIndex((previousIndex) => previousIndex + 1)
  }

  if (finished) {
    return (
      <main className="screen">
        <section className="panel tech-panel">
          <h1 className="section-title">Civilization Trainer</h1>
          <p className="section-subtitle">{difficultyConfig.title} complete{reviewModeLabel}.</p>

          <div className="quiz-end-card civilization-trainer-results">
            <p className="quiz-end-score">Final Score: {totalScore}</p>
            <p className="section-subtitle">Highscore ({difficultyConfig.title}): {currentHighscore}</p>
            <p className="section-subtitle">Correct answers: {totalCorrect}</p>
            <p className="section-subtitle">Incorrect answers: {totalIncorrect}</p>

            <div className="civilization-trainer-summary-list">
              {sectionResults.map((result) => (
                <article key={result.id} className="civilization-trainer-summary-row">
                  <span>{result.title}</span>
                  <span>{result.score}</span>
                </article>
              ))}
            </div>

            <div className="quiz-end-actions civilization-trainer-results-actions">
              <Link to={menuRoute} className="method-card tech-action" onClick={playMenuClickSound}>
                Continue
              </Link>
            </div>
          </div>
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
            {difficultyConfig.title}
            {reviewModeLabel} | Section {currentSectionIndex + 1}/{sectionDefinitions.length} | Score {totalScore}
          </p>
        </div>

        <h1 className="section-title">Civilization Trainer</h1>
        <p className="section-subtitle">{currentSection.title}</p>

        {currentSection.kind === 'bonuses' && (
          <BonusesSection
            key={`${currentSection.id}-${currentSectionIndex}`}
            activeSheet={activeSheet}
            onComplete={onSectionComplete}
          />
        )}

        {currentSection.kind === 'crowns' && (
          <CrownsDescriptionSection
            key={`${currentSection.id}-${currentSectionIndex}`}
            civilizationId={activeSheet.civilizationId}
            civilizationIcon={activeSheet.civilizationIcon}
            civilizationName={activeSheet.civilizationName}
            onComplete={onSectionComplete}
          />
        )}

        {currentSection.kind === 'tech' && activeCivilization && (
          <TechSelectionSection
            key={`${currentSection.id}-${currentSectionIndex}`}
            civilization={activeCivilization}
            sectionConfig={currentSection.config}
            onComplete={onSectionComplete}
          />
        )}
      </section>
    </main>
  )
}

export function CivilizationTrainerPage() {
  const { difficulty } = useParams()
  const [searchParams] = useSearchParams()
  const difficultyConfig = useMemo(
    () => civilizationTrainerDifficulties.find((candidate) => candidate.id === difficulty) ?? null,
    [difficulty],
  )
  const isValidDifficulty = Boolean(difficultyConfig)
  const effectiveDifficultyId = isValidDifficulty ? difficulty : 'easy'
  const isReviewMode = isReviewModeEnabled(searchParams)
  const reviewProfile = useMemo(
    () => (isReviewMode ? buildCivilizationTrainerReviewProfile() : { civWeights: {}, hasFailures: false }),
    [isReviewMode],
  )
  const difficultyPool = useMemo(() => buildDifficultyPool(effectiveDifficultyId), [effectiveDifficultyId])

  if (!isValidDifficulty) {
    return <Navigate to="/civilization-trainer" replace />
  }

  return (
    <CivilizationTrainerSession
      key={`${difficultyConfig.id}:${isReviewMode ? 'review' : 'normal'}`}
      difficultyConfig={difficultyConfig}
      difficultyPool={difficultyPool}
      isReviewMode={isReviewMode}
      reviewProfile={reviewProfile}
    />
  )
}
