import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { readHighscores } from './highscores.js'
import { playMenuClickSound } from '../../shared/audio/uiSounds.js'
import { isReviewModeEnabled } from '../../shared/reviewMode.js'

const difficulties = [
  {
    id: 'easy',
    title: 'Easy',
    description: 'Only unit types (Barracks, Stable, Archery Range).',
    className: 'difficulty-easy',
    icon: '/img/Units/83.png',
  },
  {
    id: 'medium',
    title: 'Medium',
    description: 'Units + Blacksmith + Military upgrades. No Naval/Monastery/Defenses.',
    className: 'difficulty-medium',
    icon: '/img/Units/448.png',
  },
  {
    id: 'hard',
    title: 'Hard',
    description:
      'No unit lines: Blacksmith + Military + key Defenses/Monastery options.',
    className: 'difficulty-hard',
    icon: '/img/Units/38.png',
  },
  {
    id: 'extreme',
    title: 'Extreme',
    description: 'All non-unit categories (no Barracks/Stable/Archery line questions).',
    className: 'difficulty-extreme',
    icon: '/img/Units/569.png',
  },
  {
    id: 'legendary',
    title: 'Legendary',
    description: 'Advanced only (Hard/Extreme scope), very large pools (up to 30 options).',
    className: 'difficulty-legendary',
    icon: '/img/Units/1790.png',
  },
]

export function TechTreeTrainerMenuPage() {
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
            <Link to="/tech-tree-trainer/stats" className="trainer-nav-button" onClick={playMenuClickSound}>
              Stats
            </Link>
            <Link
              to={isReviewMode ? '/tech-tree-trainer' : '/tech-tree-trainer?mode=review'}
              className="trainer-nav-button"
              onClick={playMenuClickSound}
            >
              {isReviewMode ? 'Normal' : 'Review'}
            </Link>
          </div>
        </div>

        <h1 className="section-title">Tech Tree Trainer</h1>
        <p className="section-subtitle">
          {isReviewMode
            ? 'Review Mode: questions focus on your weakest civilizations and tech options.'
            : 'Choose a difficulty to start a 10-question quiz (mixed multiple choice + select-all).'}
        </p>

        <div className="difficulty-grid">
          {difficulties.map((difficulty) => (
            <Link
              key={difficulty.id}
              to={`/tech-tree-trainer/play/${difficulty.id}${playRouteSuffix}`}
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
                  <span className="highscore-crown" aria-hidden="true">
                    ♕
                  </span>
                  <span className="highscore-prefix">HS</span>
                  <span className="highscore-value">{highscores[difficulty.id] ?? 0}</span>
                </p>
              </div>
              <p>{difficulty.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
