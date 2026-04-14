#!/usr/bin/env python3
"""
下载 PDF 课件并提取文本 — LH26 P0 条目
使用 /usr/bin/python3 运行
"""
import os
import sys
import urllib.request

# PyMuPDF
import fitz

BASE = "/Users/xulater/Code/assistant-agent/muse/user/reference/courses/lee-hongyi"
RAW_PDF_DIR = f"{BASE}/raw_pdf"
SLIDES_TEXT_DIR = f"{BASE}/slides_text"

os.makedirs(RAW_PDF_DIR, exist_ok=True)
os.makedirs(SLIDES_TEXT_DIR, exist_ok=True)

# LH26 的 PDF URL（来自 lee-hongyi/README.md）
# Flash Attention + KV Cache 共享同一个 PDF
# Positional Embedding 有自己的 PDF
TASKS = [
    {
        "prefix": "LH26_03_flash_attention",
        "pdf_url": "https://speech.ee.ntu.edu.tw/~hylee/ml/ml2026-course-data/inference.pdf",
        "slides_text_name": "LH26_inference.txt",  # Flash Attention + KV Cache 共享
    },
    {
        "prefix": "LH26_04_kv_cache",
        "pdf_url": "https://speech.ee.ntu.edu.tw/~hylee/ml/ml2026-course-data/inference.pdf",
        "slides_text_name": "LH26_inference.txt",  # 共享同一个 PDF
    },
    {
        "prefix": "LH26_05_positional_embedding",
        "pdf_url": "https://speech.ee.ntu.edu.tw/~hylee/ml/ml2026-course-data/pos.pdf",
        "slides_text_name": "LH26_positional_embedding.txt",
    },
]

def download_pdf(url, output_path):
    """下载 PDF"""
    if os.path.exists(output_path):
        size = os.path.getsize(output_path)
        if size > 1000:
            print(f"  ⏭️  PDF exists ({size//1024}KB): {os.path.basename(output_path)}")
            return True
    
    print(f"  📥 Downloading PDF: {url}")
    try:
        urllib.request.urlretrieve(url, output_path)
        size = os.path.getsize(output_path) / 1024
        print(f"  ✅ Saved: {output_path} ({size:.0f}KB)")
        return True
    except Exception as e:
        print(f"  ❌ Failed: {e}")
        return False

def extract_pdf_text(pdf_path, output_path):
    """从 PDF 提取文字"""
    if os.path.exists(output_path):
        size = os.path.getsize(output_path)
        if size > 100:
            print(f"  ⏭️  Text exists ({size//1024}KB): {os.path.basename(output_path)}")
            return True
    
    print(f"  📝 Extracting text from: {os.path.basename(pdf_path)}")
    doc = fitz.open(pdf_path)
    texts = []
    for page_num, page in enumerate(doc, 1):
        text = page.get_text().strip()
        if text:
            texts.append(f"=== Slide {page_num} ===\n{text}")
    
    with open(output_path, "w") as f:
        f.write("\n\n".join(texts))
    
    print(f"  ✅ Extracted {len(texts)} slides → {output_path}")
    return True

# 执行
seen_pdfs = set()
for task in TASKS:
    prefix = task["prefix"]
    pdf_url = task["pdf_url"]
    pdf_name = os.path.basename(pdf_url)
    pdf_path = f"{RAW_PDF_DIR}/{pdf_name}"
    text_path = f"{SLIDES_TEXT_DIR}/{task['slides_text_name']}"
    
    print(f"\n{'='*50}")
    print(f"📋 {prefix}")
    print(f"{'='*50}")
    
    # 下载 PDF（相同 URL 只下载一次）
    if pdf_url not in seen_pdfs:
        download_pdf(pdf_url, pdf_path)
        seen_pdfs.add(pdf_url)
    else:
        print(f"  ⏭️  PDF already downloaded: {pdf_name}")
    
    # 提取文本（相同输出只提取一次）
    if not os.path.exists(text_path):
        extract_pdf_text(pdf_path, text_path)
    else:
        size = os.path.getsize(text_path)
        print(f"  ⏭️  Text exists ({size//1024}KB): {task['slides_text_name']}")

print("\n✅ PDF processing complete")
