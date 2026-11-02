# 03. 아키텍처

| 항목 | 내용 |
|------|------|
| 주 역할 | 시스템이 어떻게 구성되고 연결되는지 |
| 부 역할 | 기술 선택의 이유 기록 |
| 주 담당 / 부 담당 | 스마트제조 수석연구원 / OT 통합 엔지니어, 로보틱스 시뮬레이션 엔지니어 |
| 마지막 수정 | 2026-11-02 |

> 세부 기술 스택·데이터 형식·좌표 규약은 [11 개발 지침서 R1](11_BSE_DT_DEV_STANDARD.md) 3·4·5장이 원본입니다 (D-19). 여기서는 쉬운 그림과 요약만 둡니다.

## 1. 전체 그림 (기준서 3장: 브라우저 / 서버 / 현장 3층)
```
[브라우저]  랜딩 페이지 ──Build/Monitor──▶ BSE Studio
            BSE Studio = 편집기(3D 뷰·노드 트리·편집 명령) + 데모 시뮬레이션(가볍게, 실시간)
                 │ machine.json / factory.json
                 ▼
[서버]      API(저장·계정·라이브러리) + 정식 시뮬레이션(헤드리스 N회) + 최적화·AI + 변환(STEP·DXF·URDF·AAS)
                 │                                   └──▶ USD/URDF 내보내기 ──▶ [Omniverse / Isaac Sim] (V2~V3)
                 ▼
[현장]      게이트웨이 (Node-RED·rosbridge, 아웃바운드 전용) ◀── PLC / 로봇 / AMR          (V2)
```
- 브라우저는 편집·보기·데모 시뮬레이션만, 무거운 일(정식 시뮬·최적화·변환·블록 라이브러리)은 서버
- 현장 연결은 V2에서, 게이트웨이가 바깥으로만 연결 (공장 안으로 들어오는 포트 없음)
- Omniverse / Isaac는 별도 환경. 같은 JSON 데이터에서 USD/URDF로 내보내 쓴다 (D-21)

## 2. 공장 계층과의 관계 (ISA-95 기준)
| 계층 | 예 | BSE의 역할 |
|------|----|-----------|
| 4. 경영 (ERP) | 주문, 재고 | 범위 밖 (연동 대상) |
| 3. 생산관리 (MES) | 작업 지시, 실적 | 연동 대상 (V3) |
| 2. 감시 (SCADA/HMI) | 설비 화면 | **Monitor(디지털 섀도)가 겹치는 영역** (V2) |
| 1. 제어 (PLC) | 설비 제어 | 태그를 읽기만 함. 시뮬레이션의 가상 PLC와 같은 신호 테이블 구조 |
| 0. 현장 | 센서, 모터 | 데이터 출처 |

## 3. 구성 요소
| 구성 요소 | 하는 일 | 기술 (기준서 3.2절) | 위치 |
|-----------|---------|----------------------|------|
| 랜딩 페이지 | 소개 + 입구 | HTML/CSS/JS, Three.js + anime.js (빌드 도구 없음, 기준서 스택 예외) | GitHub `BSE-Digital-Twin`의 `landing/` → Vercel |
| BSE Studio (편집기 코어) | 설비·공장 편집, 3D 뷰, 데모 시뮬 | TypeScript, React 18, Vite, Three.js + react-three-fiber, zustand, zod | 같은 저장소 `apps/web` (처음부터 작성, D-31·D-32) |
| API 서버 | 저장·버전, 계정·권한, 라이브러리 전달 | Node.js 22, Fastify, PostgreSQL(JSONB), Redis, S3 호환 저장소 | `apps/api` (예정) |
| 시뮬 엔진 | 신호 → 기구학 → DES → 네비 4층 | 같은 코드를 브라우저(Web Worker)와 서버(Node Worker)에서 실행 | `packages/engine` (예정) |
| 최적화·AI | GA/베이지안 루프, LLM 생성, MCP | Python (pymoo, Optuna), Claude API (V2) | `services/optimize` (예정) |
| 변환 서비스 | STEP↔glb, DXF, URDF, 썸네일, **AAS/AASX 변환(X-01)**, **USD 내보내기(X-02)** | Python FastAPI, pythonocc, ezdxf | `services/convert` (예정) |
| 게이트웨이 | PLC·ROS2 → WebSocket/MQTT | Node-RED, rosbridge (직접 개발 안 함) | 현장 엣지 PC (V2) |
| 정밀 물리 · 로봇 학습 | 로봇 셀 물리, 강화학습 | NVIDIA Omniverse / Isaac Sim / Isaac Lab, MuJoCo | 별도 GPU 환경 (V3) |

## 4. 데이터 형식 (기준서 4장)
- **모든 것은 노드 트리 하나**: 설비(machine.json)와 공장(factory.json)은 같은 구조에 뿌리만 다름. 설비는 공장에 "참조"로 놓여 원본을 고치면 전부 반영
- **블록 = 형식 + 파라미터 + 치수 표**: 메이커 제품 하나하나가 블록이 아님. 정확한 외형이 필요할 때만 glb 로드
- **신호 테이블 하나로 통신**: 시뮬레이션의 네 층은 신호 테이블로만 대화. 실제 PLC 태그와 1:1로 바꿀 수 있어 시뮬과 현장 연결이 같은 구조
- **fidelity 등급**: 설비마다 L1(카드만) / L2(기구·신호) / L3(물리). 한 공장 안에 섞여 있는 것이 정상
- **사양(spec) 섹션**: 전기·공압·가스·통신 등 13개 섹션 49필드가 처음부터 스키마에 있고 1차엔 숨김
- **AAS/AASX**: 저장 형식이 아니라 변환 기능 (D-22)

## 5. 좌표·단위 규약 (기준서 5장 요약)
| 항목 | 규약 |
|------|------|
| 길이 / 각도 | mm / 도(deg)로 저장·표시. 내부 계산은 m·rad |
| 좌표계 | 오른손, **Z가 위**, X가 설비 진행 방향(투입 → 배출), Y 왼쪽 |
| 원점 | 설비: 바닥면 중심 · 공장: 평면도 원점 |
| glTF | Y-up이므로 불러올 때 X축 -90° 보정 |
| URDF / MJCF / USD | m·rad·Z-up으로 변환해 내보냄 (Omniverse도 Z-up 설정으로 맞춤) |
| 시간 | 신호 틱 10 ms, 화면 60 fps 보간 |
| 태그 이름 | 대문자·숫자·밑줄, `{스테이션}.{설비}.{태그}` (예: `ST01.M1.CYL1_FWD`), 32자 이내 |

## 6. 배포
- 사이트 하나: `BSE-Digital-Twin` main 을 Vercel 프로젝트 `bse-digital-twin` 이 자동 배포. 루트 `vercel.json` 이 `apps/web` 을 빌드한 뒤 `landing/` 과 합쳐 `site/` 로 내보낸다 → `/` = 랜딩, `/studio/` = BSE Studio (D-36). Vercel 프로젝트의 루트 폴더 설정은 저장소 루트(비움)
- BSE Studio: Docker Compose(개발·단일 서버) + GitHub Actions (기준서). 공개 주소가 생기면 Build 버튼 연결

## 7. 기술 선택 이유
| 선택 | 이유 | 대안 |
|------|------|------|
| 랜딩은 빌드 도구 없는 정적 사이트 | 파일만 열면 보이고 관리가 단순 | React 등 |
| Three.js + react-three-fiber | 브라우저 표준, 설치 불필요, React와 결합 | Babylon.js |
| 자체 JSON 노드 트리 | 설비·공장·시뮬이 하나의 구조, 서버와 브라우저가 같은 코드 | AAS를 저장 형식으로 (→ 변환 기능으로, D-22) |
| 웹 자체 시뮬 엔진 (신호·기구학·DES·네비) | 설치 없이, 수천 번 반복 실행 가능, 현장 태그와 같은 구조 | Omniverse만으로 (→ V3 정밀 물리로, D-21) |
| 외부 솔루션 (Node-RED, rosbridge, MuJoCo/Isaac, pythonocc) | 직접 만들면 안 되는 영역을 기준서가 못 박음 | 자체 개발 |
| OPC UA 등 프로토콜은 게이트웨이 뒤로 | 트윈은 프로토콜을 모르고 신호 테이블만 봄 | 직접 연결 |

## 8. 보안 / 라이선스 (기준서 11장)
- 브라우저 코드는 읽힌다고 전제. 지킬 것은 서버 로직·블록 라이브러리·고객 모델
- 회사(테넌트)별 데이터 분리, 로그인·역할(편집/열람), 감사 로그
- 현장 연결은 읽기 전용이 기본, 태그 쓰기는 꺼 둠
- **realvirtual(AGPL) 코드는 쓰지 않음** (참고만). 메이커 CAD 파일은 라이브러리에 넣지 않음
