# 14. 편집 명령 목록 (Edit Command API)

| 항목 | 내용 |
|------|------|
| 주 역할 | 빌더의 모든 편집·실행 명령 한 벌 (지침서 원칙 4, 10.2절) |
| 부 역할 | UI 버튼·AI·MCP 가 부르는 공통 입구. OpenAPI·MCP 도구 설명의 원본 |
| 주 담당 / 부 담당 | 스마트제조 수석연구원 / 로보틱스 시뮬레이션 엔지니어, 리드 프로덕트 디자이너 |
| 마지막 수정 | 2026-11-04 |

> **원본은 코드**입니다: `packages/schema/src/commands.ts` (zod). 이 표는 거기서 생성한 것이라 손으로 고치지 않습니다. 명령을 더하거나 바꾸려면 코드 → 이 문서 순서로 갱신합니다 (CLAUDE.md 6장 "명령 추가 순서").

## 1. 규칙
- 모든 편집은 명령 하나로 표현된다. UI 는 명령을 부르기만 하고, 자기 손으로 문서를 고치지 않는다
- 명령은 `{ cmd: '이름', ...인자 }` JSON 한 덩어리. 결과는 `{ ok: true, changed[], created[] }` 또는 `{ ok: false, error }`
- 되돌리기(undo)가 가능해야 한다. 되돌릴 수 없는 명령(저장·내보내기·실행)은 문서를 바꾸지 않는다
- 범위: "설비" = 머신빌더에서, "공장" = 팩토리빌더에서, "설비·공장" = 어디서든
- 인자의 길이는 mm, 각도는 deg (지침서 5장). id 는 UUID v7
- 구현 위치: `packages/engine/src/editor` — `applyCommand(문서, 명령)` 은 새 문서를 돌려주고(순수 함수), `MachineEditor.dispatch(명령)` 이 실행 취소·선택·실행 모드(force_tag)를 맡는다. 설비 범위 명령은 2단계 1차 묶음에서 구현(set_reference·load_glb·load_urdf·import_io 는 에셋 저장소가 생기는 묶음에서)

## 2. 명령 (58개)

### 공통 (편집기 코어) — 17개
| 명령 | 범위 | 인자 |
|------|------|------|
| `select` | 설비·공장 | `ids`: string[] |
| `move` | 설비·공장 | `id`: string<br>`transform`: {…} |
| `snap` | 설비·공장 | `id`: string<br>`socket`: string<br>`targetId`: string<br>`targetSocket`: string |
| `group` | 설비·공장 | `ids`: string[]<br>`name`: string (기본값 있음) |
| `ungroup` | 설비·공장 | `id`: string |
| `duplicate` | 설비·공장 | `ids`: string[]<br>`offset`: [number, number, number] (기본값 있음) |
| `mirror` | 설비·공장 | `ids`: string[]<br>`plane`: xz \| yz |
| `array` | 설비·공장 | `ids`: string[]<br>`count`: integer<br>`step`: [number, number, number] |
| `remove` | 설비·공장 | `ids`: string[] |
| `rename` | 설비·공장 | `id`: string<br>`name`: string |
| `set_reference` | 설비·공장 | `asset`: string<br>`kind`: image \| dxf<br>`plane`: floor \| side (기본값 있음)<br>`scalePoints`: [[number, number], [number, number]]?<br>`scaleDistance`: number? — 두 점 사이 실제 거리 (mm) |
| `measure` | 설비·공장 | `from`: [number, number, number]<br>`to`: [number, number, number] |
| `check_collision` | 설비·공장 | `ids`: string[]? |
| `undo` | 설비·공장 | — |
| `redo` | 설비·공장 | — |
| `save` | 설비·공장 | `message`: string (기본값 있음) |
| `export` | 설비·공장 | `format`: json \| glb \| dxf \| xlsx_io \| pdf \| card |

### 머신빌더 (Build, 지침서 6장) — 20개
| 명령 | 범위 | 인자 |
|------|------|------|
| `set_bbox` | 설비 | `bbox`: [number, number, number] |
| `add_block` | 설비 | `blockType`: string<br>`params`: record (기본값 있음)<br>`transform`: {…} (기본값 있음)<br>`parent`: string \| null (기본값 있음) |
| `set_param` | 설비 | `id`: string<br>`key`: string<br>`value`: number \| boolean \| string<br>_값 검증은 블록 정의의 params 로_ |
| `load_glb` | 설비 | `asset`: string<br>`transform`: {…} (기본값 있음) |
| `load_urdf` | 설비 | `asset`: string |
| `add_joint` | 설비 | `node`: string<br>`type`: rot \| lin \| surface<br>`axis`: [number, number, number]<br>`mode`: onoff \| position \| continuous<br>`min`: number (기본값 있음)<br>`max`: number<br>`vmax`: number<br>`amax`: number |
| `set_joint` | 설비 | `id`: string<br>`patch`: {…} |
| `bind_tag` | 설비 | `tag`: string<br>`kind`: joint \| sensor \| process \| carrier \| trajectory<br>`target`: string |
| `rename_tag` | 설비 | `from`: string<br>`to`: string |
| `import_io` | 설비 | `asset`: string — I/O 리스트 엑셀 |
| `add_work` | 설비 | `kind`: work \| source \| sink \| carrier<br>`transform`: {…} (기본값 있음)<br>`params`: record (기본값 있음) |
| `attach` | 설비 | `tool`: string<br>`work`: string |
| `detach` | 설비 | `tool`: string |
| `set_sequence` | 설비 | `steps`: {…}[] |
| `generate_sequence` | 설비 | —<br>_블록·태그를 보고 간이 동작 순서를 자동으로 만든다 (문서의 sequence 를 덮어씀)_ |
| `auto` | 설비 | `on`: boolean<br>_실행 모드에서 동작 순서(sequence)를 자동으로 돌린다 / 멈춘다_ |
| `reset_works` | 설비 | —<br>_실행 모드에서 시뮬이 만든 워크를 모두 치우고 소스·싱크 카운트를 0 으로_ |
| `force_tag` | 설비·공장 | `tag`: string<br>`value`: boolean \| number<br>_수동 조작 패널_ |
| `set_fidelity` | 설비 | `fidelity`: L1 \| L2 \| L3 |
| `make_card` | 설비 | —<br>_설비 카드(L1) 생성 → 팩토리 라이브러리 등록_ |

### 팩토리빌더 (Build, 지침서 7장) — 14개
| 명령 | 범위 | 인자 |
|------|------|------|
| `add_level` | 공장 | `name`: string<br>`elevation`: number (기본값 있음) |
| `draw_slab` | 공장 | `level`: string<br>`polygon`: [number, number][] |
| `draw_wall` | 공장 | `level`: string<br>`polyline`: [number, number][]<br>`height`: number<br>`thickness`: number (기본값 있음) |
| `place_columns` | 공장 | `level`: string<br>`origin`: [number, number]<br>`pitch`: [number, number]<br>`count`: [integer, integer]<br>`height`: number |
| `draw_roof` | 공장 | `polygon`: [number, number][]<br>`height`: number — 지붕 밑면 높이 (mm) |
| `add_opening` | 공장 | `wall`: string<br>`kind`: door \| shutter \| dock \| emergency_exit \| window<br>`offset`: number<br>`width`: number<br>`height`: number |
| `draw_marking` | 공장 | `kind`: aisle \| zone \| safety<br>`points`: [number, number][] |
| `place_machine` | 공장 | `ref`: string<br>`transform`: {…} (기본값 있음)<br>`tagPrefix`: string? |
| `set_card_override` | 공장 | `id`: string<br>`patch`: {…} |
| `connect_flow` | 공장 | `from`: string<br>`to`: string<br>`ratio`: number (기본값 있음) |
| `add_storage` | 공장 | `kind`: rack \| floor \| buffer<br>`transform`: {…} (기본값 있음)<br>`capacity`: integer |
| `add_mover` | 공장 | `kind`: worker \| amr \| forklift<br>`home`: [number, number, number]<br>`params`: record (기본값 있음) |
| `build_nav` | 공장 | —<br>_바닥 마킹 → 네비 그래프 자동 생성_ |
| `add_drop` | 공장 | `kind`: power \| air<br>`position`: [number, number, number] |

### 시뮬레이션 (Simulate, 지침서 8장) — 7개
| 명령 | 범위 | 인자 |
|------|------|------|
| `run_demo` | 설비·공장 | `speed`: number (기본값 있음)<br>`seed`: integer (기본값 있음) |
| `stop` | 설비·공장 | — |
| `create_scenario` | 공장 | `name`: string<br>`overrides`: record (기본값 있음)<br>`duration_s`: number<br>`runs`: integer (기본값 있음)<br>`seed`: integer (기본값 있음) |
| `run_scenario` | 공장 | `scenario`: string<br>_서버 헤드리스 정식 실행_ |
| `compare` | 공장 | `scenarios`: string[] |
| `replay` | 공장 | `scenario`: string<br>`run`: integer (기본값 있음) |
| `optimize` | 공장 | `kind`: layout \| buffer \| balancing<br>`scenario`: string<br>`generations`: integer (기본값 있음) |

## 3. 아직 없는 것 (V2 이후, 지침서 9.3절)
실PLC 태그 녹화(`record_tags`), 로봇 IK 궤적 편집, STEP 로드, AAS/USD 내보내기, 공유 링크. 필요해지면 코드에 먼저 추가하고 이 표를 다시 생성한다.
