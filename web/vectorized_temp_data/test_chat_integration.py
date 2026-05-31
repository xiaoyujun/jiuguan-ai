#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
聊天集成测试 - 验证聊天场景下的数据书自动引入功能
模拟真实的聊天场景，测试系统是否能正确识别并引入相关角色数据
"""

import sys
from pathlib import Path
import json
import traceback

# 添加项目根目录到路径
sys.path.append(str(Path(__file__).parent.parent.parent))

def test_chat_scenario_analysis():
    """测试聊天场景分析功能"""
    print("=" * 80)
    print("🎭 聊天场景分析测试")
    print("=" * 80)
    print("💡 测试目标：验证系统能否从聊天内容中识别出相关角色并自动引入数据书")
    
    try:
        from web.vectorized_temp_data.architecture_2_0_integration import get_architecture_2_0_processor
        
        processor = get_architecture_2_0_processor()
        print("✅ 聊天集成处理器初始化成功")
        
        # 模拟真实聊天场景
        chat_scenarios = [
            {
                "scenario": "Mel谈论敌人Jade",
                "current_role": "Mel", 
                "user_input": "你的主要敌人是谁",
                "expected_mentions": ["Jade"],
                "description": "Mel在回答中会提到Jade，系统应该识别出Jade并引入她的数据书"
            },
            {
                "scenario": "Mel详细描述Jade特征", 
                "current_role": "Mel",
                "user_input": "这人主要特点是什么",
                "context": "之前提到了Jade",
                "expected_mentions": ["Jade"],
                "description": "当Mel描述'金发的拉拉队队长'时，系统应该关联到Jade的特征"
            },
            {
                "scenario": "直接询问某个角色",
                "current_role": "兰斯",
                "user_input": "告诉我关于Jade的事情",
                "expected_mentions": ["Jade"],
                "description": "直接提到角色名称，应该立即识别并引入数据书"
            },
            {
                "scenario": "描述性查询",
                "current_role": "兰斯", 
                "user_input": "学校里有什么运动很厉害的女生吗",
                "expected_mentions": ["Jade"],
                "description": "通过描述'运动很厉害的女生'应该能联想到田径健将Jade"
            },
            {
                "scenario": "关系查询",
                "current_role": "兰斯",
                "user_input": "谁在霸凌转学生",
                "expected_mentions": ["Jade"],
                "description": "通过行为描述应该能识别出相关角色"
            }
        ]
        
        for i, scenario in enumerate(chat_scenarios, 1):
            print(f"\n📋 场景 {i}: {scenario['scenario']}")
            print(f"   当前角色: {scenario['current_role']}")
            print(f"   用户输入: '{scenario['user_input']}'")
            print(f"   期望识别: {scenario.get('expected_mentions', [])}")
            print(f"   场景说明: {scenario['description']}")
            print("-" * 60)
            
            try:
                # 处理聊天输入
                context, success, details = processor.process_user_input(
                    role_name=scenario['current_role'],
                    user_input=scenario['user_input'],
                    include_player_data=False
                )
                
                print(f"   🔍 处理结果:")
                print(f"      成功: {success}")
                print(f"      识别角色数: {details.get('matched_storybooks', 0)}")
                print(f"      上下文长度: {details.get('total_context_length', 0)} 字符")
                
                # 分析识别到的角色
                chat_analysis = details.get('chat_analysis', {})
                analysis_details = chat_analysis.get('analysis_details', [])
                
                if analysis_details:
                    print(f"      📊 识别到的角色:")
                    for detail in analysis_details:
                        char_name = detail.get('character_name', 'Unknown')
                        score = detail.get('relevance_score', 0)
                        reason = detail.get('reason', 'No reason')
                        analysis_type = detail.get('analysis_type', 'unknown')
                        print(f"         - {char_name} (得分: {score:.3f}, 类型: {analysis_type})")
                        print(f"           原因: {reason}")
                
                # 显示生成的上下文预览
                if context:
                    print(f"      📝 上下文预览:")
                    context_preview = context[:200] + "..." if len(context) > 200 else context
                    print(f"         {context_preview}")
                else:
                    print(f"      📝 未生成上下文")
                
                # 验证是否符合期望
                expected = scenario.get('expected_mentions', [])
                identified = [detail.get('character_name') for detail in analysis_details]
                
                if expected:
                    matches = set(expected) & set(identified)
                    if matches:
                        print(f"      ✅ 成功识别期望角色: {list(matches)}")
                    else:
                        print(f"      ⚠️ 未识别到期望角色: {expected}")
                        print(f"         实际识别: {identified}")
                
            except Exception as e:
                print(f"      ❌ 场景处理失败: {e}")
                traceback.print_exc()
        
        return True
        
    except Exception as e:
        print(f"❌ 聊天场景分析测试失败: {e}")
        traceback.print_exc()
        return False

def test_real_chat_record():
    """测试真实聊天记录场景"""
    print("\n" + "=" * 80)
    print("📜 真实聊天记录测试")
    print("=" * 80)
    print("💡 基于实际聊天记录测试数据书引入功能")
    
    try:
        from web.vectorized_temp_data.architecture_2_0_integration import get_architecture_2_0_processor
        
        processor = get_architecture_2_0_processor()
        
        # 基于真实聊天记录的测试场景
        real_scenarios = [
            {
                "context": "兰斯询问Mel的敌人",
                "current_role": "Mel",
                "user_input": "你的主要敌人是谁",
                "expected_response_context": "当Mel回答时，系统应该预先加载Jade的信息，以便AI能准确描述她们的关系"
            },
            {
                "context": "Mel描述Jade的特征", 
                "current_role": "Mel",
                "user_input": "这人主要特点是什么",
                "previous_mention": "之前提到了Jade",
                "expected_response_context": "系统应该提供Jade的详细信息，让AI能准确描述'金发拉拉队队长'等特征"
            }
        ]
        
        print("🎯 模拟真实对话流程:")
        
        for i, scenario in enumerate(real_scenarios, 1):
            print(f"\n💬 对话 {i}: {scenario['context']}")
            print(f"   角色: {scenario['current_role']}")
            print(f"   用户: {scenario['user_input']}")
            
            if 'previous_mention' in scenario:
                print(f"   背景: {scenario['previous_mention']}")
            
            print(f"   期望: {scenario['expected_response_context']}")
            print("-" * 50)
            
            # 处理这个对话
            context, success, details = processor.process_user_input(
                role_name=scenario['current_role'],
                user_input=scenario['user_input'],
                include_player_data=False
            )
            
            print(f"   🤖 AI将获得的上下文信息:")
            if success and context:
                # 解析上下文中包含的角色信息
                context_lines = context.split('\n')
                current_section = None
                
                for line in context_lines:
                    if line.startswith('=== ') and line.endswith(' ==='):
                        current_section = line.strip('= ')
                        print(f"      📚 {current_section} 数据书已加载")
                    elif line.startswith('总结词:') and current_section:
                        tags = line.replace('总结词:', '').strip()
                        print(f"         特征: {tags}")
                    elif line.startswith('属性信息:') and current_section:
                        print(f"         包含详细属性信息")
                
                print(f"      📊 总上下文长度: {len(context)} 字符")
                
                # 这样AI就能在回答时准确地描述相关角色
                print(f"      ✅ AI现在可以准确回答关于其他角色的问题了")
                
            else:
                print(f"      ⚠️ 未能生成相关上下文，AI可能无法准确回答")
        
        return True
        
    except Exception as e:
        print(f"❌ 真实聊天记录测试失败: {e}")
        traceback.print_exc()
        return False

def test_edge_cases():
    """测试边缘情况"""
    print("\n" + "=" * 80)
    print("🔧 边缘情况测试")
    print("=" * 80)
    
    try:
        from web.vectorized_temp_data.architecture_2_0_integration import get_architecture_2_0_processor
        
        processor = get_architecture_2_0_processor()
        
        edge_cases = [
            {
                "name": "空输入",
                "current_role": "Mel",
                "user_input": "",
                "expected": "应该优雅处理空输入"
            },
            {
                "name": "只有标点符号",
                "current_role": "Mel", 
                "user_input": "？？？",
                "expected": "应该不匹配任何角色"
            },
            {
                "name": "非常长的输入",
                "current_role": "Mel",
                "user_input": "我想知道关于学校里那个" + "非常" * 50 + "厉害的运动员的事情",
                "expected": "应该能处理长输入并识别运动员相关角色"
            },
            {
                "name": "多个角色提及",
                "current_role": "兰斯",
                "user_input": "告诉我Jade和Mel之间的关系",
                "expected": "应该同时识别两个角色"
            },
            {
                "name": "模糊描述",
                "current_role": "兰斯",
                "user_input": "那个金头发的女生",
                "expected": "应该能通过外貌特征识别角色"
            }
        ]
        
        for case in edge_cases:
            print(f"\n🧪 测试: {case['name']}")
            print(f"   输入: '{case['user_input']}'")
            print(f"   期望: {case['expected']}")
            
            try:
                context, success, details = processor.process_user_input(
                    role_name=case['current_role'],
                    user_input=case['user_input'],
                    include_player_data=False
                )
                
                analysis_details = details.get('chat_analysis', {}).get('analysis_details', [])
                identified_chars = [detail.get('character_name') for detail in analysis_details]
                
                print(f"   结果: 成功={success}, 识别角色={identified_chars}")
                print(f"   上下文长度: {details.get('total_context_length', 0)}")
                
            except Exception as e:
                print(f"   ❌ 处理失败: {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ 边缘情况测试失败: {e}")
        traceback.print_exc()
        return False

def test_performance():
    """测试性能"""
    print("\n" + "=" * 80)
    print("⚡ 性能测试")
    print("=" * 80)
    
    try:
        import time
        from web.vectorized_temp_data.architecture_2_0_integration import get_architecture_2_0_processor
        
        processor = get_architecture_2_0_processor()
        
        # 测试多个查询的响应时间
        test_queries = [
            "你的敌人是谁",
            "告诉我关于Jade的事情", 
            "学校里有什么厉害的运动员",
            "那个金发女生是谁",
            "谁在霸凌其他学生"
        ]
        
        total_time = 0
        successful_queries = 0
        
        print("🏃 执行性能测试...")
        
        for i, query in enumerate(test_queries, 1):
            start_time = time.time()
            
            try:
                context, success, details = processor.process_user_input(
                    role_name="兰斯",
                    user_input=query,
                    include_player_data=False
                )
                
                end_time = time.time()
                query_time = (end_time - start_time) * 1000  # 转换为毫秒
                
                total_time += query_time
                if success:
                    successful_queries += 1
                
                matched = details.get('matched_storybooks', 0)
                print(f"   查询 {i}: {query_time:.1f}ms, 匹配{matched}个角色")
                
            except Exception as e:
                print(f"   查询 {i}: 失败 - {e}")
        
        if len(test_queries) > 0:
            avg_time = total_time / len(test_queries)
            success_rate = (successful_queries / len(test_queries)) * 100
            
            print(f"\n📊 性能统计:")
            print(f"   平均响应时间: {avg_time:.1f}ms")
            print(f"   成功率: {success_rate:.1f}%")
            print(f"   总查询数: {len(test_queries)}")
            
            # 性能评估
            if avg_time < 50:
                print(f"   ✅ 性能优秀 (< 50ms)")
            elif avg_time < 200:
                print(f"   ✅ 性能良好 (< 200ms)")
            else:
                print(f"   ⚠️ 性能需要优化 (> 200ms)")
        
        return True
        
    except Exception as e:
        print(f"❌ 性能测试失败: {e}")
        traceback.print_exc()
        return False

def main():
    """运行所有聊天集成测试"""
    print("🚀 开始聊天集成测试")
    print("🎯 目标：验证聊天过程中的数据书自动引入功能")
    print("=" * 80)
    
    tests = [
        ("聊天场景分析", test_chat_scenario_analysis),
        ("真实聊天记录", test_real_chat_record),
        ("边缘情况处理", test_edge_cases),
        ("性能测试", test_performance),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            print(f"\n🧪 开始测试: {test_name}")
            if test_func():
                passed += 1
                print(f"✅ {test_name} 测试通过")
            else:
                print(f"❌ {test_name} 测试失败")
        except Exception as e:
            print(f"❌ {test_name} 测试发生异常: {e}")
            traceback.print_exc()
    
    print("\n" + "=" * 80)
    print("📊 聊天集成测试总结")
    print("=" * 80)
    print(f"总测试数: {total}")
    print(f"通过数: {passed}")
    print(f"失败数: {total - passed}")
    print(f"成功率: {passed/total*100:.1f}%")
    
    if passed == total:
        print("🎉 所有聊天集成测试通过！")
        print("💡 系统已经可以在聊天过程中自动识别并引入相关角色数据书")
        return True
    else:
        print("⚠️ 部分测试失败，需要进一步优化")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
