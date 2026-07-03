# V2 싱크 작업 목록

기준: `docs/ecosystem-review-2026-07-03.md` 리뷰 결과.
순서 의존성 있음 — Phase 순서대로 진행. 각 항목에 대상 repo, 파일, 검증 방법 명시.

---

## Phase 0 — 미커밋 작업 착지 (즉시, ~30분)

- [x] **P0-1. workflow profile 슬라이스 커밋 + PR** `[preqstation]`
  - 대상: 수정 12개 파일 + 신규 `docs/workflow-profile-contract.md`, `lib/agent-guide.ts`
  - 상태: T1–T8 구현 완료, 테스트 전부 통과 확인됨 (2026-07-03)
  - 방치 시 dep bump 커밋들과 충돌 위험
  - 검증: `npm run typecheck && npm run test:unit`

- [x] **P0-2. `TODOS.md` 트래킹 여부 결정** `[preqstation]`
  - 커밋에 포함하거나 `.gitignore` 추가. 애매하게 untracked 방치 금지.
  - 결정: `TODOS.md`를 repo backlog로 트래킹하고 workflow profile 후속(P3 manual controls)을 기록한다.

---

## Phase 1 — CLI 경계 결정 (설계 결정 1개 + 구현 반나절)

> ⚠️ 문서 작업(Phase 2)보다 먼저. 안 하면 문서가 어느 bin 기준인지 애매해짐.

- [x] **P1-1. [결정] core bin 이름 처리 방향** `[preqstation]` `[preqstation-cli]`
  - 문제: core `preqstation`(0.1.4)와 `@sonim1/preqstation`(0.1.57) 둘 다 bin 이름 `preqstation`. CLI repo sync plan은 "@sonim1이 canonical"로 못박음.
  - 옵션 A: core bin 이름 변경 (`preq-core`, `preqstation-agent` 등) — 빠름
  - 옵션 B: dispatcher에 graph/agent 커맨드 위임 통합, core bin 제거 — 장기적으로 깔끔
  - 산출물: 결정 기록 (이 파일 또는 workflow-profile-contract.md 스타일 문서)
  - 결정: 옵션 A. core package bin command를 `preqstation-agent`로 변경하고, canonical `preqstation` command는 dispatcher package(`@sonim1/preqstation`) 소유로 둔다. 장기적으로 dispatcher 위임 통합은 Phase 3 하류 repo 싱크 때 다시 검토한다.

- [x] **P1-2. `bin/preqstation.mjs` ↔ `lib/cli` 단일 소스화** `[preqstation]`
  - 문제: bin(136줄 standalone)이 `lib/cli/` import 안 함. 테스트되는 `runPreqstationCli`는 프로덕션 호출자 없음.
  - bin에 빠진 것: `graph node complete`, `--metadata-file`, `context files/doctor`, `project resolve`, agent guide의 `workflow_profile` 계약
  - **이거 안 하면 workflow profile 계약이 실제 설치 bin에서 안 돌아감**
  - 방법: bin이 lib/cli 빌드 산출물을 로드하거나 esbuild 번들
  - 검증: `node bin/preqstation.mjs help` 출력에 `--metadata-file`, `node complete` 포함 + 스모크 테스트 1개 추가
  - 구현: `scripts/build-cli.mjs`가 `lib/cli/bin.ts`를 esbuild로 `dist/preqstation-cli.mjs`에 번들하고, `bin/preqstation.mjs`는 해당 산출물만 로드한다.

- [x] **P1-3. core `package.json`에 `files` 필드 추가** `[preqstation]`
  - 현재 없음 → 실수 publish 시 repo 전체 업로드 위험
  - 검증: `npm pack --dry-run`으로 포함 파일 확인

---

## Phase 2 — core 기준 문서 작성 (v2 싱크의 전제조건)

- [x] **P2-1. `docs/architecture.md`에 Work Graph 섹션 추가** `[preqstation]`
  - 완료 (PR #288): Work Graph 섹션 신설 (데이터 모델, canonical root note, 전이 액션, evidence/workflow memory, root_overlay, 표면 3종), Task Lifecycle에 primary view 관계 명시, External API 표에 라우트 연결

- [x] **P2-2. `docs/API.md`에 work-graph API 문서화** `[preqstation]`
  - 완료 (PR #288): 라우트 7개 표 (`/work-graph`, `/init`, `/nodes`, `/memory`, `/work-nodes/:nodeId` GET/PATCH, `/evidence`), envelope + `preqstation.v2.0` 스키마 버전 설명(P4-2 겸함), node type/status/evidence kind 목록, `metadata.workflow_profile` 계약, 에이전트 CLI 표, MCP graph 도구 5종

- [x] **P2-3. `README.md` Features에 Work Graph 반영** `[preqstation]`
  - 완료 (PR #288): Features에 work graph + workflow profile 항목, Documentation에 contract 링크

- [x] **P2-4. `docs/workflow-profile-contract.md` DRAFT 승격** `[preqstation]`
  - 완료 (PR #288): Status → IMPLEMENTED (2026-07-03), dogfood 대기 명시

---

## Phase 3 — 하류 repo 싱크 (Phase 2 완료 후)

- [ ] **P3-1. `preqstation-cli` 문서 갱신** `[preqstation-cli]`
  - README/INSTALLATION에 에이전트 런타임에서의 graph 커맨드 관계 설명
  - 내용은 P1-1 결정에 따라 달라짐 (그래서 순서 중요)
  - 현재 work graph 언급 0건

- [ ] **P3-2. `preqstation-lp` 가이드 갱신 (영/한 미러링)** `[preqstation-lp]`
  - Work Graph 가이드 페이지 신설
  - `web-app/kanban.mdx` → "보드 뷰" 관점으로 재구성 (primary는 work graph)
  - `api/task-lifecycle.mdx` 갱신
  - `skill/` 섹션 4페이지 legacy 표기 강화 또는 축소 검토
  - 검증: `pnpm build` (guide + landing)

- [ ] **P3-3. 싱크 progress log 기록** `[preqstation-cli]`
  - `docs/cli-first-documentation-sync-plan.md` 포맷 재활용해 "v2 work graph docs sync" 기록 남기기

---

## Phase 4 — 청소 + 후속 (아무 때나)

- [ ] **P4-1. worktree 잔여물 정리**
  - `preqstation/.worktrees/preqstation-v2-clean`, `preqstation-v2-work-graph` (v2 머지 완료 확인 후)
  - `~/projects/_preq_worktrees/proj/` (용도 확인 후)
  - 검증: `git worktree list` / `git worktree prune`

- [x] **P4-2. 스키마 버전 표기 명시**
  - 완료 (PR #288): API.md Work Graph 섹션에 "wire contract 버전, npm 패키지 버전과 별개" 기록

- [ ] **P4-3. workflow profile 계약 dogfood**
  - 실제 harness 런 1회로 `metadata.workflow_profile`에 `resolved`/`resolved_command`/`resolved_reason` 기록되는지 확인
  - 통과 후 → `TODOS.md`의 수동 워크플로 컨트롤(P3) 착수 여부 판단

---

## 진행 기록

| 날짜       | 항목                    | 결과                                                                                                                      |
| ---------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-03 | 리뷰 수행, 이 목록 생성 | typecheck + 2092 테스트 통과 확인                                                                                         |
| 2026-07-03 | Phase 0 착수            | workflow profile 슬라이스와 `TODOS.md`를 `codex/v2-sync-worklist` PR 범위로 묶음                                          |
| 2026-07-03 | Phase 0 완료            | 슬라이스 + `TODOS.md` 커밋 (`feat/workflow-profile-contract`, 7b7ba76)                                                    |
| 2026-07-03 | Phase 2 + P4-2 완료     | core docs 4건 갱신 커밋 (4e69e53), PR #288 오픈                                                                           |
| 2026-07-03 | Phase 1 완료            | core bin command를 `preqstation-agent`로 변경, production bin을 `lib/cli` 번들 산출물로 단일 소스화, package `files` 추가 |
| —          | 남은 항목 (codex 예정)  | Phase 3 하류 싱크, P4-1 worktree 정리, P4-3 dogfood                                                                       |
