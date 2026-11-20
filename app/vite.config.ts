import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Adresse de base : « / » sur Netlify, « /jeu_island_v0/ » sur GitHub Pages (voir .github/workflows/pages.yml).
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  build: { target: 'es2022' },
});
