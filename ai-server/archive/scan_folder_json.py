import sys, json
from pathlib import Path

folder = Path(sys.argv[1])
json_files = sorted(folder.glob("*_keypoints.json"))

print("folder:", folder)
print("json files:", len(json_files))

for i, fp in enumerate(json_files, 1):
    try:
        json.loads(fp.read_text(encoding="utf-8"))
    except Exception as e:
        print("\n[❌ BAD FILE]", fp)
        print("[ERROR]", repr(e))
        sys.exit(1)

    if i % 200 == 0:
        print("checked:", i)

print("✅ all good")
