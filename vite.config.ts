import { defineConfig } from 'vite'
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
export default defineConfig({
  // Development server configuration
  server: {
    host: true,  // Allow external access
    port: 5173,  // Default development port
  },
  
  // Plugins configuration
  plugins: [react()],  // Enable React support
})
