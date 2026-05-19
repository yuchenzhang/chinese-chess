import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    test: {
      root: 'src',
      env,
      reporters: [
        'default',
        ['./reporter/htmlReporter.ts', './test-report.html'],
      ],
    },
  }
})
