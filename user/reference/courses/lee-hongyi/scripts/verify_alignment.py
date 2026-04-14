#!/usr/bin/env python3
"""验证所有课程条目的产物是否齐全且对应。"""
import os, json

base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

items = [
    ("LH26_01_openclaw_agent", "A1", "解剖小龙虾 Agent"),
    ("LH26_02_context_engineering", "A1", "Context Engineering"),
    ("LH25_01_ai_agent", "A1", "AI Agent 原理"),
    ("LH25F_02_context_agent", "A1", "CE+Agent+Reasoning"),
    ("LH25_07_reasoning", "A1", "Reasoning"),
    ("LH25_08_reason_eval", "A1", "Reasoning 评估"),
    ("LH25_09_reason_shorter", "A1", "Reasoning 缩短"),
    ("LH25_06_post_training", "A1", "Post-training"),
    ("LH25_05_multi_gpu_training", "A2", "多GPU训练"),
    ("LH25F_06_training_tips", "A1", "训练诀窍"),
    ("LH25_02_model_inside", "A1", "Model Inside"),
    ("LH25_03_mamba", "A1", "Mamba"),
    ("LH25_10_model_editing", "A1", "Model Editing"),
    ("LH25_11_model_merging", "B1", "Model Merging"),
    ("LH25F_04_evaluation", "A1", "评估的坑"),
    ("LH25F_08_lifelong_learning", "A1", "终身学习"),
    ("LH26_02b_agent_interaction", "A2", "Agent互动"),
    ("LH26_02c_agent_work_impact", "A2", "Agent工作冲击"),
    ("LH25_12_speech_llm", "A1", "Speech LLM"),
    ("LH25F_09_generation", "A1", "生成策略"),
    # LH21 — ML 2021 Spring (Self-Attention & Transformer 手推版)
    ("LH21_self_attention_1", "A1", "Self-Attn 上"),
    ("LH21_self_attention_2", "A1", "Self-Attn 下"),
    ("LH21_transformer_1", "A1", "Transformer 上"),
    ("LH21_transformer_2", "A1", "Transformer 下"),
]

# LH21 共享 PDF 的 slides_text 映射
slides_override = {
    "LH21_self_attention_1": "LH21_self_attention.txt",
    "LH21_self_attention_2": "LH21_self_attention.txt",
    "LH21_transformer_1": "LH21_transformer.txt",
    "LH21_transformer_2": "LH21_transformer.txt",
}

header = f"{'#':>2} {'prefix':<35} {'title':<15} {'audio':>8} {'trans':>10} {'segs':>8} {'slides':>8}"
print(header)
print("-" * 95)

ok_count = 0
for i, (prefix, mode, title) in enumerate(items, 1):
    # audio
    audio_size = 0
    for ext in [".mp4", ".m4a", ".webm"]:
        p = os.path.join(base, "raw_audio", prefix + ext)
        if os.path.exists(p):
            audio_size = os.path.getsize(p) / 1024 / 1024
            break
    if mode == "B1":
        a = "—"
    elif audio_size > 0.1:
        a = f"{audio_size:.0f}MB"
    else:
        a = "0B!"

    # transcript
    tp = os.path.join(base, "transcripts", f"{prefix}_transcript.txt")
    t_chars = os.path.getsize(tp) if os.path.exists(tp) else 0
    if mode == "B1":
        t = "—"
    elif t_chars > 100:
        t = f"{t_chars // 1024}KB"
    else:
        t = "waiting"

    # segments
    sp = os.path.join(base, "transcripts", f"{prefix}_segments.json")
    s_count = 0
    if os.path.exists(sp) and os.path.getsize(sp) > 10:
        with open(sp) as f:
            s_count = len(json.load(f))
    if mode == "B1":
        s = "—"
    elif s_count > 0:
        s = str(s_count)
    else:
        s = "waiting"

    # slides_text (支持 LH21 共享 PDF 的情况)
    sl_name = slides_override.get(prefix, f"{prefix}.txt")
    sl = os.path.join(base, "slides_text", sl_name)
    sl_size = os.path.getsize(sl) if os.path.exists(sl) else 0
    if mode == "A2":
        sl_str = "—"
    elif sl_size > 100:
        sl_str = f"{sl_size // 1024}KB"
    else:
        sl_str = "missing"

    # completeness
    all_ok = True
    if mode in ("A1", "A2") and audio_size < 1:
        all_ok = False
    if mode in ("A1", "A2") and t_chars < 100:
        all_ok = False
    if mode == "A1" and sl_size < 100:
        all_ok = False
    if all_ok:
        ok_count += 1

    status = "✅" if all_ok else "⚠️"
    print(f"{i:>2} {prefix:<35} {title:<15} {a:>8} {t:>10} {s:>8} {sl_str:>8} {status}")

print("-" * 95)
print(f"完整闭环: {ok_count}/{len(items)}")
