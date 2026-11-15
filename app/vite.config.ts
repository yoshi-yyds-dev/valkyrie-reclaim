import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './', // GitHub Pages や任意のサブディレクトリ配置でもパスが壊れないように相対パス基準にする
  plugins: [react()],
})
