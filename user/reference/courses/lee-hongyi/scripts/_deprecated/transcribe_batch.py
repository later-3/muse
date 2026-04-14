#!/usr/bin/env python3
"""
批量转写脚本 — 按 P0 优先级处理李宏毅视频
使用 /usr/bin/python3 运行（系统 Python，已装 whisper）
"""
import whisper
import json
import os
import sys
import time

# === 配置 ===
BASE = "/Users/xulater/Code/assistant-agent/muse/user/reference/courses/lee-hongyi"
TRANSCRIPTS_DIR = f"{BASE}/transcripts"
RAW_AUDIO_DIR = f"{BASE}/raw_audio"

# 确保 ffmpeg 在 PATH
os.environ["PATH"] = "/Users/xulater/Code/assistant-agent/muse/data:" + os.environ["PATH"]

def transcribe_one(audio_path, output_prefix, language="zh"):
    """转写单个音频文件，输出 transcript.txt + segments.json"""
    transcript_path = f"{TRANSCRIPTS_DIR}/{output_prefix}_transcript.txt"
    segments_path = f"{TRANSCRIPTS_DIR}/{output_prefix}_segments.json"
    
    # 跳过已完成的
    if os.path.exists(transcript_path) and os.path.exists(segments_path):
        size = os.path.getsize(transcript_path)
        if size > 100:  # 非空文件
            print(f"⏭️  Skip (exists, {size} bytes): {output_prefix}")
            return True
    
    if not os.path.exists(audio_path):
        print(f"❌ Audio not found: {audio_path}")
        return False
    
    file_size = os.path.getsize(audio_path) / 1024 / 1024
    print(f"\n{'='*60}")
    print(f"🎙️  Transcribing: {output_prefix}")
    print(f"    Audio: {audio_path} ({file_size:.1f}MB)")
    print(f"    Language: {language}")
    print(f"{'='*60}")
    
    start = time.time()
    result = model.transcribe(audio_path, language=language, verbose=False)
    elapsed = time.time() - start
    
    # 保存全文
    text = result["text"]
    with open(transcript_path, "w") as f:
        f.write(text)
    
    # 保存带时间戳的分段
    segments = [{
        "start": round(seg["start"], 1),
        "end": round(seg["end"], 1),
        "text": seg["text"].strip(),
    } for seg in result["segments"]]
    with open(segments_path, "w") as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)
    
    duration_min = segments[-1]["end"] / 60 if segments else 0
    print(f"✅ Done: {output_prefix}")
    print(f"   Characters: {len(text)}")
    print(f"   Segments: {len(segments)}")
    print(f"   Audio duration: {duration_min:.1f} min")
    print(f"   Transcribe time: {elapsed:.1f}s ({elapsed/60:.1f} min)")
    return True


# === 要处理的队列 ===
# 只处理命令行指定的 prefix，或默认处理当前需要的
if len(sys.argv) > 1:
    targets = sys.argv[1:]
else:
    # 默认：LH25F_01 (音频已下载)
    targets = ["LH25F_01_genai_intro"]

# 查找每个 target 的音频文件
tasks = []
for prefix in targets:
    # 尝试多种扩展名
    for ext in [".m4a", ".mp4", ".webm"]:
        path = f"{RAW_AUDIO_DIR}/{prefix}{ext}"
        if os.path.exists(path):
            tasks.append((path, prefix))
            break
    else:
        print(f"⚠️  No audio found for: {prefix}")

if not tasks:
    print("No tasks to process. Exiting.")
    sys.exit(0)

# 加载模型（只加载一次）
print(f"\n📦 Loading whisper medium model...")
load_start = time.time()
model = whisper.load_model("medium")
print(f"   Model loaded in {time.time()-load_start:.1f}s")

# 逐个转写
total_start = time.time()
results = []
for audio_path, prefix in tasks:
    ok = transcribe_one(audio_path, prefix)
    results.append((prefix, ok))

# 汇总
print(f"\n{'='*60}")
print(f"📊 Batch Summary")
print(f"{'='*60}")
for prefix, ok in results:
    status = "✅" if ok else "❌"
    print(f"  {status} {prefix}")
print(f"\nTotal time: {(time.time()-total_start)/60:.1f} min")
