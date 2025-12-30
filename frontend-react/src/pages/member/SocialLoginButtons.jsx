export default function SocialLoginButtons() {
  const go = (provider) => {
    // 백으로 직접 이동 (OAuth2 로그인 시작)
    window.location.href = `/oauth2/authorization/${provider}`;
  };

  return (
    <div className="space-y-2">
      <button
        type="button" // form submit 방지
        onClick={() => go("google")}
        className="w-full border rounded-xl py-3"
      >
        Google로 계속
      </button>

      <button
        type="button"
        onClick={() => go("kakao")}
        className="w-full border rounded-xl py-3"
      >
        Kakao로 계속
      </button>

      <button
        type="button"
        onClick={() => go("naver")}
        className="w-full border rounded-xl py-3"
      >
        Naver로 계속
      </button>
    </div>
  );
}
