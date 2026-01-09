import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useTranslation } from "react-i18next";

export default function OAuth2Redirect() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { setAccessToken } = useAuth();
  const { t } = useTranslation(["member"]);

  useEffect(() => {
    const run = async () => {
      let accessToken = params.get("accessToken");

      if (!accessToken && window.location.hash) {
        const hashParams = new URLSearchParams(
          window.location.hash.replace("#", "")
        );
        accessToken = hashParams.get("accessToken");
      }

      if (!accessToken) {
        console.error(t("member:oauth.noToken"));
        nav("/login", { replace: true });
        return;
      }

      await setAccessToken(accessToken);
      nav("/", { replace: true });
    };

    run();
  }, [params, nav, setAccessToken, t]);

  return <div className="p-6">{t("member:oauth.processing")}</div>;
}
