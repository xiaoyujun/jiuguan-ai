#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试实际聊天中的提示词效果
验证修复后的系统在实际聊天中是否能正确构建提示词
"""

import sys
import json
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

def test_actual_chat_prompt():
    """模拟实际聊天请求来测试提示词构建"""
    print("🧪 测试实际聊天中的提示词构建")
    print("=" * 80)
    
    try:
        # 模拟聊天请求的数据
        chat_data = {
            "message": "告诉我关于Jade的详细信息，她是什么样的人？",
            "role": "Mel",
            "new_topic": False
        }
        
        print(f"📨 模拟聊天请求:")
        print(f"   - 消息: {chat_data['message']}")
        print(f"   - 角色: {chat_data['role']}")
        
        # 直接测试向量化处理结果
        from web.vectorized_temp_data.architecture_2_0_integration import get_architecture_2_0_processor
        
        processor = get_architecture_2_0_processor()
        vectorized_context, success, details = processor.process_user_input(
            role_name=chat_data['role'],
            user_input=chat_data['message'],
            include_player_data=True
        )
        
        print(f"\n📊 向量化处理结果:")
        print(f"   - 成功: {success}")
        print(f"   - 上下文长度: {len(vectorized_context)} 字符")
        
        if success:
            # 检查关键标识
            print(f"\n🔍 关键标识检查:")
            
            checks = [
                ("=== 其他角色信息:", "其他角色信息标识"),
                ("Jade", "包含目标角色Jade"),
                ("总结词:", "包含角色属性信息"),
                ("属性信息:", "包含详细属性")
            ]
            
            all_checks_passed = True
            for check_text, description in checks:
                if check_text in vectorized_context:
                    print(f"   ✅ {description}")
                else:
                    print(f"   ❌ {description}")
                    all_checks_passed = False
            
            # 显示向量化上下文的结构
            print(f"\n📄 向量化上下文结构:")
            lines = vectorized_context.split('\n')
            
            # 统计角色信息数量
            role_count = vectorized_context.count("=== 其他角色信息:")
            print(f"   - 包含 {role_count} 个其他角色的信息")
            
            # 显示角色列表
            role_names = []
            for line in lines:
                if line.startswith("=== 其他角色信息:"):
                    role_name = line.replace("=== 其他角色信息:", "").replace("===", "").strip()
                    role_names.append(role_name)
            
            print(f"   - 角色列表: {', '.join(role_names)}")
            
            # 显示第一个角色的信息结构
            if role_names:
                print(f"\n📋 第一个角色({role_names[0]})的信息结构:")
                in_first_role = False
                role_lines = []
                
                for line in lines:
                    if line.startswith(f"=== 其他角色信息: {role_names[0]}"):
                        in_first_role = True
                        role_lines.append(line)
                    elif in_first_role:
                        if line.startswith("=== 其他角色信息:"):
                            break
                        role_lines.append(line)
                
                # 显示前10行
                for i, line in enumerate(role_lines[:10], 1):
                    print(f"     {i:2d}| {line}")
                if len(role_lines) > 10:
                    print(f"     ... (还有 {len(role_lines) - 10} 行)")
            
            return all_checks_passed
        else:
            print("❌ 向量化处理失败")
            return False
            
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def check_chat_route_integration():
    """检查聊天路由中的集成情况"""
    print("\n🔧 检查聊天路由集成")
    print("-" * 40)
    
    try:
        # 读取聊天路由文件，检查修改是否正确应用
        chat_routes_file = Path(__file__).parent.parent / "chat_routes.py"
        
        if not chat_routes_file.exists():
            print("❌ 聊天路由文件不存在")
            return False
        
        content = chat_routes_file.read_text(encoding='utf-8')
        
        # 检查关键修改是否存在
        checks = [
            ("【其他角色信息】以下是聊天中提到的其他角色的相关信息，仅供参考，你不要扮演这些角色", "其他角色信息标识"),
            ("【重要】你必须严格扮演以下角色，不可以扮演其他任何角色", "强制角色扮演指令"),
            ("【玩家角色】我扮演的角色", "玩家角色标识")
        ]
        
        all_checks_passed = True
        print("聊天路由修改检查:")
        
        for check_text, description in checks:
            if check_text in content:
                print(f"   ✅ {description}")
            else:
                print(f"   ❌ {description}")
                all_checks_passed = False
        
        return all_checks_passed
        
    except Exception as e:
        print(f"❌ 检查聊天路由失败: {e}")
        return False

def main():
    """主测试函数"""
    print("🚀 开始实际聊天提示词测试")
    print("=" * 80)
    
    # 测试1: 向量化上下文
    context_test = test_actual_chat_prompt()
    
    # 测试2: 聊天路由集成
    route_test = check_chat_route_integration()
    
    # 输出结果
    print(f"\n🎊 测试结果总结")
    print("=" * 80)
    print(f"🧪 向量化上下文测试: {'✅ 通过' if context_test else '❌ 失败'}")
    print(f"🔧 聊天路由集成测试: {'✅ 通过' if route_test else '❌ 失败'}")
    
    overall_success = context_test and route_test
    print(f"\n🏆 总体结果: {'✅ 所有测试通过' if overall_success else '❌ 部分测试失败'}")
    
    if overall_success:
        print(f"\n🎉 提示词修复验证成功！")
        print(f"✨ 现在AI将能够:")
        print(f"   • 明确知道自己应该扮演哪个角色")
        print(f"   • 理解其他角色信息仅供参考")
        print(f"   • 严格按照指定角色进行回答")
        print(f"   • 不会混淆自己的身份")
        
        print(f"\n📝 下一步建议:")
        print(f"   1. 在实际聊天中测试效果")
        print(f"   2. 观察AI是否严格按照指定角色回答")
        print(f"   3. 如有问题可进一步调整提示词强度")
    else:
        print(f"\n⚠️ 需要进一步调试的问题")
    
    return overall_success

if __name__ == "__main__":
    main()
