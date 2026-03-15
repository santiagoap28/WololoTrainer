import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { playMenuClickSound } from '../../shared/audio/uiSounds.js'
import { crownsTrainerDifficulties } from './crownsData.js'
import { readHighscores } from './highscores.js'
import { isReviewModeEnabled } from '../../shared/reviewMode.js'

const difficultyDescription =
  'Guess the civilization from Castle Crown and Imperial Crown unique techs.'

export function CrownsTrainerMenuPage() {
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
            <Link to="/crowns-trainer/stats" className="trainer-nav-button" onClick={playMenuClickSound}>
              Stats
            </Link>
            <Link
              to={isReviewMode ? '/crowns-trainer' : '/crowns-trainer?mode=review'}
              className="trainer-nav-button"
              onClick={playMenuClickSound}
            >
              {isReviewMode ? 'Normal' : 'Review'}
            </Link>
          </div>
        </div>

        <h1 className="section-title">Crowns Trainer</h1>
        <p className="section-subtitle">
          {isReviewMode
            ? 'Review Mode: questions focus on the crown techs and civs you miss most.'
            : 'Choose a difficulty to start a 10-question crown-tech quiz.'}
        </p>

        <div className="difficulty-grid">
          {crownsTrainerDifficulties.map((difficulty) => (
            <Link
              key={difficulty.id}
              to={`/crowns-trainer/play/${difficulty.id}${playRouteSuffix}`}
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
              <p>{difficultyDescription}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
