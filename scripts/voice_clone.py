"""Đọc nhiều câu bằng giọng nhân bản (nạp model MỘT lần cho cả video) — dùng bởi scripts/aff_voice.mjs.

usage: <python của repo giọng> voice_clone.py <repo_dir> <jobs.json>
jobs.json: [{"text": "...", "out": "/abs/01.wav"}, ...]   (chữ đã chuẩn hoá số → chữ ở phía Node)
Hỗ trợ repo kiểu NGUYEN-TAT-KIEM-VOICE (lớp Giong trong giong.py, có .doc(text) → bytes WAV).
In "@@ <0..1> câu i/n" để báo tiến độ.
"""
import json
import os
import sys

repo, jobs_file = sys.argv[1], sys.argv[2]
sys.path.insert(0, repo)
os.chdir(repo)
from giong import Giong  # noqa: E402

jobs = json.load(open(jobs_file, encoding="utf-8"))
g = Giong()
for i, j in enumerate(jobs):
    with open(j["out"], "wb") as f:
        f.write(g.doc(j["text"]))
    print(f"@@ {(i + 1) / len(jobs):.3f} câu {i + 1}/{len(jobs)}", flush=True)
