import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MyApp from './MyApp.tsx'
import { StyledEngineProvider } from '@mui/material'
import { BrowserRouter } from 'react-router-dom'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyledEngineProvider injectFirst>
    <BrowserRouter>

      <MyApp />
    </BrowserRouter>
    </StyledEngineProvider>

  </StrictMode>,
)
