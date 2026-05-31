#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图片生成功能测试脚本
测试整个图片生成流程的各个组件
"""

import sys
import os

# 添加上级目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from prompt_generator import PromptGenerator
from image_generator import ImageGenerationService
from image_generation_routes import handle_generate_image_command


def test_prompt_generator():
    """测试提示词生成器"""
    print("=" * 60)
    print("🧪 测试提示词生成器")
    print("=" * 60)
    
    try:
        generator = PromptGenerator()
        
        # 测试生成莉塔的提示词
        print("📝 为角色'莉塔'生成提示词...")
        prompt = generator.generate_prompt("莉塔", "正在清洁房间")
        
        if prompt:
            print(f"✅ 提示词生成成功:")
            print(f"   {prompt}")
            return True
        else:
            print("❌ 提示词生成失败")
            return False
            
    except Exception as e:
        print(f"❌ 提示词生成器测试失败: {e}")
        return False


def test_comfyui_connection():
    """测试ComfyUI连接"""
    print("\n" + "=" * 60)
    print("🔌 测试ComfyUI服务器连接")
    print("=" * 60)
    
    try:
        service = ImageGenerationService()
        connection_result = service.test_connection()
        
        if connection_result['success']:
            print(f"✅ ComfyUI连接成功: {connection_result['message']}")
            return True
        else:
            print(f"❌ ComfyUI连接失败: {connection_result['error']}")
            print("💡 请确保ComfyUI服务器正在运行在 127.0.0.1:8188")
            return False
            
    except Exception as e:
        print(f"❌ ComfyUI连接测试失败: {e}")
        return False


def test_service_status():
    """测试图片生成服务状态"""
    print("\n" + "=" * 60)
    print("📊 测试图片生成服务状态")
    print("=" * 60)
    
    try:
        service = ImageGenerationService()
        status = service.get_generation_status()
        
        print("📋 服务状态:")
        print(f"   服务状态: {status['service_status']}")
        print(f"   服务器地址: {status['server_address']}")
        print(f"   输出目录: {status['output_directory']}")
        print(f"   工作流文件: {status['workflow_path']}")
        print(f"   工作流存在: {status['workflow_exists']}")
        
        if status['workflow_exists']:
            print("✅ 工作流文件存在")
        else:
            print("❌ 工作流文件不存在")
            print(f"💡 请确保文件存在: {status['workflow_path']}")
        
        return status['workflow_exists']
        
    except Exception as e:
        print(f"❌ 服务状态检查失败: {e}")
        return False


def test_command_handler():
    """测试命令处理器"""
    print("\n" + "=" * 60)
    print("⚙️ 测试命令处理器")
    print("=" * 60)
    
    try:
        # 模拟聊天历史
        mock_chat_history = [
            "兰斯: 我回来了",
            "莉塔: 欢迎回来，兰斯大人。您看起来有些疲惫，需要我为您准备热水沐浴吗？"
        ]
        
        print("🔄 测试/生图命令处理...")
        result = handle_generate_image_command("莉塔", mock_chat_history)
        
        if result['success']:
            print("✅ 命令处理成功")
            print(f"   消息: {result.get('message', 'N/A')}")
            print(f"   图片路径: {result.get('image_paths', [])}")
            print(f"   提示词: {result.get('prompt', 'N/A')}")
            return True
        else:
            print(f"❌ 命令处理失败: {result.get('error', 'Unknown error')}")
            print(f"💡 {result.get('message', '')}")
            return False
            
    except Exception as e:
        print(f"❌ 命令处理器测试失败: {e}")
        return False


def test_full_integration():
    """完整集成测试"""
    print("\n" + "=" * 80)
    print("🚀 完整图片生成流程集成测试")
    print("=" * 80)
    
    results = {
        'prompt_generator': test_prompt_generator(),
        'comfyui_connection': test_comfyui_connection(),
        'service_status': test_service_status(),
        'command_handler': test_command_handler()
    }
    
    print("\n" + "=" * 60)
    print("📊 测试结果汇总")
    print("=" * 60)
    
    all_passed = True
    for test_name, passed in results.items():
        status = "✅ 通过" if passed else "❌ 失败"
        print(f"   {test_name.replace('_', ' ').title()}: {status}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 所有测试通过！图片生成功能已准备就绪")
        print("\n💡 使用方法:")
        print("   1. 确保ComfyUI服务器运行在 127.0.0.1:8188")
        print("   2. 在聊天界面输入 '/生图' 命令")
        print("   3. 或使用快捷命令 '/generate-image'")
    else:
        print("⚠️ 部分测试失败，请检查相关配置")
        print("\n🔧 故障排除:")
        if not results['comfyui_connection']:
            print("   - 启动ComfyUI服务器")
            print("   - 检查服务器地址配置")
        if not results['service_status']:
            print("   - 检查工作流文件是否存在")
            print("   - 确认文件路径配置正确")
    
    return all_passed


if __name__ == "__main__":
    print("🎨 图片生成功能测试开始")
    print("📝 测试将验证所有组件是否正常工作\n")
    
    success = test_full_integration()
    
    print(f"\n🏁 测试完成，结果: {'成功' if success else '失败'}")
    sys.exit(0 if success else 1)
