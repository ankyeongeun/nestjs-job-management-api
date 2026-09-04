# 작업 관리 API

NestJS로 구현한 작업 관리 API입니다. 작업을 생성·조회·검색·수정할 수 있으며, 스케줄러가 대기 중인 작업을 주기적으로 처리합니다. 데이터는 `node-json-db`를 이용해 `jobs.json`에 저장합니다.

## 구현 범위

핵심 구현에는 약 2시간의 타임박스를 두었습니다. 제한된 시간 안에서 요구사항을 충족하되, API와 스케줄러의 동시 접근으로 발생할 수 있는 데이터 유실과 중복 처리를 우선적으로 설계하고 검증했습니다. 이후 테스트와 문서화를 통해 구현 결과를 점검했습니다.

## 실행 방법

Node.js 20 이상 환경을 기준으로 작성했습니다.

```bash
npm install
npm run start:dev
```

기본 주소는 `http://localhost:3000`입니다.

```bash
# 빌드 및 실행
npm run build
npm run start:prod

# 단위 테스트
npm test

# API E2E 테스트
npm run test:e2e
```

| 환경 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `3000` | 서버 포트 |
| `JOBS_DB_PATH` | `jobs.json` | 작업 데이터 파일 경로 |
| `LOG_FILE_PATH` | `logs.txt` | 로그 파일 경로 |

프로젝트 루트의 `jobs.json`에는 조회 동작을 확인할 수 있는 샘플 데이터가 포함되어 있습니다.

## API

| Method | Path | 설명 |
| --- | --- | --- |
| `POST` | `/jobs` | 작업 생성 |
| `GET` | `/jobs` | 전체 작업 조회 |
| `GET` | `/jobs/search` | 제목·상태 검색 |
| `GET` | `/jobs/:id` | 단일 작업 조회 |
| `PATCH` | `/jobs/:id` | 작업 제목·설명 수정 |

### 작업 생성

```http
POST /jobs
Content-Type: application/json
```

```json
{
  "title": "월간 리포트",
  "description": "월간 금융 리포트를 생성합니다."
}
```

응답 `201 Created`:

```json
{
  "id": "9dbfb0d4-8f5e-4f82-9f0e-c45cd9363532",
  "title": "월간 리포트",
  "description": "월간 금융 리포트를 생성합니다.",
  "status": "pending",
  "createdAt": "2026-09-04T03:00:00.000Z",
  "updatedAt": "2026-09-04T03:00:00.000Z"
}
```

### 작업 검색

```http
GET /jobs/search?title=금융&status=pending
```

- `title`은 대소문자를 구분하지 않고 부분 일치로 검색합니다.
- `status`는 `pending`, `processing`, `completed`, `failed` 중 하나입니다.
- 두 조건을 함께 전달하면 모두 만족하는 작업을 반환합니다.
- 검색 조건은 하나 이상 필요합니다.

### 작업 수정

```http
PATCH /jobs/{id}
Content-Type: application/json
```

```json
{
  "title": "수정된 월간 리포트"
}
```

`title`과 `description` 중 하나 이상 전달해야 합니다. `pending` 상태의 작업만 수정할 수 있으며, 상태는 API에서 직접 변경할 수 없습니다.

### 에러 응답

```json
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "작업을 찾을 수 없습니다: unknown-id",
  "timestamp": "2026-09-04T03:00:00.000Z",
  "path": "/jobs/unknown-id"
}
```

## 작업 처리

스케줄러는 1분마다 실행되며 한 번에 최대 5개의 `pending` 작업을 처리합니다. 실제 작업 내용이 정해져 있지 않아 `JobExecutor`는 현재 성공하는 기본 구현으로 두었습니다.

```text
pending → processing → completed
                     ↘ failed
```

작업을 먼저 `processing`으로 변경해 선점한 뒤 실행하므로, 같은 작업이 중복으로 선택되지 않습니다. 한 번에 처리하는 개수는 작업이 무제한으로 선점되는 것을 막기 위해 5개로 가정했습니다.

## 동시성 처리

API와 스케줄러가 동시에 같은 JSON을 변경하면, 둘 다 이전 데이터를 읽은 뒤 한쪽 결과가 다른 결과를 덮어쓸 수 있습니다. 이를 막기 위해 다음 구간을 프로세스 내 뮤텍스로 직렬화했습니다.

```text
데이터 읽기 → 조건 확인 → 변경 → 파일 저장
```

실제 작업을 실행하는 동안에는 락을 해제합니다. 오래 걸리는 작업 때문에 다른 API 요청까지 차단하지 않기 위한 선택입니다.

이 구현은 단일 JSON 파일을 사용하는 하나의 애플리케이션 인스턴스를 전제로 합니다. 여러 서버가 같은 데이터를 처리하는 환경이라면 프로세스 내 뮤텍스로는 충분하지 않습니다.

## 로깅

모든 HTTP 요청과 스케줄러 처리 결과를 `logs.txt`에 JSON Lines 형식으로 기록합니다.

```json
{"timestamp":"2026-09-04T03:00:00.000Z","event":"http_request","method":"GET","path":"/jobs","statusCode":200,"durationMs":7}
```

로그 쓰기도 별도의 뮤텍스로 직렬화했습니다. 요청 본문은 민감한 정보가 포함될 수 있어 기록하지 않습니다.

## 테스트

일반적인 API 동작과 함께 다음 상황을 중점적으로 확인했습니다.

- 작업을 동시에 생성해도 데이터가 유실되지 않는지
- 여러 실행이 동시에 작업을 선점해도 중복되지 않는지
- 작업 성공·실패 시 상태가 올바르게 변경되는지
- 한 번에 설정한 작업 개수만 처리하는지
- 처리 중인 작업의 API 수정이 거절되는지
- 요청 결과가 로그 파일에 기록되는지

스케줄러 테스트에서는 1분을 기다리지 않고 처리 메서드를 직접 호출합니다. 타이머보다 실행 결과와 상태 전이를 검증하는 것이 이 코드의 테스트 대상이라고 판단했습니다.

## 구현 범위에서 남은 점

작업을 `processing`으로 변경한 직후 프로세스가 종료되면 해당 작업이 처리 중 상태에 남을 수 있습니다. 이번 구현에서는 `processingStartedAt`을 기록하는 데까지 포함했고, 자동 회수와 재시도는 구현 범위에서 제외했습니다.

## AI 활용

- 사용 도구 및 모델: **OpenAI Codex (GPT-5 계열)**
- 요구사항 정리, 설계 검토, 코드와 테스트 초안, 문서 작성에 활용했습니다.
- 생성된 코드는 직접 검토하고 단위 테스트·E2E 테스트·빌드로 확인했습니다.
