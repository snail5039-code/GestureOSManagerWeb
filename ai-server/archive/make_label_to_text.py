import json                     # JSON 파일 읽고/쓰기 위해 필요
import re                       # 파일명에서 WORD00001 같은 패턴을 찾기 위해 필요
from pathlib import Path        # 윈도우 경로/파일 탐색을 편하게 해주는 도구

# ✅ 1) morpheme JSON들이 들어있는 "루트 폴더" 경로
# 여기 안에 17, 18 폴더가 있고, 그 안에 *_morpheme.json 파일들이 있음
ROOT = Path(r"D:\aihub_download\sign_103\004.수어영상\1.Training\라벨링데이터\REAL\WORD\01_real_word_morpheme\morpheme")

out = {}                        # ✅ 결과를 저장할 딕셔너리: label -> 한국어
# 예: out["WORD00001"] = "고민"
label_map = json.loads((Path("current") / "label_map.json").read_text(encoding="utf-8"))

# idx->label이면 values가 WORD..., label->idx이면 keys가 WORD...
if all(str(k).isdigit() for k in label_map.keys()):
    valid_labels = set(label_map.values())
else:
    valid_labels = set(label_map.keys())

# 자리수 통일(WORD0001/WORD00001 섞일 수 있으니)
valid_labels = set("WORD" + v[4:].zfill(5) for v in valid_labels)


# ✅ 2) 파일명에서 "WORD숫자" 형태를 뽑기 위한 정규식
# 예: "NIA_SL_WORD00001_REAL17_D_morpheme.json" 에서 "WORD00001"만 뽑음
pat = re.compile(r"(WORD\d{4,5})")

# ✅ 3) ROOT 아래(17,18 포함) 모든 *_morpheme.json 파일을 다 찾기
# rglob는 하위 폴더까지 전부 찾아줌
json_files = list(ROOT.rglob("*_morpheme.json"))
print("found:", len(json_files))  # 찾은 파일 개수 출력(확인용)

# ✅ 4) 파일을 하나씩 돌면서 label->한국어를 뽑아 out에 저장
for fp in json_files:            # fp는 파일 경로(Path 객체)
    # (1) 파일명에서 WORD00001 같은 라벨 찾기
    m = pat.search(fp.name)      # fp.name = 파일 이름만
    if not m:                    # WORD가 없으면 스킵
        continue
    label = m.group(1)           # group(1) = 괄호로 묶은 (WORD\d+) 부분
    label = "WORD" + label[4:].zfill(5)

    if label not in valid_labels:
        continue

    # (2) JSON 파일 읽기
    # 대부분 utf-8인데, 혹시 오류 나면 cp949로 한 번 더 시도
    try:
        obj = json.loads(fp.read_text(encoding="utf-8"))
    except Exception:
        obj = json.loads(fp.read_text(encoding="cp949"))

    # (3) ✅ 한국어 텍스트 추출
    # 너가 보여준 구조:
    # obj["data"] 안에 여러 구간이 있을 수 있고
    # 그 안에 "attributes" 배열이 있고
    # attributes 안에 {"name": "고민"} 같은 게 있음
    names = []                   # 발견한 name들을 모아두는 리스트

    for seg in obj.get("data", []):              # data가 없으면 빈 리스트로 처리
        for attr in seg.get("attributes", []):   # attributes도 없으면 빈 리스트
            name = attr.get("name")              # name 가져오기
            if isinstance(name, str) and name.strip():  # 문자열이고 비어있지 않으면
                names.append(name.strip())       # 양쪽 공백 제거하고 추가

    if not names:                # name이 하나도 없으면 스킵
        continue

    # (4) 중복 제거
    # 같은 단어가 여러 구간에 반복될 수 있어서 중복을 빼고 합쳐줌
    uniq = []
    for n in names:
        if n not in uniq:
            uniq.append(n)

    korean = " ".join(uniq)      # 중복 제거된 단어들을 공백으로 이어붙임
    # 예: ["고민"] -> "고민"
    # 예: ["학교", "가다"] -> "학교 가다"

    # (5) out에 저장
    # 같은 label이 여러 파일에서 나올 수 있는데, 일단 "처음 값"을 유지
    # (원하면 나중에 덮어쓰도록 바꿀 수도 있음)
    out.setdefault(label, korean)

# ✅ 5) 결과를 JSON 파일로 저장
# label_to_text.json 이라는 파일이 ROOT 폴더에 생성됨
save_path = Path("current") / "label_to_text.json"
save_path.write_text(
    json.dumps(out, ensure_ascii=False, indent=2),  # ensure_ascii=False => 한글 깨짐 방지
    encoding="utf-8"
)

print("saved:", save_path)      # 저장된 파일 경로 출력
print("count:", len(out))       # 최종 라벨 개수 출력
