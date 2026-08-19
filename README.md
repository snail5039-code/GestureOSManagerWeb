# GestureOSManagerWeb

[GestureOS Manager](https://github.com/snail5039-code/GestureOSManager) 의 웹 사이트입니다.
계정(일반·소셜 로그인), 게시판·댓글, 모션 가이드, 앱 다운로드, AI 도움말을 담당합니다.

| 폴더 | 무엇 | 포트 |
| --- | --- | --- |
| `backend-spring/` | 계정·게시판 API (Spring Boot + MyBatis + PostgreSQL) | **8082** |
| `frontend-react/` | 웹 프런트 (React + Vite) | **5174** |

매니저 데스크톱 앱(5173)도 로그인·학습 프로필 동기화를 위해 이 서버(8082)를 사용합니다.

## 실행

**필요한 것**: PostgreSQL, `JWT_SECRET`.
DB 는 기동 시 `schema.sql` / `data.sql` 을 실행하므로 없으면 서버가 뜨지 않습니다.

```bash
# 0) 설정
cp .env.example .env      # 값 채우고 셸에 export 하거나 IDE 실행 구성에 넣는다
openssl rand -base64 48   # JWT_SECRET 생성

# 1) 백엔드 (8082)
cd backend-spring
./mvnw spring-boot:run

# 2) 프런트 (5174)
cd frontend-react
npm install
npm run dev
```

기동 로그의 `[CONFIG]` 줄에 **설정이 없어 꺼진 기능**이 나옵니다.
메일·AI 도움말·소셜 로그인은 값이 없으면 그 기능만 비활성되고 서버는 정상적으로 뜹니다.

## 관리자 계정

`data.sql` 이 `admin` 계정을 만들지만 **비밀번호는 비어 있는(로그인 불가) 상태**입니다.
`ADMIN_INITIAL_PASSWORD` (8자 이상)를 주면 기동 시 한 번만 설정됩니다.
이미 비밀번호가 있으면 이 값을 바꿔도 덮어쓰지 않습니다.

## 비밀번호 저장 방식

비밀번호는 bcrypt 해시만 인정합니다. 예전 데이터에 평문이 남아 있으면
기동 시 `LegacyPasswordMigration` 이 같은 비밀번호의 해시로 옮깁니다.
단, 널리 알려진 약한 값(`admin`, `1234` 등)을 쓰던 계정은 로그인 불가로 바꾸고
경고를 남기므로 '비밀번호 찾기'로 재설정해야 합니다.

소셜로 가입한 계정은 아이디/비밀번호 로그인을 허용하지 않습니다.

## 설정값

`.env.example` 참고. 필수 / DB / 선택으로 나눠 두었습니다.

## 알려진 제한

- `/api/help/**` 가 인증 없이 열려 있어 AI 도움말 호출량(비용)에 제한이 없습니다.
- 이메일 인증코드에 시도 횟수 제한이 없습니다.
- WebRTC 시그널링(`/ws`)에 인증이 없어 roomId 만 알면 참여할 수 있습니다.
- `frontend-react` 에 라우트 가드가 없어 비로그인 상태로 `/mypage` 등에 접근됩니다.
