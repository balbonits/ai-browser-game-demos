import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.{js,ts,jsx,tsx}'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'replay',
          include: ['tests/replay/**/*.test.{js,ts}'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'property',
          include: ['tests/property/**/*.test.{js,ts}'],
          environment: 'node',
          testTimeout: 20_000,
        },
      },
    ],
  },
});
