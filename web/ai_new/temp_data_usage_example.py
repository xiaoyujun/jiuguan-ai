"""
临时数据提取器使用示例
演示如何使用临时数据提取器从聊天记录中提取和处理[]数据
"""

from temp_data_extractor import get_temp_data_extractor
import json


def example_extract_from_chat():
    """示例：从聊天记录中提取数据"""
    extractor = get_temp_data_extractor()
    
    # 从家务女仆的聊天记录中提取
    result = extractor.extract_from_chat_history("家务女仆")
    
    print("=== 从聊天记录提取结果 ===")
    print(f"成功: {result['success']}")
    if result['success']:
        print(f"临时数据: {json.dumps(result.get('temp_data', {}), ensure_ascii=False, indent=2)}")
        print(f"处理详情: {json.dumps(result.get('processing_details', []), ensure_ascii=False, indent=2)}")
    else:
        print(f"错误: {result.get('error')}")
    
    return result


def example_extract_from_message():
    """示例：从单条消息中提取数据"""
    extractor = get_temp_data_extractor()
    
    # 测试消息
    test_messages = [
        "[兰斯.学分/80, 生命值/75, 精神力/60, 声望/30, 阵营倾向/中立]",
        "[当前区域: 生活岛 - 宿舍区]",
        "[时间: 第3天 早上 7:00]",
        "[兰斯.金币/100]",
        "[兰斯.背包.血瓶/已使用]",
        "[环境.天气/晴朗]"
    ]
    
    print("=== 从消息提取结果 ===")
    for message in test_messages:
        print(f"\n处理消息: {message}")
        result = extractor.extract_from_message(message, "测试角色")
        
        if result['success']:
            temp_data = result.get('temp_data', {})
            if temp_data:
                print(f"提取到: {json.dumps(temp_data, ensure_ascii=False, indent=2)}")
            else:
                print("未提取到数据")
        else:
            print(f"错误: {result.get('error')}")


def test_bracket_patterns():
    """测试各种[]格式的解析"""
    extractor = get_temp_data_extractor()
    
    test_cases = [
        "兰斯.学分/80",
        "兰斯.生命值/75",  
        "当前区域: 生活岛 - 宿舍区",
        "时间: 第3天 早上 7:00",
        "兰斯.背包.血瓶/已使用",
        "环境.天气/晴朗",
        "角色.状态.睡眠",
        "无法解析的复杂内容",
        "Mel.外貌.发色/金色",
        "系统.任务.主线任务/进行中"
    ]
    
    print("=== 测试不同[]格式解析 ===")
    for case in test_cases:
        print(f"\n测试: [{case}]")
        result = extractor._parse_bracket_content(case)
        
        if result['success']:
            print(f"直接解析成功: {json.dumps(result['data'], ensure_ascii=False, indent=2)}")
        else:
            print(f"需要AI处理: {result.get('error')}")
            # 可以进一步测试AI处理
            ai_result = extractor._ai_process_bracket(case, "测试角色")
            if ai_result['success']:
                print(f"AI处理成功: {json.dumps(ai_result['data'], ensure_ascii=False, indent=2)}")
            else:
                print(f"AI处理失败: {ai_result.get('error')}")


if __name__ == "__main__":
    print("临时数据提取器使用示例")
    print("=" * 50)
    
    # 测试格式解析
    test_bracket_patterns()
    
    print("\n" + "=" * 50)
    
    # 测试从消息提取
    example_extract_from_message()
    
    print("\n" + "=" * 50)
    
    # 测试从聊天记录提取
    example_extract_from_chat()
