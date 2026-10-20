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
import { BrowserRouter } from 'react-router-dom'
import { ProjectProvider } from './context/ProjectContext.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { PluginInstallProvider } from './pluginCatalogue/PluginInstallContext.tsx'
import {Toaster} from "react-hot-toast";
import { DeploymentGate } from './DeploymentGate.tsx'
import { installProjectHeader } from './api/installProjectHeader'
import { isConfigurator } from './deployment'

const queryClient = new QueryClient()

// Configurator: every engine API call names the open project (X-AISC-Project).
try { if (isConfigurator()) installProjectHeader() } catch { /* a bad mode: DeploymentGate shows it */ }

// Create and render the root application component
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DeploymentGate>
    <StyledEngineProvider injectFirst>
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
    </StyledEngineProvider>
    </DeploymentGate>

  </StrictMode>,
)
