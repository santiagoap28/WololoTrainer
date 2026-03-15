import { civilizations } from './civilizationsData.js'

const EASY_EXPANSIONS = ['Age of Kings']
const MEDIUM_ADDITIONS = ['The Conquerors', 'The Forgotten', 'African Kingdoms']
const HARD_ADDITIONS = ['Rise of the Rajas', 'The Last Khans', 'Lords of the West', 'Dawn of the Dukes']
const EXTREME_ADDITIONS = ['Dynasties of India', 'Return of Rome', 'The Mountain Royals']
const LEGENDARY_ADDITIONS = ['Three Kingdoms', 'The Last Chieftains']

const expansionSetByDifficulty = {
  easy: new Set(EASY_EXPANSIONS),
  medium: new Set([...EASY_EXPANSIONS, ...MEDIUM_ADDITIONS]),
  hard: new Set([...EASY_EXPANSIONS, ...MEDIUM_ADDITIONS, ...HARD_ADDITIONS]),
  extreme: new Set([...EASY_EXPANSIONS, ...MEDIUM_ADDITIONS, ...HARD_ADDITIONS, ...EXTREME_ADDITIONS]),
  legendary: new Set([
    ...EASY_EXPANSIONS,
    ...MEDIUM_ADDITIONS,
    ...HARD_ADDITIONS,
    ...EXTREME_ADDITIONS,
    ...LEGENDARY_ADDITIONS,
  ]),
}

export function getAllowedCivilizationsForDifficulty(difficultyId) {
  const allowedExpansions = expansionSetByDifficulty[difficultyId] ?? expansionSetByDifficulty.easy
  const filteredCivilizations = civilizations.filter((civilization) => allowedExpansions.has(civilization.expansion))

  return filteredCivilizations.length > 0 ? filteredCivilizations : civilizations
}

export function getAllowedCivilizationIdsForDifficulty(difficultyId) {
  return new Set(getAllowedCivilizationsForDifficulty(difficultyId).map((civilization) => civilization.id))
}
