export default function SocialLoginButtons() {
  const goToLogin = (provider) => {
    // 소셜 로그인 제공자 URL로 리디렉션
    window.location.href = `/oauth2/authorization/${provider}`;
  };

  return (
    <div className="space-y-2">
      <button
        type="button" // form submit 방지
        onClick={() => goToLogin("google")}
        className="w-full border rounded-xl py-3"
      >
        Google로 계속
      </button>

      <button
        type="button"
        onClick={() => goToLogin("kakao")}
        className="w-full border rounded-xl py-3"
      >
        Kakao로 계속
      </button>

      <button
        type="button"
        onClick={() => goToLogin("naver")}
        className="w-full border rounded-xl py-3"
      >
        Naver로 계속
      </button>
    </div>
  );
}
