#!/usr/bin/env python3
"""
PDF 课件文本提取器 — 从 PDF 中提取每页文字（按 slide 分隔）。

环境要求:
  - Python: /usr/bin/python3 (macOS 系统 Python 3.9.6)
  - 依赖:  PyMuPDF (pip install pymupdf)

用法:
  # 从 URL 下载 PDF 并提取文本
  /usr/bin/python3 scripts/extract_pdf_text.py --url "https://example.com/slides.pdf" --output slides_text/MySlides.txt

  # 从本地 PDF 提取文本
  /usr/bin/python3 scripts/extract_pdf_text.py --pdf raw_pdf/BasicML.pdf --output slides_text/BasicML.txt

  # 批量处理（JSON 文件）
  /usr/bin/python3 scripts/extract_pdf_text.py --batch tasks.json

  # tasks.json 格式:
  # [
  #   {"url": "https://example.com/a.pdf", "pdf_name": "a.pdf", "output": "slides_A.txt"},
  #   {"pdf": "raw_pdf/b.pdf", "output": "slides_B.txt"}
  # ]

输出格式:
  每页用 "--- Slide N ---" 分隔：

  --- Slide 1 ---
  请各位同学稍待片刻
  我们 14:23 开始上课

  --- Slide 2 ---
  一堂课搞懂
  机器学习和深度学习

已知问题:
  - 纯图片 PDF（扫描件）提取不出文字，需 OCR
  - 数学公式可能只提取到部分字符（如 𝑤, 𝑥 等 Unicode 数学符号）
  - 李宏毅的课件是文字版 PDF，提取效果很好

验证记录:
  2026-04-09: 成功提取 inference.pdf (Flash Attention + KV Cache) 和 pos.pdf (Positional Embedding)
"""
import os
import sys
import json
import urllib.request

# PyMuPDF
import fitz

def get_dirs():
    """获取 PDF 和文本目录"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)  # lee-hongyi/
    return {
        "raw_pdf": os.path.join(base_dir, "raw_pdf"),
        "slides_text": os.path.join(base_dir, "slides_text"),
    }

def download_pdf(url, output_path):
    """下载 PDF（幂等：已存在则跳过）"""
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

def extract_text(pdf_path, output_path):
    """
    从 PDF 提取文字，按 slide 分隔输出。

    Args:
        pdf_path: PDF 文件路径
        output_path: 输出文本文件路径

    Returns:
        bool: 提取是否成功
    """
    # 幂等
    if os.path.exists(output_path):
        size = os.path.getsize(output_path)
        if size > 100:
            print(f"  ⏭️  Text exists ({size//1024}KB): {os.path.basename(output_path)}")
            return True

    if not os.path.exists(pdf_path):
        print(f"  ❌ PDF not found: {pdf_path}")
        return False

    print(f"  📝 Extracting text from: {os.path.basename(pdf_path)}")
    doc = fitz.open(pdf_path)
    texts = []
    for page_num, page in enumerate(doc, 1):
        text = page.get_text().strip()
        if text:
            texts.append(f"--- Slide {page_num} ---\n{text}")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        f.write("\n\n".join(texts))

    print(f"  ✅ Extracted {len(texts)} slides → {output_path}")
    return True


def main():
    dirs = get_dirs()
    os.makedirs(dirs["raw_pdf"], exist_ok=True)
    os.makedirs(dirs["slides_text"], exist_ok=True)

    if len(sys.argv) < 2:
        print("用法:")
        print("  # 从 URL 下载并提取")
        print("  /usr/bin/python3 scripts/extract_pdf_text.py --url URL --output slides_text/Name.txt")
        print()
        print("  # 从本地 PDF 提取")
        print("  /usr/bin/python3 scripts/extract_pdf_text.py --pdf raw_pdf/Name.pdf --output slides_text/Name.txt")
        print()
        print("  # 批量处理")
        print("  /usr/bin/python3 scripts/extract_pdf_text.py --batch tasks.json")
        sys.exit(1)

    # 模式 1: --batch
    if sys.argv[1] == "--batch":
        with open(sys.argv[2]) as f:
            tasks = json.load(f)
        for task in tasks:
            output_path = os.path.join(dirs["slides_text"], task["output"])
            if "url" in task:
                pdf_name = task.get("pdf_name", os.path.basename(task["url"]))
                pdf_path = os.path.join(dirs["raw_pdf"], pdf_name)
                download_pdf(task["url"], pdf_path)
                extract_text(pdf_path, output_path)
            elif "pdf" in task:
                pdf_path = os.path.join(dirs["raw_pdf"], task["pdf"]) if not os.path.isabs(task["pdf"]) else task["pdf"]
                extract_text(pdf_path, output_path)

    # 模式 2: --url URL --output OUTPUT
    elif sys.argv[1] == "--url":
        url = sys.argv[2]
        output_name = sys.argv[4] if len(sys.argv) > 4 else os.path.basename(url).replace(".pdf", ".txt")
        output_path = os.path.join(dirs["slides_text"], output_name)
        pdf_name = os.path.basename(url)
        pdf_path = os.path.join(dirs["raw_pdf"], pdf_name)
        download_pdf(url, pdf_path)
        extract_text(pdf_path, output_path)

    # 模式 3: --pdf LOCAL_PDF --output OUTPUT
    elif sys.argv[1] == "--pdf":
        pdf_path = sys.argv[2]
        output_name = sys.argv[4] if len(sys.argv) > 4 else os.path.basename(pdf_path).replace(".pdf", ".txt")
        output_path = os.path.join(dirs["slides_text"], output_name)
        extract_text(pdf_path, output_path)

    print("\n✅ PDF processing complete")


if __name__ == "__main__":
    main()
