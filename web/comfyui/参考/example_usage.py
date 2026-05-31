#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ComfyUI客户端使用示例
"""

from comfyui_client import ComfyUIClient
import random


def example_basic_usage():
    """基本使用示例"""
    print("=== 基本使用示例 ===")
    
    # 创建客户端（确保ComfyUI服务器在127.0.0.1:8188运行）
    client = ComfyUIClient(server_address="127.0.0.1:8188")
    
    try:
        # 生成图像
        generated_files = client.generate_image(
            workflow_path="LL杰出.json",  # 你的工作流文件
            output_dir="./generated_images",
            positive_prompt="a beautiful anime girl, detailed face, high quality",
            negative_prompt="low quality, blurry, bad anatomy",
            width=768,
            height=768,
            steps=25,
            cfg=7.5,
            seed=random.randint(1, 1000000),
            batch_size=1
        )
        
        print(f"生成完成！图像保存在: {generated_files}")
        
    except Exception as e:
        print(f"生成失败: {e}")
    finally:
        client.close()


def example_multiple_images():
    """批量生成示例"""
    print("=== 批量生成示例 ===")
    
    client = ComfyUIClient()
    
    prompts = [
        "a cute cat sitting on a windowsill",
        "a majestic dragon flying over mountains",
        "a peaceful forest scene with sunlight",
        "a futuristic city with neon lights"
    ]
    
    try:
        for i, prompt in enumerate(prompts):
            print(f"生成第 {i+1}/{len(prompts)} 张图像...")
            
            generated_files = client.generate_image(
                workflow_path="生图工作流.json",
                output_dir=f"./batch_output/image_{i+1}",
                positive_prompt=prompt,
                negative_prompt="low quality, blurry",
                seed=random.randint(1, 1000000),
                filename_prefix=f"batch_{i+1}_"
            )
            
            print(f"第 {i+1} 张图像生成完成: {generated_files[0]}")
            
    except Exception as e:
        print(f"批量生成失败: {e}")
    finally:
        client.close()


def example_custom_workflow():
    """自定义工作流参数示例"""
    print("=== 自定义参数示例 ===")
    
    client = ComfyUIClient()
    
    try:
        # 使用不同的采样器和调度器
        generated_files = client.generate_image(
            workflow_path="LL杰出.json",
            output_dir="./custom_output",
            positive_prompt="masterpiece, best quality, 1girl, detailed face, beautiful eyes",
            negative_prompt="worst quality, low quality, normal quality, lowres, bad anatomy",
            width=512,
            height=768,  # 竖图
            steps=30,
            cfg=8.0,
            sampler_name="dpmpp_2m",  # 如果你的工作流支持这个采样器
            scheduler="karras",       # 如果你的工作流支持这个调度器
            denoise=1.0,
            seed=42,  # 固定种子以获得可重现的结果
            batch_size=2  # 一次生成2张图
        )
        
        print(f"自定义参数生成完成: {generated_files}")
        
    except Exception as e:
        print(f"自定义生成失败: {e}")
    finally:
        client.close()


if __name__ == "__main__":
    print("ComfyUI客户端使用示例")
    print("请确保ComfyUI服务器正在运行在 127.0.0.1:8188")
    print()
    
    # 选择要运行的示例
    choice = input("选择示例 (1: 基本使用, 2: 批量生成, 3: 自定义参数): ").strip()
    
    if choice == "1":
        example_basic_usage()
    elif choice == "2":
        example_multiple_images()
    elif choice == "3":
        example_custom_workflow()
    else:
        print("无效选择，运行基本使用示例...")
        example_basic_usage()
