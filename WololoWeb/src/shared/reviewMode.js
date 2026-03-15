function toSafeNonNegativeInteger(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0
  }

  return Math.floor(numericValue)
}

export function isReviewModeEnabled(searchParams) {
  return String(searchParams?.get?.('mode') ?? '').toLowerCase() === 'review'
}

export function getCounterMisses(counter) {
  const total = toSafeNonNegativeInteger(counter?.total)
  const correct = Math.min(total, toSafeNonNegativeInteger(counter?.correct))
  return Math.max(0, total - correct)
}

export function createCounterMissMap(counterById) {
  const result = {}

  for (const [id, counter] of Object.entries(counterById ?? {})) {
    const misses = getCounterMisses(counter)
    if (misses > 0) {
      result[id] = misses
    }
  }

  return result
}

export function hasAnyFailures(weightById) {
  return Object.values(weightById ?? {}).some((value) => Number(value) > 0)
}

export function pickWeightedItem(items, getWeight, fallbackItem = null) {
  if (!Array.isArray(items) || items.length === 0) {
    return fallbackItem
  }

  const weighted = items.map((item) => ({
    item,
    weight: Math.max(0, Number(getWeight(item) ?? 0)),
  }))
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0)
  if (totalWeight <= 0) {
    return fallbackItem ?? items[Math.floor(Math.random() * items.length)]
  }

  let cursor = Math.random() * totalWeight
  for (const entry of weighted) {
    cursor -= entry.weight
    if (cursor <= 0) {
      return entry.item
    }
  }

  return fallbackItem ?? weighted[weighted.length - 1]?.item ?? null
}

export function sampleWeightedWithoutReplacement(items, count, getWeight) {
  if (!Array.isArray(items) || items.length === 0 || count <= 0) {
    return []
  }

  const pool = [...items]
  const results = []

  while (pool.length > 0 && results.length < count) {
    const picked = pickWeightedItem(pool, getWeight, pool[pool.length - 1])
    if (!picked) {
      break
    }

    results.push(picked)
    const pickedIndex = pool.indexOf(picked)
    if (pickedIndex >= 0) {
      pool.splice(pickedIndex, 1)
    } else {
      break
    }
  }

  return results
}
