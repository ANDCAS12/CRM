// Vitest config: unit tests run in Node (core logic has no DOM dependency).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'], // e2e specs are run by Playwright, not Vitest
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/utils/**', 'src/ai/**', 'src/config/**'], // pure layers must stay well covered
      thresholds: { lines: 85, functions: 85, branches: 75, statements: 85 }, // CI fails below these
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
