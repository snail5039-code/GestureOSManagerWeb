import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";

export default function Logout() {
  const nav = useNavigate();
  const { t } = useTranslation("member");

  useEffect(() => {
    (async () => {
      try {
        await axios.post("/api/members/logout");
      } finally {
        nav("/");
      }
    })();
  }, [nav]);

  return (
    <div className="max-w-md mx-auto mt-16 p-6 border rounded-xl bg-[var(--surface)] text-center text-[color:var(--text)]">
      {t("logout.loading")}
    </div>
  );
}
