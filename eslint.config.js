// 패키지 경계 (지침서 3장, CLAUDE.md 3장): schema → 아무것도 의존하지 않음, blocks → schema, engine → schema·blocks, apps → 셋 다.
// 패키지 내부 경로(@bse/<pkg>/src/...)가 아니라 공개 API(@bse/<pkg>)만 import 한다.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const internal = {
  group: ['@bse/*/src/*', '@bse/*/src'],
  message: '패키지 내부 경로가 아니라 공개 API(@bse/<pkg>)만 import',
};
const forbid = (files, pkgs) => ({
  files,
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          internal,
          ...pkgs.map((p) => ({
            group: [p, `${p}/*`],
            message: `${files[0]} 는 ${p} 를 의존할 수 없음 (패키지 경계)`,
          })),
        ],
      },
    ],
  },
});

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'landing/**', 'docs/**', '**/json/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.ts', '**/*.tsx'], rules: { '@typescript-eslint/no-explicit-any': 'error' } },
  forbid(['packages/schema/**'], ['@bse/blocks', '@bse/engine', '@bse/web', '@bse/api']),
  forbid(['packages/blocks/**'], ['@bse/engine', '@bse/web', '@bse/api']),
  forbid(['packages/engine/**'], ['@bse/web', '@bse/api']),
  forbid(['apps/**'], []),
);
