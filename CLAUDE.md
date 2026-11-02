# CLAUDE.md — BSE : Digital Twin (저장소 공통 규칙)

이 저장소는 **BSE : Digital Twin 개발 지침서 R1**(프로젝트 문서 `docs/11_BSE_DT_DEV_STANDARD.md`)을 따른다.
코드를 쓰거나 고치기 전에 이 파일을 읽고, 아래 규칙과 다르면 멈추고 오너에게 묻는다.
기준서 2·4·5장(원칙·데이터·규약)은 리비전을 올려서만 바뀐다. 이 파일에서 임의로 바꾸지 않는다.

## 1. 제품
- 제품명 **BSE : Digital Twin**, 앱 이름 **BSE Studio**. 작업 공간: Build(머신빌더 + 팩토리빌더) · Simulate · Evolve(디지털 섀도 + 최적화 피드백, V2)
- UI 언어 한국어 기본 (영어는 V2). 랜딩 페이지는 별도 저장소이며 이 규칙의 대상이 아님

## 2. 설계 원칙 (어기지 말 것)
1. 단일 데이터 모델: 모든 것은 노드 트리 JSON. 편집기 코어 1 + 범위 2(machine·factory) + 모드 3(edit·run·compare)
2. 신호 테이블 단일 통신: 시뮬 레이어(신호·기구학·DES·네비)는 신호 테이블로만 대화. 실PLC 태그와 1:1 치환 가능
3. fidelity 등급 L1 | L2 | L3가 한 공장에 섞여 있는 것이 정상
4. 모든 편집은 명령 단위 API(`add_block`, `set_param`, `snap`, `add_joint`, `bind_tag`, `draw_wall`, `place_machine`, `connect_flow`, `run_scenario`, `export` …). UI는 호출자일 뿐. AI·MCP 노출은 래핑 한 겹
5. 블록은 형식 + 파라미터 + 치수 테이블. 메이커 제품이 블록이 아님. 메이커 CAD를 저장소에 넣지 않음
6. spec 섹션은 처음부터 스키마에 있고 null 허용, 1차엔 숨김. 저장·export는 항상 포함
7. 서버 분리: 정식 DES·최적화·AI·물리는 서버. 브라우저는 뷰·편집·데모 시뮬
8. 외부 플랫폼은 변환으로만: 저장 형식은 machine.json / factory.json 뿐. AAS/AASX, USD, URDF/MJCF, STEP, DXF는 `services/convert`의 import/export

자체 개발 금지: 물리 엔진, PLC 프로토콜 변환, ROS2 브리지, STEP 변환, 영상 녹화. **realvirtual(AGPL) 코드 복사 금지.**

## 3. 저장소 구조 (pnpm + Turborepo)
```
apps/web            BSE Studio (React 18, Vite 5, r3f, zustand, Tailwind, Radix)
apps/api            Fastify 4, Drizzle, PostgreSQL 16, Redis/BullMQ, S3
packages/schema     zod 스키마 → JSON Schema. machine.json / factory.json / 블록 정의 / 편집 명령의 단일 출처
packages/engine     시뮬 엔진 (브라우저 Worker와 서버 Worker가 같은 코드)
packages/blocks     블록 정의·지오메트리 함수·치수 테이블
services/convert    Python FastAPI: STEP/glb/DXF/URDF/USD/AAS 변환
services/optimize   Python: pymoo, Optuna
```
- 패키지 경계는 ESLint boundaries 규칙으로 강제. `apps/*`가 `packages/engine` 내부를 직접 import하지 않음
- 저장소 `seb000423/BSE-Digital-Twin` 하나에 `landing/`(정적 랜딩, 화면 파일만, D-05), `docs/`(프로젝트 문서·지침서), `apps/`·`packages/`(빌더)가 있다. 앱 코드는 처음부터 새로 쓴다. 기존 `BSE_STUDIO`(VEXPLOR AAS Studio 파생, Apache 2.0) 파일은 복사하거나 옮겨 오지 않는다 (D-31). AAS는 IDTA 공식 aas-core3.0 라이브러리 + 우리 매핑, 현장 연결은 게이트웨이(Node-RED·rosbridge) 뒤 WebSocket/MQTT만

## 4. 데이터 모델 요점
- 노드 `{id, type, name, transform, parent, children[], components{}}`
- `schema: "bse-twin/machine@1"` / `"bse-twin/factory@1"`. 스키마 변경은 버전 올림 + 마이그레이션
- 설비는 공장에 `ref: machine@version` 참조 인스턴스. `tagPrefix` 자동 (`ST01.M1`)
- 관절은 `vmax`·`amax` 필수, `verified` 플래그. 미확인 값은 `verified=false`
- `ext.aas`, `ext.usd`는 외부 식별자만. 없으면 null
- 태그 이름: 대문자·숫자·밑줄, `{station}.{machine}.{tag}`, 32자 이내. 세트 규칙은 기준서 4.4절

## 5. 좌표·단위
- 저장·UI는 **mm, deg**. Three.js 씬·USD·URDF는 **m, rad**로 변환
- **Z-up**, X 전방(투입→배출), Y 좌측, 오른손 법칙
- glTF 로드 시 X축 -90° 보정, export 시 역보정
- 시뮬 틱 10 ms, 렌더 60 fps 보간
- ID는 UUID v7, 블록 타입 id는 kebab-case

## 6. 코드 규약
- TypeScript strict. `any` 금지. 외부 입력은 zod로 검증
- 상태: 문서 상태는 zustand + immer 불변 스토어 (zundo로 Undo/Redo). 시뮬 런타임 상태는 별도 버퍼(SharedArrayBuffer), 스토어에 넣지 않음
- 시뮬 엔진은 결정적: 같은 시드 → 같은 결과. `Math.random` 금지, seedrandom 사용
- 테스트: 엔진·스키마는 Vitest 단위 테스트 필수. 화면은 Playwright. 게이트는 회귀 테스트 통과가 기준
- 명령 추가 순서: `packages/schema`에 zod 명령 정의 → `packages/engine` 또는 편집기 코어에 구현 → UI 호출. 순서를 건너뛰지 않음
- 커밋 전 lint·format·typecheck 통과 (Husky + lint-staged)
- 새 의존성 추가 시 라이선스 확인 (AGPL 금지). 기준서 11.1절

## 7. 범위 규칙
- 지금은 **V1** (기준서 9.1절). V1에 없는 기능(실PLC 연결, 로봇 IK, STEP 로드, MCP, 영어 UI, AAS 변환, USD export)은 만들지 않음. 다만 5장 규약과 `ext` 필드는 지금 지킴
- 새 기능 제안은 코드에 넣지 말고 `docs/standard/BSE_DT_기능_로드맵.xlsx`에 등급을 달아 백로그로
- 블록은 기준 설비 3종(컨베이어 스테이션 · 픽앤플레이스 셀 · 프레스 스테이션)을 재현하면서 채움. 목록부터 채우지 않음

## 8. 작업 방식
- 큰 변경(스키마, 패키지 경계, 의존성 교체) 전에 오너 확인. 결정은 `docs/06_DECISIONS.md`에 기록
- 오너는 개발자가 아니므로 설명은 쉬운 한국어로, 선택지는 추천과 함께
- 모르는 사양 값은 추정하지 말고 `verified=false`로 두고 묻는다
