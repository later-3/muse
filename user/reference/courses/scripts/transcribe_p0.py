#!/usr/bin/env python3
import whisper
import json
import os
import time
from pytubefix import YouTube

P0_ITEMS = [
    {"prefix": "LH25F_05_basic_ml", "url": "https://youtu.be/Taj1eHmZyWw", "slides_text": "BasicML.txt"},
    {"prefix": "LH25F_01_genai_intro", "url": "https://youtu.be/TigfpYPJk1s", "slides_text": "LLM_GenAI_Intro.txt"},
    {"prefix": "LH25F_03_llm_understand", "url": "https://youtu.be/8iFvM7WUUs8", "slides_text": "LLMunderstand.txt"},
    {"prefix": "LH25_04_pretrain_alignment", "url": "https://youtu.be/Ozos6M1JtIE", "slides_text": "Pretrain_Alignment.txt"},
    {"prefix": "LH25F_07_llm_training", "url": "https://youtu.be/YJoegm7kiUM", "slides_text": "LLMtraining.txt"},
    {"prefix": "LH26_03_flash_attention", "url": "https://youtu.be/vXb2QYOUzl4"},
    {"prefix": "LH26_04_kv_cache", "url": "https://youtu.be/fDQaadKysSA"},
    {"prefix": "LH26_05_positional_embedding", "url": "https://youtu.be/Ll-wk8x3G_g"},
]

BASE_DIR = "user/reference/courses/lee-hongyi"
model = None

def download_audio(url, prefix):
    output_dir = f"{BASE_DIR}/raw_audio"
    audio_path = f"{output_dir}/{prefix}.mp4"
    
    if os.path.exists(audio_path):
        print(f"  [SKIP] Audio exists")
        return audio_path
    
    os.makedirs(output_dir, exist_ok=True)
    yt = YouTube(url)
    print(f"  [DOWNLOAD] {yt.title} ({yt.length//60}min)")
    stream = yt.streams.filter(only_audio=True).order_by("abr").desc().first()
    return stream.download(output_path=output_dir, filename=f"{prefix}.mp4")

def transcribe(audio_path, prefix):
    global model
    
    output_dir = f"{BASE_DIR}/transcripts"
    transcript_path = f"{output_dir}/{prefix}_transcript.txt"
    segments_path = f"{output_dir}/{prefix}_segments.json"
    
    if os.path.exists(transcript_path) and os.path.exists(segments_path):
        print(f"  [SKIP] Transcript exists")
        return
    
    os.makedirs(output_dir, exist_ok=True)
    
    if model is None:
        print(f"  [LOAD] Whisper medium...")
        model = whisper.load_model("medium")
    
    print(f"  [TRANSCRIBE] Starting...")
    start = time.time()
    result = model.transcribe(audio_path, language="zh", verbose=False)
    print(f"  [TRANSCRIBE] Done in {(time.time()-start):.1f}s")
    
    with open(transcript_path, "w") as f:
        f.write(result["text"])
    
    segments = [{"start": round(s["start"], 1), "end": round(s["end"], 1), "text": s["text"].strip()} for s in result["segments"]]
    with open(segments_path, "w") as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)
    
    print(f"  [SAVED] {len(segments)} segments")

def main():
    print(f"\n{'='*50}")
    print(f"P0 课程处理 - {time.strftime('%H:%M:%S')}")
    print(f"{'='*50}\n")
    
    for i, item in enumerate(P0_ITEMS, 1):
        print(f"[{i}/{len(P0_ITEMS)}] {item['prefix']}")
        audio = download_audio(item["url"], item["prefix"])
        transcribe(audio, item["prefix"])
        print()
    
    print(f"{'='*50}")
    print(f"DONE - {time.strftime('%H:%M:%S')}")

if __name__ == "__main__":
    main()