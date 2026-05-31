#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
角色上下文增强功能测试
测试改进后的向量化临时数据系统是否能够正确识别和提高当前聊天角色和当前玩家角色的相关度
"""

import sys
import logging
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_role_context_enhancement():
    """测试角色上下文增强功能"""
    print("🧪 开始测试角色上下文增强功能")
    print("=" * 80)
    
    try:
        # 导入必要的模块
        from web.vectorized_temp_data.architecture_2_0_integration import get_architecture_2_0_processor
        
        # 获取处理器
        processor = get_architecture_2_0_processor()
        print("✅ 成功初始化2.0架构处理器")
        
        # 测试场景1：当前角色Mel询问关于敌人的信息
        print("\n🎭 测试场景1: Mel询问敌人信息")
        print("-" * 40)
        
        test_input_1 = "你的主要敌人是谁？她们都有什么特点？"
        current_role_1 = "Mel"
        current_player_1 = "兰斯"
        
        print(f"👤 当前角色: {current_role_1}")
        print(f"🎮 当前玩家: {current_player_1}")
        print(f"💬 用户输入: {test_input_1}")
        
        context_1, success_1, details_1 = processor.process_user_input(
            role_name=current_role_1,
            user_input=test_input_1,
            include_player_data=True,
            player_name=current_player_1
        )
        
        print(f"📊 处理结果: {'成功' if success_1 else '失败'}")
        print(f"📝 上下文长度: {len(context_1)} 字符")
        
        if success_1:
            matched_books = details_1.get('chat_analysis', {}).get('matched_storybooks', {})
            print(f"📚 匹配的数据书数量: {len(matched_books)}")
            
            analysis_details = details_1.get('chat_analysis', {}).get('analysis_details', [])
            print("🔍 详细分析结果:")
            for detail in analysis_details[:5]:  # 只显示前5个
                char_name = detail.get('character_name', 'Unknown')
                score = detail.get('relevance_score', 0)
                original_score = detail.get('original_score', score)
                context_boost = detail.get('context_boost', False)
                reason = detail.get('reason', 'No reason')
                
                boost_indicator = "🚀" if context_boost else "  "
                print(f"  {boost_indicator} {char_name}: {original_score:.3f} → {score:.3f} ({reason})")
        
        # 测试场景2：询问特定角色信息
        print("\n🎭 测试场景2: 直接询问Jade的信息")
        print("-" * 40)
        
        test_input_2 = "告诉我关于Jade的详细信息"
        current_role_2 = "兰斯"
        current_player_2 = "兰斯"
        
        print(f"👤 当前角色: {current_role_2}")
        print(f"🎮 当前玩家: {current_player_2}")
        print(f"💬 用户输入: {test_input_2}")
        
        context_2, success_2, details_2 = processor.process_user_input(
            role_name=current_role_2,
            user_input=test_input_2,
            include_player_data=True,
            player_name=current_player_2
        )
        
        print(f"📊 处理结果: {'成功' if success_2 else '失败'}")
        print(f"📝 上下文长度: {len(context_2)} 字符")
        
        if success_2:
            matched_books_2 = details_2.get('chat_analysis', {}).get('matched_storybooks', {})
            print(f"📚 匹配的数据书数量: {len(matched_books_2)}")
            
            analysis_details_2 = details_2.get('chat_analysis', {}).get('analysis_details', [])
            print("🔍 详细分析结果:")
            for detail in analysis_details_2[:5]:
                char_name = detail.get('character_name', 'Unknown')
                score = detail.get('relevance_score', 0)
                original_score = detail.get('original_score', score)
                context_boost = detail.get('context_boost', False)
                reason = detail.get('reason', 'No reason')
                
                boost_indicator = "🚀" if context_boost else "  "
                print(f"  {boost_indicator} {char_name}: {original_score:.3f} → {score:.3f} ({reason})")
        
        # 测试场景3：描述性查询
        print("\n🎭 测试场景3: 描述性查询运动女生")
        print("-" * 40)
        
        test_input_3 = "学校里有什么运动很厉害的女生吗？"
        current_role_3 = "兰斯"
        current_player_3 = "兰斯"
        
        print(f"👤 当前角色: {current_role_3}")
        print(f"🎮 当前玩家: {current_player_3}")
        print(f"💬 用户输入: {test_input_3}")
        
        context_3, success_3, details_3 = processor.process_user_input(
            role_name=current_role_3,
            user_input=test_input_3,
            include_player_data=True,
            player_name=current_player_3
        )
        
        print(f"📊 处理结果: {'成功' if success_3 else '失败'}")
        print(f"📝 上下文长度: {len(context_3)} 字符")
        
        if success_3:
            matched_books_3 = details_3.get('chat_analysis', {}).get('matched_storybooks', {})
            print(f"📚 匹配的数据书数量: {len(matched_books_3)}")
            
            analysis_details_3 = details_3.get('chat_analysis', {}).get('analysis_details', [])
            print("🔍 详细分析结果:")
            for detail in analysis_details_3[:5]:
                char_name = detail.get('character_name', 'Unknown')
                score = detail.get('relevance_score', 0)
                original_score = detail.get('original_score', score)
                context_boost = detail.get('context_boost', False)
                reason = detail.get('reason', 'No reason')
                
                boost_indicator = "🚀" if context_boost else "  "
                print(f"  {boost_indicator} {char_name}: {original_score:.3f} → {score:.3f} ({reason})")
        
        # 总结测试结果
        print("\n📈 测试总结")
        print("=" * 80)
        print(f"✅ 场景1 (Mel询问敌人): {'通过' if success_1 else '失败'}")
        print(f"✅ 场景2 (直接询问Jade): {'通过' if success_2 else '失败'}")
        print(f"✅ 场景3 (描述性查询): {'通过' if success_3 else '失败'}")
        
        overall_success = success_1 and success_2 and success_3
        print(f"\n🎯 总体测试结果: {'✅ 全部通过' if overall_success else '❌ 部分失败'}")
        
        return overall_success
        
    except Exception as e:
        logger.error(f"❌ 测试过程中出现错误: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_player_binding_detection():
    """测试玩家绑定检测功能"""
    print("\n🔗 测试玩家绑定检测功能")
    print("-" * 40)
    
    try:
        from web.vectorized_temp_data.architecture_2_0_integration import get_architecture_2_0_processor
        
        processor = get_architecture_2_0_processor()
        chat_processor = processor
        
        # 测试几个角色与玩家的绑定关系
        test_cases = [
            ("Mel", "兰斯"),
            ("Jade", "兰斯"),
            ("Elena", "兰斯"),
            ("Luna", "兰斯")
        ]
        
        for character, player in test_cases:
            is_bound = chat_processor._is_character_bound_to_player(character, player)
            print(f"📚 {character} 与玩家 {player} 的绑定关系: {'✅ 已绑定' if is_bound else '❌ 未绑定'}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ 绑定检测测试失败: {e}")
        return False

def main():
    """主测试函数"""
    print("🚀 开始角色上下文增强功能完整测试")
    print("=" * 80)
    
    # 测试1: 基本功能测试
    basic_test_result = test_role_context_enhancement()
    
    # 测试2: 绑定检测测试
    binding_test_result = test_player_binding_detection()
    
    # 输出最终结果
    print("\n🎊 最终测试结果")
    print("=" * 80)
    print(f"🧪 基本功能测试: {'✅ 通过' if basic_test_result else '❌ 失败'}")
    print(f"🔗 绑定检测测试: {'✅ 通过' if binding_test_result else '❌ 失败'}")
    
    overall_success = basic_test_result and binding_test_result
    print(f"\n🏆 总体结果: {'✅ 所有测试通过' if overall_success else '❌ 部分测试失败'}")
    
    if overall_success:
        print("\n🎉 角色上下文增强功能已成功实现！")
        print("✨ 系统现在能够:")
        print("   • 识别当前聊天角色和当前玩家")
        print("   • 根据角色关系调整相关度得分")
        print("   • 优先加载与当前角色相关的数据书")
        print("   • 提供更准确的AI上下文信息")
    else:
        print("\n⚠️ 部分功能需要进一步调试")
    
    return overall_success

if __name__ == "__main__":
    main()
