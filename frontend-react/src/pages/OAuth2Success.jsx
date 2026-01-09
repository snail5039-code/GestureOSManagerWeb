import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useTranslation } from "react-i18next";

export default function OAuth2Success() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation(["member"]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("accessToken");

    if (token) {
      localStorage.setItem("accessToken", token);
      navigate("/home", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>{t("member:oauth.socialProcessing")}</p>
    </div>
  );
}
