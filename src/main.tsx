import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MyApp from './MyApp.tsx'
import { StyledEngineProvider } from '@mui/material'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyledEngineProvider injectFirst>

      <MyApp />
    </StyledEngineProvider>

  </StrictMode>,
)
