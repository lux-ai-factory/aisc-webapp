import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite Configuration for A4S webapp
 * Purpose: Configures the development server and build process
 *
 * Configuration includes:
 * - Development server settings (host and port)
 * - React plugin for JSX/TSX processing
 *
 * @see https://vitejs.dev/config/
 */
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // Development server configuration
    server: {
      host: true,  // Allow external access
      port: 5173,  // Default development port
      proxy: {
        // Proxy all other API requests to main backend
        '/api/v1': {
          target: env.VITE_API_URL,
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [react()],
  }
})


