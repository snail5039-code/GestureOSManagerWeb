import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";

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
  // baseURL이 "/api"이므로 "/members/countries"라고 써야 
  // 최종적으로 "/api/members/countries"가 호출됩니다.
  api.get("/members/countries") 
    .then((res) => {
      setCountries(res.data);
    })
    .catch((e) => {
      console.error("Failed to fetch countries", e);
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
      // api 인스턴스 사용
      await api.post("/members/join", {
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
    <div className="max-w-md mx-auto mt-16 p-6 border rounded-xl bg-white shadow-sm">
      <h2 className="text-2xl font-bold mb-5 text-center">회원가입</h2>
      <div className="space-y-3">
        <input className="w-full border p-3 rounded-xl" name="loginId" placeholder="아이디" value={form.loginId} onChange={onChange} />
        <input className="w-full border p-3 rounded-xl" name="loginPw" type="password" placeholder="비밀번호" value={form.loginPw} onChange={onChange} />
        <input className="w-full border p-3 rounded-xl" name="loginPw2" type="password" placeholder="비밀번호 재확인" value={form.loginPw2} onChange={onChange} />
        <input className="w-full border p-3 rounded-xl" name="name" placeholder="이름" value={form.name} onChange={onChange} />
        <input className="w-full border p-3 rounded-xl" name="email" placeholder="이메일" value={form.email} onChange={onChange} />
        
        <select className="w-full border p-3 rounded-xl" name="countryId" value={form.countryId} onChange={onChange}>
          <option value="">국가 선택</option>
          {countries.length > 0 ? (
           countries.map((country) => (
             <option key={country.id} value={country.id}>
               {country.countryName}
             </option>
           ))
          ) : (
            <option>국가 목록이 없습니다</option>
          )}
        </select>
        <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold" onClick={submit}>
          회원가입
        </button>
      </div>
    </div>
  );
}