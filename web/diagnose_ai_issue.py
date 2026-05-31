#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

# 导入必要的模块
from config_loader import *
from history_manager import *
import json
import yaml

def diagnose_ai_response_issue():
    """诊断AI为什么没有提到矿洞信息"""
    
    role_name = 'biabia'
    
    print("=== AI响应问题诊断 ===\n")
    
    # 1. 检查角色设定
    print("1. 角色设定检查:")
    current_role = load_current_role(role_name)
    print(f"biabia角色设定: {current_role.strip()}")
    
    if "矿洞" not in current_role and "探险" not in current_role:
        print("❌ 问题发现：角色设定中没有提到矿洞或探险相关内容")
        print("   AI主要依据角色设定来回应，如果角色设定过于简单，可能忽略临时数据")
    else:
        print("✅ 角色设定包含相关内容")
    
    # 2. 检查底层描述
    print("\n2. 底层描述检查:")
    base_description = load_base_description_text()
    print(f"底层描述内容: {base_description.strip()}")
    
    if "坚持自己的角色设定" in base_description:
        print("❌ 问题发现：底层描述强调'坚持自己的角色设定'")
        print("   这可能导致AI忽略临时数据，严格按照角色设定回应")
    
    if "简短回复" in base_description:
        print("⚠️  注意：底层描述要求'简短回复'")
        print("   这可能导致AI不详细描述环境信息")
    
    # 3. 检查系统提示结构
    print("\n3. 系统提示结构分析:")
    story_temp_data = get_story_temp_data(role_name)
    history = load_history(role_name)
    
    # 构建完整系统提示
    系统提示 = f"底层描述:\n{base_description}\n\n你扮演的角色:\n{current_role}\n\n我扮演的角色:\n{load_current_player()}"
    
    if story_temp_data:
        temp_data_str = json.dumps(story_temp_data, ensure_ascii=False, indent=2)
        系统提示 += f"\n\n当前场景的数据书临时数据（包含重要的环境信息、物品价格等）:\n{temp_data_str}"
    
    if history:
        系统提示 += "\n\n聊天历史:\n" + "\n".join(history[-10:])
    
    # 分析各部分的比重
    sections = [
        ("底层描述", base_description),
        ("角色设定", current_role),
        ("数据书临时数据", json.dumps(story_temp_data, ensure_ascii=False) if story_temp_data else ""),
        ("聊天历史", "\n".join(history) if history else "")
    ]
    
    print(f"系统提示总长度: {len(系统提示)} 字符")
    for name, content in sections:
        print(f"  {name}: {len(content)} 字符 ({len(content)/len(系统提示)*100:.1f}%)")
    
    # 4. 检查临时数据的位置
    print("\n4. 临时数据位置分析:")
    temp_data_position = 系统提示.find("当前场景的数据书临时数据")
    if temp_data_position > 0:
        position_ratio = temp_data_position / len(系统提示)
        print(f"临时数据在系统提示中的位置: {position_ratio:.1%}")
        if position_ratio > 0.5:
            print("⚠️  临时数据位置较靠后，可能被AI忽略")
        else:
            print("✅ 临时数据位置较靠前")
    
    # 5. 提供解决建议
    print("\n=== 解决建议 ===")
    print("1. 修改角色设定，添加对当前环境的感知能力")
    print("2. 在系统提示中更突出地强调临时数据的重要性")
    print("3. 调整底层描述，减少对'坚持角色设定'的强调")
    print("4. 将临时数据放在更靠前的位置")
    
    # 6. 输出优化后的系统提示建议
    print("\n=== 优化建议 ===")
    print("建议修改biabia.yml角色设定为：")
    print("""名字: biabia
介绍: 一只可爱的小猫咪，英短蓝猫今年1岁。biabia很聪明，能够感知周围的环境和情况，会根据当前所在的地点和场景做出相应的反应。""")
    
    print("\n建议优化系统提示结构，将临时数据前置：")
    print("1. 底层描述")
    print("2. 当前场景信息（数据书临时数据）← 提前到这里")
    print("3. 角色设定")
    print("4. 玩家设定")
    print("5. 聊天历史")

if __name__ == "__main__":
    diagnose_ai_response_issue()
