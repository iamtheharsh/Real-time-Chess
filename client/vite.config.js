import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // All /api requests from React get forwarded to the Express server
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Socket.IO requests also forwarded to the same server
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,  // Enable WebSocket proxying
        changeOrigin: true,
      },
    },
  },
})

