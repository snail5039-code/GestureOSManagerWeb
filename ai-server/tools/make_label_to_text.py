import json
import re
from pathlib import Path

# ✅ morpheme JSON 루트(01~16 폴더 포함)
ROOT = Path(r"D:\aihub_download\sign_103\004.수어영상\1.Training\라벨링데이터\REAL\WORD\01_real_word_morpheme\morpheme")

# 파일명에서 WORDxxxxx 추출
pat = re.compile(r"(WORD)(\d{1,5})")

out = {}

json_files = list(ROOT.rglob("*_morpheme.json"))
print("found:", len(json_files))

for fp in json_files:
    m = pat.search(fp.name)
    if not m:
        continue

    label = f"WORD{m.group(2).zfill(5)}"

    # JSON 읽기(utf-8 우선, 실패 시 cp949)
    try:
        obj = json.loads(fp.read_text(encoding="utf-8"))
    except Exception:
        obj = json.loads(fp.read_text(encoding="cp949"))

    # data[].attributes[].name 수집
    names = []
    for seg in obj.get("data", []):
        for attr in seg.get("attributes", []):
            name = attr.get("name")
            if isinstance(name, str) and name.strip():
                names.append(name.strip())

    if not names:
        continue

    # 중복 제거(순서 유지)
    uniq = []
    for n in names:
        if n not in uniq:
            uniq.append(n)

    out.setdefault(label, " ".join(uniq))

# 저장
Path("current").mkdir(parents=True, exist_ok=True)
save_path = Path("current") / "label_to_text.json"
save_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

print("saved:", save_path)
print("count:", len(out))
