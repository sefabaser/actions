module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/electron',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module'
  },
  root: true,
  env: {
    node: true,
    jest: true
  },
  plugins: ['@typescript-eslint', '@typescript-eslint/eslint-plugin', 'no-null', 'sort-class-members'],
  ignorePatterns: ['**/*.js', 'vite.config.ts', 'out/**/*', 'dist/**/*', 'node_modules/**/*'],
  rules: {
    'no-null/no-null': 2,
    'sort-class-members/sort-class-members': [
      2,
      {
        order: [
          '[static-properties]',
          '[static-private-properties]',
          '[static-methods]',
          '[getters]',
          '[setters]',
          '[properties]',
          '[conventional-private-properties]',
          'constructor',
          '[methods]',
          '[conventional-private-methods]'
        ],
        accessorPairPositioning: 'getThenSet'
      }
    ],
    '@typescript-eslint/adjacent-overload-signatures': 'error',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/ban-types': 'error',
    '@typescript-eslint/consistent-type-definitions': 'error',
    '@typescript-eslint/dot-notation': 'off',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/explicit-member-accessibility': [
      'off',
      {
        accessibility: 'explicit'
      }
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    '@typescript-eslint/indent': ['off', 2],
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/member-delimiter-style': [
      'error',
      {
        multiline: {
          delimiter: 'semi',
          requireLast: true
        },
        singleline: {
          delimiter: 'semi',
          requireLast: false
        }
      }
    ],
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'variable',
        modifiers: ['const'],
        format: ['PascalCase', 'UPPER_CASE']
      }
    ],
    '@typescript-eslint/no-array-constructor': 'error',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-empty-interface': 'error',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-extra-non-null-assertion': 'error',
    '@typescript-eslint/no-inferrable-types': [
      'error',
      {
        ignoreParameters: true,
        ignoreProperties: true
      }
    ],
    '@typescript-eslint/no-misused-new': 'error',
    '@typescript-eslint/no-namespace': 'error',
    '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-this-alias': 'error',
    '@typescript-eslint/no-unused-expressions': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-var-requires': 'error',
    '@typescript-eslint/prefer-as-const': 'error',
    '@typescript-eslint/prefer-function-type': 'error',
    '@typescript-eslint/prefer-namespace-keyword': 'error',
    '@typescript-eslint/quotes': ['error', 'single', { allowTemplateLiterals: true }],
    '@typescript-eslint/semi': ['error', 'always'],
    '@typescript-eslint/triple-slash-reference': 'error',
    '@typescript-eslint/type-annotation-spacing': 'error',
    '@typescript-eslint/unified-signatures': 'error',
    '@typescript-eslint/no-shadow': 'warn',
    'arrow-body-style': 'error',
    'arrow-parens': [2, 'as-needed'],
    'brace-style': ['error', '1tbs'],
    'constructor-super': 'error',
    curly: 'error',
    'eol-last': 'error',
    eqeqeq: ['error', 'smart'],
    'guard-for-in': 'off',
    'id-blacklist': 'off',
    'id-match': 'off',
    'max-len': [
      'error',
      {
        code: 170
      }
    ],
    'no-array-constructor': 'off',
    'no-bitwise': 'error',
    'no-caller': 'error',
    'no-console': [
      'error',
      {
        allow: [
          'log',
          'warn',
          'dir',
          'timeLog',
          'assert',
          'clear',
          'count',
          'countReset',
          'group',
          'groupEnd',
          'table',
          'info',
          'dirxml',
          'error',
          'groupCollapsed',
          'Console',
          'profile',
          'profileEnd',
          'timeStamp',
          'context'
        ]
      }
    ],
    'no-debugger': 'error',
    'no-empty': 'off',
    'no-empty-function': 'off',
    'no-eval': 'error',
    'no-fallthrough': 'error',
    'no-new-wrappers': 'error',
    'no-restricted-imports': 'error',
    'no-shadow': 'off',
    'no-throw-literal': 'error',
    'no-trailing-spaces': 'error',
    'no-undef-init': 'error',
    'no-underscore-dangle': 'off',
    'no-unused-labels': 'error',
    'no-unused-vars': 'off',
    'no-var': 'error',
    'prefer-const': 'off',
    radix: 'off',
    semi: [
      'error',
      'always',
      {
        omitLastInOneLineBlock: true
      }
    ],
    'spaced-comment': [
      'error',
      'always',
      {
        markers: ['/']
      }
    ]
  }
};