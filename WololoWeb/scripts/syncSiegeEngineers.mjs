import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const REPO_URL = 'https://github.com/SiegeEngineers/aoe2techtree.git'
const REPO_BRANCH = 'master'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const outputPaths = {
  mirroredTechTree: path.join(projectRoot, 'public', 'aoe2techtree'),
  mirroredImages: path.join(projectRoot, 'public', 'img'),
  gameData: path.join(projectRoot, 'src', 'shared', 'data', 'gameData.json'),
  strings: path.join(projectRoot, 'src', 'shared', 'data', 'strings.json'),
}

const imageFolderByUseType = {
  Building: 'Building',
  Tech: 'Tech',
  Unit: 'Unit',
}

const compatImageFolders = [
  ['Building', 'Buildings'],
  ['Tech', 'Techs'],
  ['Unit', 'Units'],
]

function run(command, args, cwd = projectRoot) {
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
  })
}

function runCapture(command, args, cwd = projectRoot) {
  return execFileSync(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8')
  return JSON.parse(content)
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

async function replaceDir(sourceDir, targetDir) {
  await fs.rm(targetDir, { recursive: true, force: true })
  await fs.mkdir(path.dirname(targetDir), { recursive: true })
  await fs.cp(sourceDir, targetDir, { recursive: true })
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function copyAlias(sourcePath, targetPath) {
  if (sourcePath === targetPath) {
    return false
  }

  if (!(await exists(sourcePath))) {
    return false
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.copyFile(sourcePath, targetPath)
  return true
}

async function ensureCompatImageFolders(publicImgDir) {
  for (const [sourceFolderName, targetFolderName] of compatImageFolders) {
    const sourceDir = path.join(publicImgDir, sourceFolderName)
    const targetDir = path.join(publicImgDir, targetFolderName)
    await fs.rm(targetDir, { recursive: true, force: true })
    await fs.cp(sourceDir, targetDir, { recursive: true })
  }
}

async function createNodeIdImageAliases(treeFilePaths, publicImgDir) {
  const aliases = new Map()

  for (const treeFilePath of treeFilePaths) {
    const tree = await readJson(treeFilePath)
    const nodes = [...(tree?.buildings ?? []), ...(tree?.units_techs ?? [])]

    for (const node of nodes) {
      const sourceFolder = imageFolderByUseType[node?.use_type]
      if (!sourceFolder) {
        continue
      }

      const nodeId = Number(node?.node_id)
      const pictureIndex = Number(node?.picture_index)
      if (!Number.isFinite(nodeId) || !Number.isFinite(pictureIndex)) {
        continue
      }

      const key = `${sourceFolder}:${nodeId}`
      if (!aliases.has(key)) {
        aliases.set(key, { sourceFolder, nodeId, pictureIndex })
      }
    }
  }

  let copiedCount = 0
  let missingSourceCount = 0
  const aliasJobs = []
  const sourceContentByPath = new Map()

  for (const alias of aliases.values()) {
    const sourcePath = path.join(publicImgDir, alias.sourceFolder, `${alias.pictureIndex}.png`)
    if (!(await exists(sourcePath))) {
      missingSourceCount += 1
      continue
    }

    const targetPaths = []

    const compatTargetFolder = compatImageFolders.find(
      ([sourceFolderName]) => sourceFolderName === alias.sourceFolder,
    )?.[1]

    if (compatTargetFolder) {
      const pluralTargetPath = path.join(publicImgDir, compatTargetFolder, `${alias.nodeId}.png`)
      targetPaths.push(pluralTargetPath)
    } else {
      const singularTargetPath = path.join(publicImgDir, alias.sourceFolder, `${alias.nodeId}.png`)
      targetPaths.push(singularTargetPath)
    }

    aliasJobs.push({
      sourcePath,
      targetPaths,
    })
  }

  for (const { sourcePath } of aliasJobs) {
    if (!sourceContentByPath.has(sourcePath)) {
      sourceContentByPath.set(sourcePath, await fs.readFile(sourcePath))
    }
  }

  for (const { sourcePath, targetPaths } of aliasJobs) {
    const sourceContent = sourceContentByPath.get(sourcePath)

    for (const targetPath of targetPaths) {
      if (targetPath === sourcePath) {
        continue
      }

      await fs.mkdir(path.dirname(targetPath), { recursive: true })
      await fs.writeFile(targetPath, sourceContent)
      copiedCount += 1
    }
  }

  return {
    aliases: aliases.size,
    copiedCount,
    missingSourceCount,
  }
}

function resolveGitRootPath() {
  try {
    return runCapture('git', ['rev-parse', '--show-toplevel']).toString().trim()
  } catch {
    return null
  }
}

async function restoreLegacyNamedImageAliases(publicImgDir) {
  const legacyFiles = [
    {
      target: 'Techs/unique_tech_1.png',
      legacyGitObject: 'img/Techs/unique_tech_1.png',
      fallbackCandidates: ['Techs/101.png', 'Tech/101.png'],
    },
    {
      target: 'Techs/unique_tech_2.png',
      legacyGitObject: 'img/Techs/unique_tech_2.png',
      fallbackCandidates: ['Techs/102.png', 'Tech/102.png'],
    },
    {
      target: 'Units/unique_unit.png',
      legacyGitObject: 'img/Units/unique_unit.png',
      fallbackCandidates: ['Units/831.png', 'Units/4.png', 'Unit/4.png'],
    },
    {
      target: 'Units/elite_unique_unit.png',
      legacyGitObject: 'img/Units/elite_unique_unit.png',
      fallbackCandidates: ['Units/832.png', 'Units/5.png', 'Unit/5.png'],
    },
  ]

  const gitRootPath = resolveGitRootPath()
  let restoredFromGitCount = 0
  let restoredFromFallbackCount = 0

  for (const legacyFile of legacyFiles) {
    const targetPath = path.join(publicImgDir, legacyFile.target)
    if (await exists(targetPath)) {
      continue
    }

    let restored = false
    if (gitRootPath) {
      try {
        const blob = runCapture('git', ['show', `HEAD:${legacyFile.legacyGitObject}`], gitRootPath)
        await fs.mkdir(path.dirname(targetPath), { recursive: true })
        await fs.writeFile(targetPath, blob)
        restoredFromGitCount += 1
        restored = true
      } catch {
        restored = false
      }
    }

    if (restored) {
      continue
    }

    for (const fallbackCandidate of legacyFile.fallbackCandidates) {
      const fallbackPath = path.join(publicImgDir, fallbackCandidate)
      if (await copyAlias(fallbackPath, targetPath)) {
        restoredFromFallbackCount += 1
        restored = true
        break
      }
    }

    if (!restored) {
      console.warn(`Could not restore legacy image alias: ${legacyFile.target}`)
    }
  }

  return {
    restoredFromGitCount,
    restoredFromFallbackCount,
  }
}

function parseHelpLines(helpText) {
  if (!helpText) {
    return []
  }

  return helpText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const KNOWN_SECTION_HEADING = /^(Unique Unit(?:s)?|Unique Tech(?:s)?|Team Bonus)\s*:/i

function normalizeHeadingList(helpText, headingPattern, { splitCommaWhenInline = false } = {}) {
  const plainLines = parseHelpLines(helpText)
  if (plainLines.length === 0) {
    return []
  }

  const headingIndex = plainLines.findIndex((line) => headingPattern.test(line))
  if (headingIndex === -1) {
    return []
  }

  const sectionLines = []
  const headingLine = plainLines[headingIndex]
  const [, inlineText = ''] = headingLine.split(/:\s*/, 2)
  if (inlineText.trim()) {
    sectionLines.push(inlineText.trim())
  }

  for (let index = headingIndex + 1; index < plainLines.length; index += 1) {
    const line = plainLines[index]
    if (KNOWN_SECTION_HEADING.test(line)) {
      break
    }
    sectionLines.push(line)
  }

  const normalized = []
  for (const line of sectionLines) {
    const withoutBullet = line.replace(/^[\u2022*-]\s*/, '').trim()
    if (!withoutBullet) {
      continue
    }

    const fragments = splitCommaWhenInline && !/^[\u2022*-]\s*/.test(line) ? withoutBullet.split(',') : [withoutBullet]
    for (const fragment of fragments) {
      const name = fragment
        .split(':', 1)[0]
        .split('(', 1)[0]
        .replace(/\.$/, '')
        .trim()

      if (name) {
        normalized.push(name)
      }
    }
  }

  return Array.from(new Set(normalized))
}

function normalizeForMatch(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeWithoutElitePrefix(value) {
  return normalizeForMatch(value).replace(/^elite\s+/, '')
}

function normalizeTreeKey(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
}

async function resolveBaseCivilizationTreeRefs(upstreamRootData, treesDirPath) {
  const baseCivilizations = Object.entries(upstreamRootData.civs ?? {})
    .filter(([, civ]) => civ?.era === 'base')
    .sort((left, right) => left[0].localeCompare(right[0]))

  const treeFileNames = await fs.readdir(treesDirPath)
  const treeFileByNormalizedName = new Map()
  for (const treeFileName of treeFileNames) {
    if (!treeFileName.toLowerCase().endsWith('.json')) {
      continue
    }

    const key = treeFileName.replace(/\.json$/i, '').toUpperCase()
    treeFileByNormalizedName.set(key, treeFileName)
  }

  return baseCivilizations.map(([civilizationName, civilizationData]) => {
    const candidateKeys = [
      civilizationData?.internal_name,
      civilizationName,
      civilizationName.replace(/\s+/g, '_'),
    ].map((candidate) => normalizeTreeKey(candidate))

    const resolvedTreeFileName = candidateKeys
      .map((candidateKey) => treeFileByNormalizedName.get(candidateKey))
      .find(Boolean)

    if (!resolvedTreeFileName) {
      throw new Error(`Missing tree file for civilization "${civilizationName}"`)
    }

    return {
      civilizationData,
      civilizationName,
      treeFilePath: path.join(treesDirPath, resolvedTreeFileName),
    }
  })
}

function toAvailabilityEntries(nodes, idField = 'node_id') {
  const unique = new Map()

  for (const node of nodes ?? []) {
    if (node?.node_status === 'NotAvailable') {
      continue
    }

    const id = Number(node?.[idField])
    const age = Number(node?.age_id)

    if (!Number.isFinite(id) || !Number.isFinite(age)) {
      continue
    }

    const key = `${id}:${age}`
    if (!unique.has(key)) {
      unique.set(key, { id, age })
    }
  }

  return Array.from(unique.values()).sort((a, b) => {
    if (a.age !== b.age) {
      return a.age - b.age
    }
    return a.id - b.id
  })
}

function pickUniqueUnits(unitNodes, uniqueUnitNames) {
  const uniqueCandidates = (unitNodes ?? [])
    .filter((node) => node?.use_type === 'Unit')
    .filter((node) => node?.node_type === 'UniqueUnit')
    .filter((node) => node?.node_status !== 'NotAvailable')

  const castleCandidates = uniqueCandidates.filter((node) => Number(node?.building_id) === 82)
  const candidates = castleCandidates.length > 0 ? castleCandidates : uniqueCandidates

  if (candidates.length === 0) {
    return {
      castleAgeUniqueUnit: null,
      imperialAgeUniqueUnit: null,
    }
  }

  for (const unitName of uniqueUnitNames) {
    const normalizedName = normalizeWithoutElitePrefix(unitName)
    const sameFamily = candidates.filter(
      (candidate) => normalizeWithoutElitePrefix(candidate?.name) === normalizedName,
    )

    if (sameFamily.length === 0) {
      continue
    }

    const sorted = sameFamily.slice().sort((left, right) => {
      const leftElite = /^elite\s+/i.test(left?.name ?? '')
      const rightElite = /^elite\s+/i.test(right?.name ?? '')

      if (leftElite !== rightElite) {
        return leftElite ? 1 : -1
      }

      return Number(left?.age_id ?? 0) - Number(right?.age_id ?? 0)
    })

    return {
      castleAgeUniqueUnit: Number(sorted[0]?.node_id ?? null),
      imperialAgeUniqueUnit: Number(sorted[sorted.length - 1]?.node_id ?? null),
    }
  }

  const grouped = new Map()
  for (const candidate of candidates) {
    const groupKey = normalizeWithoutElitePrefix(candidate?.name)
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, [])
    }
    grouped.get(groupKey).push(candidate)
  }

  const groups = Array.from(grouped.values())
  groups.sort((leftGroup, rightGroup) => {
    const leftMinAge = Math.min(...leftGroup.map((entry) => Number(entry?.age_id ?? 0)))
    const rightMinAge = Math.min(...rightGroup.map((entry) => Number(entry?.age_id ?? 0)))
    return leftMinAge - rightMinAge
  })

  const selected = groups[0].slice().sort((left, right) => Number(left?.age_id ?? 0) - Number(right?.age_id ?? 0))

  return {
    castleAgeUniqueUnit: Number(selected[0]?.node_id ?? null),
    imperialAgeUniqueUnit: Number(selected[selected.length - 1]?.node_id ?? null),
  }
}

function pickUniqueTechs(techNodes, uniqueTechNames, castleTechFrequency) {
  const candidates = (techNodes ?? [])
    .filter((node) => node?.use_type === 'Tech')
    .filter((node) => Number(node?.building_id) === 82)
    .filter((node) => node?.node_status !== 'NotAvailable')

  if (candidates.length === 0) {
    return {
      castleAgeUniqueTech: null,
      imperialAgeUniqueTech: null,
    }
  }

  const normalizedCandidates = candidates.map((candidate) => ({
    ...candidate,
    _normalizedName: normalizeForMatch(candidate?.name),
  }))

  if (uniqueTechNames.length > 0) {
    const resolved = []

    for (const uniqueTechName of uniqueTechNames) {
      const normalizedUniqueTech = normalizeForMatch(uniqueTechName)
      const found = normalizedCandidates.find((candidate) => candidate._normalizedName === normalizedUniqueTech)
      if (found) {
        resolved.push(found)
      }
    }

    const uniqueResolved = Array.from(
      new Map(resolved.map((entry) => [Number(entry?.node_id), entry])).values(),
    ).sort((left, right) => Number(left?.age_id ?? 0) - Number(right?.age_id ?? 0))

    if (uniqueResolved.length >= 2) {
      return {
        castleAgeUniqueTech: Number(uniqueResolved[0]?.node_id ?? null),
        imperialAgeUniqueTech: Number(uniqueResolved[uniqueResolved.length - 1]?.node_id ?? null),
      }
    }

    if (uniqueResolved.length === 1) {
      const matched = uniqueResolved[0]
      const fallbackWithoutMatched = normalizedCandidates
        .filter((candidate) => Number(candidate?.node_id) !== Number(matched?.node_id))
        .filter((candidate) => Number(castleTechFrequency.get(Number(candidate?.node_id)) ?? 0) <= 2)
        .sort((left, right) => Number(left?.age_id ?? 0) - Number(right?.age_id ?? 0))

      const secondary = fallbackWithoutMatched[0]
      if (secondary) {
        const pair = [matched, secondary].sort((left, right) => Number(left?.age_id ?? 0) - Number(right?.age_id ?? 0))
        return {
          castleAgeUniqueTech: Number(pair[0]?.node_id ?? null),
          imperialAgeUniqueTech: Number(pair[pair.length - 1]?.node_id ?? null),
        }
      }

      return {
        castleAgeUniqueTech: Number(matched?.node_id ?? null),
        imperialAgeUniqueTech: Number(matched?.node_id ?? null),
      }
    }
  }

  const fallback = normalizedCandidates
    .filter((candidate) => Number(castleTechFrequency.get(Number(candidate?.node_id)) ?? 0) <= 2)
    .sort((left, right) => Number(left?.age_id ?? 0) - Number(right?.age_id ?? 0))

  const selectedFallback = fallback.length > 0 ? fallback : normalizedCandidates

  return {
    castleAgeUniqueTech: Number(selectedFallback[0]?.node_id ?? null),
    imperialAgeUniqueTech: Number(selectedFallback[selectedFallback.length - 1]?.node_id ?? null),
  }
}

function findTreeNodeById(nodes, nodeId) {
  const numericNodeId = Number(nodeId)
  if (!Number.isFinite(numericNodeId)) {
    return null
  }

  const matches = (nodes ?? []).filter((node) => Number(node?.node_id) === numericNodeId)
  if (matches.length === 0) {
    return null
  }

  return matches.find((node) => node?.node_status !== 'NotAvailable') ?? matches[0]
}

async function buildNormalizedGameData(upstreamRootData, upstreamEnglishStrings, treesDirPath) {
  const baseCivilizationTreeRefs = await resolveBaseCivilizationTreeRefs(upstreamRootData, treesDirPath)

  const civ_names = {}
  const civ_helptexts = {}
  const techtrees = {}

  const treesByCivName = new Map()
  for (const { civilizationName, treeFilePath } of baseCivilizationTreeRefs) {
    const tree = await readJson(treeFilePath)
    treesByCivName.set(civilizationName, tree)
  }

  const castleTechFrequency = new Map()
  for (const tree of treesByCivName.values()) {
    for (const node of tree?.units_techs ?? []) {
      if (node?.use_type !== 'Tech') {
        continue
      }
      if (Number(node?.building_id) !== 82) {
        continue
      }
      if (node?.node_status === 'NotAvailable') {
        continue
      }
      const techId = Number(node?.node_id)
      if (!Number.isFinite(techId)) {
        continue
      }
      castleTechFrequency.set(techId, Number(castleTechFrequency.get(techId) ?? 0) + 1)
    }
  }

  for (const { civilizationName, civilizationData } of baseCivilizationTreeRefs) {
    civ_names[civilizationName] = civilizationData?.name_string_id ?? null
    civ_helptexts[civilizationName] = civilizationData?.help_string_id ?? null

    const tree = treesByCivName.get(civilizationName)
    const helpText = upstreamEnglishStrings[String(civilizationData?.help_string_id)] ?? ''

    const uniqueUnitNames = normalizeHeadingList(helpText, /^Unique Unit(?:s)?\s*:/i, {
      splitCommaWhenInline: true,
    })
    const uniqueTechNames = normalizeHeadingList(helpText, /^Unique Tech(?:s)?\s*:/i)

    const uniqueUnits = pickUniqueUnits(tree?.units_techs, uniqueUnitNames)
    const uniqueTechs = pickUniqueTechs(tree?.units_techs, uniqueTechNames, castleTechFrequency)
    const unitNodes = (tree?.units_techs ?? []).filter((node) => node?.use_type === 'Unit')
    const castleAgeUniqueUnitNode = findTreeNodeById(unitNodes, uniqueUnits.castleAgeUniqueUnit)
    const imperialAgeUniqueUnitNode = findTreeNodeById(unitNodes, uniqueUnits.imperialAgeUniqueUnit)

    techtrees[civilizationName] = {
      buildings: toAvailabilityEntries(tree?.buildings, 'node_id'),
      monkSuffix: '',
      techs: toAvailabilityEntries(
        (tree?.units_techs ?? []).filter((node) => node?.use_type === 'Tech'),
        'node_id',
      ),
      unique: {
        castleAgeUniqueTech: uniqueTechs.castleAgeUniqueTech,
        castleAgeUniqueUnit: uniqueUnits.castleAgeUniqueUnit,
        castleAgeUniqueUnitHelpStringId: Number(castleAgeUniqueUnitNode?.help_string_id ?? null),
        castleAgeUniqueUnitNameStringId: Number(castleAgeUniqueUnitNode?.name_string_id ?? null),
        imperialAgeUniqueTech: uniqueTechs.imperialAgeUniqueTech,
        imperialAgeUniqueUnit: uniqueUnits.imperialAgeUniqueUnit,
        imperialAgeUniqueUnitHelpStringId: Number(imperialAgeUniqueUnitNode?.help_string_id ?? null),
        imperialAgeUniqueUnitNameStringId: Number(imperialAgeUniqueUnitNode?.name_string_id ?? null),
      },
      units: toAvailabilityEntries(
        (tree?.units_techs ?? []).filter((node) => node?.use_type === 'Unit'),
        'node_id',
      ),
    }
  }

  return {
    age_names: upstreamRootData.age_names ?? {},
    civ_helptexts,
    civ_names,
    data: {
      buildings: upstreamRootData.data?.Building ?? {},
      node_types: {},
      techs: upstreamRootData.data?.Tech ?? {},
      unit_upgrades: upstreamRootData.data?.unit_upgrades ?? {},
      units: upstreamRootData.data?.Unit ?? {},
    },
    tech_tree_strings: upstreamRootData.tech_tree_strings ?? {},
    techtrees,
  }
}

async function main() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'siegeengineers-sync-'))
  const clonePath = path.join(tempDir, 'aoe2techtree')

  try {
    console.log(`Cloning ${REPO_URL} (${REPO_BRANCH})...`)
    run('git', ['clone', '--depth', '1', '--branch', REPO_BRANCH, REPO_URL, clonePath], tempDir)

    const sourceDataPath = path.join(clonePath, 'data', 'data.json')
    const sourceEnglishStringsPath = path.join(clonePath, 'data', 'locales', 'en', 'strings.json')

    const upstreamRootData = await readJson(sourceDataPath)
    const upstreamEnglishStrings = await readJson(sourceEnglishStringsPath)

    console.log('Mirroring upstream tech-tree viewer assets...')
    await replaceDir(path.join(clonePath, 'data'), path.join(outputPaths.mirroredTechTree, 'data'))
    await replaceDir(path.join(clonePath, 'fonts'), path.join(outputPaths.mirroredTechTree, 'fonts'))
    await replaceDir(path.join(clonePath, 'img'), path.join(outputPaths.mirroredTechTree, 'img'))
    await replaceDir(path.join(clonePath, 'js'), path.join(outputPaths.mirroredTechTree, 'js'))
    await fs.copyFile(path.join(clonePath, 'index.html'), path.join(outputPaths.mirroredTechTree, 'index.html'))
    await fs.copyFile(path.join(clonePath, 'style.css'), path.join(outputPaths.mirroredTechTree, 'style.css'))

    console.log('Mirroring image assets used by trainers...')
    await replaceDir(path.join(clonePath, 'img'), outputPaths.mirroredImages)
    await ensureCompatImageFolders(outputPaths.mirroredImages)
    const baseCivilizationTreeRefs = await resolveBaseCivilizationTreeRefs(
      upstreamRootData,
      path.join(clonePath, 'data', 'trees'),
    )
    const aliasStats = await createNodeIdImageAliases(
      baseCivilizationTreeRefs.map((treeRef) => treeRef.treeFilePath),
      outputPaths.mirroredImages,
    )
    const legacyAliasStats = await restoreLegacyNamedImageAliases(outputPaths.mirroredImages)
    console.log(
      `Generated icon aliases from node IDs: ${aliasStats.aliases} aliases, ${aliasStats.copiedCount} copied, ${aliasStats.missingSourceCount} missing sources`,
    )
    console.log(
      `Restored legacy icon aliases: ${legacyAliasStats.restoredFromGitCount} from git history, ${legacyAliasStats.restoredFromFallbackCount} from fallbacks`,
    )

    console.log('Generating normalized local game data...')
    const normalizedGameData = await buildNormalizedGameData(
      upstreamRootData,
      upstreamEnglishStrings,
      path.join(clonePath, 'data', 'trees'),
    )

    await writeJson(outputPaths.gameData, normalizedGameData)

    console.log('Syncing English strings...')
    await writeJson(outputPaths.strings, upstreamEnglishStrings)

    const civCount = Object.keys(normalizedGameData.civ_names).length
    const hasMuisca = Object.prototype.hasOwnProperty.call(normalizedGameData.civ_names, 'Muisca')
    const hasMapuche = Object.prototype.hasOwnProperty.call(normalizedGameData.civ_names, 'Mapuche')
    const hasTupi = Object.prototype.hasOwnProperty.call(normalizedGameData.civ_names, 'Tupi')

    console.log(`Done. Base-era civs: ${civCount}`)
    console.log(`Includes Muisca: ${hasMuisca}, Mapuche: ${hasMapuche}, Tupi: ${hasTupi}`)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
