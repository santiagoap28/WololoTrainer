import gameData from '../../shared/data/gameData.json'
import strings from '../../shared/data/strings.json'
import { civilizations } from '../civilizations/civilizationsData.js'

const CROWN_ICON_BY_TYPE = {
  silver: '/img/Techs/unique_tech_1.png',
  gold: '/img/Techs/unique_tech_2.png',
}

function toIconSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function getString(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback
  }

  return strings[value] ?? fallback
}

const civilizationByName = new Map(civilizations.map((civilization) => [civilization.name, civilization]))

export const crownTechs = Object.entries(gameData.techtrees)
  .flatMap(([civilizationName, techTree]) => {
    const uniqueData = techTree?.unique ?? {}
    const civilization = civilizationByName.get(civilizationName)
    const civilizationId = civilization?.id ?? toIconSlug(civilizationName)
    const civilizationIcon = civilization?.icon ?? `/img/Civs/${civilizationId}.png`
    const crownEntries = [
      { type: 'silver', techId: uniqueData.castleAgeUniqueTech },
      { type: 'gold', techId: uniqueData.imperialAgeUniqueTech },
    ]

    return crownEntries
      .filter((entry) => Number.isFinite(entry.techId))
      .map((entry) => {
        const tech = gameData.data.techs[entry.techId]
        const fallbackName = tech?.internal_name ?? `Tech ${entry.techId}`
        const name = getString(tech?.LanguageNameId, fallbackName)
        const description = getString(tech?.LanguageHelpId, '')

        return {
          id: `${civilizationId}:${entry.type}:${entry.techId}`,
          techId: entry.techId,
          crownType: entry.type,
          crownIcon: CROWN_ICON_BY_TYPE[entry.type],
          name,
          description,
          civilizationId,
          civilizationName,
          civilizationIcon,
        }
      })
  })
  .sort((left, right) => left.name.localeCompare(right.name))

export const crownsTrainerDifficulties = [
  { id: 'easy', title: 'Easy', className: 'difficulty-easy', icon: '/img/Civs/britons.png' },
  { id: 'medium', title: 'Medium', className: 'difficulty-medium', icon: '/img/Civs/ethiopians.png' },
  { id: 'hard', title: 'Hard', className: 'difficulty-hard', icon: '/img/Civs/bohemians.png' },
  { id: 'extreme', title: 'Extreme', className: 'difficulty-extreme', icon: '/img/Civs/romans.png' },
  { id: 'legendary', title: 'Legendary', className: 'difficulty-legendary', icon: '/img/Civs/shu.png' },
]
