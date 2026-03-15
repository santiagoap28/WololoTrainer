import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  archeryRangeOptions,
  barracksOptions,
  blacksmithUpgradeOptions,
  civilizationCategoryOptions,
  civilizationExpansionOptions,
  civilizations,
  defenseOptions,
  militaryUpgradeOptions,
  monasteryOptions,
  navalOptions,
  stableOptions,
} from './civilizationsData.js'

const filterGroups = [
  { key: 'categories', title: 'Civilization Category', options: civilizationCategoryOptions },
  { key: 'barracks', title: 'Barracks', options: barracksOptions },
  { key: 'stable', title: 'Stable', options: stableOptions },
  { key: 'archeryRange', title: 'Archery Range', options: archeryRangeOptions },
  { key: 'naval', title: 'Naval', options: navalOptions },
  { key: 'monastery', title: 'Monastery', options: monasteryOptions },
  { key: 'blacksmithUpgrades', title: 'Blacksmith Upgrades', options: blacksmithUpgradeOptions },
  { key: 'militaryUpgrades', title: 'Military Upgrades', options: militaryUpgradeOptions },
  { key: 'defenses', title: 'Defenses', options: defenseOptions },
  { key: 'expansions', title: 'Expansion', options: civilizationExpansionOptions },
]

const FILTER_GROUP_ORDER_STORAGE_KEY = 'wololo_filter_group_order_v1'
const filterGroupByKey = new Map(filterGroups.map((group) => [group.key, group]))
const defaultFilterOrder = filterGroups.map((group) => group.key)

function hasBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readFilterGroupOrder() {
  if (!hasBrowserStorage()) {
    return defaultFilterOrder
  }

  try {
    const rawValue = window.localStorage.getItem(FILTER_GROUP_ORDER_STORAGE_KEY)
    if (!rawValue) {
      return defaultFilterOrder
    }

    const parsedValue = JSON.parse(rawValue)
    if (!Array.isArray(parsedValue)) {
      return defaultFilterOrder
    }

    const uniqueValidKeys = [...new Set(parsedValue.filter((key) => filterGroupByKey.has(key)))]
    if (uniqueValidKeys.length === 0) {
      return defaultFilterOrder
    }

    const missingKeys = defaultFilterOrder.filter((key) => !uniqueValidKeys.includes(key))
    return [...uniqueValidKeys, ...missingKeys]
  } catch {
    return defaultFilterOrder
  }
}

function writeFilterGroupOrder(nextOrder) {
  if (!hasBrowserStorage()) {
    return
  }

  window.localStorage.setItem(FILTER_GROUP_ORDER_STORAGE_KEY, JSON.stringify(nextOrder))
}

const OPTION_STATE = {
  NONE: 'NONE',
  HAS: 'HAS',
  HAS_NOT: 'HAS_NOT',
}

function createInitialOptionStates() {
  const states = {}

  filterGroups.forEach((group) => {
    states[group.key] = {}
    group.options.forEach((option) => {
      states[group.key][option.id] = OPTION_STATE.NONE
    })
  })

  return states
}

const defaultEnabledGroups = {
  categories: true,
  expansions: true,
  barracks: true,
  stable: true,
  archeryRange: true,
  naval: true,
  monastery: true,
  blacksmithUpgrades: true,
  militaryUpgrades: true,
  defenses: true,
}

const defaultGroupModes = {
  categories: 'OR',
  expansions: 'OR',
  barracks: 'OR',
  stable: 'OR',
  archeryRange: 'OR',
  naval: 'OR',
  monastery: 'OR',
  blacksmithUpgrades: 'OR',
  militaryUpgrades: 'OR',
  defenses: 'OR',
}

const defaultOpenGroups = {
  categories: false,
  expansions: false,
  barracks: false,
  stable: false,
  archeryRange: false,
  naval: false,
  monastery: false,
  blacksmithUpgrades: false,
  militaryUpgrades: false,
  defenses: false,
}

const defaultInvertedGroups = {
  categories: false,
  expansions: false,
  barracks: false,
  stable: false,
  archeryRange: false,
  naval: false,
  monastery: false,
  blacksmithUpgrades: false,
  militaryUpgrades: false,
  defenses: false,
}

function handleImageLoadError(event, fallbackImage) {
  const { currentTarget } = event
  if (currentTarget.dataset.fallbackApplied === 'true') {
    return
  }

  currentTarget.dataset.fallbackApplied = 'true'
  currentTarget.src = fallbackImage
}

function matchesFilterGroup({ civValues, enabled, selected, mode, inverted }) {
  const stateEntries = Object.entries(selected)
  const hasFilters = stateEntries.some(([, state]) => state !== OPTION_STATE.NONE)

  if (!enabled || !hasFilters) {
    return true
  }

  const hasSelections = stateEntries
    .filter(([, state]) => state === OPTION_STATE.HAS)
    .map(([optionId]) => optionId)

  const hasNotSelections = stateEntries
    .filter(([, state]) => state === OPTION_STATE.HAS_NOT)
    .map(([optionId]) => optionId)

  const evalHas = () => {
    if (hasSelections.length === 0) {
      return true
    }

    return mode === 'AND'
      ? hasSelections.every((optionId) => civValues.includes(optionId))
      : hasSelections.some((optionId) => civValues.includes(optionId))
  }

  const evalHasNot = () => {
    if (hasNotSelections.length === 0) {
      return true
    }

    return mode === 'AND'
      ? hasNotSelections.every((optionId) => !civValues.includes(optionId))
      : hasNotSelections.some((optionId) => !civValues.includes(optionId))
  }

  const baseMatch = evalHas() && evalHasNot()

  return inverted ? !baseMatch : baseMatch
}

function getGridClassName(hasEffectiveFilters, count) {
  if (!hasEffectiveFilters) {
    return 'grid-compact'
  }

  if (count <= 12) {
    return 'grid-xl'
  }
  if (count <= 24) {
    return 'grid-lg'
  }
  if (count <= 36) {
    return 'grid-md'
  }

  return 'grid-sm'
}

function getCivValues(civilization, groupKey) {
  if (groupKey === 'expansions') {
    return [civilization.expansion]
  }

  return civilization[groupKey] ?? []
}

export function CivilizationsPage() {
  const [optionStates, setOptionStates] = useState(() => createInitialOptionStates())
  const [enabledGroups, setEnabledGroups] = useState(defaultEnabledGroups)
  const [groupModes, setGroupModes] = useState(defaultGroupModes)
  const [openGroups, setOpenGroups] = useState(defaultOpenGroups)
  const [invertedGroups, setInvertedGroups] = useState(defaultInvertedGroups)
  const [selectedCivilization, setSelectedCivilization] = useState(null)
  const [filterGroupOrder, setFilterGroupOrder] = useState(() => readFilterGroupOrder())
  const [draggedGroupKey, setDraggedGroupKey] = useState(null)
  const [dragOverGroupKey, setDragOverGroupKey] = useState(null)

  const orderedFilterGroups = useMemo(
    () => filterGroupOrder.map((groupKey) => filterGroupByKey.get(groupKey)).filter(Boolean),
    [filterGroupOrder],
  )

  useEffect(() => {
    if (!selectedCivilization) {
      return undefined
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedCivilization(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedCivilization])

  useEffect(() => {
    writeFilterGroupOrder(filterGroupOrder)
  }, [filterGroupOrder])

  const filteredCivilizations = useMemo(
    () =>
      civilizations.filter((civilization) =>
        orderedFilterGroups.every((group) =>
          matchesFilterGroup({
            civValues: getCivValues(civilization, group.key),
            enabled: enabledGroups[group.key],
            selected: optionStates[group.key],
            mode: groupModes[group.key],
            inverted: invertedGroups[group.key],
          }),
        ),
      ),
    [enabledGroups, groupModes, invertedGroups, optionStates, orderedFilterGroups],
  )

  const hasAnySelections = orderedFilterGroups.some((group) =>
    Object.values(optionStates[group.key]).some((state) => state !== OPTION_STATE.NONE),
  )
  const hasEffectiveFilters = orderedFilterGroups.some(
    (group) =>
      enabledGroups[group.key] &&
      Object.values(optionStates[group.key]).some((state) => state !== OPTION_STATE.NONE),
  )

  const gridClassName = getGridClassName(hasEffectiveFilters, filteredCivilizations.length)

  const toggleSelectedValue = (groupKey, value) => {
    setOptionStates((currentState) => {
      const currentValue = currentState[groupKey][value] ?? OPTION_STATE.NONE
      let nextValue = OPTION_STATE.NONE

      if (currentValue === OPTION_STATE.NONE) {
        nextValue = OPTION_STATE.HAS
      } else if (currentValue === OPTION_STATE.HAS) {
        nextValue = OPTION_STATE.HAS_NOT
      }

      return {
        ...currentState,
        [groupKey]: {
          ...currentState[groupKey],
          [value]: nextValue,
        },
      }
    })
  }

  const toggleGroupEnabled = (groupKey) => {
    setEnabledGroups((currentState) => ({
      ...currentState,
      [groupKey]: !currentState[groupKey],
    }))
  }

  const toggleGroupMode = (groupKey) => {
    setGroupModes((currentState) => ({
      ...currentState,
      [groupKey]: currentState[groupKey] === 'AND' ? 'OR' : 'AND',
    }))
  }

  const toggleGroupOpen = (groupKey) => {
    setOpenGroups((currentState) => ({
      ...currentState,
      [groupKey]: !currentState[groupKey],
    }))
  }

  const toggleGroupInversion = (groupKey) => {
    setInvertedGroups((currentState) => ({
      ...currentState,
      [groupKey]: !currentState[groupKey],
    }))
  }

  const moveFilterGroup = (sourceGroupKey, targetGroupKey) => {
    if (!sourceGroupKey || !targetGroupKey || sourceGroupKey === targetGroupKey) {
      return
    }

    setFilterGroupOrder((currentOrder) => {
      const sourceIndex = currentOrder.indexOf(sourceGroupKey)
      const targetIndex = currentOrder.indexOf(targetGroupKey)
      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
        return currentOrder
      }

      const nextOrder = [...currentOrder]
      nextOrder.splice(sourceIndex, 1)
      nextOrder.splice(targetIndex, 0, sourceGroupKey)
      return nextOrder
    })
  }

  return (
    <main className="screen">
      <section className="panel wide">
        <div className="top-bar">
          <Link to="/" className="back-link">
            Back to Main Menu
          </Link>
          <p className="count-label">
            Showing {filteredCivilizations.length} / {civilizations.length}
          </p>
        </div>

        <h1 className="section-title">Civilizations</h1>
        <p className="section-subtitle">Sorted alphabetically (A-Z).</p>

        <div className="civilizations-layout">
          <aside className="filters-sidebar" aria-label="Civilization filters">
            <div className="filters-topbar">
              <p className="filters-title">Filters</p>
              <button
                type="button"
                className="clear-filters-button"
                onClick={() => setOptionStates(createInitialOptionStates())}
                disabled={!hasAnySelections}
              >
                Clear Selections
              </button>
            </div>

            {orderedFilterGroups.map((group) => (
              <section
                key={group.key}
                className={`filter-group ${enabledGroups[group.key] ? '' : 'is-disabled'} ${
                  dragOverGroupKey === group.key ? 'is-drag-over' : ''
                }`}
                draggable
                onDragStart={() => {
                  setDraggedGroupKey(group.key)
                  setDragOverGroupKey(null)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  if (draggedGroupKey && draggedGroupKey !== group.key) {
                    setDragOverGroupKey(group.key)
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  moveFilterGroup(draggedGroupKey, group.key)
                  setDraggedGroupKey(null)
                  setDragOverGroupKey(null)
                }}
                onDragEnd={() => {
                  setDraggedGroupKey(null)
                  setDragOverGroupKey(null)
                }}
              >
                <div className="filter-group-head">
                  <div className="filter-group-controls">
                    <label className="switch" title={`${group.title}: enabled`}>
                      <input
                        type="checkbox"
                        checked={enabledGroups[group.key]}
                        onChange={() => toggleGroupEnabled(group.key)}
                        aria-label={`${group.title} enabled`}
                      />
                      <span className="switch-track" />
                    </label>

                    <label className="chip-control" title={`${group.title}: match mode`}>
                      <input
                        type="checkbox"
                        checked={groupModes[group.key] === 'AND'}
                        onChange={() => toggleGroupMode(group.key)}
                        aria-label={`${group.title} mode`}
                      />
                      <span>{groupModes[group.key]}</span>
                    </label>

                    <label className="chip-control invert" title={`${group.title}: invert`}>
                      <input
                        type="checkbox"
                        checked={invertedGroups[group.key]}
                        onChange={() => toggleGroupInversion(group.key)}
                        aria-label={`${group.title} invert`}
                      />
                      <span>Invert</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    className="filter-toggle"
                    onClick={() => toggleGroupOpen(group.key)}
                    aria-expanded={openGroups[group.key]}
                  >
                    <span>{group.title}</span>
                    <span className={`filter-arrow ${openGroups[group.key] ? 'open' : ''}`}>v</span>
                  </button>
                </div>

                {openGroups[group.key] && (
                  <div className="filter-options-grid">
                    {group.options.map((option) => {
                      const state = optionStates[group.key][option.id] ?? OPTION_STATE.NONE
                      const stateClass =
                        state === OPTION_STATE.HAS
                          ? 'state-has'
                          : state === OPTION_STATE.HAS_NOT
                            ? 'state-has-not'
                            : 'state-none'

                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={`filter-option-button ${stateClass}`}
                          onClick={() => toggleSelectedValue(group.key, option.id)}
                          aria-pressed={state !== OPTION_STATE.NONE}
                          title={`${option.label}: ${state.replace('_', ' ')}`}
                        >
                          <img
                            src={option.icon}
                            alt=""
                            className="filter-option-icon"
                            loading="lazy"
                            onError={(event) => handleImageLoadError(event, '/img/missing.png')}
                          />
                          <span>{option.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>
            ))}
          </aside>

          <section className="civilizations-content">
            <ul className={`civ-grid ${gridClassName}`}>
              {filteredCivilizations.map((civilization) => (
                <li key={civilization.id}>
                  <button
                    type="button"
                    className="civ-card"
                    onClick={() => setSelectedCivilization(civilization)}
                    aria-label={`Open ${civilization.name} overview`}
                  >
                    <img
                      src={civilization.icon}
                      alt={`${civilization.name} icon`}
                      loading="lazy"
                      className="civ-icon"
                      onError={(event) => handleImageLoadError(event, '/img/missing.png')}
                    />
                    <p className="civ-name">{civilization.name}</p>
                  </button>
                </li>
              ))}
            </ul>

            {filteredCivilizations.length === 0 && (
              <p className="section-subtitle">No civilizations match the active filters.</p>
            )}
          </section>
        </div>
      </section>

      {selectedCivilization && (
        <div className="civ-modal-backdrop" onClick={() => setSelectedCivilization(null)} role="presentation">
          <section className="civ-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="civ-modal-close"
              onClick={() => setSelectedCivilization(null)}
              aria-label="Close"
            >
              X
            </button>

            <header className="civ-modal-header">
              <img
                src={selectedCivilization.icon}
                alt={`${selectedCivilization.name} icon`}
                className="civ-modal-icon"
                onError={(event) => handleImageLoadError(event, '/img/missing.png')}
              />
              <div>
                <h2 className="civ-modal-title">{selectedCivilization.name}</h2>
                <p className="civ-modal-meta">
                  {selectedCivilization.expansion} | {selectedCivilization.categories.join(', ')}
                </p>
                <Link to={`/tech-tree/${selectedCivilization.id}`} className="trainer-nav-button civ-modal-open-tree-link">
                  Open Full Tech Tree
                </Link>
              </div>
            </header>

            {selectedCivilization.description && (
              <section className="civ-modal-section">
                <h3>Overview</h3>
                <div
                  className="civ-modal-text"
                  dangerouslySetInnerHTML={{ __html: selectedCivilization.description }}
                />
              </section>
            )}

            <section className="civ-modal-section">
              <h3>Unique Units</h3>
              <div className="unique-units-list">
                {selectedCivilization.uniqueUnits.map((unit) => (
                  <article key={unit.id} className="unique-unit-card">
                    <img
                      src={unit.icon}
                      alt={`${unit.name} icon`}
                      className="unique-unit-icon"
                      onError={(event) => handleImageLoadError(event, '/img/missing.png')}
                    />
                    <div>
                      <p className="unique-unit-name">{unit.name}</p>
                      {unit.description && (
                        <div className="civ-modal-text" dangerouslySetInnerHTML={{ __html: unit.description }} />
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </div>
      )}
    </main>
  )
}
