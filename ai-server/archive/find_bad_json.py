from pathlib import Path
import json

ROOT = Path(r"D:\puh\aihub_word_keypoint\09_real_word_keypoint\keypoint\17")

checked_folders = 0

for folder in sorted([p for p in ROOT.iterdir() if p.is_dir()]):
    json_files = sorted(folder.glob("*_keypoints.json"))
    if not json_files:
        continue

    # 폴더당 5개만 먼저 검사 (빠름)
    sample = json_files[:5]

    try:
        for fp in sample:
            json.loads(fp.read_text(encoding="utf-8"))
    except Exception as e:
        print("\n[❌ BAD FOLDER]", folder)
        print("[❌ BAD FILE]  ", fp)
        print("[ERROR]       ", repr(e))
        break

    checked_folders += 1
    if checked_folders % 200 == 0:
        print("checked folders:", checked_folders)

print("DONE. checked folders:", checked_folders)
