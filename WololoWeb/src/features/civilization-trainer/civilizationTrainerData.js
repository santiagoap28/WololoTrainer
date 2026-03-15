import { civilizationBonuses } from '../bonuses-trainer/bonusesData.js'
import { civilizations } from '../civilizations/civilizationsData.js'

const bonusSheetsByCivilizationId = new Map(
  civilizations.map((civilization) => [
    civilization.id,
    {
      civilizationId: civilization.id,
      civilizationName: civilization.name,
      civilizationIcon: civilization.icon,
      civBonuses: [],
      teamBonuses: [],
    },
  ]),
)

civilizationBonuses.forEach((bonus) => {
  const sheet = bonusSheetsByCivilizationId.get(bonus.civilizationId)
  if (!sheet) {
    return
  }

  const targetGroup = bonus.type === 'team' ? sheet.teamBonuses : sheet.civBonuses
  targetGroup.push({
    id: bonus.id,
    text: bonus.text,
    type: bonus.type,
  })
})

export const civilizationBonusSheets = Array.from(bonusSheetsByCivilizationId.values())
  .map((sheet) => ({
    ...sheet,
    totalBonusCount: sheet.civBonuses.length + sheet.teamBonuses.length,
  }))
  .filter((sheet) => sheet.totalBonusCount > 0)
  .sort((left, right) => left.civilizationName.localeCompare(right.civilizationName))

export const allCivilizationTrainerBonuses = civilizationBonusSheets.flatMap((sheet) => [
  ...sheet.civBonuses.map((bonus) => ({
    ...bonus,
    civilizationId: sheet.civilizationId,
    civilizationName: sheet.civilizationName,
  })),
  ...sheet.teamBonuses.map((bonus) => ({
    ...bonus,
    civilizationId: sheet.civilizationId,
    civilizationName: sheet.civilizationName,
  })),
])

export const civilizationTrainerDifficulties = [
  { id: 'easy', title: 'Easy', className: 'difficulty-easy', icon: '/img/Civs/britons.png' },
  { id: 'medium', title: 'Medium', className: 'difficulty-medium', icon: '/img/Civs/ethiopians.png' },
  { id: 'hard', title: 'Hard', className: 'difficulty-hard', icon: '/img/Civs/bohemians.png' },
  { id: 'extreme', title: 'Extreme', className: 'difficulty-extreme', icon: '/img/Civs/romans.png' },
  { id: 'legendary', title: 'Legendary', className: 'difficulty-legendary', icon: '/img/Civs/shu.png' },
]
