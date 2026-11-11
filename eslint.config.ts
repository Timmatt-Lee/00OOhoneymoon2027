import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default defineConfig(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'public/sw.js']
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: false }],
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true }
      ]
    }
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: ['variable', 'parameter', 'classProperty', 'typeProperty'],
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['is']
        }
      ]
    }
  },
  {
    files: ['**/*.test.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off'
    }
  },
  eslintConfigPrettier
);
