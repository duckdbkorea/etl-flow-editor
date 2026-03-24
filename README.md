# ETL Flow Editor

React Flow 기반 시각적 ETL / DB 이관 파이프라인 편집기

## 기술 스택

- **Frontend**: React 18 + Vite + React Flow
- **ETL 엔진**: Apache Hop (REST API 연동)
- **Mock 서버**: Node.js (개발용)

## 실행 방법

### 개발 환경

터미널 1 — Mock 서버 실행
\`\`\`bash
node mock-server.js
\`\`\`

터미널 2 — Vite 개발 서버
\`\`\`bash
npm install
npm run dev
\`\`\`

브라우저에서 http://localhost:5173 접속

### 실제 Apache Hop 서버 연동

1. Apache Hop 서버를 localhost:8080 으로 실행
2. mock-server.js 대신 Hop 서버 사용
3. 프론트 코드 변경 없이 자동 연동

## 프로젝트 구조

\`\`\`
src/
├── api/          # Hop REST API 호출
├── hooks/        # useExecution, useSSE
├── panels/       # 노드 설정 인스펙터 패널
└── utils/        # 직렬화 / 역직렬화 / 유효성 검사
mock-server.js    # 개발용 Mock 서버
\`\`\`

## 노드 타입

| 타입 | 설명 |
|---|---|
| Source | Oracle, MySQL, PostgreSQL 등 소스 DB |
| Transform | 컬럼 매핑 및 타입 변환 |
| Filter | WHERE 조건 필터링 |
| Target | AgensSQL 등 대상 DB |