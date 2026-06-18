import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier'; // 追加
import tseslint from 'typescript-eslint';

const eslintConfig = tseslint.config(
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
  ...nextVitals,
  ...nextTs,
  prettierConfig
);

export default eslintConfig;
