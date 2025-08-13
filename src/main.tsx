/**
 * Main entry point for the A4S web application
 * Sets up the React application with Material-UI and React Router
 * Renders the application in StrictMode for additional development checks
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MyApp from './MyApp.tsx'
import { StyledEngineProvider } from '@mui/material'
import { BrowserRouter } from 'react-router-dom'
import { ProjectProvider } from './context/ProjectContext.tsx'

// Create and render the root application component
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyledEngineProvider injectFirst>
      <BrowserRouter>
        <ProjectProvider>
          <MyApp />
        </ProjectProvider>
      </BrowserRouter>
    </StyledEngineProvider>

  </StrictMode>,
)
