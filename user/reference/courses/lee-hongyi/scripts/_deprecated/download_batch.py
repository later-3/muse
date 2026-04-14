#!/usr/bin/env python3
"""
批量下载 YouTube 音频 — P0 剩余条目
使用 /usr/bin/python3 运行（系统 Python，已装 pytubefix）
"""
from pytubefix import YouTube
import os
import sys
import time

RAW_AUDIO_DIR = "/Users/xulater/Code/assistant-agent/muse/user/reference/courses/lee-hongyi/raw_audio"
os.makedirs(RAW_AUDIO_DIR, exist_ok=True)

# P0 剩余条目 — YouTube URL → prefix
TASKS = [
    ("https://youtu.be/8iFvM7WUUs8", "LH25F_03_llm_understand"),
    ("https://youtu.be/YJoegm7kiUM", "LH25F_07_llm_training"),
    ("https://youtu.be/Ozos6M1JtIE", "LH25_04_pretrain_alignment"),
    ("https://youtu.be/vXb2QYOUzl4", "LH26_03_flash_attention"),
    ("https://youtu.be/fDQaadKysSA", "LH26_04_kv_cache"),
    ("https://youtu.be/Ll-wk8x3G_g", "LH26_05_positional_embedding"),
]

def download_one(url, prefix):
    """下载单个 YouTube 视频的音频流"""
    out_path = f"{RAW_AUDIO_DIR}/{prefix}.mp4"
    
    # 跳过已存在的
    if os.path.exists(out_path):
        size_mb = os.path.getsize(out_path) / 1024 / 1024
        if size_mb > 1:  # 大于 1MB 认为有效
            print(f"⏭️  Skip (exists, {size_mb:.1f}MB): {prefix}")
            return True
    
    try:
        print(f"\n{'='*60}")
        print(f"📥 Downloading: {prefix}")
        print(f"    URL: {url}")
        
        yt = YouTube(url)
        print(f"    Title: {yt.title}")
        print(f"    Duration: {yt.length}s ({yt.length//60}:{yt.length%60:02d})")
        
        # 优先选 audio-only 流，按码率降序
        stream = yt.streams.filter(only_audio=True).order_by('abr').desc().first()
        if not stream:
            stream = yt.streams.filter(progressive=True).order_by('resolution').asc().first()
        
        print(f"    Stream: {stream}")
        
        start = time.time()
        filepath = stream.download(output_path=RAW_AUDIO_DIR, filename=f"{prefix}.mp4")
        elapsed = time.time() - start
        
        size_mb = os.path.getsize(filepath) / 1024 / 1024
        print(f"✅ Saved: {filepath} ({size_mb:.1f}MB, {elapsed:.1f}s)")
        return True
        
    except Exception as e:
        print(f"❌ Failed: {prefix} — {e}")
        return False


# 执行
if len(sys.argv) > 1:
    # 指定哪些要下
    indices = [int(i) for i in sys.argv[1:]]
    tasks = [TASKS[i] for i in indices if i < len(TASKS)]
else:
    tasks = TASKS

print(f"📋 Downloading {len(tasks)} audio files...")
results = []
for url, prefix in tasks:
    ok = download_one(url, prefix)
    results.append((prefix, ok))

print(f"\n{'='*60}")
print(f"📊 Download Summary")
print(f"{'='*60}")
for prefix, ok in results:
    status = "✅" if ok else "❌"
    print(f"  {status} {prefix}")
