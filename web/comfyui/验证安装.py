#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图片生成功能安装验证脚本
快速验证所有组件是否正确安装和配置
"""

import sys
import os

def test_imports():
    """测试所有必要的导入"""
    print("🔍 测试模块导入...")
    
    try:
        # 添加项目根目录到路径
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        sys.path.insert(0, project_root)
        
        # 测试基础模块导入
        from web.comfyui.prompt_generator import PromptGenerator
        print("✅ PromptGenerator 导入成功")
        
        from web.comfyui.image_generator import ImageGenerationService
        print("✅ ImageGenerationService 导入成功")
        
        from web.comfyui.image_generation_routes import image_bp, handle_generate_image_command
        print("✅ 图片生成路由 导入成功")
        
        # 测试Flask应用导入
        from web.app_new import app
        print("✅ Flask应用 导入成功")
        
        return True
        
    except ImportError as e:
        print(f"❌ 导入失败: {e}")
        return False

def test_file_structure():
    """测试文件结构"""
    print("\n📁 检查文件结构...")
    
    current_dir = os.path.dirname(__file__)
    required_files = [
        'prompt_generator.py',
        'image_generator.py', 
        'image_generation_routes.py',
        '__init__.py',
        '参考/comfyui_client.py',
        '参考/LL杰出.json'
    ]
    
    all_exist = True
    for file_path in required_files:
        full_path = os.path.join(current_dir, file_path)
        if os.path.exists(full_path):
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path} - 文件不存在")
            all_exist = False
    
    return all_exist

def test_static_directory():
    """测试静态目录"""
    print("\n📂 检查静态目录...")
    
    static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'generated_images')
    
    if os.path.exists(static_dir):
        print(f"✅ 静态图片目录存在: {static_dir}")
        return True
    else:
        print(f"❌ 静态图片目录不存在: {static_dir}")
        print("💡 尝试创建目录...")
        try:
            os.makedirs(static_dir, exist_ok=True)
            print("✅ 静态图片目录创建成功")
            return True
        except Exception as e:
            print(f"❌ 创建目录失败: {e}")
            return False

def test_basic_functionality():
    """测试基础功能"""
    print("\n⚙️ 测试基础功能...")
    
    try:
        from web.comfyui.prompt_generator import PromptGenerator
        
        generator = PromptGenerator()
        print("✅ PromptGenerator 实例化成功")
        
        # 测试获取角色外貌特征（如果莉塔角色存在）
        try:
            appearance = generator.get_character_appearance("莉塔")
            if appearance:
                print(f"✅ 成功获取角色外貌特征: {list(appearance.keys())}")
            else:
                print("⚠️ 未找到角色外貌特征数据（这是正常的，如果角色不存在）")
        except Exception as e:
            print(f"⚠️ 获取角色数据时出现问题: {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ 基础功能测试失败: {e}")
        return False

def main():
    """主函数"""
    print("🎨 AI图片生成功能安装验证")
    print("=" * 50)
    
    # 运行所有测试
    tests = [
        ("模块导入", test_imports),
        ("文件结构", test_file_structure), 
        ("静态目录", test_static_directory),
        ("基础功能", test_basic_functionality)
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n🧪 {test_name}测试")
        print("-" * 30)
        result = test_func()
        results.append((test_name, result))
    
    # 显示结果汇总
    print("\n" + "=" * 50)
    print("📊 测试结果汇总")
    print("=" * 50)
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ 通过" if passed else "❌ 失败"
        print(f"{test_name:12} {status}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 所有测试通过！图片生成功能已正确安装")
        print("\n💡 下一步:")
        print("1. 启动ComfyUI服务器: python main.py --listen 127.0.0.1 --port 8188")
        print("2. 启动Flask应用")
        print("3. 在聊天界面使用 '/生图' 命令")
    else:
        print("⚠️ 部分测试失败，请检查相关配置")
        print("\n🔧 建议:")
        print("- 确保所有必要文件都存在")
        print("- 检查Python路径和导入设置")
        print("- 查看详细错误信息并修复")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
