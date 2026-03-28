# F10: 小模型本地部署 — GGUF + llama.cpp + 3090 实操

> **一句话：** 从 GGUF 格式原理到 3090 真实部署，你跑的每个小模型的底层在这里。

---

## ⚡ 3 分钟速读版

```
一句话: GGUF 是量化模型的标准格式，llama.cpp 是最主流的本地推理引擎
3 个关键概念: 量化(Quantization) / GGUF格式 / KV-cache管理
对 Muse 最重要的: 本地小模型可以替代部分 API 调用(省钱+快+隐私)
面试必记: "量化是精度换效率的工程权衡，Q4_K_M 是性价比最优的量化档位"
```

---

## 🔬 核心原理（三栏表）

| 概念 | 能力来源 | 激活方式 | 类比（仅类比） |
|------|---------|---------|--------------|
| **量化** | 把 FP16 参数映射到低精度整数（INT4/INT8） | 量化算法（GPTQ/AWQ/GGML）处理模型文件 | 仅类比：像把 WAV 音频压成 MP3，主体保留但有损 |
| **GGUF** | llama.cpp 社区设计的开放格式（取代旧 GGML） | 下载 .gguf 文件 → llama.cpp/ollama 加载 | 仅类比：像 Docker 镜像之于容器 |
| **KV-cache** | Transformer 推理时缓存已计算的 Key/Value | 自动管理，影响最大上下文长度和显存 | 仅类比：像缓存已翻过的课本页，不用每次重读 |

---

## 1. 量化原理

### 1.1 为什么要量化？

```
原始模型 (FP16):
  参数: 每个 2 bytes
  27B 模型: 27 × 10^9 × 2 bytes = 54GB
  3090 显存: 24GB → ❌ 装不下

量化后 (INT4):
  参数: 每个 0.5 bytes
  27B 模型: 27 × 10^9 × 0.5 bytes ≈ 14GB
  3090 显存: 24GB → ✅ 装得下，还有余量给 KV-cache
```

### 1.2 量化怎么做的

```
FP16 参数: [-0.342, 0.156, -0.089, 0.501, ...]
             ↓ 找到 min/max
          min = -0.342, max = 0.501, range = 0.843
             ↓ 映射到 4-bit 整数 (0-15)
INT4 量化:  [0, 8, 4, 15, ...]
             + 存一个 scale factor = 0.843/15 = 0.0562
             + 存一个 zero point = -0.342

反量化（推理时）:
  INT4 值 × scale + zero_point ≈ 原始 FP16 值
  0 × 0.0562 + (-0.342) = -0.342  ✅ 完全匹配
  8 × 0.0562 + (-0.342) = 0.108   vs 原始 0.156  ← 有误差
```

### 1.3 量化档位对比

| 量化 | 精度 | 每参数字节 | 27B 模型大小 | 质量损失 | 推荐场景 |
|------|------|----------|-----------|---------|---------|
| FP16 | 16-bit | 2.0 | 54GB | 无 | 训练/基准测试 |
| Q8_0 | 8-bit | 1.0 | 27GB | 极小 | 有显存时优选 |
| **Q4_K_M** | **4-bit mixed** | **0.56** | **~16GB** | **小** | **⭐ 性价比最优** |
| Q4_K_S | 4-bit small | 0.52 | ~15GB | 小-中 | 显存紧张 |
| Q3_K_M | 3-bit | 0.42 | ~12GB | 中 | 极端显存限制 |
| Q2_K | 2-bit | 0.32 | ~9GB | 大 | 实验用，质量差 |

> [!IMPORTANT]
> **Q4_K_M 是你 3090 的最佳选择。** K = K-quants（分组量化，每组单独计算 scale），M = Mixed（重要层用更高精度）。这是社区公认的精度/效率最优平衡点。

---

## 2. GGUF 格式

### 2.1 为什么是 GGUF？

```
时间线:
  GGML (2023初) → 有缺陷(不标准/不灵活) → 2023.08 升级为 GGUF
  
GGUF 的优势:
  ✅ 自包含: 模型参数 + tokenizer + 元信息 全在一个文件里
  ✅ 版本化: 有 magic number 和版本号
  ✅ 扩展性: key-value 元数据，方便加新字段
  ✅ 生态: llama.cpp / ollama / LM Studio 都支持
```

### 2.2 文件命名规范

```
qwen3.5-27b-claude-4.6-opus-reasoning-distilled-v2-gguf
│       │    │              │                     │  │
│       │    │              │                     │  └─ 格式: GGUF
│       │    │              │                     └─── 版本: v2
│       │    │              └─────────────────────── 方法: 推理蒸馏
│       │    └────────────────────────────────────── Teacher: Claude Opus
│       └─────────────────────────────────────────── 参数: 27B
└─────────────────────────────────────────────────── 基座: Qwen 3.5
```

---

## 3. 部署工具链

### 3.1 llama.cpp（最底层）

```bash
# 编译（支持 CUDA/3090）
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp
cmake -B build -DGGML_CUDA=ON
cmake --build build --config Release

# 运行推理
./build/bin/llama-cli \
  -m ~/models/qwen3.5-27b-Q4_K_M.gguf \
  -p "请解释什么是知识蒸馏" \
  -n 512 \
  --gpu-layers 99 \    # 尽量多放 GPU（3090: 27B Q4 约 33 层全上）
  --ctx-size 4096      # 上下文窗口
```

### 3.2 Ollama（一行命令）

```bash
# 安装
curl -fsSL https://ollama.com/install.sh | sh

# 拉取并运行
ollama run qwen3.5:27b

# 或从 GGUF 文件创建
cat > Modelfile << EOF
FROM ~/models/qwen3.5-27b-Q4_K_M.gguf
PARAMETER temperature 0.7
PARAMETER num_ctx 4096
EOF
ollama create my-qwen -f Modelfile
ollama run my-qwen
```

### 3.3 vLLM（高性能 API 服务）

```bash
# 适合给 Muse 提供 API
pip install vllm
vllm serve qwen3.5-27b --quantization awq --gpu-memory-utilization 0.9
# 然后 Muse 可以通过 OpenAI 兼容 API 调用本地模型
```

---

## 4. 3090 部署实操路线

> Sprint 2 做实操，现在先把原理吃透。

```
Phase 1: 部署推理（Sprint 2 实操）
  ├─ 下载 qwen3.5-27b Q4_K_M GGUF
  ├─ ollama 一行跑起来
  ├─ 测试推理速度和质量
  └─ 对比 API 模型(Claude/GPT)的差异

Phase 2: LoRA 微调（Sprint 3-4）
  ├─ 准备 Muse 场景的对话数据
  ├─ QLoRA 微调 7B 模型（3090 轻松跑）
  ├─ 评估微调效果
  └─ 考虑给 Muse 接本地模型

Phase 3: 本地模型 + Muse 集成（Sprint 5+）
  ├─ vLLM 部署 API 服务
  ├─ Muse 的某些角色用本地模型（省钱）
  └─ 敏感数据不出机器（隐私）
```

---

## 💼 面试必答

**Q: 什么是模型量化？Q4_K_M 是什么意思？**
> 量化是把 FP16 浮点参数映射到低精度整数的过程，用精度换效率。Q4 表示 4-bit 量化，K 表示 K-quants（分组量化，每组有独立的 scale factor），M 表示 Mixed（重要层用更高精度）。Q4_K_M 是社区公认的精度/效率最优平衡点。

**Q: GGUF 是什么？为什么取代了 GGML？**
> GGUF 是 llama.cpp 社区设计的量化模型标准格式，自包含（参数+tokenizer+元数据全在一个文件）、版本化、可扩展。取代 GGML 是因为旧格式不标准、不支持扩展。

**Q: 27B 模型怎么跑在 24GB 显存的 3090 上？**
> 通过量化。FP16 的 27B 模型需要 54GB，Q4_K_M 量化后约 16GB，留 8GB 给 KV-cache 和系统，刚好能跑。速度约 12 tok/s，够用于交互式对话。
