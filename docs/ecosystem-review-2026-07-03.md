# PreqStation 생태계 리뷰 — 2026-07-03

전체 repo 구성, v2(Work Graph) 구현 상태, 문서 싱크 상태를 점검한 결과 정리.

---

## 1. TL;DR

| 항목             | 상태                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------ |
| v2 코드 품질     | ✅ 양호 — typecheck 통과, 전체 유닛 테스트 307 파일 / 2092개 전부 통과                     |
| v2 문서화        | 🔴 심각한 공백 — **core repo 포함** 모든 repo 문서에 work graph 언급 0건                   |
| CLI 이중 구현    | 🔴 core의 `bin/preqstation.mjs`는 테스트되는 `lib/cli/`와 별개의 오래된 복제본             |
| bin 이름 충돌    | 🟠 core(`preqstation`)와 dispatcher(`@sonim1/preqstation`) 둘 다 `preqstation` 커맨드 선점 |
| 미커밋 작업      | 🟡 workflow profile contract 슬라이스(T1–T8) 구현 완료, 테스트 통과 — 커밋만 남음          |
| CLI/LP repo 싱크 | 🔴 v2 개념(work graph, workflow profile) 완전 미반영                                       |

**한 줄 결론:** v2 구현 자체는 코드/테스트 레벨에서 문제 없음. 문제는 (1) 배포되는 bin이 테스트되는 코드가 아니라는 것, (2) v2가 core 문서에조차 기록되지 않아 CLI/LP repo가 따라갈 기준 문서가 없다는 것.

---

## 2. Repo 구성 맵

```
~/projects/
├── preqstation/          # Core App — 시스템의 원장(system of record)
│   │                     # Next.js 16, Kanban, Task API, MCP, Work Graph(v2)
│   ├── bin/preqstation.mjs      # ⚠️ v2 에이전트용 standalone CLI (스텁 수준)
│   ├── lib/cli/                 # ⚠️ 진짜 CLI 로직 (테스트 대상, 프로덕션 진입점 없음)
│   ├── lib/work-graph-service.ts  # Work Graph 핵심 서비스
│   ├── lib/mcp/tools.ts         # MCP 도구 (preq_agent_guide 포함)
│   └── .worktrees/              # v2 작업용 worktree 잔여물 2개
│
├── preqstation-cli/      # @sonim1/preqstation (npm, v0.1.57) — Dispatcher
│   │                     # 운영 호스트 설치, 프로젝트 매핑, 엔진 디스패치
│   │                     # (claude-code / codex / gemini-cli, OpenClaw/Hermes 어댑터)
│   └── docs/cli-first-documentation-sync-plan.md  # 이전 싱크 작업 기록 (2026-06-10 완료)
│
├── preqstation-lp/       # 공개 웹사이트 모노레포 (pnpm + turbo)
│   ├── apps/landing/            # preqstation.com
│   └── apps/guide/              # Astro Starlight 가이드 (영/한 이중 언어)
│
└── (원격에만 존재) preqstation-skill  # Legacy worker skill — deprecated 처리됨
```

**소유권 경계 (문서에 명시된 계약):**

- `preqstation` = 태스크 생애주기, API, MCP, 아키텍처의 단일 소스
- `preqstation-cli` = 운영자 호스트 셋업 + 디스패치. **`preqstation` 커맨드의 canonical 소유자** (sync plan 문서 기준)
- `preqstation-lp` = 공개 가이드. core/cli 문서를 따라가는 하류(downstream)

---

## 3. V2 (Work Graph) 현재 상태

### 타임라인

| 날짜       | 커밋      | 내용                                                                                            |
| ---------- | --------- | ----------------------------------------------------------------------------------------------- |
| 2026-06-25 | `4a537a3` | `feat: add preqstation v2 work graph workflow` — 그래프 서비스, API, `bin/preqstation.mjs` 추가 |
| 2026-07-01 | `3cb72a8` | `feat: make work graph the primary task view (#282)` — 워크 그래프가 기본 태스크 뷰로 승격      |
| 2026-07-02 | (미커밋)  | Workflow Profile Contract 슬라이스 (T1–T8) 구현                                                 |

### 코드 표면

- **API:** `/api/tasks/[id]/work-graph`(+`/init`, `/nodes`), `/api/work-nodes/[nodeId]`
- **서비스:** `lib/work-graph-service.ts` (20.7K), `lib/work-graph.ts`, `lib/project-work-graph-summary.ts`
- **UI:** `work-graph-tree`, `work-graph-node-card`, `work-graph-node-inspector`, `project-work-graph-cockpit` 등 컴포넌트 10여 개
- **CLI(에이전트용):** `preqstation-agent graph init/state/node create/node complete`, `agent guide`, `run prepare`, `context files/doctor`, `project resolve`
- **MCP:** `preq_agent_guide`가 workflow profile 계약 노출

### 미커밋 작업 (workflow profile contract)

`docs/workflow-profile-contract.md` + `TODOS.md` + 12개 파일 수정 (436 추가 / 15 삭제).
T1–T8 전부 체크 완료 상태. 핵심 결정:

- 기본 workflow profile = `auto`, Core는 스킬 선택 안 함 (harness가 판단)
- 결과는 work node의 `metadata.workflow_profile`에 기록 (`requested` / `resolved` / `resolved_command` / `resolved_reason`)
- 디스패치 커맨드에는 아직 안 붙임 (파서 호환성 검증 전)

### 검증 결과 (2026-07-03 실행)

```
npm run typecheck  → 통과
npm run test:unit  → 307 파일 / 2092 테스트 전부 통과 (98초)
포커스 스위트 (graph/CLI/MCP 6개 파일) → 45/45 통과
```

**코드 레벨에서 v2 구현은 건강함.** 아래 문제들은 코드 로직이 아니라 패키징/문서/경계 문제.

---

## 4. 발견된 문제 (심각도순)

### 🔴 P1-A. 배포 bin ≠ 테스트되는 CLI (core repo)

`bin/preqstation.mjs`(136줄, standalone)는 `lib/cli/`를 **import하지 않는** 별도 구현.
`runPreqstationCli`(lib/cli)의 프로덕션 호출자는 **테스트 파일뿐** — 사실상 dead code를 테스트 중.

bin에 빠진 것 (lib/cli에는 있음):

- `graph node complete` (노드 완료 커맨드 자체가 없음)
- `--metadata-file` (이번 workflow profile 슬라이스의 핵심 전달 경로)
- `context files` / `context doctor` / `project resolve`
- `agent guide`의 `workflow_profile` 계약 (bin은 하드코딩된 옛 버전 — rules 3줄짜리)
- `loadCliConfig` 기반 설정 (bin은 env 변수 2개만)

**영향:** 에이전트가 실제 설치된 `preqstation` bin을 쓰면 workflow profile 메타데이터를 보낼 방법이 없음. 이번 슬라이스가 통째로 무효화됨.

**해결:** bin을 `lib/cli` 빌드 산출물로 교체(esbuild 번들 등)하거나, bin이 lib를 직접 import하도록 통합. 둘 중 하나로 단일 소스화. bin 자체 스모크 테스트 1개 추가.

### 🔴 P1-B. `preqstation` bin 이름 충돌

| 패키지                                 | 버전   | bin           |
| -------------------------------------- | ------ | ------------- |
| `preqstation` (core, `private: false`) | 0.1.4  | `preqstation` |
| `@sonim1/preqstation` (dispatcher)     | 0.1.57 | `preqstation` |

CLI repo의 sync plan 문서는 "`@sonim1/preqstation`이 canonical `preqstation` 커맨드"라고 못박았는데, core v2가 같은 이름의 bin을 추가함. 둘 다 글로벌 설치하면 마지막 설치가 이김. core `package.json`에 `files` 필드도 없어서 실수로 publish하면 repo 전체가 올라감.

**해결 (택1):**

1. core bin 이름 변경 — 예: `preq-core`, `preqstation-agent` (에이전트 대면 커맨드임을 명시)
2. dispatcher(`@sonim1/preqstation`)에 graph/agent 커맨드를 **위임 서브커맨드**로 흡수하고 core bin 제거 — 사용자 대면 커맨드 하나 유지 (장기적으론 이게 깔끔)

어느 쪽이든 core `package.json`에 `files` 필드 추가 필수.

### 🔴 P1-C. v2 문서 완전 공백 — core repo 포함

`work graph` 검색 결과:

| 문서                                     | 언급 |
| ---------------------------------------- | ---- |
| `preqstation/README.md`                  | 0건  |
| `preqstation/docs/architecture.md` (41K) | 0건  |
| `preqstation/docs/API.md`                | 0건  |
| `preqstation-cli/**` (전체)              | 0건  |
| `preqstation-lp/**` (가이드 영/한 전체)  | 0건  |

architecture.md의 "Task Lifecycle" 섹션은 여전히 칸반 6-status 모델만 기술. work-graph API 4개 라우트, 에이전트 CLI, `preq_agent_guide` MCP 도구 전부 미문서화. **core가 기준 문서를 안 만들면 CLI/LP는 따라갈 대상이 없음** — 지금 미싱크의 근본 원인.

### 🟡 P2-A. workflow profile 슬라이스 미커밋

12개 파일 + 신규 3개(`TODOS.md`, `docs/workflow-profile-contract.md`, `lib/agent-guide.ts`)가 워킹트리에만 존재. 테스트 전부 통과 상태이므로 커밋/PR만 하면 됨. 오래 방치하면 dep bump 커밋들과 충돌 위험.

### 🟡 P2-B. LP 가이드가 v1 세계관

가이드 구조가 `web-app/kanban.mdx`, `api/task-lifecycle.mdx` 중심 — 칸반이 primary라는 전제. 실제 앱은 `3cb72a8`부터 work graph가 primary task view. 영/한 양쪽 다 갱신 필요 (이전 싱크 작업도 양쪽 미러링 원칙이었음). `skill/` 섹션 4페이지는 deprecated repo 기준이라 legacy 표기 강화 또는 축소 검토.

### 🟢 P3-A. 잔여 worktree

- `preqstation/.worktrees/preqstation-v2-clean`, `preqstation-v2-work-graph` — v2 머지 완료됐으면 정리 대상
- `~/projects/_preq_worktrees/proj/` — 용도 확인 후 정리

### 🟢 P3-B. 버전 표기 혼선

`bin/preqstation.mjs`의 `SCHEMA_VERSION = 'preqstation.v2.0'` vs `package.json` `0.1.4`. 스키마 버전과 패키지 버전이 다른 체계임을 어딘가(추후 API.md)에 한 줄 명시하면 충분.

---

## 5. 문서 싱크 매트릭스

| 개념                                  | core 코드   | core docs  | cli repo | lp guide                  |
| ------------------------------------- | ----------- | ---------- | -------- | ------------------------- |
| Kanban 6-status                       | ✅          | ✅         | ✅       | ✅                        |
| CLI-first dispatch (`~/.preqstation`) | ✅          | ✅         | ✅       | ✅ (2026-06-10 싱크 완료) |
| Work Graph (v2)                       | ✅          | ❌         | ❌       | ❌                        |
| Work graph = primary view             | ✅          | ❌         | ❌       | ❌                        |
| 에이전트 CLI (`graph`, `agent guide`) | ✅          | ❌         | ❌       | ❌                        |
| Workflow Profile Contract             | ✅ (미커밋) | 🟡 draft만 | ❌       | ❌                        |

이전 "CLI-first documentation sync" 작업(2026-06-10, 5개 phase)이 좋은 선례 — 같은 방식으로 "v2 work graph documentation sync"를 돌리면 됨.

---

## 6. 권장 액션 플랜 (순서 중요)

### Phase 0 — 미커밋 작업 착지 (즉시, ~30분)

1. workflow profile 슬라이스 커밋 + PR. 테스트 이미 통과 상태.
2. `TODOS.md`를 트래킹할지 gitignore할지 결정.

### Phase 1 — CLI 경계 결정 (설계 결정 1개, 구현 반나절)

3. **결정:** core bin 이름 변경 vs dispatcher로 위임 통합 (P1-B 참고).
4. `bin/preqstation.mjs` → `lib/cli` 단일 소스화 (P1-A). 이거 안 하면 workflow profile 계약이 실전에서 안 돌아감.
5. core `package.json`에 `files` 필드 추가.

### Phase 2 — core 기준 문서 작성 (v2 싱크의 전제조건)

6. `docs/architecture.md`에 Work Graph 섹션 추가 (데이터 모델, 노드 상태 전이, canonical root note 규칙).
7. `docs/API.md`에 work-graph 4개 라우트 + `metadata.workflow_profile` 계약 추가.
8. `README.md` Features에 Work Graph 반영, `workflow-profile-contract.md`를 DRAFT에서 승격.

### Phase 3 — 하류 repo 싱크 (Phase 2 완료 후)

9. `preqstation-cli`: README/INSTALLATION에 에이전트 런타임에서의 graph 커맨드 관계 설명 (Phase 1 결정에 따라 내용 달라짐 — 그래서 순서가 중요).
10. `preqstation-lp`: 가이드에 Work Graph 페이지 신설, kanban.mdx를 "보드 뷰" 관점으로 재구성, task-lifecycle.mdx 갱신. 영/한 미러링.
11. 기존 `cli-first-documentation-sync-plan.md` 포맷으로 progress log 남기기.

### Phase 4 — 청소 (아무 때나)

12. `.worktrees/` 잔여물 2개 + `_preq_worktrees/proj` 정리.
13. 계약 dogfood: 실제 harness 런 1회로 `resolved`/`resolved_command`/`resolved_reason` 기록 확인 → TODOS.md의 P3 항목(수동 워크플로 컨트롤) 착수 여부 판단.

---

## 7. 결론

- **v2 구현 로직: 문제 없음.** 테스트 커버리지 넓고 전부 통과. 계약 설계(contract-first, Core는 시맨틱 판단 안 함)도 경계가 깔끔함.
- **진짜 리스크는 배선(wiring):** 테스트되는 CLI가 배포 경로에 연결 안 됨 + bin 이름 충돌. 이 두 개는 문서보다 먼저 풀어야 함 — 문서를 지금 쓰면 어느 bin 기준인지부터 애매해짐.
- **문서 싱크는 core부터:** 이전 CLI-first 싱크(6/10) 때처럼 core → cli → lp 순서로 내려가면 됨. LP까지 포함 대략 1–2일 분량.
