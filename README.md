# BSE : Digital Twin

> Build · Simulate · Evolve — 웹 브라우저에서 설비와 공장을 3D로 만들고, PLC 신호 기준으로 미리 돌려 보고, 그 결과를 설계로 되돌려 발전시키는 스마트팩토리 디지털 트윈.

| 폴더 | 내용 |
|------|------|
| `landing/` | 소개 페이지 (정적 HTML/CSS/JS, 빌드 없음). https://bse-digital-twin.vercel.app — 이 폴더에는 화면을 그리는 파일만 둡니다 |
| `docs/` | 프로젝트 문서 00~13. 최상위 기준은 [docs/11 개발 지침서](docs/11_BSE_DT_DEV_STANDARD.md), 문서 지도는 [docs/00](docs/00_README.md) |
| `packages/schema` | machine.json · factory.json · 블록 정의 · 편집 명령의 단일 출처 (zod → JSON Schema, `json/`) |
| `packages/engine` | 시뮬 엔진 (신호 테이블 · 기구학 · DES · 네비). 브라우저와 서버가 같은 코드 |
| `packages/blocks` | 블록 정의 · 지오메트리 · 치수 표 |
| `apps/`, `services/` | BSE Studio 화면·API·변환·최적화 (지침서 3.2절, 2단계부터) |
| `CLAUDE.md` | 코드 작업 전에 읽는 규칙 (지침서 2·4·5장 요약) |

문서는 한국어, 화면의 제품명·태그라인·버튼은 영어입니다.

```
pnpm install
pnpm test        # 스키마·엔진·블록 단위 테스트
pnpm typecheck   # TypeScript strict
pnpm lint        # ESLint + 패키지 경계
pnpm schema:json # zod → packages/schema/json/*.schema.json
pnpm schema:doc  # 편집 명령 표 → docs/14_EDIT_COMMANDS.md
```
