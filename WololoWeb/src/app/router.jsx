import { Navigate, createBrowserRouter } from 'react-router-dom'
import { CivilizationsPage } from '../features/civilizations/CivilizationsPage.jsx'
import { BonusesTrainerMenuPage } from '../features/bonuses-trainer/BonusesTrainerMenuPage.jsx'
import { BonusesTrainerPage } from '../features/bonuses-trainer/BonusesTrainerPage.jsx'
import { BonusesTrainerStatsPage } from '../features/bonuses-trainer/BonusesTrainerStatsPage.jsx'
import { CivilizationTrainerMenuPage } from '../features/civilization-trainer/CivilizationTrainerMenuPage.jsx'
import { CivilizationTrainerPage } from '../features/civilization-trainer/CivilizationTrainerPage.jsx'
import { CivilizationTrainerStatsPage } from '../features/civilization-trainer/CivilizationTrainerStatsPage.jsx'
import { CrownsTrainerMenuPage } from '../features/crowns-trainer/CrownsTrainerMenuPage.jsx'
import { CrownsTrainerPage } from '../features/crowns-trainer/CrownsTrainerPage.jsx'
import { CrownsTrainerStatsPage } from '../features/crowns-trainer/CrownsTrainerStatsPage.jsx'
import { MainMenuPage } from '../features/main-menu/MainMenuPage.jsx'
import { TechTreeTrainerMenuPage } from '../features/tech-tree-trainer/TechTreeTrainerMenuPage.jsx'
import { TechTreeTrainerPage } from '../features/tech-tree-trainer/TechTreeTrainerPage.jsx'
import { TechTreeTrainerStatsPage } from '../features/tech-tree-trainer/TechTreeTrainerStatsPage.jsx'
import { TechTreeViewerPage } from '../features/tech-tree-viewer/TechTreeViewerPage.jsx'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainMenuPage />,
  },
  {
    path: '/civilizations',
    element: <CivilizationsPage />,
  },
  {
    path: '/tech-tree/:civilizationId',
    element: <TechTreeViewerPage />,
  },
  {
    path: '/tech-tree-trainer',
    element: <TechTreeTrainerMenuPage />,
  },
  {
    path: '/tech-tree-trainer/play/:difficulty',
    element: <TechTreeTrainerPage />,
  },
  {
    path: '/tech-tree-trainer/stats',
    element: <TechTreeTrainerStatsPage />,
  },
  {
    path: '/crowns-trainer',
    element: <CrownsTrainerMenuPage />,
  },
  {
    path: '/crowns-trainer/play/:difficulty',
    element: <CrownsTrainerPage />,
  },
  {
    path: '/crowns-trainer/stats',
    element: <CrownsTrainerStatsPage />,
  },
  {
    path: '/bonuses-trainer',
    element: <BonusesTrainerMenuPage />,
  },
  {
    path: '/bonuses-trainer/play/:difficulty',
    element: <BonusesTrainerPage />,
  },
  {
    path: '/bonuses-trainer/stats',
    element: <BonusesTrainerStatsPage />,
  },
  {
    path: '/civilization-trainer',
    element: <CivilizationTrainerMenuPage />,
  },
  {
    path: '/civilization-trainer/play/:difficulty',
    element: <CivilizationTrainerPage />,
  },
  {
    path: '/civilization-trainer/stats',
    element: <CivilizationTrainerStatsPage />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
