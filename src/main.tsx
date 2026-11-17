/**
 * Main entry point for the AISC web application
 * Sets up the React application with Material-UI and React Router
 * Renders the application in StrictMode for additional development checks
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import MyApp from './MyApp.tsx'
import { StyledEngineProvider } from '@mui/material'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { BrowserRouter } from 'react-router-dom'
import { ProjectProvider } from './context/ProjectContext.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { PluginInstallProvider } from './pluginCatalogue/PluginInstallContext.tsx'
import {Toaster} from "react-hot-toast";

const queryClient = new QueryClient()

/** Brand theme: pilot palette, typography and square corners (shared/theme/brand.json). */
const brandTheme = createTheme({
  palette: {
    primary: { main: '#000fdf', dark: '#000079' },
    secondary: { main: '#ff007e', dark: '#cc0066' },
    background: { default: '#f2f3fd', paper: '#ffffff' },
    text: { primary: '#0b0b2e', secondary: '#4a4f6a' },
  },
  shape: { borderRadius: 0 },
  typography: {
    fontFamily: '"Raleway", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
})

// Create and render the root application component
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={brandTheme}>
      <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ProjectProvider>
                <PluginInstallProvider>
                  <MyApp />
                  <Toaster />
                </PluginInstallProvider>
              </ProjectProvider>
            </AuthProvider>
          </QueryClientProvider>
      </BrowserRouter>
      </ThemeProvider>
    </StyledEngineProvider>

  </StrictMode>,
)
