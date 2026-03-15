const HIGHSCORE_STORAGE_KEY = 'wololo_civilization_trainer_highscores_v1'

const DEFAULT_HIGHSCORES = {
  easy: 0,
  medium: 0,
  hard: 0,
  extreme: 0,
  legendary: 0,
}

function hasBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readHighscores() {
  if (!hasBrowserStorage()) {
    return { ...DEFAULT_HIGHSCORES }
  }

  try {
    const rawValue = window.localStorage.getItem(HIGHSCORE_STORAGE_KEY)
    if (!rawValue) {
      return { ...DEFAULT_HIGHSCORES }
    }

    const parsedValue = JSON.parse(rawValue)
    return {
      ...DEFAULT_HIGHSCORES,
      ...Object.fromEntries(
        Object.entries(parsedValue).map(([difficulty, value]) => [difficulty, Number(value) || 0]),
      ),
    }
  } catch {
    return { ...DEFAULT_HIGHSCORES }
  }
}

export function writeHighscores(nextHighscores) {
  if (!hasBrowserStorage()) {
    return
  }

  window.localStorage.setItem(HIGHSCORE_STORAGE_KEY, JSON.stringify(nextHighscores))
}

export function updateHighscore(difficulty, score) {
  const currentHighscores = readHighscores()
  const currentScore = currentHighscores[difficulty] ?? 0

  if (score <= currentScore) {
    return currentHighscores
  }

  const nextHighscores = {
    ...currentHighscores,
    [difficulty]: score,
  }
  writeHighscores(nextHighscores)
  return nextHighscores
}
