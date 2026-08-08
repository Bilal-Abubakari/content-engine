import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'],
          // `pg` is a runtime peer of @prisma/adapter-pg (the actual database
          // driver). It is required at runtime but never imported directly,
          // so the dependency graph can't see the usage.
          ignoredDependencies: ['pg'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    ignores: ['**/out-tsc', 'src/generated/**/*'],
  },
];
