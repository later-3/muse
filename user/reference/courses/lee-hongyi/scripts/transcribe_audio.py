#!/usr/bin/env python3
"""
Whisper 音频转写器 — 将音频文件转写为中文文本 + 带时间戳的分段。

环境要求:
  - Python: /usr/bin/python3 (macOS 系统 Python 3.9.6)
  - 依赖:  openai-whisper (pip install openai-whisper)
  - ffmpeg: 必须在 PATH 中（脚本会自动检查 muse/data/ffmpeg）
  - 硬件:  CPU 可跑，M4 Pro 上 medium 模型约 10:1 压缩比
           （10 分钟音频 ≈ 1 分钟转写）

用法:
  # 转写单个文件
  /usr/bin/python3 scripts/transcribe_audio.py LH25F_05_basic_ml

  # 转写多个文件
  /usr/bin/python3 scripts/transcribe_audio.py LH25F_01_genai_intro LH25F_03_llm_understand

  # 脚本会自动在 raw_audio/ 下查找对应的 .m4a/.mp4/.webm 文件

输出:
  transcripts/<prefix>_transcript.txt   — 纯文本（一整段连续文字）
  transcripts/<prefix>_segments.json    — 带时间戳分段，格式:
    [{"start": 0.0, "end": 5.2, "text": "好那我们就开始上课吧"}, ...]

模型选择:
  - tiny:   最快，质量差，仅用于测试
  - base:   快，质量一般
  - small:  中等速度，质量不错
  - medium: 推荐 ← 当前默认，中文质量最佳性价比
  - large:  最慢，质量最好（通常 medium 已经够用）

已知问题:
  - 中文转写偶尔会出现繁简混用（Whisper 特性，不影响理解）
  - 专业术语（如 "Transformer", "Attention"）可能被转成同音中文
  - segments.json 中的时间戳精度约 ±0.5s

验证记录:
  2026-04-08/09: 成功转写 8 个李宏毅视频 (~8.6h)，总耗时 91.4min (CPU)
"""
import whisper
import json
import os
import sys
import time

def get_dirs():
    """获取音频和转写目录 — 相对于脚本所在的 lee-hongyi/ 目录"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)  # lee-hongyi/
    return {
        "raw_audio": os.path.join(base_dir, "raw_audio"),
        "transcripts": os.path.join(base_dir, "transcripts"),
        # ffmpeg 在 muse/data/ 下 (lee-hongyi → courses → reference → user → muse)
        "muse_data": os.path.join(base_dir, "..", "..", "..", "..", "data"),
    }

def setup_ffmpeg(dirs):
    """确保 ffmpeg 在 PATH 中（Whisper 依赖 ffmpeg 读取音频）"""
    muse_data = os.path.abspath(dirs["muse_data"])
    ffmpeg_path = os.path.join(muse_data, "ffmpeg")
    if os.path.exists(ffmpeg_path):
        os.environ["PATH"] = muse_data + ":" + os.environ["PATH"]
        print(f"  ffmpeg: {ffmpeg_path}")
    else:
        # 尝试系统 ffmpeg
        import shutil
        sys_ffmpeg = shutil.which("ffmpeg")
        if sys_ffmpeg:
            print(f"  ffmpeg: {sys_ffmpeg} (system)")
        else:
            print("❌ ffmpeg not found! Whisper needs ffmpeg to read audio files.")
            print("   Install: brew install ffmpeg")
            print("   Or place ffmpeg binary in muse/data/")
            sys.exit(1)

def find_audio(prefix, audio_dir):
    """查找音频文件，支持 .m4a / .mp4 / .webm 扩展名"""
    for ext in [".m4a", ".mp4", ".webm"]:
        path = os.path.join(audio_dir, f"{prefix}{ext}")
        if os.path.exists(path):
            return path
    return None

def transcribe_one(model, audio_path, prefix, transcripts_dir, language="zh"):
    """
    转写单个音频文件。

    Args:
        model: 已加载的 Whisper 模型对象
        audio_path: 音频文件路径
        prefix: 输出文件名前缀
        transcripts_dir: 转写输出目录
        language: 语言代码（"zh" = 中文，"en" = 英文）

    Returns:
        bool: 转写是否成功
    """
    transcript_path = os.path.join(transcripts_dir, f"{prefix}_transcript.txt")
    segments_path = os.path.join(transcripts_dir, f"{prefix}_segments.json")

    # 幂等：如果已有有效转写，跳过
    if os.path.exists(transcript_path) and os.path.exists(segments_path):
        size = os.path.getsize(transcript_path)
        if size > 100:  # 非空文件
            print(f"⏭️  Skip (exists, {size} bytes): {prefix}")
            return True

    file_size = os.path.getsize(audio_path) / 1024 / 1024
    print(f"\n{'='*60}")
    print(f"🎙️  Transcribing: {prefix}")
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
    print(f"✅ Done: {prefix}")
    print(f"   Characters: {len(text)}")
    print(f"   Segments: {len(segments)}")
    print(f"   Audio duration: {duration_min:.1f} min")
    print(f"   Transcribe time: {elapsed:.1f}s ({elapsed/60:.1f} min)")
    print(f"   Ratio: {duration_min*60/elapsed:.1f}:1 (audio:compute)")
    return True


def main():
    dirs = get_dirs()
    os.makedirs(dirs["transcripts"], exist_ok=True)

    if len(sys.argv) < 2:
        print("用法:")
        print("  /usr/bin/python3 scripts/transcribe_audio.py PREFIX [PREFIX2 ...]")
        print()
        print("示例:")
        print("  /usr/bin/python3 scripts/transcribe_audio.py LH25F_05_basic_ml")
        print("  /usr/bin/python3 scripts/transcribe_audio.py LH25F_01_genai_intro LH25F_03_llm_understand")
        print()
        print("脚本会在 raw_audio/ 下查找对应的音频文件。")
        sys.exit(1)

    prefixes = sys.argv[1:]

    # 检查 ffmpeg
    print("🔍 Checking environment...")
    setup_ffmpeg(dirs)

    # 查找音频文件
    tasks = []
    for prefix in prefixes:
        audio_path = find_audio(prefix, dirs["raw_audio"])
        if audio_path:
            tasks.append((audio_path, prefix))
        else:
            print(f"⚠️  No audio found for: {prefix} (checked .m4a/.mp4/.webm in {dirs['raw_audio']})")

    if not tasks:
        print("No tasks to process. Exiting.")
        sys.exit(0)

    # 加载模型（只加载一次，很耗时）
    print(f"\n📦 Loading whisper medium model...")
    load_start = time.time()
    model = whisper.load_model("medium")
    print(f"   Model loaded in {time.time()-load_start:.1f}s")

    # 逐个转写
    total_start = time.time()
    results = []
    for audio_path, prefix in tasks:
        ok = transcribe_one(model, audio_path, prefix, dirs["transcripts"])
        results.append((prefix, ok))

    # 汇总
    print(f"\n{'='*60}")
    print(f"📊 Batch Summary")
    print(f"{'='*60}")
    for prefix, ok in results:
        status = "✅" if ok else "❌"
        print(f"  {status} {prefix}")
    print(f"\nTotal time: {(time.time()-total_start)/60:.1f} min")


if __name__ == "__main__":
    main()
