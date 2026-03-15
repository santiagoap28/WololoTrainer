import { Link } from 'react-router-dom'
import { playMenuClickSound } from '../../shared/audio/uiSounds.js'

const trainingMethods = [
  {
    id: 'civilizations',
    title: 'Compare Civilizations',
    description: 'Identify every civilization icon quickly.',
    route: '/civilizations',
    enabled: true,
  },
  {
    id: 'units',
    title: 'Unit Recognition',
    description: 'Practice unit icons and names.',
    enabled: false,
  },
  {
    id: 'tech-tree',
    title: 'Tech Tree Trainer',
    description: 'Practice civilization tech-tree availability.',
    route: '/tech-tree-trainer',
    enabled: true,
  },
  {
    id: 'crowns-trainer',
    title: 'Crowns Trainer',
    description: 'Practice unique castle/imperial crown tech recognition.',
    route: '/crowns-trainer',
    enabled: true,
  },
  {
    id: 'bonuses-trainer',
    title: 'Bonuses Trainer',
    description: 'Practice civilization and team bonus recognition.',
    route: '/bonuses-trainer',
    enabled: true,
  },
  {
    id: 'civilization-trainer',
    title: 'Civilization Trainer',
    description: 'Complete each civilization bonus sheet by searching the bonus text.',
    route: '/civilization-trainer',
    enabled: true,
  },
  {
    id: 'build-orders',
    title: 'Build Order Quiz',
    description: 'Learn optimized openings by matchup.',
    enabled: false,
  },
]

export function MainMenuPage() {
  return (
    <main className="screen">
      <section className="panel">
        <p className="eyebrow">Wololo Trainer</p>
        <h1 className="hero-title">Age of Empires II Training Grounds</h1>
        <p className="hero-subtitle">Choose a training method to start practicing.</p>

        <div className="method-grid">
          {trainingMethods.map((method) => {
            if (method.enabled) {
              return (
                <Link key={method.id} to={method.route} className="method-card" onClick={playMenuClickSound}>
                  <h2>{method.title}</h2>
                  <p>{method.description}</p>
                </Link>
              )
            }

            return (
              <button key={method.id} className="method-card disabled" type="button" disabled>
                <h2>{method.title}</h2>
                <p>{method.description}</p>
                <span className="tag">Coming Soon</span>
              </button>
            )
          })}
        </div>
      </section>
    </main>
  )
}
