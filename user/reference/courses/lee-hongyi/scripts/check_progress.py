#!/usr/bin/env python3
"""
进度监控脚本 — 检查李宏毅剩余课程的处理状态。

用法:
  /usr/bin/python3 user/reference/courses/lee-hongyi/scripts/check_progress.py
"""
import os

base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
audio_dir = os.path.join(base, "raw_audio")
trans_dir = os.path.join(base, "transcripts")
slides_dir = os.path.join(base, "slides_text")
manifest_dir = os.path.join(base, "manifests")

items = [
    ("LH26_01_openclaw_agent", "A1"),
    ("LH26_02_context_engineering", "A1"),
    ("LH25_01_ai_agent", "A1"),
    ("LH25F_02_context_agent", "A1"),
    ("LH25_07_reasoning", "A1"),
    ("LH25_08_reason_eval", "A1"),
    ("LH25_09_reason_shorter", "A1"),
    ("LH25_06_post_training", "A1"),
    ("LH25_05_multi_gpu_training", "A2"),
    ("LH25F_06_training_tips", "A1"),
    ("LH25_02_model_inside", "A1"),
    ("LH25_03_mamba", "A1"),
    ("LH25_10_model_editing", "A1"),
    ("LH25_11_model_merging", "B1"),
    ("LH25F_04_evaluation", "A1"),
    ("LH25F_08_lifelong_learning", "A1"),
    ("LH26_02b_agent_interaction", "A2"),
    ("LH26_02c_agent_work_impact", "A2"),
    ("LH25_12_speech_llm", "A1"),
    ("LH25F_09_generation", "A1"),
    # LH21 — ML 2021 Spring (Self-Attention & Transformer 经典手推)
    ("LH21_self_attention_1", "A1"),
    ("LH21_self_attention_2", "A1"),
    ("LH21_transformer_1", "A1"),
    ("LH21_transformer_2", "A1"),
]

def has_file(directory, prefix, extensions):
    for ext in extensions:
        if os.path.exists(os.path.join(directory, prefix + ext)):
            return True
    return False

done = 0
total = len(items)
print(f"📊 李宏毅剩余课程进度 ({total} items)")
print("=" * 72)
print(f"{'#':>2}  {'prefix':<35} {'audio':>6} {'trans':>6} {'slides':>6} {'manif':>6}")
print("-" * 72)

for i, (prefix, mode) in enumerate(items, 1):
    if mode == "B1":
        a = "—"
        t = "—"
    else:
        a = "✅" if has_file(audio_dir, prefix, [".mp4", ".m4a", ".webm"]) else "⬜"
        t = "✅" if os.path.exists(os.path.join(trans_dir, f"{prefix}_transcript.txt")) else "⬜"

    if mode == "A2":
        s = "—"
    else:
        s = "✅" if has_file(slides_dir, prefix, [".txt"]) else "⬜"

    m = "✅" if os.path.exists(os.path.join(manifest_dir, f"{prefix}.md")) else "⬜"

    all_done = all(x in ("✅", "—") for x in [a, t, s, m])
    if all_done:
        done += 1

    print(f"{i:>2}  {prefix:<35} {a:>6} {t:>6} {s:>6} {m:>6}")

print("-" * 72)
print(f"完成: {done}/{total}  |  ✅=有  ⬜=缺  —=不需要")
