import gameData from '../../shared/data/gameData.json'
import strings from '../../shared/data/strings.json'

function toIconSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

const expansionOrder = [
  'Age of Kings',
  'The Conquerors',
  'The Forgotten',
  'African Kingdoms',
  'Rise of the Rajas',
  'The Last Khans',
  'Lords of the West',
  'Dawn of the Dukes',
  'Dynasties of India',
  'Return of Rome',
  'The Mountain Royals',
  'Three Kingdoms',
  'The Last Chieftains',
]

const civilizationMetadata = {
  Armenians: {
    categories: ['Infantry', 'Archer', 'Naval'],
    expansion: 'The Mountain Royals',
  },
  Aztecs: {
    categories: ['Infantry', 'Monk', 'Eagle Warrior'],
    expansion: 'The Conquerors',
  },
  Bengalis: {
    categories: ['Elephant', 'Monk', 'Naval'],
    expansion: 'Dynasties of India',
  },
  Berbers: {
    categories: ['Cavalry', 'Camel', 'Naval'],
    expansion: 'African Kingdoms',
  },
  Bohemians: {
    categories: ['Gunpowder', 'Monk', 'Defensive'],
    expansion: 'Dawn of the Dukes',
  },
  Britons: {
    categories: ['Archer', 'Defensive'],
    expansion: 'Age of Kings',
  },
  Bulgarians: {
    categories: ['Infantry', 'Cavalry'],
    expansion: 'The Last Khans',
  },
  Burgundians: {
    categories: ['Cavalry', 'Gunpowder', 'Economy'],
    expansion: 'Lords of the West',
  },
  Burmese: {
    categories: ['Infantry', 'Monk', 'Elephant'],
    expansion: 'Rise of the Rajas',
  },
  Byzantines: {
    categories: ['Defensive', 'Camel', 'Naval'],
    expansion: 'Age of Kings',
  },
  Celts: {
    categories: ['Infantry', 'Siege'],
    expansion: 'Age of Kings',
  },
  Chinese: {
    categories: ['Archer', 'Defensive', 'Economy'],
    expansion: 'Age of Kings',
  },
  Cumans: {
    categories: ['Cavalry', 'Siege'],
    expansion: 'The Last Khans',
  },
  Dravidians: {
    categories: ['Infantry', 'Naval'],
    expansion: 'Dynasties of India',
  },
  Ethiopians: {
    categories: ['Archer', 'Siege'],
    expansion: 'African Kingdoms',
  },
  Franks: {
    categories: ['Cavalry'],
    expansion: 'Age of Kings',
  },
  Georgians: {
    categories: ['Cavalry', 'Defensive'],
    expansion: 'The Mountain Royals',
  },
  Goths: {
    categories: ['Infantry'],
    expansion: 'Age of Kings',
  },
  Gurjaras: {
    categories: ['Camel', 'Cavalry'],
    expansion: 'Dynasties of India',
  },
  Hindustanis: {
    categories: ['Camel', 'Gunpowder'],
    expansion: 'Dynasties of India',
  },
  Huns: {
    categories: ['Cavalry', 'Archer'],
    expansion: 'The Conquerors',
  },
  Incas: {
    categories: ['Infantry', 'Defensive', 'Eagle Warrior'],
    expansion: 'The Forgotten',
  },
  Italians: {
    categories: ['Archer', 'Naval', 'Gunpowder'],
    expansion: 'The Forgotten',
  },
  Japanese: {
    categories: ['Infantry', 'Naval'],
    expansion: 'Age of Kings',
  },
  Jurchens: {
    categories: ['Cavalry', 'Archer'],
    expansion: 'Three Kingdoms',
  },
  Khitans: {
    categories: ['Cavalry', 'Archer'],
    expansion: 'Three Kingdoms',
  },
  Khmer: {
    categories: ['Elephant', 'Siege'],
    expansion: 'Rise of the Rajas',
  },
  Koreans: {
    categories: ['Defensive', 'Naval'],
    expansion: 'The Conquerors',
  },
  Lithuanians: {
    categories: ['Cavalry', 'Monk'],
    expansion: 'The Last Khans',
  },
  Magyars: {
    categories: ['Cavalry', 'Archer'],
    expansion: 'The Forgotten',
  },
  Mapuche: {
    categories: ['Cavalry', 'Counter-Units'],
    expansion: 'The Last Chieftains',
  },
  Malay: {
    categories: ['Naval', 'Infantry'],
    expansion: 'Rise of the Rajas',
  },
  Malians: {
    categories: ['Infantry', 'Cavalry'],
    expansion: 'African Kingdoms',
  },
  Mayans: {
    categories: ['Archer', 'Eagle Warrior'],
    expansion: 'The Conquerors',
  },
  Mongols: {
    categories: ['Cavalry', 'Archer', 'Siege'],
    expansion: 'Age of Kings',
  },
  Muisca: {
    categories: ['Archer', 'Monk'],
    expansion: 'The Last Chieftains',
  },
  Persians: {
    categories: ['Cavalry', 'Elephant'],
    expansion: 'Age of Kings',
  },
  Poles: {
    categories: ['Cavalry', 'Economy'],
    expansion: 'Dawn of the Dukes',
  },
  Portuguese: {
    categories: ['Naval', 'Gunpowder'],
    expansion: 'African Kingdoms',
  },
  Romans: {
    categories: ['Infantry', 'Defensive'],
    expansion: 'Return of Rome',
  },
  Saracens: {
    categories: ['Camel', 'Naval'],
    expansion: 'Age of Kings',
  },
  Shu: {
    categories: ['Infantry', 'Archer'],
    expansion: 'Three Kingdoms',
  },
  Sicilians: {
    categories: ['Infantry', 'Cavalry', 'Defensive'],
    expansion: 'Lords of the West',
  },
  Slavs: {
    categories: ['Infantry', 'Siege'],
    expansion: 'The Forgotten',
  },
  Spanish: {
    categories: ['Gunpowder', 'Cavalry'],
    expansion: 'The Conquerors',
  },
  Tatars: {
    categories: ['Cavalry', 'Archer'],
    expansion: 'The Last Khans',
  },
  Teutons: {
    categories: ['Infantry', 'Defensive'],
    expansion: 'Age of Kings',
  },
  Turks: {
    categories: ['Gunpowder', 'Cavalry'],
    expansion: 'Age of Kings',
  },
  Tupi: {
    categories: ['Archer', 'Infantry'],
    expansion: 'The Last Chieftains',
  },
  Vietnamese: {
    categories: ['Archer', 'Defensive'],
    expansion: 'Rise of the Rajas',
  },
  Vikings: {
    categories: ['Infantry', 'Naval'],
    expansion: 'Age of Kings',
  },
  Wei: {
    categories: ['Infantry', 'Cavalry'],
    expansion: 'Three Kingdoms',
  },
  Wu: {
    categories: ['Naval', 'Infantry'],
    expansion: 'Three Kingdoms',
  },
}

const categoryIconByName = {
  Archer: '/img/Units/492.png',
  Camel: '/img/Units/330.png',
  Cavalry: '/img/Units/569.png',
  'Counter-Units': '/img/Units/359.png',
  Defensive: '/img/Buildings/117.png',
  Economy: '/img/Buildings/598.png',
  Elephant: '/img/Units/1132.png',
  'Eagle Warrior': '/img/Civs/aztecs.png',
  Gunpowder: '/img/Units/36.png',
  Infantry: '/img/Units/567.png',
  Monk: '/img/Units/125.png',
  Naval: '/img/Units/442.png',
  Siege: '/img/Units/279.png',
}

const expansionIconByName = {
  'Age of Kings': '/img/Civs/britons.png',
  'The Conquerors': '/img/Civs/aztecs.png',
  'The Forgotten': '/img/Civs/magyars.png',
  'African Kingdoms': '/img/Civs/ethiopians.png',
  'Rise of the Rajas': '/img/Civs/khmer.png',
  'The Last Khans': '/img/Civs/tatars.png',
  'Lords of the West': '/img/Civs/sicilians.png',
  'Dawn of the Dukes': '/img/Civs/bohemians.png',
  'Dynasties of India': '/img/Civs/bengalis.png',
  'Return of Rome': '/img/Civs/romans.png',
  'The Mountain Royals': '/img/Civs/armenians.png',
  'Three Kingdoms': '/img/Civs/shu.png',
  'The Last Chieftains': '/img/Civs/mapuche.png',
  Unknown: '/img/missing.png',
}

const barracksDefinitions = [
  { id: 'two-handed-swordsman', label: 'Two-Handed Swordsman', unitId: 473, icon: '/img/Units/473.png' },
  { id: 'champion', label: 'Champion', unitId: 567, icon: '/img/Units/567.png' },
  { id: 'pikeman', label: 'Pikeman', unitIds: [358, 1787], icon: '/img/Units/358.png' },
  { id: 'halberdier', label: 'Halberdier', unitIds: [359, 1788], icon: '/img/Units/359.png' },
  { id: 'fire-lancer', label: 'Fire Lancer', unitId: 1901, icon: '/img/Units/1901.png' },
]

const stableDefinitions = [
  { id: 'light-cavalry', label: 'Light Cavalry', unitId: 546, icon: '/img/Units/546.png' },
  { id: 'hussar', label: 'Hussar', unitIds: [441, 1707], icon: '/img/Units/441.png' },
  { id: 'knight', label: 'Knight', unitId: 38, icon: '/img/Units/38.png' },
  { id: 'cavalier', label: 'Cavalier', unitId: 283, icon: '/img/Units/283.png' },
  { id: 'paladin', label: 'Paladin', unitId: 569, icon: '/img/Units/569.png' },
  { id: 'camel', label: 'Camel', unitIds: [329, 1755], icon: '/img/Units/329.png' },
  { id: 'heavy-camel', label: 'Heavy Camel', unitIds: [330, 207], icon: '/img/Units/330.png' },
  { id: 'battle-elephant', label: 'Battle Elephant', unitId: 1132, icon: '/img/Units/1132.png' },
  { id: 'elite-battle-elephant', label: 'Elite Battle Elephant', unitId: 1134, icon: '/img/Units/1134.png' },
  { id: 'steppe-lancer', label: 'Steppe Lancer', unitId: 1370, icon: '/img/Units/1370.png' },
]

const archeryRangeDefinitions = [
  { id: 'crossbowman', label: 'Crossbow', unitId: 24, icon: '/img/Units/24.png' },
  { id: 'arbalester', label: 'Arbalest', unitId: 492, icon: '/img/Units/492.png' },
  { id: 'elite-skirmisher', label: 'Elite Skirm', unitId: 6, icon: '/img/Units/6.png' },
  { id: 'cavalry-archer', label: 'Cav Archer', unitId: 39, icon: '/img/Units/39.png' },
  { id: 'heavy-cavalry-archer', label: 'Heavy Cav Archer', unitId: 474, icon: '/img/Units/474.png' },
  { id: 'elephant-archer', label: 'Elephant Archer', unitId: 873, icon: '/img/Units/873.png' },
]

const blacksmithUpgradeDefinitions = [
  { id: 'bracer', label: 'Bracer', techId: 201, icon: '/img/Techs/201.png' },
  { id: 'iron-casting', label: 'Iron Casting', techId: 68, icon: '/img/Techs/68.png' },
  { id: 'blast-furnace', label: 'Blast Furnace', techId: 75, icon: '/img/Techs/75.png' },
  { id: 'chain-mail-armor', label: 'Chain Mail Armor', techId: 76, icon: '/img/Techs/76.png' },
  { id: 'plate-mail-armor', label: 'Plate Mail Armor', techId: 77, icon: '/img/Techs/77.png' },
  { id: 'chain-barding-armor', label: 'Chain Barding Armor', techId: 82, icon: '/img/Techs/82.png' },
  { id: 'plate-barding-armor', label: 'Plate Barding Armor', techId: 80, icon: '/img/Techs/80.png' },
  { id: 'leather-archer-armor', label: 'Leather Archer Armor', techId: 212, icon: '/img/Techs/212.png' },
  { id: 'ring-archer-armor', label: 'Ring Archer Armor', techId: 219, icon: '/img/Techs/219.png' },
]

const defenseDefinitions = [
  { id: 'bombard-cannon', label: 'Bombard Cannon', unitId: 36, icon: '/img/Units/36.png' },
  { id: 'bombard-tower', label: 'Bombard Tower', buildingId: 236, techId: 64, icon: '/img/Buildings/236.png' },
  { id: 'stone-wall', label: 'Stone Wall', buildingId: 117, icon: '/img/Buildings/117.png' },
  { id: 'fortified-wall', label: 'Fortified Wall', buildingId: 155, techId: 194, icon: '/img/Buildings/155.png' },
  { id: 'guard-tower', label: 'Guard Tower', buildingId: 234, techId: 140, icon: '/img/Buildings/234.png' },
  { id: 'keep', label: 'Keep', buildingId: 235, techId: 63, icon: '/img/Buildings/235.png' },
  { id: 'siege-engineers', label: 'Siege Engineers', techId: 377, icon: '/img/Techs/377.png' },
  { id: 'hoardings', label: 'Hoardings', techId: 379, icon: '/img/Techs/379.png' },
  { id: 'masonry', label: 'Masonry', techId: 50, icon: '/img/Techs/50.png' },
  { id: 'architecture', label: 'Architecture', techId: 51, icon: '/img/Techs/51.png' },
]

const militaryUpgradeDefinitions = [
  { id: 'parthian-tactics', label: 'Parthian Tactics', techId: 436, icon: '/img/Techs/436.png' },
  { id: 'thumb-ring', label: 'Thumb Ring', techId: 437, icon: '/img/Techs/437.png' },
  { id: 'husbandry', label: 'Husbandry', techId: 39, icon: '/img/Techs/39.png' },
  { id: 'bloodlines', label: 'Bloodlines', techId: 435, icon: '/img/Techs/435.png' },
  { id: 'gambesons', label: 'Gambesons', techId: 875, icon: '/img/Techs/875.png' },
  { id: 'squires', label: 'Squires', techId: 215, icon: '/img/Techs/215.png' },
]

const navalDefinitions = [
  { id: 'hulk', label: 'Hulk', unitId: 2626, icon: '/img/Units/442.png' },
  { id: 'war-hulk', label: 'War Hulk', unitId: 2627, icon: '/img/Units/420.png' },
  { id: 'fast-fire-ship', label: 'Fast Fire Ship', unitId: 532, icon: '/img/Units/532.png' },
  { id: 'heavy-demolition-ship', label: 'Heavy Demolition Ship', unitId: 528, icon: '/img/Units/528.png' },
  { id: 'galleon', label: 'Galleon', unitId: 442, icon: '/img/Units/442.png' },
  { id: 'cannon-galleon', label: 'Cannon Galleon', unitId: 420, icon: '/img/Units/420.png' },
  { id: 'elite-cannon-galleon', label: 'Elite Cannon Galleon', unitId: 691, icon: '/img/Units/691.png' },
  { id: 'dromon', label: 'Dromon', unitId: 1795, icon: '/img/Units/1795.png' },
  { id: 'lou-chuan', label: 'Lou Chuan', unitId: 1948, icon: '/img/Units/1948.png' },
  { id: 'fishing-lines', label: 'Fishing Lines', techId: 906, icon: '/img/Techs/373.png' },
  { id: 'carvel-hull', label: 'Carvel Hull', techIds: [907, 909], icon: '/img/Techs/375.png' },
  { id: 'clinker-construction', label: 'Clinker Construction', techIds: [908, 910], icon: '/img/Techs/374.png' },
  { id: 'shipwright', label: 'Shipwright', techId: 373, icon: '/img/Techs/373.png' },
  { id: 'dry-dock', label: 'Dry Dock', techId: 375, icon: '/img/Techs/375.png' },
  {
    id: 'has-unique-ship',
    label: 'Has Unique Ship',
    unitIds: [831, 832, 250, 533, 1004, 1006, 1750, 1302],
    icon: '/img/Units/831.png',
  },
]

const monasteryDefinitions = [
  { id: 'redemption', label: 'Redemption', techId: 316, icon: '/img/Techs/316.png' },
  { id: 'atonement', label: 'Atonement', techId: 319, icon: '/img/Techs/319.png' },
  { id: 'herbal-medicine', label: 'Herbal Medicine', techId: 441, icon: '/img/Techs/441.png' },
  { id: 'heresy', label: 'Heresy', techId: 439, icon: '/img/Techs/439.png' },
  { id: 'sanctity', label: 'Sanctity', techId: 231, icon: '/img/Techs/231.png' },
  { id: 'fervor', label: 'Fervor', techId: 252, icon: '/img/Techs/252.png' },
  { id: 'illumination', label: 'Illumination', techId: 233, icon: '/img/Techs/233.png' },
  { id: 'block-printing', label: 'Block Printing', techId: 230, icon: '/img/Techs/230.png' },
  { id: 'faith', label: 'Faith', techId: 45, icon: '/img/Techs/45.png' },
  { id: 'theocracy', label: 'Theocracy', techId: 438, icon: '/img/Techs/438.png' },
  { id: 'unique-monk', label: 'Unique Monk', unitIds: [1811, 775], icon: '/img/Units/1811.png' },
]

function hasAny(values, ids) {
  if (!ids || ids.length === 0) {
    return false
  }

  return ids.some((id) => values.has(id))
}

function getAvailabilityFromTree(tree, definitions) {
  const units = new Set((tree?.units ?? []).map((entry) => entry.id))
  const techs = new Set((tree?.techs ?? []).map((entry) => entry.id))
  const buildings = new Set((tree?.buildings ?? []).map((entry) => entry.id))

  return definitions
    .filter((definition) => {
      const unitIds = definition.unitIds ?? (definition.unitId !== undefined ? [definition.unitId] : [])
      const techIds = definition.techIds ?? (definition.techId !== undefined ? [definition.techId] : [])
      const buildingIds =
        definition.buildingIds ?? (definition.buildingId !== undefined ? [definition.buildingId] : [])

      return hasAny(units, unitIds) || hasAny(techs, techIds) || hasAny(buildings, buildingIds)
    })
    .map((definition) => definition.id)
}

function getString(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback
  }

  return strings[value] ?? fallback
}

function cleanInlineLabel(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getCivilizationDescription(civilizationName) {
  const helpTextId = gameData.civ_helptexts[civilizationName]
  return getString(helpTextId, '')
}

function getUniqueUnits(civilizationName, tree) {
  const unique = tree?.unique ?? {}
  const entries = [
    {
      id: unique.castleAgeUniqueUnit,
      nameStringId: unique.castleAgeUniqueUnitNameStringId,
      helpStringId: unique.castleAgeUniqueUnitHelpStringId,
    },
    {
      id: unique.imperialAgeUniqueUnit,
      nameStringId: unique.imperialAgeUniqueUnitNameStringId,
      helpStringId: unique.imperialAgeUniqueUnitHelpStringId,
    },
  ].filter((entry) => entry.id !== undefined && entry.id !== null)

  const byId = new Map()
  for (const entry of entries) {
    if (!byId.has(entry.id)) {
      byId.set(entry.id, {
        id: entry.id,
        nameStringId: entry.nameStringId,
        helpStringId: entry.helpStringId,
      })
    }
  }

  return Array.from(byId.values())
    .map(({ id, nameStringId, helpStringId }) => {
      const unit = gameData.data.units[id]
      const fallbackName = unit?.internal_name ?? `Unit ${id}`
      const inferredHelpStringId = Number.isFinite(Number(nameStringId)) ? Number(nameStringId) + 12000 : null
      const rawName = getString(nameStringId, '') || getString(unit?.LanguageNameId, fallbackName)
      const name = cleanInlineLabel(rawName) || fallbackName
      const description =
        getString(helpStringId, '') || getString(inferredHelpStringId, '') || getString(unit?.LanguageHelpId, '')

      return {
        id,
        name,
        description,
        icon: `/img/Units/${id}.png`,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const civilizations = Object.keys(gameData.civ_names)
  .map((name) => {
    const metadata = civilizationMetadata[name] ?? { categories: [], expansion: 'Unknown' }
    const techTree = gameData.techtrees[name]

    return {
      categories: metadata.categories,
      expansion: metadata.expansion,
      description: getCivilizationDescription(name),
      uniqueUnits: getUniqueUnits(name, techTree),
      barracks: getAvailabilityFromTree(techTree, barracksDefinitions),
      stable: getAvailabilityFromTree(techTree, stableDefinitions),
      archeryRange: getAvailabilityFromTree(techTree, archeryRangeDefinitions),
      blacksmithUpgrades: getAvailabilityFromTree(techTree, blacksmithUpgradeDefinitions),
      militaryUpgrades: getAvailabilityFromTree(techTree, militaryUpgradeDefinitions),
      naval: getAvailabilityFromTree(techTree, navalDefinitions),
      monastery: getAvailabilityFromTree(techTree, monasteryDefinitions),
      defenses: getAvailabilityFromTree(techTree, defenseDefinitions),
      id: toIconSlug(name),
      name,
      icon: `/img/Civs/${toIconSlug(name)}.png`,
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

const civilizationCategories = [...new Set(civilizations.flatMap((civ) => civ.categories))]
  .sort((a, b) => a.localeCompare(b))
  .map((category) => ({
    id: category,
    label: category,
    icon: categoryIconByName[category] ?? '/img/missing.png',
  }))

const civilizationExpansions = [...new Set(civilizations.map((civ) => civ.expansion))]
  .sort((a, b) => {
    const aIndex = expansionOrder.indexOf(a)
    const bIndex = expansionOrder.indexOf(b)

    if (aIndex === -1 && bIndex === -1) {
      return a.localeCompare(b)
    }
    if (aIndex === -1) {
      return 1
    }
    if (bIndex === -1) {
      return -1
    }

    return aIndex - bIndex
  })
  .map((expansion) => ({
    id: expansion,
    label: expansion,
    icon: expansionIconByName[expansion] ?? '/img/missing.png',
  }))

export const civilizationCategoryOptions = civilizationCategories
export const civilizationExpansionOptions = civilizationExpansions
export const barracksOptions = barracksDefinitions.map(({ id, label, icon }) => ({ id, label, icon }))
export const stableOptions = stableDefinitions.map(({ id, label, icon }) => ({ id, label, icon }))
export const archeryRangeOptions = archeryRangeDefinitions.map(({ id, label, icon }) => ({ id, label, icon }))
export const blacksmithUpgradeOptions = blacksmithUpgradeDefinitions.map(({ id, label, icon }) => ({
  id,
  label,
  icon,
}))
export const militaryUpgradeOptions = militaryUpgradeDefinitions.map(({ id, label, icon }) => ({
  id,
  label,
  icon,
}))
export const navalOptions = navalDefinitions.map(({ id, label, icon }) => ({
  id,
  label,
  icon,
}))
export const monasteryOptions = monasteryDefinitions.map(({ id, label, icon }) => ({
  id,
  label,
  icon,
}))
export const defenseOptions = defenseDefinitions.map(({ id, label, icon }) => ({ id, label, icon }))

export const techTreeTrainerOptions = [
  ...barracksOptions.map((option) => ({ ...option, groupKey: 'barracks', groupLabel: 'Barracks' })),
  ...stableOptions.map((option) => ({ ...option, groupKey: 'stable', groupLabel: 'Stable' })),
  ...archeryRangeOptions.map((option) => ({
    ...option,
    groupKey: 'archeryRange',
    groupLabel: 'Archery Range',
  })),
  ...navalOptions.map((option) => ({ ...option, groupKey: 'naval', groupLabel: 'Naval' })),
  ...monasteryOptions.map((option) => ({ ...option, groupKey: 'monastery', groupLabel: 'Monastery' })),
  ...blacksmithUpgradeOptions.map((option) => ({
    ...option,
    groupKey: 'blacksmithUpgrades',
    groupLabel: 'Blacksmith Upgrades',
  })),
  ...militaryUpgradeOptions.map((option) => ({
    ...option,
    groupKey: 'militaryUpgrades',
    groupLabel: 'Military Upgrades',
  })),
  ...defenseOptions.map((option) => ({ ...option, groupKey: 'defenses', groupLabel: 'Defenses' })),
].map((option) => ({
  ...option,
  key: `${option.groupKey}:${option.id}`,
}))
