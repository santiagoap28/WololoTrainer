import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { playMenuClickSound } from '../../shared/audio/uiSounds.js'
import { civilizationTrainerDifficulties } from './civilizationTrainerData.js'
import { readHighscores } from './highscores.js'
import { isReviewModeEnabled } from '../../shared/reviewMode.js'

export function CivilizationTrainerMenuPage() {
  const [searchParams] = useSearchParams()
  const [highscores, setHighscores] = useState(() => readHighscores())
  const isReviewMode = isReviewModeEnabled(searchParams)
  const playRouteSuffix = isReviewMode ? '?mode=review' : ''

  useEffect(() => {
    const onStorage = () => {
      setHighscores(readHighscores())
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <main className="screen">
      <section className="panel tech-panel">
        <div className="top-bar trainer-nav-top-bar">
          <div className="trainer-nav-actions">
            <Link to="/" className="trainer-nav-button" onClick={playMenuClickSound}>
              Back to Main Menu
            </Link>
            <Link to="/civilization-trainer/stats" className="trainer-nav-button" onClick={playMenuClickSound}>
              Stats
            </Link>
            <Link
              to={isReviewMode ? '/civilization-trainer' : '/civilization-trainer?mode=review'}
              className="trainer-nav-button"
              onClick={playMenuClickSound}
            >
              {isReviewMode ? 'Normal' : 'Review'}
            </Link>
          </div>
        </div>

        <h1 className="section-title">Civilization Trainer</h1>
        <p className="section-subtitle">
          {isReviewMode
            ? 'Review Mode: prioritizes civilizations with lower accuracy in your stats.'
            : 'Choose a difficulty to complete all civ and team bonuses for one civilization.'}
        </p>

        <div className="difficulty-grid">
          {civilizationTrainerDifficulties.map((difficulty) => (
            <Link
              key={difficulty.id}
              to={`/civilization-trainer/play/${difficulty.id}${playRouteSuffix}`}
              className={`method-card difficulty-card ${difficulty.className}`}
              onClick={playMenuClickSound}
            >
              <div className="difficulty-header-row">
                <div className="difficulty-left">
                  <img
                    src={difficulty.icon}
                    alt=""
                    className="difficulty-icon"
                    onError={(event) => {
                      event.currentTarget.src = '/img/missing.png'
                    }}
                  />
                  <h2>{difficulty.title}</h2>
                </div>
                <p className="difficulty-highscore">
                  <span className="highscore-prefix">HS</span>
                  <span className="highscore-value">{highscores[difficulty.id] ?? 0}</span>
                </p>
              </div>
              <p>Search and fill civilization bonuses, one civilization at a time.</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
