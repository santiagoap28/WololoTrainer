import { useEffect, useRef } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { playMenuClickSound } from '../../shared/audio/uiSounds.js'
import { civilizations } from '../civilizations/civilizationsData.js'

function getViewerUrl(civilizationName) {
  return `/aoe2techtree/index.html#${encodeURIComponent(civilizationName)}`
}

export function TechTreeViewerPage() {
  const { civilizationId } = useParams()
  const civilization = civilizations.find((entry) => entry.id === civilizationId)
  const frameRef = useRef(null)
  const viewerCivilizationName = civilization?.name ?? null

  useEffect(() => {
    const iframe = frameRef.current
    if (!iframe || !viewerCivilizationName) {
      return undefined
    }

    let detachWheelListener = () => {}

    const attachHorizontalWheel = () => {
      detachWheelListener()

      const frameWindow = iframe.contentWindow
      if (!frameWindow) {
        detachWheelListener = () => {}
        return
      }

      const handleWheel = (event) => {
        const horizontalDelta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY
        if (!horizontalDelta) {
          return
        }

        frameWindow.scrollBy({ left: horizontalDelta, top: 0, behavior: 'auto' })
        event.preventDefault()
      }

      const wheelListenerOptions = { capture: true, passive: false }
      frameWindow.addEventListener('wheel', handleWheel, wheelListenerOptions)
      detachWheelListener = () => frameWindow.removeEventListener('wheel', handleWheel, wheelListenerOptions)
    }

    iframe.addEventListener('load', attachHorizontalWheel)
    attachHorizontalWheel()

    return () => {
      iframe.removeEventListener('load', attachHorizontalWheel)
      detachWheelListener()
    }
  }, [viewerCivilizationName])

  if (!civilization) {
    return <Navigate to="/civilizations" replace />
  }

  return (
    <main className="screen">
      <section className="panel wide tech-tree-viewer-panel">
        <div className="top-bar trainer-nav-top-bar">
          <div className="trainer-nav-actions">
            <Link to="/civilizations" className="trainer-nav-button" onClick={playMenuClickSound}>
              Back to Civilizations
            </Link>
            <Link to="/" className="trainer-nav-button" onClick={playMenuClickSound}>
              Back to Main Menu
            </Link>
          </div>
        </div>

        <h1 className="section-title">Tech Tree Viewer</h1>
        <p className="section-subtitle">
          Viewing: <strong>{civilization.name}</strong>
        </p>

        <div className="tech-tree-viewer-frame-wrap">
          <iframe
            ref={frameRef}
            className="tech-tree-viewer-frame"
            src={getViewerUrl(civilization.name)}
            title={`Tech Tree - ${civilization.name}`}
          />
        </div>
      </section>
    </main>
  )
}
