import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { playMenuClickSound } from '../../shared/audio/uiSounds.js'
import { getCounterPercent, readTrainerStats, trackedCivilizations, trackedTechOptions } from './trainerStats.js'

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

export function TechTreeTrainerStatsPage() {
  const [stats, setStats] = useState(() => readTrainerStats())
  const [sortOrder, setSortOrder] = useState('asc')

  useEffect(() => {
    const onStorage = () => {
      setStats(readTrainerStats())
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const civilizationRows = useMemo(
    () => buildRows(trackedCivilizations, stats.civs, sortOrder),
    [sortOrder, stats.civs],
  )
  const techRows = useMemo(
    () => buildRows(trackedTechOptions, stats.techs, sortOrder),
    [sortOrder, stats.techs],
  )

  return (
    <main className="screen">
      <section className="panel wide">
        <div className="top-bar trainer-nav-top-bar">
          <div className="trainer-nav-actions">
            <Link to="/tech-tree-trainer" className="trainer-nav-button" onClick={playMenuClickSound}>
              Back to Tech Tree Trainer
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

        <h1 className="section-title">Tech Tree Trainer Stats</h1>
        <p className="section-subtitle">Combined tracking across all difficulties.</p>

        <div className="trainer-stats-columns">
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

          <section className="trainer-stats-column">
            <h2 className="trainer-stats-column-title">Techs</h2>
            <div className="trainer-stats-list">
              {techRows.length === 0 ? (
                <p className="section-subtitle">No tech stats yet.</p>
              ) : (
                techRows.map((row) => (
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
                      <span className="trainer-stats-name">
                        {row.name}
                        <span className="trainer-stats-tag">{row.groupLabel}</span>
                      </span>
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
