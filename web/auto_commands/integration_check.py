"""
自动指令集成检查脚本
验证自动指令功能是否正确集成到主应用中
"""

import sys
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.append(str(Path(__file__).parent.parent.parent))

def check_imports():
    """检查模块导入"""
    print("🔍 检查模块导入...")
    
    try:
        from web.auto_commands.auto_routes import auto_command_bp, AutoCommandProcessor
        print("✅ 自动指令路由模块导入成功")
    except ImportError as e:
        print(f"❌ 自动指令路由模块导入失败: {e}")
        return False
    
    try:
        from web.auto_commands import auto_command_bp as alt_import
        print("✅ 自动指令蓝图替代导入成功")
    except ImportError as e:
        print(f"⚠️ 自动指令蓝图替代导入失败: {e}")
    
    return True

def check_blueprint_structure():
    """检查蓝图结构"""
    print("\n🔍 检查蓝图结构...")
    
    try:
        from web.auto_commands.auto_routes import auto_command_bp
        
        # 检查蓝图属性
        print(f"✅ 蓝图名称: {auto_command_bp.name}")
        print(f"✅ 蓝图URL前缀: {getattr(auto_command_bp, 'url_prefix', 'None')}")
        print(f"✅ 模板文件夹: {auto_command_bp.template_folder}")
        print(f"✅ 静态文件夹: {auto_command_bp.static_folder}")
        
        # 检查路由
        routes = []
        for rule in auto_command_bp.url_map.iter_rules():
            routes.append(f"{rule.methods} {rule.rule}")
        
        print(f"✅ 注册的路由数量: {len(routes)}")
        for route in routes:
            print(f"   📍 {route}")
            
    except Exception as e:
        print(f"❌ 蓝图结构检查失败: {e}")
        return False
    
    return True

def check_main_app_integration():
    """检查主应用集成"""
    print("\n🔍 检查主应用集成...")
    
    try:
        # 检查主应用文件中是否包含自动指令蓝图导入
        app_file = Path(__file__).parent.parent / "app_new.py"
        
        if not app_file.exists():
            print("❌ 主应用文件 app_new.py 不存在")
            return False
        
        content = app_file.read_text(encoding='utf-8')
        
        # 检查导入
        if 'from web.auto_commands.auto_routes import auto_command_bp' in content:
            print("✅ 自动指令蓝图导入已添加到主应用")
        else:
            print("❌ 自动指令蓝图导入未添加到主应用")
            return False
        
        # 检查注册
        if 'app.register_blueprint(auto_command_bp)' in content:
            print("✅ 自动指令蓝图注册已添加到主应用")
        else:
            print("❌ 自动指令蓝图注册未添加到主应用")
            return False
        
    except Exception as e:
        print(f"❌ 主应用集成检查失败: {e}")
        return False
    
    return True

def check_chat_routes_integration():
    """检查聊天路由集成"""
    print("\n🔍 检查聊天路由集成...")
    
    try:
        chat_routes_file = Path(__file__).parent.parent / "chat_routes.py"
        
        if not chat_routes_file.exists():
            print("❌ 聊天路由文件 chat_routes.py 不存在")
            return False
        
        content = chat_routes_file.read_text(encoding='utf-8')
        
        # 检查自动指令处理逻辑
        if '/自动' in content and 'auto_processor' in content:
            print("✅ 自动指令处理逻辑已添加到聊天路由")
        else:
            print("❌ 自动指令处理逻辑未添加到聊天路由")
            return False
        
    except Exception as e:
        print(f"❌ 聊天路由集成检查失败: {e}")
        return False
    
    return True

def check_static_files():
    """检查静态文件"""
    print("\n🔍 检查静态文件...")
    
    static_dir = Path(__file__).parent / "static"
    template_dir = Path(__file__).parent / "templates"
    
    required_files = [
        static_dir / "auto_command.js",
        static_dir / "auto_command.css", 
        template_dir / "auto_help.html"
    ]
    
    all_exists = True
    for file_path in required_files:
        if file_path.exists():
            print(f"✅ {file_path.name} 存在")
        else:
            print(f"❌ {file_path.name} 不存在")
            all_exists = False
    
    return all_exists

def generate_integration_report():
    """生成集成报告"""
    print("\n📋 生成集成报告...")
    
    checks = [
        ("模块导入", check_imports),
        ("蓝图结构", check_blueprint_structure),
        ("主应用集成", check_main_app_integration),
        ("聊天路由集成", check_chat_routes_integration),
        ("静态文件", check_static_files)
    ]
    
    results = {}
    for check_name, check_func in checks:
        try:
            results[check_name] = check_func()
        except Exception as e:
            print(f"❌ {check_name} 检查时发生异常: {e}")
            results[check_name] = False
    
    print("\n" + "=" * 50)
    print("📊 集成检查报告")
    print("=" * 50)
    
    all_passed = True
    for check_name, result in results.items():
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{check_name:15} : {status}")
        if not result:
            all_passed = False
    
    print("=" * 50)
    if all_passed:
        print("🎉 所有检查都通过！自动指令功能已成功集成")
        print("💡 现在可以启动应用并测试 /自动 指令了")
    else:
        print("⚠️ 部分检查未通过，请修复相关问题")
    print("=" * 50)
    
    return all_passed

if __name__ == "__main__":
    print("🔧 自动指令集成检查")
    print("=" * 50)
    
    try:
        success = generate_integration_report()
        sys.exit(0 if success else 1)
        
    except Exception as e:
        print(f"\n💥 集成检查过程中发生严重错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)