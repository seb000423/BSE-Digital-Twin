# BSE : Digital Twin 개발 지침서 R1

| 항목 | 내용 |
|------|------|
| 주 역할 | BSE : Digital Twin(빌더 앱 BSE Studio)을 **어떻게 만들지** 정하는 유일한 개발 지침. 프로젝트 기간 내내 적용 |
| 부 역할 | AI(Claude)와 사람이 코딩·설계할 때 지키는 가드레일의 원본 |
| 주 담당 / 부 담당 | 프로젝트 오너 / 스마트제조 수석연구원 (RS·OT·PD·TA 검토) |
| 리비전 | R1 — 2026-11-02 |
| 부속 문서 | 블록·장비·기능 목록 엑셀 4개와 CLAUDE.md ([standard/](standard/)) |

> **이 문서가 우선합니다.** 다른 문서(01~09)와 다르면 이 문서를 따릅니다. 랜딩 페이지(D-05, 정적 사이트)만 3.2절 기술 스택의 예외입니다.
> 2장(원칙)·4장(데이터)·5장(규약)은 리비전 번호를 올려서만 바꿉니다. 9장(범위)은 단계가 끝날 때마다 갱신합니다. 일정은 이 문서에 두지 않고 [05 로드맵](05_ROADMAP.md)에서 관리합니다.

---

## 1. 개요

BSE : Digital Twin은 웹 브라우저에서 제조 설비와 공장을 3D로 구축하고(**Build**), PLC 신호 기반으로 동작과 물류를 시뮬레이션하며(**Simulate**), 그 결과를 현장 데이터와 최적화로 되돌려 계속 발전시키는(**Evolve**) 디지털 트윈 플랫폼이다. 설치 없이 브라우저에서 동작한다. 빌더 앱의 이름은 **BSE Studio**다.

| 항목 | 내용 |
|------|------|
| 제품명 | BSE : Digital Twin (D-01, D-20). 랜딩 https://bse-digital-twin.vercel.app |
| 대상 고객 | 제조 중소·중견기업(생산기술·생산관리·경영), 설비 제작사·시스템 통합사 |
| 핵심 용도 | 라인 레이아웃·사이클·물류 검증, 설비·로봇·AMR 도입 효과의 수치 비교, 현장 가동 현황 가시화 |
| 작업 공간 (대외 명칭) | **Build** = 머신빌더 + 팩토리빌더 · **Simulate** = 시뮬레이션 · **Evolve** = 디지털 섀도 + 최적화 피드백(V2) |
| 산출물 | machine.json / factory.json, 시나리오 비교 결과, 2D 레이아웃(DXF·PDF), I/O 리스트(엑셀), 3D 공유 뷰, (V2) AAS/AASX, USD/URDF |
| 차별점 | 설비 제작 도메인 기반 블록 체계 · 신호 테이블 단일 통신 구조(시뮬과 현장 연결이 동일 구조) · 최적화 과정이 보이는 시뮬레이션 · 웹 기반 저비용 · 같은 데이터로 Omniverse/Isaac까지 확장 |
| 경쟁하지 않는 영역 | 대규모 에셋 카탈로그, 다중 산업 프로토콜 게이트웨이, 정밀 물리 시뮬레이션 자체 개발, 범용 로봇 오프라인 프로그래밍 |

## 2. 설계 원칙

아래 8개는 첫 주에 고정하고 이후 바꾸지 않는다. 바꾸면 전부 재작업이 된다.

1. **단일 데이터 모델.** 머신빌더·팩토리빌더·시뮬레이션은 하나의 노드 트리(ECS 방식 JSON) 위에서 동작한다. 구조는 편집기 코어 1개 + 범위 2개(machine·factory) + 모드 3개(edit·run·compare) + 라이브러리 관리 1개. Build/Simulate/Evolve는 사용자 관점의 작업 공간 이름이다. 설비는 팩토리에 참조 인스턴스로 배치되어 원본 수정이 전체에 반영된다.
2. **신호 테이블 단일 통신.** 시뮬레이션 레이어(신호·기구학·DES·네비)는 신호 테이블로만 통신한다. 실PLC 태그와 1:1 치환이 가능해야 하며, 그래서 시뮬과 디지털 섀도가 같은 구조다.
3. **fidelity 등급.** 설비 노드는 L1(카드) | L2(기구·신호) | L3(물리) 등급을 가지며 한 공장 안에 섞여 있는 것이 정상이다.
4. **편집 API 레이어.** 모든 편집은 명령 단위 API(add_block, set_param, snap, add_joint, bind_tag, draw_wall …)로 구현하고 UI는 그 호출자다. AI·MCP 노출은 래핑 한 겹이어야 한다.
5. **블록은 형식, 제품이 아니다.** 메이커 모델 하나하나가 아니라 형식 + 파라미터 + 치수 테이블. 정확한 외형이 필요할 때만 glb/STEP 로드.
6. **spec 섹션 null 허용.** 전기·공압·가스·통신·I/O 등 사양 섹션은 처음부터 스키마에 있고 1차에는 숨긴다. 저장·export는 항상 포함한다.
7. **서버 분리.** DES 정식 실행·최적화·AI·물리는 서버, 브라우저는 뷰·편집·데모 시뮬. 블록 라이브러리는 인증 후 필요분만 전달.
8. **외부 플랫폼은 변환으로 연결한다 (D-21, D-22).** 저장 형식은 오직 machine.json / factory.json이다. AAS/AASX, USD(Omniverse/Isaac), URDF/MJCF, STEP, DXF는 모두 **변환 서비스의 import/export**이며, 저장 형식이 둘이 되는 일은 없다. 좌표·단위·ID 규약(5장)은 이 변환이 손실 없이 되도록 정한다.

자체 개발 금지 항목: 물리 엔진, PLC 프로토콜 변환, ROS2 브리지, STEP 변환, 영상 녹화. 전부 외부 솔루션(MuJoCo/Isaac, Node-RED, rosbridge, pythonocc, NVR)을 쓴다.

## 3. 시스템 구성

브라우저 / 서버 / 현장 3층 + 외부 시뮬 환경 1개.

```
[브라우저]  랜딩 → BSE Studio (편집기 코어 · 데모 시뮬 Worker)
                │ machine.json / factory.json
[서버]      API (저장·계정·라이브러리) · 시뮬 엔진(헤드리스) · 최적화·AI · 변환 서비스
                │                                              └─ USD/URDF/AAS/STEP/DXF export
[외부 시뮬]  Omniverse / Isaac Sim · Isaac Lab (GPU 환경, USD 입력)                     V2 export → V3 물리
[현장]       게이트웨이 (Node-RED · rosbridge, 아웃바운드 전용) ← PLC · 로봇 · AMR        V2
```

### 3.1 논리 구조
| 구성 요소 | 역할 | 비고 |
|-----------|------|------|
| 편집기 코어 | 뷰포트, 노드 트리, 기즈모·스냅, Undo/Redo, 저장, 편집 API | 머신빌더·팩토리빌더가 공유. 코드 1벌 |
| 범위 machine | 루트 = 설비, 팔레트 = 블록 라이브러리 | 머신빌더 (Build) |
| 범위 factory | 루트 = 공장, 팔레트 = 설비 카드·공장 블록 | 팩토리빌더 (Build) |
| 모드 edit / run / compare | 편집 · 실행(데모·정식) · 시나리오 비교 | 어느 범위에서든 전환 (Simulate) |
| 라이브러리 관리 | 블록·설비·템플릿·치수 테이블의 버전·공개 범위 | 공급자용 화면 |
| 시뮬 엔진 | 신호·기구학·DES·네비 레이어, 헤드리스 실행 | 브라우저(데모)·서버(정식) 동일 코드 |
| 최적화·AI 서비스 | GA/베이지안 루프, LLM 생성, MCP 서버 | 서버 |
| 변환 서비스 | STEP→glb, DXF 입출력, URDF 변환, 썸네일, **AAS/AASX ↔ JSON**, **USD export** | 서버 (Python) |
| 게이트웨이 (V2) | PLC·ROS2 → WebSocket/MQTT | 엣지 PC, 별도 배포 |
| 외부 시뮬 환경 | Omniverse / Isaac Sim·Lab | USD로 받음. V2 export, V3 물리·학습 |

### 3.2 기술 스택
| 계층 | 선정 | 역할·근거 |
|------|------|-----------|
| 언어 | TypeScript 5 (strict), Python 3.12 | 프론트·백엔드 TS 단일, 변환·최적화는 Python |
| 저장소 구조 | GitHub `seb000423/BSE-Digital-Twin` 하나 (D-32): `landing/`(랜딩, 정적), `docs/`(이 문서들), 그리고 pnpm 모노레포 + Turborepo: `apps/web`(BSE Studio), `apps/api`, `services/convert`, `services/optimize`, `packages/schema`, `packages/engine`, `packages/blocks` | 처음부터 작성 (D-31, D-23 대체). 기존 `BSE_STUDIO`(VEXPLOR 파생, Apache 2.0) 코드는 복사하지 않음. 스키마·엔진·블록을 패키지로 분리해 브라우저·서버가 같은 코드를 실행 |
| 프론트 | React 18, Vite 5, React Router | |
| 3D 렌더 | Three.js r16x, @react-three/fiber 8, @react-three/drei | WebGL2 기본, WebGPU 비활성 |
| 3D 보조 | three-mesh-bvh, DRACOLoader, KTX2Loader, urdf-loader, three-stdlib | 100개 이상 블록에서 피킹·간섭 성능 |
| 상태 관리 | zustand + immer, zundo (Undo/Redo), TanStack Query | 노드 트리는 불변 스토어, 시뮬 런타임 상태는 별도 버퍼 |
| 스키마·검증 | zod → JSON Schema 2020-12 | machine.json·factory.json·블록 정의의 단일 출처는 `packages/schema` |
| UI | Tailwind CSS, Radix UI, lucide-react, react-i18next | 한국어 기본, 영어는 V2. 색·톤은 [04 디자인 가이드](04_DESIGN_GUIDE.md) |
| 시뮬 엔진 (브라우저) | Web Worker + Comlink, 고정 타임스텝, SharedArrayBuffer | 렌더 스레드와 분리 |
| 시뮬 엔진 (서버) | 동일 `packages/engine`을 Node Worker Threads로, BullMQ 큐 | 헤드리스 N회·시나리오 병렬 |
| DES | 자체 이벤트 스케줄러(이진 힙), seedrandom, 분포 함수 자체 구현 | 외부 DES 라이브러리 미사용 |
| 네비 | 격자·그래프 A* 자체 구현 | navmesh는 V2 검토 |
| 로봇 IK (V2) | closed-chain-ik 또는 자체 CCD/Jacobian | URDF 관절 트리 기준 |
| 물리 (V3) | MuJoCo WASM (셀 단위), Isaac Sim 백엔드 스트리밍 | 자체 물리 미구현 |
| 외부 시뮬 연동 (V2~) | USD export (`services/convert`), Omniverse Z-up 설정, Isaac Sim은 USD + URDF 입력 | 같은 JSON에서 생성. 왕복 편집은 범위 밖 (export 전용) |
| 최적화 | Python: pymoo, Optuna, numpy | 엔진 호출은 HTTP/큐 |
| AI | Claude API (구조화 출력), MCP TypeScript SDK | V2 |
| 백엔드 | Node.js 22 LTS, Fastify 4 | REST + WebSocket |
| DB | PostgreSQL 16 (JSONB), Drizzle ORM | 문서는 JSONB 1행 + 메타, 버전은 별도 테이블 |
| 캐시·큐 | Redis 7, BullMQ | |
| 오브젝트 스토리지 | S3 호환 (운영: 클라우드, 개발: MinIO), 서명 URL | glb·썸네일·DXF·USD·결과 파일 |
| 실시간 | WebSocket 자체 프로토콜(JSON, 태그 배치), MQTT는 V2 게이트웨이용 | |
| 변환 서비스 | Python FastAPI, pythonocc-core, trimesh·pygltflib, ezdxf, Pillow, **usd-core(pxr)**, **basyx-python-sdk(AAS)** | 컨테이너 분리, 큐 소비자 |
| 인증·권한 | JWT, 이메일+비밀번호 → OIDC V2, RBAC(owner·editor·viewer), 테넌트 = 회사 | |
| API 문서 | OpenAPI 3.1 자동 생성 | 편집 API 명령은 zod에서 생성 |
| 테스트 | Vitest, Playwright, 엔진 회귀는 결정적 시드 | |
| 품질 | ESLint(boundaries), Prettier, Husky + lint-staged, Changesets | |
| 빌드·배포 | Docker 멀티스테이지, Docker Compose, GitHub Actions, Nginx + TLS | k8s는 다중 테넌트 이후 |
| 관측 | Sentry, Pino, Prometheus + Grafana | |
| 파일 포맷 | glTF 2.0(.glb), URDF, MJCF, DXF(AC1027), STEP AP214, XLSX, **USD(.usd/.usdc)**, **AASX** | |
| 브라우저 | Chrome·Edge 최신 2버전, WebGL2 필수, 1920×1080 기준 | Safari는 뷰어만 |
| 예외 | **랜딩 페이지**: 빌드 도구 없는 정적 HTML/CSS/JS (D-05) | 이 표를 적용하지 않음 |

### 3.3 외부 솔루션 (직접 개발하지 않음)
| 영역 | 솔루션 | 시기 |
|------|--------|------|
| PLC 프로토콜 변환 | Node-RED (OPC UA·Modbus·S7·LS XGT) → MQTT/WebSocket | V2 |
| ROS2 연결 | rosbridge_suite | V2 |
| AMR 플릿 표준 | VDA5050 | V3 |
| 물리·로봇 학습 | MuJoCo WASM, NVIDIA Isaac Sim / Isaac Lab | V3 |
| 영상 | NVR/VMS (트윈은 저장하지 않음) | 이관 |

## 4. 데이터 모델

모든 것은 노드 트리다. 노드는 `{id, type, name, transform, parent, children[], components{}}`이고, 기능은 컴포넌트로 붙인다. 설비(machine)와 공장(factory)은 같은 노드 구조의 루트가 다른 것이다. 스키마 식별자는 `bse-twin/machine@1`, `bse-twin/factory@1`.

### 4.1 machine.json
```
{
  "schema": "bse-twin/machine@1",
  "meta": {"id", "name", "bbox": [W, D, H], "fidelity": "L1|L2|L3", "thumbnail", "version"},
  "card": {"cycle_time", "ok_rate", "footprint", "operators", "inlet", "outlet"},
  "nodes": [{"id", "type": "block|glb|group", "blockType", "params": {}, "transform", "parent", "sockets": []}],
  "joints": [{"id", "node", "type": "rot|lin|surface", "axis", "mode": "onoff|position|continuous",
              "min", "max", "home", "vmax", "amax", "jmax?", "effort?", "verified": {"vmax": bool, "amax": bool}}],
  "robot": {"urdf", "tcp", "tcp_vmax", "tcp_amax", "payload", "derating": [{"payload", "factor"}], "override": 100},
  "trajectories": [{"id", "segments": [{"type": "PTP|LIN|CIRC|PATH", "points": [], "speed", "blend", "tool"}],
                    "process": [{"segment", "tag", "params"}]}],
  "io": [{"tag", "dir": "in|out", "type": "bool|int|real", "binding": {"kind": "joint|sensor|process|carrier|trajectory", "target"}}],
  "sequence": {"steps": []},
  "process": {"cycle_time", "ok_rate", "batch_size", "state_in", "state_out"},
  "spec": {"electrical": null, "io": null, "comm": null, "pneumatic": null, "hydraulic": null, "gas": null,
           "water": null, "exhaust": null, "safety": null, "physical": null, "product": null, "maintenance": null},
  "ext": {"aas": {"assetId?", "submodelIds?"}, "usd": {"primPath?"}}
}
```
`ext`는 외부 플랫폼 변환용 식별자만 담는다 (원칙 8). 없으면 null.

### 4.2 factory.json
```
{
  "schema": "bse-twin/factory@1",
  "meta": {"id", "name", "site", "levels": []},
  "reference": {"dxf|image", "scale", "origin"},
  "building": {"slabs": [], "walls": [], "columns": [], "roofs": [], "openings": []},
  "markings": [{"kind": "aisle|zone|safety", "polyline|polygon"}],
  "machines": [{"id", "ref": "machine@version", "transform", "tagPrefix": "ST01.M1", "cardOverride": {}}],
  "flows": [{"from": "machine.outlet", "to": "machine.inlet", "ratio"}],
  "storage": [{"kind": "rack|floor|buffer", "capacity"}],
  "movers": [{"kind": "worker|amr|forklift", "params", "home"}],
  "nav": {"nodes": [], "edges": [], "docks": []},
  "utilities": {"drops": [], "panels": [], "supply": []},
  "spec": {"electrical": null, "pneumatic": null, "gas": null, "water": null},
  "ext": {"aas": {}, "usd": {}}
}
```

### 4.3 블록 정의 (라이브러리)
| 필드 | 내용 |
|------|------|
| meta | id, type, name, category, fidelity, thumbnail, maker_note |
| geometry | params{} → 메쉬 생성 함수, dimTable 참조, glbRef(커스텀) |
| sockets[] | id, position, normal, kind(mount·inlet·outlet·surface·tool), compatible[] |
| joints[] | 기본 관절 템플릿 |
| ioTemplate[] | 태그명 규칙·방향·타입·바인딩 |
| process? | 공정 공통 모델 파라미터 |
| carrier? | capacity, layout(rows×cols×layers), pitch |
| detect? | ray·segment·area·volume, range, target |

블록 110종의 상세는 [standard/BSE_DT_머신빌더_블록_목록.xlsx](standard/), 공장 블록 81종은 [standard/BSE_DT_팩토리빌더_블록_목록.xlsx](standard/).

### 4.4 태그 규칙
| 동작 | 태그 세트 |
|------|-----------|
| ON/OFF 축(공압) | `{n}_FWD, {n}_BWD, {n}_FWD_LS, {n}_BWD_LS` (회전 CW/CCW, 클램프 CLAMP/UNCLAMP, 리프터 UP/DOWN) |
| 위치형 축 | `{n}_POS_CMD, {n}_POS_FB, {n}_INPOS, {n}_HOME, {n}_SVON, {n}_ALARM` |
| 속도형 | `{n}_RUN, {n}_DIR, {n}_SPEED` |
| 그리퍼·흡착 | `{n}_OPEN, {n}_CLOSE, {n}_OPEN_LS, {n}_CLOSE_LS` / `{n}_VAC_ON, {n}_VAC_OK` |
| 센서 | `{n}_ON / {n}_DIST / {n}_VALUE / {n}_SAFE` |
| 공정 블록 | `{n}_START, {n}_BUSY, {n}_DONE, {n}_OK, {n}_NG, {n}_ALARM, {n}_READY` + `{n}_{VALUE}_FB` |
| 로봇 | `{n}_PGM_NO, {n}_START, {n}_INPOS, {n}_RUNNING, {n}_ALARM, {n}_TOOL_{k}` |
| 용기·버퍼 | `{n}_FULL, {n}_EMPTY, {n}_COUNT, {n}_ID` |
| 설비 공통 | `START, STOP, RESET, EMO, AUTO_MAN, DOOR_CLOSED, SAFE, RUN, ALARM` (OP·안전 블록 자동) |
| 인스턴스 접두어 | `{station}.{machine}.{tag}` — 팩토리 배치 시 자동 |

### 4.5 spec 스키마
13개 섹션 49필드. 1차 노출은 `io.io_list`(tag·dir·type)와 `product.maker/model`뿐이며 나머지는 null + 숨김. 집계 방향은 블록 → 설비 → 스테이션 → 공장. 필드 전체는 부속 엑셀 "스펙 스키마" 시트.

### 4.6 외부 형식 대응 (원칙 8)
| 외부 형식 | 방향 | 대응 규칙 | 시기 |
|-----------|------|-----------|------|
| AAS/AASX | import·export | machine → AAS Asset + Submodel(Nameplate=product/spec, TechnicalData=spec, OperationalData=io). factory → AAS 환경(설비 참조). 식별자는 `ext.aas` | V2 (X-01) |
| USD (Omniverse/Isaac) | export | 노드 트리 → USD prim 계층, transform은 m·Z-up, joints → UsdPhysics joint, 로봇은 URDF 참조. `ext.usd.primPath` | V2 export, V3 물리 (X-02) |
| URDF / MJCF | import·export | 기준서 5장 규칙 | V2 |
| STEP / DXF | import·export | 변환 서비스 | DXF V1, STEP V2 |

> AAS 변환 구현 규칙 (D-31): AAS 자료 구조·직렬화는 IDTA 공식 `aas-core3.0-typescript`(MIT) 등 공개 라이브러리를 쓰고, 우리가 쓰는 코드는 machine.json ↔ 서브모델 **매핑 규칙**과 AASX 묶음·변환 화면뿐이다. 기존 `BSE_STUDIO`(VEXPLOR 파생)의 AAS·Edge 코드는 가져오지 않는다. 현장 연결은 게이트웨이(Node-RED·rosbridge) 뒤에서 WebSocket/MQTT로만 받는다 (3.3절).

## 5. 좌표계·단위 규약
| 항목 | 규약 |
|------|------|
| 길이 | mm (저장·UI). Three.js 씬·USD·URDF는 m로 변환 |
| 각도 | deg (저장·UI), 내부 계산·USD·URDF는 rad |
| 좌표계 | 오른손, **Z-up**, X 전방(설비 투입→배출), Y 좌측. Omniverse 스테이지도 `upAxis = Z`, `metersPerUnit = 1`로 export |
| 회전 양의 방향 | 축을 바라보고 반시계 (오른손 법칙) |
| 원점 | 설비: 바닥면 중심 · 공장: 평면도 원점(사용자 지정) |
| 직동 관절 | axis 단위벡터 + min/max(mm), 0 = 후퇴 위치 |
| 회전 관절 | axis 단위벡터 + min/max(deg), 0 = 홈 |
| 이송면 | 방향 벡터 + 속도(mm/s), 워크는 면 위 로컬 좌표 |
| glTF | Y-up이므로 로드 시 X축 -90° 보정, export 시 역보정 |
| URDF / MJCF / USD | m·rad·Z-up. mm→m, deg→rad 변환, joint axis 그대로, 부모-자식 트리 그대로 |
| DXF | mm, 2D XY = 공장 XY |
| 시간 | 시뮬 틱 10 ms(신호), 렌더 60 fps 보간, DES 이벤트 기반 |
| 태그명 | 대문자·숫자·밑줄, 접두어 `.` 구분, 32자 이내 |
| ID | UUID v7. 블록 타입 id는 kebab-case. USD prim 이름은 id에서 `-`를 `_`로 |

## 6. 머신빌더 사양 (Build)

목표: 설비를 아는 사람이 3D 도면 없는 현장 설비를 단시간 안에 L2(기구·신호)로 재현한다. 외형 정확도 ±수 cm, 동작은 축 수·스트로크·속도 일치. 체결·배선·커버 디테일은 다루지 않는다.

### 6.1 작업 흐름
1. 설비 외곽 치수(W×D×H) 입력 → 투명 가이드 박스
2. 레퍼런스 사진·도면을 바닥/측면에 깔고 2점 스케일 (선택)
3. 구조 블록 배치, 소켓 스냅
4. 기능 블록(반송·액추에이터·센서·공정) 배치 — 놓는 순간 관절·태그 기본값 생성
5. 관절 수정: 축 화살표 드래그, 숫자(스트로크·속도)
6. 태그 수정: 표에서 이름만, 또는 I/O 리스트 엑셀 붙여넣기
7. 워크·소스·싱크·용기 배치, 그리퍼 attach 확인
8. 수동 조작 패널로 태그 ON/OFF → 동작 확인 (여기까지 L2)
9. 시퀀스: 간이 스텝 에디터 또는 실PLC 태그 녹화 (V2)
10. 저장 → 설비 카드(L1) 자동 생성 → 팩토리 라이브러리 등록

### 6.2 블록 분류 (10) — 1차 실제 구현 단위 약 30개
구조 12 · 반송 13 · 액추에이터 공압 12 · 액추에이터 전동 8 · 로봇 8 · 센서 10 · 워크·용기 9 · 피더 6 · 공정 공통 모델 25 · 이동체 7(팩토리빌더). 실린더 5형식·센서 3형식은 지오메트리 함수만 다르고 관절·I/O·치수 테이블 구조는 하나다.

### 6.3 공정 블록 공통 모델
공정 장비는 전부 **고정 바디 + 동작 축 0~2 + 처리 시간 + 판정**이다. 블랙박스(BB) 블록 하나가 사출기·CNC·열처리로·세척기 등 내부 미모델링 장비를 덮는다. 워크에 state 태그를 붙여 공정을 지나면 상태가 바뀌고, 후공정 검사기가 상태 조건으로 NG를 판정한다.

### 6.4 블록 설계 규칙
- 블록 = 형식 + 파라미터 + 치수 룩업 테이블. 메이커 모델은 블록이 아니다
- 치수 테이블은 형식별 대표 치수. 카탈로그에서 확인한 값만 verified=true
- 메이커 정확 외형이 필요할 때만 glb 로드. 라이브러리에 메이커 CAD 내장 금지
- 장착 방식은 블록 옵션이 아니라 스냅 위치로 처리
- 모터는 블록이 아니라 컨베이어·축의 `drive: speed|position` 속성
- 센서 외형은 M8~M30 원통·사각 하나

### 6.5 출력
machine.json(V1) · glb(V1) · 설비 카드 JSON(V1) · I/O 리스트 엑셀(V1) · DXF(V1) · STEP(V2) · URDF/MJCF(V2) · **AASX(V2)** · **USD(V2)**

## 7. 팩토리빌더 사양 (Build)

목표: 평면도를 깔고 벽·기둥을 그린 뒤 설비 카드를 끌어다 놓아 하루 안에 공장을 올린다. 공장은 L1 설비로 만들고 L2는 설비별로 선택적으로 올라간다.

### 7.1 편집 방식
레퍼런스 플레인(DXF·이미지) · 선 그리기 → 돌출(벽·펜스·배관) · 폴리곤(슬래브·구역·층) · 그리드 자동 배치(기둥) · 벽 위에 점(문·셔터·분전반) · 점 + 회전(설비·장비) · 설비 소켓(전원·에어·도킹) · 레벨 관리

### 7.2 시뮬레이션 역할
장애물·경계(벽·기둥·펜스·랙) · 네비 통과점(문·도킹·충전소) · 네비 자동 생성(바닥 마킹) · DES 지점(도크·보관·버퍼) · 용량 집계(V2) · 접속 체크(드롭) · 배치 제약(천장·피트) · 섀도 표시(안돈, V2) · 시각 전용(지붕·창·조명, 후순위)

### 7.3 설비 배치 규칙
- 설비는 참조 인스턴스 `ref: machine@version`, 라이브러리 갱신 시 버전 선택
- 인스턴스마다 tagPrefix 자동 (ST01.M1)
- 설비 카드 값은 인스턴스에서 cardOverride
- 자재 흐름은 설비 소켓(inlet/outlet) 간 연결선, 분기 비율은 선 속성
- 용기는 워크 묶음 단위 (DES 배치 크기·버퍼 용량·AMR 적재 수량의 기준)

### 7.4 1차 블록 (V1): 81종 중 약 25종
부지 도면, 슬래브, 외벽·내벽, 기둥·보·지붕, 층, 문·셔터·도크·비상구, 바닥 마킹, 설비 인스턴스, 자재 흐름, 용기·보관 구역·랙, 이동체와 동선, 전원·에어 드롭, 안전 펜스, AMR 도킹, 안돈 표시 지점.

### 7.5 출력
factory.json(V1), DXF·PDF 2D 레이아웃(V1), 공유 링크 뷰어(V2), **USD 스테이지(V2)**.

## 8. 시뮬레이션 엔진 사양 (Simulate)

한 엔진으로 다 하지 않는다. 네 레이어가 신호 테이블로만 통신하고, 정밀 물리는 셀 단위로만 위임한다.

### 8.1 레이어
| 레이어 | 역할 | 실행 | V1 범위 |
|--------|------|------|---------|
| 신호·로직 | 신호 테이블 틱 갱신(10 ms), 시퀀스 스텝, 수동 강제 | 브라우저 Worker / 서버 | 전체 |
| 기구학 | 관절 보간(속도 제한), 이송면 워크 이동, attach/detach, 센서 검출, AABB 간섭 | 동일 | 전체 (로봇 IK는 V2) |
| DES | 이산사건 스케줄러, 설비 카드(사이클·가동률·불량률·고장/수리), 버퍼·용기, 처리량·병목·가동률·WIP·리드타임 | 동일 | 전체 |
| 네비 | 네비 그래프 A*, 작업자·AMR 이동, 도킹, 단순 충돌 회피 | 동일 | 기본 |
| 물리 | 접촉·파지, 선택 셀만 | MuJoCo WASM / Isaac Sim | V3 |

### 8.2 실행 모드
데모(브라우저, 배속 1~10) · 정식(서버 헤드리스, 시나리오 N회, 신뢰구간) · 최적화(서버 GA/베이지안, 세대별 최적해 → 브라우저 애니메이션) · 섀도(V2, 실태그가 신호 테이블 갱신 = **Evolve**)

### 8.3 fidelity별 시뮬 범위
L1 카드: 상태 태그만, 사이클타임 기반 DES · L2 기구·신호: 전체 · L3 물리: 기구학을 물리 엔진으로

### 8.4 시나리오
시나리오 = factory.json 스냅샷 + 파라미터 오버라이드 + 실행 설정(기간·반복·시드). 결과는 지표 테이블 + 이벤트 로그 + 리플레이 타임라인.

### 8.5 동작 제한과 사이클타임 계산
모든 관절·축은 위치 리밋 외에 vmax·amax를 가지며, 사다리꼴(또는 S-커브) 속도 프로파일을 생성한다. 로봇 관절은 메이커 사양표의 최대 속도(verified=true), 가속도는 추정·실측(verified=false). PTP는 가장 느린 관절에 동기화, LIN/CIRC/PATH는 TCP 속도 보간 + 매 스텝 IK, 관절 속도 초과 시 자동 감속·특이점 경고. 결과: 세그먼트별 시간, 전체 사이클, 경고 목록.

### 8.6 로봇 궤적 입력 경로 (V2~)
티칭 포인트(V2) · 지오메트리 경로 생성(V2 후반) · 로봇 프로그램 import(V2) · 실로봇 녹화(V2) · 학습 정책 재생(V3, Isaac Lab 이관)

## 9. 범위

기능 127개를 7등급으로 나눴고, R1 본체는 **V1 53개 + 추가 2개(X-01, X-02는 V2)**. 등급 전체는 [standard/BSE_DT_기능_로드맵.xlsx](standard/).

| 등급 | 건수 | 처리 |
|------|------|------|
| 본체 V1 | 53 | 이 문서의 범위 |
| 본체 V2+ | 12 + 2 (X-01 AAS 변환, X-02 USD export) | 다음 리비전 |
| A 삭제 | 7 | 목록에서 제거 |
| B 보류 | 17 | 조건 충족 시 |
| C 옵션 모듈 | 21 | 별도 판매 (디지털 섀도 = Evolve, 오더 오케스트레이션, 유틸리티 집계, 안전, 제안·ROI) |
| D 타 플랫폼 이관 | 14 | 로봇 정책 학습·합성 데이터(Isaac Lab), PLC 시퀀스 생성, 영상 추적, 게이트웨이 |
| E 외부 솔루션 | 3 | Node-RED, rosbridge, VDA5050 |

### 9.1 V1 범위 (모듈별)
| 모듈 | V1 포함 |
|------|---------|
| 공통 | 뷰포트·트리·기즈모·스냅, 데이터 모델, 저장·버전, Undo/Redo, 그룹·복사·미러·배열, 레퍼런스 이미지, 측정·간섭, 에셋 스토리지, 편집 API, 좌표계 규약, 계정·권한 기본, 서버 엔진 분리, 라이브러리 온디맨드 전달 |
| Build – 머신빌더 | 블록 프레임워크, 1차 블록(약 50종), 외곽 박스 가이드, 관절·태그 자동 생성, I/O 리스트 엑셀 입출력, 수동 조작 패널, 워크·소스·싱크·용기, attach/detach, 템플릿 3종, glb 로드, URDF 로드, 간이 시퀀스, 설비 카드 생성, fidelity 등급, DXF 출력 |
| Build – 팩토리빌더 | 평면도 레퍼런스, 바닥·벽·기둥·보·지붕·층, 개구부, 바닥 마킹→네비 그래프, 설비 인스턴스 배치, 설비 카드 편집, 자재 흐름, 용기·보관·랙, 이동체·동선, 전원·에어 드롭, 안전 펜스, 안돈 표시 지점, DXF·PDF 출력 |
| Simulate | 신호·기구학·DES·기본 네비, 헤드리스 실행, 시나리오 관리·비교 뷰, 리플레이, 레이아웃·버퍼·밸런싱 최적화(세대별 애니메이션), 비교 리포트 |

### 9.2 V1 완성 기준
1. 도면 없는 설비를 블록으로 L2 재현하고, 태그 ON/OFF로 동작이 확인된다
2. 평면도 위에 공장을 구성하고 설비 카드를 배치해 자재 흐름과 동선이 연결된다
3. 라인의 처리량·병목·가동률을 DES로 산출하고 대안 시나리오와 비교표로 출력된다
4. 레이아웃 최적화 루프가 세대별 개선을 애니메이션으로 재생한다
5. DXF를 CAD에서 열어 쓸 수 있고, I/O 리스트 엑셀이 표준 양식으로 입출력된다
6. 기준 설비 3종·기준 공장 1개로 위 1~5가 회귀 테스트로 통과한다

### 9.3 V1에서 하지 않는 것
실PLC 연결(Evolve), 로봇 IK, STEP 로드, 유틸리티 용량 집계, 공유 링크·권한 고도화, MCP, 모바일 뷰어, 영어 UI, **AAS 변환, USD export, Omniverse 연동**. 전부 V2 이후. 단, 4.6·5장 규약은 V1에서 확정해 둔다.

## 10. 개발 순서·작업 규칙

이 지침서는 기간을 정하지 않는다. 일정과 진행 상황은 [05 로드맵](05_ROADMAP.md)에서 관리한다. 여기서는 **순서와 통과 조건**만 정한다. 병목은 코딩이 아니라 규약·스키마 결정과 검수이므로, 오너의 검수 시간을 정기적으로 확보한다.

### 10.1 단계와 게이트 (순서만, 기간 없음)
| 순서 | 단계 | 산출물 | 통과 조건 |
|------|------|--------|-----------|
| 1 | 규약·스키마·API | 2·4·5장 확정, 편집 API 명령 목록, 모노레포 골격(`BSE-Digital-Twin` 저장소 안), CI, CLAUDE.md | 스키마 리뷰 통과 |
| 2 | 머신빌더 | 블록 프레임워크, 기준 설비 3종에 필요한 블록부터 → 1차 블록 전체, 관절·태그·수동 패널, 워크·attach, I/O 엑셀 | **게이트 1**: 기준 설비 3종(컨베이어 스테이션·픽앤플레이스 셀·프레스 스테이션) L2 재현, 태그로 동작 확인 |
| 3 | 팩토리빌더 | 평면도·건물·개구부·마킹·배치·흐름·동선·드롭, DXF 출력 | 기준 공장 1개 구성 |
| 4 | 시뮬 엔진 | 신호·기구학·DES·네비, 헤드리스, 시나리오 관리·비교 뷰, 리플레이 | **게이트 2**: 기준 공장 처리량·병목 산출, 대안 비교표 |
| 5 | 리포트·최적화 | 비교 리포트, GA 루프·세대별 애니메이션, PDF | 완성 기준 1~5 통과 |
| 6 | 마감 | 회귀 테스트 세트, 성능(블록 200개·설비 50대), 문서 | 완성 기준 6 통과 |

### 10.2 1단계에서 정할 것
- [ ] 2장 설계 원칙 8개 승인
- [ ] 4장 machine.json / factory.json / 블록 정의 / 태그 규칙 / spec 스키마 / ext 확정 (zod → JSON Schema)
- [ ] 5장 좌표계·단위 규약 확정 (USD·URDF export 검증 포함)
- [ ] 편집 API 명령 목록 초안 (add_block, set_param, snap, add_joint, bind_tag, draw_wall, place_machine, connect_flow, run_scenario, export …)
- [ ] 기준 설비 3종·기준 공장 1개의 치수·I/O 리스트·레퍼런스 확보 (오너)
- [x] 저장소: `seb000423/BSE-Digital-Twin` (D-32)
- [ ] 모노레포 패키지 경계(schema·engine·blocks)와 ESLint boundaries 규칙

### 10.3 작업 규칙
- 블록 라이브러리는 기준 설비를 재현하면서 채운다. 목록을 먼저 채우지 않는다
- 게이트 통과 기준은 "데모가 돌아간다"가 아니라 "완성 기준의 해당 항목이 회귀 테스트로 통과한다"
- 새 기능 제안은 기능 로드맵 시트에 등급을 달아 백로그로 보내고 현재 단계 작업에 끼워 넣지 않는다
- 정기적으로(주 1회 권장) 동작 빌드를 오너가 검토하고, 피드백 1건 이상 반영
- 사양 값(치수·정격)은 카탈로그·도면 확인값만 입력, 미확인은 verified=false
- 스키마 변경은 마이그레이션과 함께, schema 버전 올림
- Claude가 코드를 쓸 때는 앱 저장소의 CLAUDE.md(이 문서 2·4·5장 + 코드 규약)를 먼저 읽는다

## 11. 보안·라이선스

브라우저에 내려간 코드는 읽힌다는 전제로 설계한다. 보호 대상은 UI가 아니라 **서버 로직·라이브러리 데이터·고객 모델**이다.

| 구분 | 조치 | 시기 |
|------|------|------|
| 서버 전용 | DES 정식 실행, 최적화, AI 생성, 물리 백엔드, 블록 치수 테이블·템플릿 | V1 |
| 라이브러리 전달 | 인증 후 필요 블록만 API 전달, 계정 워터마크, 레이트 리밋 | V1 |
| 테넌트 | 회사별 데이터·스토리지 분리, JWT·역할, 서명 URL, 감사 로그 | V1 기본 → V2 |
| 현장 연결 | 게이트웨이 아웃바운드 전용, 태그 쓰기 기본 비활성, 민감 공장은 온프레미스(V3) | V2 |
| 공유 | 공유 링크 만료, 다운로드(glb·STEP·USD) 권한 분리 | V2 |
| 법적 | 이용약관 역공학 금지, 저작권 등록, 핵심 방법 특허 검토 | V1 |

### 11.1 오픈소스·라이선스 규칙
- **realvirtual(AGPL-3.0) 코드는 쓰지 않는다.** 구조·문서만 참고
- Three.js·r3f(MIT), MuJoCo(Apache-2.0), rosbridge(BSD), ezdxf(MIT), pythonocc(LGPL, 서버 측), usd-core(Apache-2.0 계열), basyx(MIT) 허용
- 메이커 CAD 파일은 라이브러리에 내장·재배포하지 않는다
- Omniverse/Isaac Sim은 NVIDIA 라이선스 조건에 따라 별도 환경에서만 사용. 트윈 서버에 번들하지 않음

### 11.2 데이터 처리
고객 공장 모델·실태그 로그는 고객 소유. 익명화된 설비 카드 통계만 라이브러리 개선에 쓰며 약관에 명시한다.

## 12. 부속 문서
| 문서 | 내용 | 용도 |
|------|------|------|
| [standard/BSE_DT_머신빌더_블록_목록.xlsx](standard/) | 블록 110종 · 공통 구조 · I/O 태그 규칙 · 우선순위 · 스펙 스키마 | 머신빌더 구현 명세 |
| [standard/BSE_DT_팩토리빌더_블록_목록.xlsx](standard/) | 공장 블록 81종 · 편집 방식 · 시뮬 역할 · 우선순위 | 팩토리빌더 구현 명세 |
| [standard/BSE_DT_자동차부품_제조장비_목록.xlsx](standard/) | 장비 189종 · 모델링 등급 · 메이커 | 공정 블록·설비 카드 참조 |
| [standard/BSE_DT_기능_로드맵.xlsx](standard/) | 기능 127개 × V1/V2/V3 · 등급 | 범위 관리 (X-01, X-02 추가 예정) |
| [standard/CLAUDE.md](standard/CLAUDE.md) | 2·4·5장 + 코드 규약 + 편집 API 명령 목록 | AI 코딩 가드레일. 앱 저장소 루트에 복사 |
| I/O 리스트 표준 양식 (xlsx, 작성 예정) | 태그·방향·타입·신호·주소·단자·케이블 열 정의 | import/export 호환 기준 |

## 13. 이 기준서가 프로젝트를 이끄는 방식
1. **문서**: [00 문서 지도](00_README.md)가 이 문서를 최상위 기준으로 가리킨다. 01~09는 이 문서의 쉬운 요약이고 다르면 이 문서가 이긴다.
2. **코드**: 저장소 `BSE-Digital-Twin` 루트의 CLAUDE.md가 이 문서의 2·4·5장을 담는다. Claude는 코드를 쓰기 전에 그것을 읽는다.
3. **결정**: 원칙·데이터·규약을 바꾸려면 [06 결정 기록](06_DECISIONS.md)에 적고 이 문서의 리비전을 올린다 (R2, R3 …).
4. **범위**: 새 기능은 기능 로드맵 엑셀에 등급을 달아 백로그로. 현재 주 작업에 끼워 넣지 않는다.
5. **역할**: [08 역할 정의](08_ROLES.md)의 장별 담당이 검토한다. 최종 결정은 오너.

| 리비전 | 날짜 | 변경 |
|--------|------|------|
| R1 | 2026-11-02 | 최초 작성. 일정은 제외(05 로드맵으로). 원칙 8개, ext 필드, 4.6 외부 형식 대응, USD/AAS 변환(V2). 같은 날 D-31로 저장소 방침을 "새 저장소에 새로 작성"으로 수정 |
