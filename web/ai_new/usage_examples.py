"""
AI新架构使用示例
演示如何使用新的AI功能模块
"""

import json
from .core_generator import CoreGenerator
from .global_modifier import GlobalModifier
from .smart_filter import SmartFilter
from .prompt_manager import PromptManager


def example_generate_character():
    """示例：生成角色数据书"""
    print("=== 示例：生成角色数据书 ===")
    
    generator = CoreGenerator()
    
    # 生成一个战士角色
    result = generator.generate_storybook(
        template_type='character',
        user_description='一个勇敢的战士，擅长使用双手剑，有着坚定的正义感。身高180cm，肌肉发达，有着金色的头发和蓝色的眼睛。',
        target_name='亚瑟·圣骑士'
    )
    
    if result['success']:
        print("✅ 角色生成成功！")
        print(f"角色数据: {json.dumps(result['data'], ensure_ascii=False, indent=2)}")
    else:
        print(f"❌ 角色生成失败: {result['error']}")
    
    return result


def example_analyze_temp_data():
    """示例：分析临时数据"""
    print("\n=== 示例：分析临时数据 ===")
    
    modifier = GlobalModifier()
    
    # 自动选择模式分析临时数据
    result = modifier.analyze_and_modify_temp_data(
        role_id='test_character',
        mode='auto_select',
        is_silent=False
    )
    
    if result['success']:
        if result['updated']:
            print("✅ 临时数据分析完成，有更新！")
            print(f"应用了 {result.get('applied_count', 0)} 个修改")
        else:
            print("✅ 临时数据分析完成，无需更新")
    else:
        print(f"❌ 临时数据分析失败: {result['message']}")
    
    return result


def example_filter_content():
    """示例：智能筛选"""
    print("\n=== 示例：智能筛选 ===")
    
    filter_engine = SmartFilter()
    
    # 模拟数据书列表
    sample_storybooks = [
        {
            'name': '勇者之剑',
            'summary': ['武器', '圣剑', '传说'],
            'tags': ['武器', '光属性'],
            'description': '传说中的圣剑，具有强大的光明力量'
        },
        {
            'name': '暗影斗篷',
            'summary': ['装备', '隐身', '暗属性'],
            'tags': ['装备', '暗属性'],
            'description': '神秘的斗篷，可以让穿戴者隐身'
        },
        {
            'name': '火焰法杖',
            'summary': ['法杖', '火属性', '魔法'],
            'tags': ['武器', '火属性'],
            'description': '强大的火属性法杖，可以释放火焰魔法'
        }
    ]
    
    # 筛选火属性相关的物品
    result = filter_engine.filter_by_prompt(
        filter_type='storybook',
        items=sample_storybooks,
        filter_prompt='筛选出与火焰或火属性相关的物品',
        max_results=5,
        is_silent=False
    )
    
    if result['success']:
        print("✅ 筛选成功！")
        print(f"从 {result['total_count']} 个项目中筛选出 {result['filtered_count']} 个结果")
        for item in result['filtered_items']:
            print(f"  - {item['name']}: {item['description']}")
    else:
        print(f"❌ 筛选失败: {result['error']}")
    
    return result


def example_multi_chat_responders():
    """示例：多人聊天回复者筛选"""
    print("\n=== 示例：多人聊天回复者筛选 ===")
    
    filter_engine = SmartFilter()
    
    # 模拟角色列表
    sample_characters = [
        {
            'name': '厨师长玛丽',
            'description': '经验丰富的厨师，擅长各种料理',
            'tags': ['厨师', '料理', '热情']
        },
        {
            'name': '战士杰克',
            'description': '勇敢的战士，专门负责战斗和保护',
            'tags': ['战士', '勇敢', '保护']
        },
        {
            'name': '魔法师莉莉',
            'description': '聪明的魔法师，精通各种魔法',
            'tags': ['魔法师', '聪明', '魔法']
        }
    ]
    
    # 模拟对话上下文
    dialogue_context = {
        'recent_messages': [
            {'speaker': '玩家', 'content': '我们今天晚餐吃什么好呢？'},
            {'speaker': '厨师长玛丽', 'content': '我可以做一些特色菜'},
            {'speaker': '玩家', 'content': '那需要什么食材？'}
        ],
        'current_topic': '讨论晚餐计划'
    }
    
    # 筛选合适的回复者
    result = filter_engine.filter_multi_chat_responders(
        characters=sample_characters,
        dialogue_context=dialogue_context,
        selection_criteria='选择最适合讨论食物和烹饪的角色',
        max_responders=2,
        is_silent=False
    )
    
    if result['success']:
        print("✅ 回复者筛选成功！")
        print(f"从 {result['total_characters']} 个角色中选择了 {result['selected_count']} 个回复者")
        for responder in result['selected_responders']:
            print(f"  - {responder['name']}: {responder['description']}")
    else:
        print(f"❌ 回复者筛选失败: {result['error']}")
    
    return result


def example_prompt_management():
    """示例：提示词管理"""
    print("\n=== 示例：提示词管理 ===")
    
    prompt_manager = PromptManager()
    
    # 获取角色生成提示词
    character_template = {
        "总结词": [],
        "属性": {
            "状态": {"名称": "", "描述": "", "性格特点": ""},
            "外貌特征": {"身高": "", "体重": "", "发色": "", "瞳色": "", "特征": ""},
            "能力值": {"力量": "0/100", "智力": "0/100", "生命": "100/100", "金币": "0"},
            "社交关系": {"朋友": [], "恋人": "无", "敌人等": []},
            "背包": {}
        }
    }
    
    prompt = prompt_manager.get_generation_prompt(
        template_type='character',
        template=character_template,
        user_description='一个神秘的法师',
        target_name='梅林'
    )
    
    print("✅ 获取角色生成提示词成功！")
    print(f"提示词长度: {len(prompt)} 字符")
    print(f"提示词预览: {prompt[:200]}...")
    
    # 获取临时数据分析提示词
    analysis_prompt = prompt_manager.get_temp_data_analysis_prompt()
    print(f"\n✅ 获取临时数据分析提示词成功！")
    print(f"分析提示词长度: {len(analysis_prompt)} 字符")
    
    return True


def example_batch_operations():
    """示例：批量操作"""
    print("\n=== 示例：批量操作 ===")
    
    generator = CoreGenerator()
    
    # 批量生成请求
    batch_requests = [
        {
            'template_type': 'character',
            'description': '一个聪明的学者，热爱研究古代文献',
            'name': '学者爱德华'
        },
        {
            'template_type': 'item',
            'description': '一本记录着古代魔法的神秘书籍',
            'name': '魔法典籍'
        },
        {
            'template_type': 'item',
            'description': '一座古老的图书馆，收藏着珍贵的书籍',
            'name': '古老图书馆'
        }
    ]
    
    # 执行批量生成
    result = generator.batch_generate_storyboks(batch_requests)
    
    if result['success']:
        print("✅ 批量生成成功！")
        print(f"成功生成 {result['success_count']}/{result['total_count']} 个数据书")
        
        for i, item_result in enumerate(result['results']):
            if item_result['success']:
                print(f"  ✅ 项目 {i+1}: {item_result.get('template_type', 'unknown')} 类型生成成功")
            else:
                print(f"  ❌ 项目 {i+1}: 生成失败 - {item_result.get('error', 'unknown error')}")
    else:
        print(f"❌ 批量生成失败: {result.get('error', 'unknown error')}")
    
    return result


def run_all_examples():
    """运行所有示例"""
    print("🚀 开始运行AI新架构使用示例...")
    
    try:
        # 运行各个示例
        example_generate_character()
        example_analyze_temp_data()
        example_filter_content()
        example_multi_chat_responders()
        example_prompt_management()
        example_batch_operations()
        
        print("\n🎉 所有示例运行完成！")
        print("\n📚 更多信息请参考 MIGRATION_GUIDE.md")
        
    except Exception as e:
        print(f"\n❌ 示例运行出错: {e}")
        import traceback
        print(f"详细错误: {traceback.format_exc()}")


if __name__ == '__main__':
    run_all_examples()
