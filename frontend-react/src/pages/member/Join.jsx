import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Join() {
  const nav = useNavigate();
  const [countries, setCountries] = useState([]);
  const [form, setForm] = useState({
    loginId: "",
    loginPw: "",
    loginPw2: "",
    name: "",
    email: "",
    countryId: "",
  });

  useEffect(() => {
  axios.get("/api/countries")
    .then((res) => {
      console.log("countries status:", res.status);
      console.log("countries data:", res.data);

      const data = res.data;
      const list =
        Array.isArray(data) ? data :
        Array.isArray(data?.data) ? data.data :
        Array.isArray(data?.countries) ? data.countries :
        Array.isArray(data?.items) ? data.items :
        [];

      setCountries(list);
    })
    .catch((e) => {
      console.log("countries error:", e?.response?.status, e?.response?.data, e?.message);
      alert("국적 목록 호출 실패");
    });
}, []);



const onChange = (e) => {
  const { name, value } = e.target;
  setForm((prev) => ({ ...prev, [name]: value }));
};

  const submit = async () => {
    if (!form.loginId.trim()) return alert("아이디 입력");
    if (!form.loginPw.trim()) return alert("비밀번호 입력");
    if (form.loginPw !== form.loginPw2) return alert("비밀번호 재확인 불일치");
    if (!form.name.trim()) return alert("이름 입력");
    if (!form.email.trim()) return alert("이메일 입력");
    if (!form.countryId) return alert("국적 선택");

    try {
      await axios.post("/api/members/join", {
        loginId: form.loginId.trim(),
        loginPw: form.loginPw.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        countryId: Number(form.countryId),
      });

      alert("회원가입 완료");
      nav("/login");
    } catch (e) {
      alert(e.response?.data?.message ?? "회원가입 실패");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-6 border rounded-xl bg-white">
      <h2 className="text-2xl font-bold mb-5 text-center">회원가입</h2>

      <input className="w-full border p-3 rounded-xl mb-2"
        name="loginId" placeholder="아이디" value={form.loginId} onChange={onChange}
      />
      <input className="w-full border p-3 rounded-xl mb-2"
        name="loginPw" type="password" placeholder="비밀번호" value={form.loginPw} onChange={onChange}
      />
      <input className="w-full border p-3 rounded-xl mb-2"
        name="loginPw2" type="password" placeholder="비밀번호 재확인" value={form.loginPw2} onChange={onChange}
      />
      <input className="w-full border p-3 rounded-xl mb-2"
        name="name" placeholder="이름" value={form.name} onChange={onChange}
      />
      <input className="w-full border p-3 rounded-xl mb-2"
        name="email" placeholder="이메일" value={form.email} onChange={onChange}
      />

      <select className="w-full border p-3 rounded-xl mb-3"
        name="countryId" value={form.countryId} onChange={onChange}
      >
        <option value="">국적 선택</option>
        {countries.map((c) => (
          <option key={c.id} value={String(c.id)}>{c.countryName}</option>
        ))}
      </select>

      <button className="w-full bg-blue-600 text-white py-2 rounded-xl" onClick={submit}>
        회원가입
      </button>
    </div>
  );
}
