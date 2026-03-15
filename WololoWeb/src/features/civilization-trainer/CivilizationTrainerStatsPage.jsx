import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { playMenuClickSound } from '../../shared/audio/uiSounds.js'
import { civilizationTrainerDifficulties } from './civilizationTrainerData.js'
import { readHighscores } from './highscores.js'
import {
  getCounterPercent,
  readCivilizationTrainerStats,
  trackedCivilizationTrainerCivilizations,
} from './civilizationTrainerStats.js'

function getPercentColor(percent) {
  const hue = Math.max(0, Math.min(120, Math.round((percent / 100) * 120)))
  return `hsl(${hue} 74% 42%)`
}

function buildRows(items, countersById, sortOrder) {
  const direction = sortOrder === 'asc' ? 1 : -1
  return items
    .map((item) => {
      const counter = countersById[item.id] ?? { total: 0, correct: 0 }
      const total = Number(counter.total) || 0
      const correct = Number(counter.correct) || 0
      const percent = getCounterPercent(counter)

      return {
        ...item,
        correct,
        total,
        percent,
      }
    })
    .filter((row) => row.total > 0)
    .sort((left, right) => {
      if (left.percent !== right.percent) {
        return direction * (left.percent - right.percent)
      }

      if (left.total !== right.total) {
        return direction * (left.total - right.total)
      }

      return left.name.localeCompare(right.name)
    })
}

export function CivilizationTrainerStatsPage() {
  const [stats, setStats] = useState(() => readCivilizationTrainerStats())
  const [highscores, setHighscores] = useState(() => readHighscores())
  const [sortOrder, setSortOrder] = useState('asc')

  useEffect(() => {
    const onStorage = () => {
      setStats(readCivilizationTrainerStats())
      setHighscores(readHighscores())
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const civilizationRows = useMemo(
    () => buildRows(trackedCivilizationTrainerCivilizations, stats.civs, sortOrder),
    [sortOrder, stats.civs],
  )

  return (
    <main className="screen">
      <section className="panel wide">
        <div className="top-bar trainer-nav-top-bar">
          <div className="trainer-nav-actions">
            <Link to="/civilization-trainer" className="trainer-nav-button" onClick={playMenuClickSound}>
              Back to Civilization Trainer
            </Link>
            <Link to="/" className="trainer-nav-button" onClick={playMenuClickSound}>
              Back to Main Menu
            </Link>
          </div>
          <button
            type="button"
            className="trainer-sort-button"
            onClick={() => setSortOrder((currentOrder) => (currentOrder === 'asc' ? 'desc' : 'asc'))}
          >
            Order: {sortOrder === 'asc' ? 'Lowest to Highest' : 'Highest to Lowest'}
          </button>
        </div>

        <h1 className="section-title">Civilization Trainer Stats</h1>
        <p className="section-subtitle">Track how consistently you identify each civilization bonus set.</p>
        <section className="civilization-trainer-highscore-grid-wrap">
          <h2 className="trainer-stats-column-title">Highscores By Difficulty</h2>
          <div className="civilization-trainer-highscore-grid">
            {civilizationTrainerDifficulties.map((difficulty) => (
              <article key={difficulty.id} className="civilization-trainer-highscore-card">
                <span>{difficulty.title}</span>
                <strong>{highscores[difficulty.id] ?? 0}</strong>
              </article>
            ))}
          </div>
        </section>

        <div className="trainer-stats-columns civilization-trainer-stats-single">
          <section className="trainer-stats-column">
            <h2 className="trainer-stats-column-title">Civilizations</h2>
            <div className="trainer-stats-list">
              {civilizationRows.length === 0 ? (
                <p className="section-subtitle">No civilization stats yet.</p>
              ) : (
                civilizationRows.map((row) => (
                  <article key={row.id} className="trainer-stats-row">
                    <div className="trainer-stats-meta">
                      <img
                        src={row.icon}
                        alt=""
                        className="trainer-stats-icon"
                        onError={(event) => {
                          event.currentTarget.src = '/img/missing.png'
                        }}
                      />
                      <span className="trainer-stats-name">{row.name}</span>
                    </div>
                    <div className="trainer-stats-bar-wrap">
                      <p className="trainer-stats-percent-label">
                        {row.percent}% ({row.correct}/{row.total})
                      </p>
                      <div className="trainer-stats-bar-track">
                        <div
                          className="trainer-stats-bar-fill"
                          style={{
                            width: `${row.percent}%`,
                            backgroundColor: getPercentColor(row.percent),
                          }}
                        />
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
