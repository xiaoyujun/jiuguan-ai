#!/usr/bin/env python3
"""
向量化功能依赖安装脚本
自动安装向量化功能所需的Python包
"""

import subprocess
import sys
import os
from pathlib import Path

def install_package(package):
    """安装Python包"""
    try:
        print(f"正在安装 {package}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        print(f"✅ {package} 安装成功")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {package} 安装失败: {e}")
        return False

def check_package(package):
    """检查包是否已安装"""
    try:
        __import__(package)
        return True
    except ImportError:
        return False

def main():
    """主函数"""
    print("🚀 开始安装向量化功能依赖...")
    print("=" * 50)
    
    # 需要安装的包列表
    required_packages = [
        "numpy",          # 数值计算
        "sqlite3",        # SQLite数据库（通常是内置的）
    ]
    
    # 可选的高级包（用于更好的向量化效果）
    optional_packages = [
        "scikit-learn",   # 机器学习库，提供更好的特征提取
        "jieba",          # 中文分词
        "sentence-transformers",  # 预训练的句子嵌入模型
    ]
    
    success_count = 0
    total_packages = len(required_packages)
    
    # 检查并安装必需的包
    print("📦 检查必需依赖...")
    for package in required_packages:
        if package == "sqlite3":
            # sqlite3 通常是Python内置的
            try:
                import sqlite3
                print(f"✅ sqlite3 已可用")
                success_count += 1
            except ImportError:
                print(f"❌ sqlite3 不可用，请检查Python安装")
        else:
            if check_package(package):
                print(f"✅ {package} 已安装")
                success_count += 1
            else:
                if install_package(package):
                    success_count += 1
    
    print("\n📦 检查可选依赖...")
    optional_success = 0
    for package in optional_packages:
        if check_package(package.split('[')[0]):  # 处理可能的额外选项
            print(f"✅ {package} 已安装")
            optional_success += 1
        else:
            print(f"ℹ️ {package} 未安装（可选）")
            install_choice = input(f"是否安装 {package}？(y/N): ").lower().strip()
            if install_choice in ['y', 'yes']:
                if install_package(package):
                    optional_success += 1
    
    # 创建向量数据库目录
    print("\n📁 创建向量数据库目录...")
    vector_dir = Path("web")
    vector_dir.mkdir(exist_ok=True)
    print(f"✅ 向量数据库目录已准备: {vector_dir}")
    
    # 检查现有的requirements.txt并更新
    print("\n📝 更新requirements.txt...")
    requirements_file = Path("requirements.txt")
    
    new_requirements = [
        "numpy>=1.21.0",
    ]
    
    if requirements_file.exists():
        with open(requirements_file, 'r', encoding='utf-8') as f:
            existing_requirements = f.read()
        
        # 检查是否需要添加新的依赖
        requirements_to_add = []
        for req in new_requirements:
            package_name = req.split('>=')[0].split('==')[0]
            if package_name not in existing_requirements:
                requirements_to_add.append(req)
        
        if requirements_to_add:
            with open(requirements_file, 'a', encoding='utf-8') as f:
                f.write('\n# 向量化功能依赖\n')
                for req in requirements_to_add:
                    f.write(f'{req}\n')
            print(f"✅ 已添加 {len(requirements_to_add)} 个依赖到 requirements.txt")
        else:
            print("ℹ️ requirements.txt 已包含所需依赖")
    else:
        with open(requirements_file, 'w', encoding='utf-8') as f:
            f.write('# 向量化功能依赖\n')
            for req in new_requirements:
                f.write(f'{req}\n')
        print("✅ 已创建 requirements.txt")
    
    # 创建配置文件
    print("\n⚙️ 创建向量化配置...")
    config_content = """# 向量化功能配置
# 这些设置可以在 web/vectorized_chat_helper.py 中修改

VECTOR_CONFIG = {
    "max_relevant_items": 3,        # 最大相关项目数
    "similarity_threshold": 0.1,    # 相似度阈值
    # 移除长度限制，允许包含所有相关数据书
    "vector_dimension": 384,        # 向量维度
    "auto_sync_enabled": True,      # 自动同步功能
}
"""
    
    config_file = Path("vector_config.py")
    if not config_file.exists():
        with open(config_file, 'w', encoding='utf-8') as f:
            f.write(config_content)
        print("✅ 已创建向量化配置文件")
    else:
        print("ℹ️ 向量化配置文件已存在")
    
    # 总结安装结果
    print("\n" + "=" * 50)
    print("📊 安装总结:")
    print(f"必需依赖: {success_count}/{total_packages} 成功")
    print(f"可选依赖: {optional_success}/{len(optional_packages)} 已安装")
    
    if success_count == total_packages:
        print("🎉 向量化功能依赖安装完成！")
        print("\n📋 下一步操作:")
        print("1. 重启应用程序")
        print("2. 向量化功能已整合到系统中，会自动工作")
        print("3. 在聊天时系统会自动使用向量化优化")
        
        print("\n💡 使用提示:")
        print("- 向量化会自动减少传入AI的提示词长度")
        print("- 可以在管理页面查看压缩效果统计")
        print("- 如果向量化失败，系统会自动回退到原始数据")
        
        return True
    else:
        print("⚠️ 部分依赖安装失败，请检查网络连接和Python环境")
        return False

if __name__ == "__main__":
    try:
        success = main()
        if success:
            sys.exit(0)
        else:
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n⚠️ 安装被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 安装过程中出现错误: {e}")
        sys.exit(1)
