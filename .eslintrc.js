module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module'
  },
  plugins: ['no-null', 'simple-import-sort'],
  ignorePatterns: ['**/*.js', 'vite.config.ts', 'out/**/*', 'dist/**/*', 'node_modules/**/*'],
  // ONLY rules that Biome doesn't handle
  rules: {
    'simple-import-sort/imports': [
      'error',
      {
        groups: [
          ['^[a-z]'], // External libraries
          ['^\\.\\.', '^\\./'] // Local imports
        ]
      }
    ],
    'simple-import-sort/exports': 'error',
    'no-null/no-null': 'error'
  }
};
