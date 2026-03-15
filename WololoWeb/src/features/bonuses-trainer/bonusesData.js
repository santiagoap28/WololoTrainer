import gameData from '../../shared/data/gameData.json'
import strings from '../../shared/data/strings.json'
import { civilizations } from '../civilizations/civilizationsData.js'

function getString(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback
  }

  return strings[value] ?? fallback
}

function normalizeHelpText(helpText) {
  return helpText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function isUniqueUnitHeading(line) {
  return /^Unique Unit(?:s)?\s*:/i.test(line)
}

function isUniqueTechHeading(line) {
  return /^Unique Tech(?:s)?\s*:/i.test(line)
}

function isTeamBonusHeading(line) {
  return /^Team Bonus\s*:/i.test(line)
}

function isKnownSectionHeading(line) {
  return isUniqueUnitHeading(line) || isUniqueTechHeading(line) || isTeamBonusHeading(line)
}

function cleanBonusLine(line) {
  return line.replace(/^\u2022\s*/, '').trim()
}

function startsWithBullet(line) {
  return /^\u2022\s*/.test(line)
}

function collectBonusEntries(lines, { requireBulletStart }) {
  const entries = []

  lines.forEach((line) => {
    if (!line || isKnownSectionHeading(line)) {
      return
    }

    const lineStartsWithBullet = startsWithBullet(line)
    const cleanedLine = cleanBonusLine(line)
    if (!cleanedLine) {
      return
    }

    if (lineStartsWithBullet) {
      entries.push(cleanedLine)
      return
    }

    if (entries.length > 0) {
      entries[entries.length - 1] = `${entries[entries.length - 1]} ${cleanedLine}`.trim()
      return
    }

    if (!requireBulletStart) {
      entries.push(cleanedLine)
    }
  })

  return entries.filter(Boolean)
}

function getCivilizationBonusData(civilizationName) {
  const helpTextId = gameData.civ_helptexts[civilizationName]
  const helpText = getString(helpTextId, '')
  const lines = normalizeHelpText(helpText)

  if (lines.length < 2) {
    return { civBonuses: [], teamBonuses: [] }
  }

  const firstSectionIndex = lines.findIndex((line) => isKnownSectionHeading(line))
  const civBonusEnd = firstSectionIndex >= 0 ? firstSectionIndex : lines.length
  const civBonusLines = lines.slice(1, civBonusEnd)
  const civBonuses = collectBonusEntries(civBonusLines, { requireBulletStart: true })

  const teamBonusIndex = lines.findIndex((line) => isTeamBonusHeading(line))
  let teamBonuses = []

  if (teamBonusIndex !== -1) {
    const teamBonusEndRelativeIndex = lines.slice(teamBonusIndex + 1).findIndex((line) => isKnownSectionHeading(line))
    const teamBonusEnd =
      teamBonusEndRelativeIndex === -1 ? lines.length : teamBonusIndex + 1 + teamBonusEndRelativeIndex
    const teamBonusLines = lines.slice(teamBonusIndex + 1, teamBonusEnd)
    teamBonuses = collectBonusEntries(teamBonusLines, { requireBulletStart: false })
  }

  return { civBonuses, teamBonuses }
}

export const civilizationBonuses = civilizations.flatMap((civilization) => {
  const { civBonuses, teamBonuses } = getCivilizationBonusData(civilization.name)

  const civBonusEntries = civBonuses.map((bonusText, index) => ({
    id: `${civilization.id}:civ:${index}`,
    type: 'civ',
    typeLabel: 'Civ Bonus',
    text: bonusText,
    civilizationId: civilization.id,
    civilizationName: civilization.name,
    civilizationIcon: civilization.icon,
  }))

  const teamBonusEntries = teamBonuses.map((bonusText, index) => ({
    id: `${civilization.id}:team:${index}`,
    type: 'team',
    typeLabel: 'Team Bonus',
    text: bonusText,
    civilizationId: civilization.id,
    civilizationName: civilization.name,
    civilizationIcon: civilization.icon,
  }))

  return [...civBonusEntries, ...teamBonusEntries]
})

export const bonusesTrainerDifficulties = [
  { id: 'easy', title: 'Easy', className: 'difficulty-easy', icon: '/img/Civs/britons.png' },
  { id: 'medium', title: 'Medium', className: 'difficulty-medium', icon: '/img/Civs/ethiopians.png' },
  { id: 'hard', title: 'Hard', className: 'difficulty-hard', icon: '/img/Civs/bohemians.png' },
  { id: 'extreme', title: 'Extreme', className: 'difficulty-extreme', icon: '/img/Civs/romans.png' },
  { id: 'legendary', title: 'Legendary', className: 'difficulty-legendary', icon: '/img/Civs/shu.png' },
]
