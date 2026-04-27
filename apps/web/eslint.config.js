// @ts-check
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import reactPlugin from 'eslint-plugin-react';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'src/routeTree.gen.ts'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'react': reactPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // U8: block inline style={{}} on host JSX elements as a CI-blocking error.
      // This prevents regression of the U7 CSS-Modules migration that eliminated
      // all literal style props from apps/web/src/**. The rule catches literal-form
      // style={{...}} on host elements; variable-form (style={cssVars}) and spread
      // cases were also migrated in U7 and are covered by code review convention.
      'react/forbid-dom-props': ['error', { forbid: ['style'] }],
    },
  },
);
