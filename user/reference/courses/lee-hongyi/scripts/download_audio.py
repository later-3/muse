#!/usr/bin/env python3
"""
YouTube 音频下载器 — 从 YouTube 视频中提取纯音频流。

环境要求:
  - Python: /usr/bin/python3 (macOS 系统 Python 3.9.6)
  - 依赖:  pytubefix (pip install pytubefix)
  - 注意:  不要用 conda/venv 的 python，用系统 /usr/bin/python3

用法:
  # 下载单个视频
  /usr/bin/python3 scripts/download_audio.py "https://youtu.be/VIDEO_ID" my_prefix

  # 下载多个视频（用 JSON 文件）
  /usr/bin/python3 scripts/download_audio.py --batch tasks.json

  # tasks.json 格式:
  # [
  #   {"url": "https://youtu.be/xxx", "prefix": "LH25F_01_genai_intro"},
  #   {"url": "https://youtu.be/yyy", "prefix": "LH25F_03_llm_understand"}
  # ]

输出:
  raw_audio/<prefix>.mp4  — 音频文件（实际是 m4a 容器）

已知问题:
  - YouTube 可能限速或临时屏蔽，重试通常能解决
  - 某些视频可能没有纯音频流，脚本会自动 fallback 到最低画质视频流
  - pytubefix 版本不同可能有 API 变化，当前验证版本: 10.3.8

验证记录:
  2026-04-08: 成功下载 8 个李宏毅视频音频 (~591MB, 8.6h)
"""
from pytubefix import YouTube
import os
import sys
import json
import time

def get_output_dir():
    """获取输出目录 — 相对于脚本所在的 lee-hongyi/ 目录"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)  # lee-hongyi/
    raw_audio_dir = os.path.join(base_dir, "raw_audio")
    os.makedirs(raw_audio_dir, exist_ok=True)
    return raw_audio_dir

def download_one(url, prefix, output_dir):
    """
    下载单个 YouTube 视频的音频流。

    Args:
        url: YouTube 视频 URL（支持 youtu.be/ 和 youtube.com/watch?v= 两种格式）
        prefix: 输出文件名前缀，如 "LH25F_05_basic_ml"
        output_dir: 输出目录

    Returns:
        bool: 下载是否成功
    """
    out_path = os.path.join(output_dir, f"{prefix}.mp4")

    # 幂等：如果文件已存在且有效（>1MB），跳过
    if os.path.exists(out_path):
        size_mb = os.path.getsize(out_path) / 1024 / 1024
        if size_mb > 1:
            print(f"⏭️  Skip (exists, {size_mb:.1f}MB): {prefix}")
            return True

    try:
        print(f"\n{'='*60}")
        print(f"📥 Downloading: {prefix}")
        print(f"    URL: {url}")

        yt = YouTube(url)
        print(f"    Title: {yt.title}")
        print(f"    Duration: {yt.length}s ({yt.length//60}:{yt.length%60:02d})")

        # 策略：优先选纯音频流（按码率降序），fallback 到最低画质视频
        stream = yt.streams.filter(only_audio=True).order_by('abr').desc().first()
        if not stream:
            print("    ⚠️  No audio-only stream, falling back to lowest video")
            stream = yt.streams.filter(progressive=True).order_by('resolution').asc().first()

        if not stream:
            print(f"❌ No downloadable stream found for: {prefix}")
            return False

        print(f"    Stream: {stream}")

        start = time.time()
        filepath = stream.download(output_path=output_dir, filename=f"{prefix}.mp4")
        elapsed = time.time() - start

        size_mb = os.path.getsize(filepath) / 1024 / 1024
        print(f"✅ Saved: {filepath} ({size_mb:.1f}MB, {elapsed:.1f}s)")
        return True

    except Exception as e:
        print(f"❌ Failed: {prefix} — {e}")
        return False


def main():
    output_dir = get_output_dir()

    if len(sys.argv) < 2:
        print("用法:")
        print("  /usr/bin/python3 scripts/download_audio.py URL PREFIX")
        print("  /usr/bin/python3 scripts/download_audio.py --batch tasks.json")
        sys.exit(1)

    # 模式 1: --batch JSON 文件
    if sys.argv[1] == "--batch":
        if len(sys.argv) < 3:
            print("❌ 需要指定 JSON 文件路径")
            sys.exit(1)
        with open(sys.argv[2]) as f:
            tasks = json.load(f)
        # 支持 [{"url": ..., "prefix": ...}] 格式
        task_list = [(t["url"], t["prefix"]) for t in tasks]

    # 模式 2: 直接传 URL + PREFIX
    elif len(sys.argv) >= 3:
        task_list = [(sys.argv[1], sys.argv[2])]

    else:
        print("❌ 参数不足。用法: download_audio.py URL PREFIX")
        sys.exit(1)

    print(f"📋 Downloading {len(task_list)} audio files to {output_dir}")
    results = []
    for url, prefix in task_list:
        ok = download_one(url, prefix, output_dir)
        results.append((prefix, ok))

    # 汇总
    print(f"\n{'='*60}")
    print(f"📊 Download Summary")
    print(f"{'='*60}")
    for prefix, ok in results:
        status = "✅" if ok else "❌"
        print(f"  {status} {prefix}")

    failed = [p for p, ok in results if not ok]
    if failed:
        print(f"\n⚠️  {len(failed)} failed. Re-run with same args to retry (idempotent).")
        sys.exit(1)


if __name__ == "__main__":
    main()
