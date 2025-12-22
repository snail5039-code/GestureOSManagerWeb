@echo off
cd /d %~dp0\..
curl -s -X POST "http://127.0.0.1:8080/api/translate" ^
  -H "Content-Type: application/json" ^
  --data-binary "@docs/sample_request.json"
echo.
pause