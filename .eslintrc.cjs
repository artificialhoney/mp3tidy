// .eslintrc.cjs

module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  overrides: [
    {
      files: ['*.ts', '*.js'],
      rules: {
        'perfectionist/sort-objects': [
          'error',
          {
            order: 'asc',
            type: 'natural',
          },
        ],
      },
    },
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'perfectionist'],
  root: true,
}
