"""
自动指令功能测试脚本
"""

import sys
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.append(str(Path(__file__).parent.parent.parent))

from web.auto_commands.auto_routes import AutoCommandProcessor

def test_auto_command_parser():
    """测试自动指令解析器"""
    print("🔍 测试自动指令解析器...")
    
    processor = AutoCommandProcessor()
    
    test_cases = [
        ("/自动", {"command": "auto", "count": 3}),
        ("/自动 5", {"command": "auto", "count": 5}),
        ("/自动 10", {"command": "auto", "count": 10}),
        ("/自动 25", {"command": "auto", "count": 20}),  # 应该被限制为20
        ("自动", None),  # 无效格式
        ("/自动abc", None),  # 无效格式
        ("/自动 0", {"command": "auto", "count": 0}),
    ]
    
    for message, expected in test_cases:
        result = processor.parse_auto_command(message)
        if expected is None:
            if result is None:
                print(f"✅ '{message}' -> None (正确)")
            else:
                print(f"❌ '{message}' -> {result} (应该为None)")
        else:
            if result and result['command'] == expected['command'] and result['count'] == expected['count']:
                print(f"✅ '{message}' -> count={result['count']} (正确)")
            else:
                print(f"❌ '{message}' -> {result} (期望: {expected})")

def test_command_validation():
    """测试指令验证"""
    print("\n🔍 测试指令验证...")
    
    processor = AutoCommandProcessor()
    
    # 测试无效指令
    invalid_commands = [
        "",
        "hello",
        "/生图",
        "/自动abc",
        "/自动 -1",
        "/自动 abc",
    ]
    
    for cmd in invalid_commands:
        result = processor.parse_auto_command(cmd)
        if result is None:
            print(f"✅ 无效指令 '{cmd}' 被正确拒绝")
        else:
            print(f"❌ 无效指令 '{cmd}' 被错误接受: {result}")

def test_features():
    """测试功能特性"""
    print("\n🔍 测试功能特性...")
    
    processor = AutoCommandProcessor()
    
    # 测试活跃会话状态
    print(f"📊 活跃会话: {len(processor.active_sessions)}")
    
    # 测试最大条数限制
    result = processor.parse_auto_command("/自动 100")
    if result and result['count'] == 20:
        print("✅ 最大条数限制正常工作")
    else:
        print(f"❌ 最大条数限制异常: {result}")
    
    # 测试指令解析的边界情况
    edge_cases = [
        "/自动  5",  # 多余空格
        "/自动\t3",  # 制表符
        "/自动\n",   # 换行符
    ]
    
    for case in edge_cases:
        result = processor.parse_auto_command(case)
        print(f"🔍 边界测试 '{repr(case)}': {result}")
    
    print("✅ 功能特性测试完成")

if __name__ == "__main__":
    print("🤖 自动指令功能测试")
    print("=" * 50)
    
    try:
        test_auto_command_parser()
        test_command_validation()
        test_features()
        
        print("\n" + "=" * 50)
        print("✅ 所有测试完成！")
        
    except Exception as e:
        print(f"\n❌ 测试过程中出现错误: {e}")
        import traceback
        traceback.print_exc()