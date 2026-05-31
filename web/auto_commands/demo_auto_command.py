"""
自动指令功能演示
展示如何在代码中直接调用自动指令功能
"""

import sys
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.append(str(Path(__file__).parent.parent.parent))

from web.auto_commands.auto_routes import AutoCommandProcessor

def demo_auto_command_parsing():
    """演示自动指令解析"""
    print("🤖 自动指令解析演示")
    print("-" * 30)
    
    processor = AutoCommandProcessor()
    
    # 演示各种指令格式
    demo_commands = [
        "/自动",
        "/自动 3", 
        "/自动 5",
        "/自动 10",
        "/自动 15",
    ]
    
    for cmd in demo_commands:
        result = processor.parse_auto_command(cmd)
        if result:
            print(f"📝 指令: {cmd:10} → 生成 {result['count']:2} 条对话")
        else:
            print(f"❌ 指令: {cmd:10} → 无效格式")

def demo_error_handling():
    """演示错误处理"""
    print("\n🛡️ 错误处理演示")
    print("-" * 30)
    
    processor = AutoCommandProcessor()
    
    # 演示各种错误情况
    error_commands = [
        "",              # 空指令
        "自动",          # 缺少斜杠
        "/自动abc",      # 无效后缀
        "/自动 -5",      # 负数
        "/自动 abc",     # 非数字
        "/自动 100",     # 超过最大值
    ]
    
    for cmd in error_commands:
        result = processor.parse_auto_command(cmd)
        if result:
            count = result['count']
            if count > 20:
                print(f"⚠️ 指令: {cmd:12} → 限制为 {min(count, 20)} 条 (原: {count})")
            else:
                print(f"✅ 指令: {cmd:12} → 生成 {count} 条对话")
        else:
            print(f"❌ 指令: {cmd:12} → 格式错误，已拒绝")

def demo_usage_scenarios():
    """演示使用场景"""
    print("\n🎭 使用场景演示")
    print("-" * 30)
    
    scenarios = [
        {
            "name": "角色内心独白",
            "command": "/自动 3",
            "description": "让角色表达内心想法"
        },
        {
            "name": "连续行动描述", 
            "command": "/自动 5",
            "description": "描述角色的一系列行动"
        },
        {
            "name": "情节快速发展",
            "command": "/自动 8",
            "description": "推进故事情节发展"
        },
        {
            "name": "丰富对话内容",
            "command": "/自动 10",
            "description": "增加对话的深度和广度"
        }
    ]
    
    for scenario in scenarios:
        print(f"🎯 {scenario['name']}")
        print(f"   指令: {scenario['command']}")
        print(f"   说明: {scenario['description']}")
        print()

def demo_integration_tips():
    """演示集成建议"""
    print("🔧 集成建议")
    print("-" * 30)
    
    tips = [
        "1. 在聊天界面输入框中直接输入指令",
        "2. 确保用户已登录系统",
        "3. 生成的对话会自动保存到历史记录",
        "4. 可以配合其他功能一起使用",
        "5. 建议在合适的时机使用，避免打断对话流",
    ]
    
    for tip in tips:
        print(f"💡 {tip}")

if __name__ == "__main__":
    print("🌟 自动指令功能演示")
    print("=" * 50)
    
    try:
        demo_auto_command_parsing()
        demo_error_handling()
        demo_usage_scenarios()
        demo_integration_tips()
        
        print("\n" + "=" * 50)
        print("✨ 演示完成！现在您可以在聊天界面中使用 /自动 指令了")
        print("📖 更多信息请访问: /auto_help")
        
    except Exception as e:
        print(f"\n❌ 演示过程中出现错误: {e}")
        import traceback
        traceback.print_exc()