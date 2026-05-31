"""
临时数据录入系统演示
展示如何使用临时数据提取器从聊天记录中提取[]数据并进行处理
"""

import json
from temp_data_extractor import get_temp_data_extractor


def demo_bracket_parsing():
    """演示各种[]格式的解析能力"""
    print("=" * 60)
    print("🎯 临时数据录入系统 - 方括号解析演示")
    print("=" * 60)
    
    extractor = get_temp_data_extractor()
    
    # 测试用例
    test_cases = [
        # 基本格式：对象.属性/值
        "[兰斯.学分/80]",
        "[兰斯.生命值/75]",
        "[Mel.金币/500]",
        
        # 复合格式：对象.物品.状态  
        "[兰斯.背包.血瓶/已使用]",
        "[Mel.装备.武器/破损]",
        "[女仆莉塔.工具.扫帚/完好]",
        
        # 环境和系统状态
        "[当前区域: 生活岛 - 宿舍区]",
        "[时间: 第3天 早上 7:00]",
        "[天气.状态/晴朗]",
        
        # 复杂格式（需要AI处理）
        "[兰斯的心情变得很好，获得了额外的精神力加成]",
        "[莉塔完成了家务任务，获得了主人的赞赏]",
        "[因为天气晴朗，所有角色的心情都有所提升]",
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n--- 测试用例 {i} ---")
        print(f"原始内容: {test_case}")
        
        # 提取[]中的内容
        bracket_content = test_case.strip('[]')
        
        # 尝试直接解析
        parse_result = extractor._parse_bracket_content(bracket_content)
        
        if parse_result['success']:
            print("✅ 直接解析成功:")
            print(f"   结果: {json.dumps(parse_result['data'], ensure_ascii=False, indent=4)}")
        else:
            print("⚠️ 需要AI处理:")
            print(f"   原因: {parse_result.get('error', '未知')}")
            
            # 使用AI处理
            ai_result = extractor._ai_process_bracket(bracket_content, "演示角色")
            if ai_result['success']:
                print("🤖 AI处理成功:")
                print(f"   结果: {json.dumps(ai_result['data'], ensure_ascii=False, indent=4)}")
            else:
                print(f"❌ AI处理失败: {ai_result.get('error', '未知错误')}")


def demo_chat_extraction():
    """演示从聊天记录中提取临时数据"""
    print("\n" + "=" * 60)
    print("🔍 从聊天记录提取临时数据演示")
    print("=" * 60)
    
    extractor = get_temp_data_extractor()
    
    # 模拟聊天消息
    test_messages = [
        # 用户消息
        "用户: 我想查看一下兰斯的状态",
        
        # AI响应（包含[]数据）
        """学院系统: [兰斯.学分/80, 生命值/75, 精神力/60, 声望/30, 阵营倾向/中立]
[当前区域: 生活岛 - 宿舍区]
[时间: 第3天 早上 7:00]

我揉了揉眼睛，从床上坐起来。宿舍里还很安静，其他室友都在熟睡。今天的任务是去食堂吃早餐，然后去图书馆查资料。

[兰斯.背包.血瓶/3瓶] [兰斯.装备.学院制服/穿着中]""",
        
        # 用户操作
        "用户: 兰斯使用一瓶血瓶",
        
        # AI响应
        """学院系统: [兰斯.生命值/100] [兰斯.背包.血瓶/2瓶]

兰斯感到身体的疲劳瞬间消散，精神状态恢复到了最佳。"""
    ]
    
    for i, message in enumerate(test_messages, 1):
        print(f"\n--- 处理消息 {i} ---")
        print(f"消息内容: {message[:50]}...")
        
        # 从消息中提取临时数据
        result = extractor.extract_from_message(message, "演示角色")
        
        if result['success']:
            temp_data = result.get('temp_data', {})
            if temp_data:
                print("✅ 提取到临时数据:")
                print(json.dumps(temp_data, ensure_ascii=False, indent=2))
                
                processing_details = result.get('processing_details', [])
                if processing_details:
                    print("\n📋 处理详情:")
                    for detail in processing_details:
                        method = detail.get('method', 'unknown')
                        content = detail.get('content', '')
                        if method == 'direct_parse':
                            print(f"   ✅ 直接解析: [{content}]")
                        elif method == 'ai_process':
                            print(f"   🤖 AI处理: [{content}]")
                        elif method == 'failed':
                            print(f"   ❌ 处理失败: [{content}] - {detail.get('error', '')}")
            else:
                print("ℹ️ 未发现[]数据")
        else:
            print(f"❌ 处理失败: {result.get('error', '未知错误')}")


def demo_overlaying_mechanism():
    """演示临时数据覆盖机制"""
    print("\n" + "=" * 60)
    print("🔄 临时数据覆盖机制演示")
    print("=" * 60)
    
    extractor = get_temp_data_extractor()
    
    # 模拟连续的数据更新
    update_sequence = [
        # 初始状态
        "[兰斯.学分/80] [兰斯.生命值/75]",
        
        # 第一次更新
        "[兰斯.学分/85] [兰斯.背包.血瓶/3瓶]",
        
        # 第二次更新（覆盖）
        "[兰斯.学分/90] [兰斯.背包.血瓶/2瓶] [兰斯.生命值/100]",
        
        # 第三次更新（添加新数据）
        "[兰斯.声望/35] [兰斯.装备.武器/学院长剑]"
    ]
    
    print("模拟连续更新过程:")
    for i, update in enumerate(update_sequence, 1):
        print(f"\n--- 更新 {i} ---")
        print(f"输入: {update}")
        
        result = extractor.extract_from_message(update, "覆盖演示")
        if result['success']:
            temp_data = result.get('temp_data', {})
            if temp_data:
                print("提取到:")
                print(json.dumps(temp_data, ensure_ascii=False, indent=2))
    
    print("\n🎯 最终结果演示:")
    print("由于覆盖机制，相同格式的新数据会覆盖旧数据，")
    print("最终临时数据应该包含所有最新的状态信息。")


def demo_integration_workflow():
    """演示完整的集成工作流程"""
    print("\n" + "=" * 60)
    print("🚀 完整集成工作流程演示")
    print("=" * 60)
    
    workflow_steps = [
        "1. 用户发送消息到聊天接口",
        "2. AI生成响应，响应中包含[]数据",
        "3. 聊天路由调用临时数据提取器",
        "4. 提取器使用正则表达式提取[]中的内容",
        "5. 对每个[]内容尝试直接解析",
        "6. 无法解析的内容交给AI处理",
        "7. 将处理后的数据合并并覆盖到临时数据",
        "8. 前端接收[TEMP_DATA_EXTRACTED]标记",
        "9. 前端更新临时数据显示和管理"
    ]
    
    print("完整工作流程:")
    for step in workflow_steps:
        print(f"   {step}")
    
    print("\n🔧 技术特点:")
    features = [
        "✅ 自动化：无需手动操作，AI响应中的[]数据自动提取",
        "✅ 智能化：支持正则直接解析和AI智能处理两种模式", 
        "✅ 覆盖机制：相同格式新数据自动覆盖旧数据",
        "✅ 实时性：聊天过程中实时录入临时数据",
        "✅ 可扩展：易于添加新的解析规则和AI处理逻辑",
        "✅ 容错性：解析失败不影响正常聊天功能"
    ]
    
    for feature in features:
        print(f"   {feature}")


if __name__ == "__main__":
    print("🎯 临时数据录入系统完整演示")
    print("底层描述.yml 规则:")
    print('   当属性进行变更，比如送礼物，检定，使用物品以[]进行包裹')
    print('   格式：[对象.属性/物品.当前值/当前状态]')
    print('   如果要更新物品之类的状态应该[对象.物品.当前状态]')
    print()
    
    # 运行所有演示
    demo_bracket_parsing()
    demo_chat_extraction()
    demo_overlaying_mechanism()
    demo_integration_workflow()
    
    print("\n" + "=" * 60)
    print("✅ 演示完成！临时数据录入系统已就绪。")
    print("=" * 60)
