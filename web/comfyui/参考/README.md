# ComfyUI API 客户端

这是一个用于调用ComfyUI工作流的Python客户端，支持通过API生成图像。

## 功能特性

- 🚀 支持加载和执行ComfyUI工作流
- 🎨 可自定义提示词、图像尺寸、采样参数等
- 📡 实时WebSocket连接监控生成进度
- 📁 自动下载生成的图像
- 🔧 支持命令行和编程两种使用方式
- ⚡ 支持批量生成

## 安装依赖

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 确保ComfyUI服务器运行

首先确保你的ComfyUI服务器正在运行，默认地址为 `127.0.0.1:8188`

### 2. 命令行使用

```bash
# 基本使用
python comfyui_client.py --workflow LL杰出.json --positive "a beautiful anime girl"

# 完整参数示例
python comfyui_client.py \
    --workflow LL杰出.json \
    --positive "masterpiece, best quality, 1girl, detailed face" \
    --negative "low quality, blurry, bad anatomy" \
    --width 768 \
    --height 768 \
    --steps 25 \
    --cfg 7.5 \
    --seed 12345 \
    --batch-size 2 \
    --output ./my_images
```

### 3. Python脚本使用

```python
from comfyui_client import ComfyUIClient

# 创建客户端
client = ComfyUIClient(server_address="127.0.0.1:8188")

try:
    # 生成图像
    generated_files = client.generate_image(
        workflow_path="LL杰出.json",
        output_dir="./output",
        positive_prompt="a beautiful anime girl, detailed face",
        negative_prompt="low quality, blurry",
        width=768,
        height=768,
        steps=25,
        cfg=7.5,
        seed=42
    )
    
    print(f"生成完成: {generated_files}")
    
finally:
    client.close()
```

## 支持的参数

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `positive_prompt` | str | 正面提示词 |
| `negative_prompt` | str | 负面提示词 |
| `width` | int | 图像宽度 |
| `height` | int | 图像高度 |
| `steps` | int | 采样步数 |
| `cfg` | float | CFG引导强度 |
| `seed` | int | 随机种子 |
| `sampler_name` | str | 采样器名称 |
| `scheduler` | str | 调度器类型 |
| `denoise` | float | 去噪强度 (0.0-1.0) |
| `batch_size` | int | 批次大小 |
| `filename_prefix` | str | 文件名前缀 |
| `ckpt_name` | str | 模型文件名 |

## 命令行参数

```
usage: comfyui_client.py [-h] --workflow WORKFLOW [--server SERVER] 
                         [--output OUTPUT] [--positive POSITIVE]
                         [--negative NEGATIVE] [--width WIDTH] 
                         [--height HEIGHT] [--steps STEPS] [--cfg CFG]
                         [--seed SEED] [--batch-size BATCH_SIZE]

optional arguments:
  -h, --help            显示帮助信息
  --workflow, -w        工作流JSON文件路径 (必需)
  --server, -s          ComfyUI服务器地址 (默认: 127.0.0.1:8188)
  --output, -o          输出目录 (默认: ./output)
  --positive, -p        正面提示词
  --negative, -n        负面提示词
  --width               图像宽度
  --height              图像高度
  --steps               采样步数
  --cfg                 CFG值
  --seed                随机种子
  --batch-size          批次大小
```

## 使用示例

查看 `example_usage.py` 文件了解更多使用示例：

```bash
python example_usage.py
```

## 工作流兼容性

此客户端基于你提供的工作流 `LL杰出.json` 设计，包含以下节点：

- **节点3**: KSampler (K采样器)
- **节点5**: EmptyLatentImage (空Latent)
- **节点6**: CLIPTextEncode (正面提示词编码)
- **节点7**: CLIPTextEncode (负面提示词编码)
- **节点8**: VAEDecode (VAE解码)
- **节点9**: SaveImage (保存图像)
- **节点16**: CheckpointLoaderSimple (模型加载器)
- **节点19**: Anything Everywhere3 (全局输入)

如果你的工作流结构不同，可能需要修改 `update_workflow_params` 方法中的节点ID。

## 错误处理

客户端包含完整的错误处理机制：

- WebSocket连接错误
- HTTP请求错误
- 工作流执行错误
- 文件下载错误
- 超时处理

## 注意事项

1. 确保ComfyUI服务器正在运行且可访问
2. 工作流文件路径正确
3. 模型文件存在于ComfyUI的models目录中
4. 有足够的磁盘空间保存生成的图像
5. 网络连接稳定

## 故障排除

### 连接失败
- 检查ComfyUI服务器是否运行
- 确认服务器地址和端口正确
- 检查防火墙设置

### 生成失败
- 检查工作流文件格式是否正确
- 确认模型文件存在
- 查看ComfyUI服务器日志

### 下载失败
- 检查输出目录权限
- 确认磁盘空间足够
- 检查网络连接

## 许可证

MIT License
