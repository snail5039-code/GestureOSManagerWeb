# 실행 버튼 안내 (Windows)

## 0) 폴더 위치
프로젝트 루트에 `ai-server/`, `backend-spring/`, `frontend-react/`, `tools/`가 있어야 함.

## 1) 실행 순서 (필수)
1) `tools/start_ai.bat` 더블클릭 (FastAPI + 모델, 포트 8000)
2) Spring 실행 (IntelliJ에서 backend-spring 실행, 포트 8080)
3) `tools/test_translate.bat` 더블클릭 → JSON 나오면 연결 성공

## 2) 프론트 실행 (선택)
- `tools/start_front.bat` 더블클릭 (Vite dev server)

## 3) 문제 해결
- Spring에서 `Connection refused 127.0.0.1:8000` 뜨면: FastAPI(8000) 먼저 켰는지 확인
- `test_translate.bat`가 실패하면: `docs/sample_request.json` 경로가 맞는지 확인