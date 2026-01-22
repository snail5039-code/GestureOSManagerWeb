export function formatDateTimeMinute(input) {
  if (!input) return "";

  // 1) 숫자(timestamp) 가능
  const d1 = typeof input === "number" ? new Date(input) : new Date(String(input));

  // Date 파싱 성공하면 로컬 기준으로 포맷
  if (!Number.isNaN(d1.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d1.getFullYear();
    const mm = pad(d1.getMonth() + 1);
    const dd = pad(d1.getDate());
    const hh = pad(d1.getHours());
    const mi = pad(d1.getMinutes());
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  // 2) 혹시 특이한 문자열이면 그냥 잘라서 안전 처리
  // "2026-01-22 14:49:19.981585" / "2026-01-22T14:49:19.981585" 대응
  const s = String(input).trim().replace("T", " ");
  // YYYY-MM-DD HH:mm 까지만
  return s.length >= 16 ? s.slice(0, 16) : s;
}
