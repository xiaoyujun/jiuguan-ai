import json

from web.utils import PathManager

def load_chat_history_settings():
    """加载聊天记录设置"""
    settings_path = PathManager.get_chat_history_settings_path()
    default_settings = {
        "max_history_length": 30,
        "enable_history_reduction": False,
        "reduction_interval": 20,
        "reduction_model": "medium_performance",
        "reduction_prompt": "请将以下聊天记录整理成第三人称旁白形式的简洁总结，保留重要的情节发展、角色互动和关键信息。只需要返回总结内容本身，不需要添加[旁白]或任何其他前缀。",
        "keep_recent_messages": 5
    }
    
    try:
        if settings_path.exists():
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
                # 合并默认设置，确保所有字段都存在
                for key, value in default_settings.items():
                    if key not in settings:
                        settings[key] = value
                return settings
        else:
            return default_settings
    except Exception as e:
        print(f"加载聊天记录设置失败: {e}")
        return default_settings

def _call_ai_for_summary(prompt, model_key):
    """调用AI进行总结的辅助函数"""
    try:
        from openai import OpenAI
        import json
        
        # 加载配置
        config_path = PathManager.get_config_path()
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # 获取模型配置
        models = config.get('chat_models', {}).get('models', {})
        model_config = models.get(model_key, {})
        
        if not model_config:
            print(f"❌ 找不到模型配置: {model_key}")
            return None
        
        # 创建OpenAI客户端
        client = OpenAI(
            api_key=model_config.get('api_key'),
            base_url=model_config.get('base_url')
        )
        
        # 调用API
        response = client.chat.completions.create(
            model=model_config.get('model'),
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        result = response.choices[0].message.content
        print(f"✅ AI总结完成，生成内容长度: {len(result) if result else 0} 字符")
        
        return result
        
    except Exception as e:
        print(f"❌ AI调用失败: {e}")
        import traceback
        traceback.print_exc()
        return None

def load_history(role_name, apply_limits=False):
    """
    加载角色的聊天历史记录
    
    Args:
        role_name: 角色名称
        apply_limits: 是否应用聊天记录限制（条数限制和减负）
    
    Returns:
        list: 聊天记录列表
    """
    path = PathManager.get_chat_records_dir() / f"{role_name}.json"
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # 如果是旧格式（直接是数组），返回对话历史
            if isinstance(data, list):
                history = data
            # 如果是新格式（包含对话历史和数据书数据），返回对话历史部分
            elif isinstance(data, dict) and "对话历史" in data:
                history = data["对话历史"]
            else:
                history = []
                
        # 如果需要应用限制，调用限制函数
        if apply_limits:
            return get_limited_history_from_data(history, role_name)
        else:
            return history
            
    except:
        return []

def get_limited_history_from_data(history, role_name):
    """
    从原始历史数据中获取有限制的历史记录
    
    Args:
        history: 原始历史记录列表
        role_name: 角色名称
    
    Returns:
        list: 经过限制处理的历史记录
    """
    settings = load_chat_history_settings()
    
    # 应用减负（如果启用）
    if settings.get('enable_history_reduction', False):
        history = apply_history_reduction_to_data(history, role_name, settings)
    
    # 限制返回的记录条数
    max_length = settings.get('max_history_length', 30)
    if len(history) > max_length:
        return history[-max_length:]
    
    return history

def apply_history_reduction_to_data(history, role_name, settings):
    """
    对历史记录数据应用减负处理
    
    Args:
        history: 历史记录列表
        role_name: 角色名称
        settings: 聊天记录设置
    
    Returns:
        list: 处理后的历史记录
    """
    max_length = settings.get('max_history_length', 30)
    reduction_interval = settings.get('reduction_interval', 20)
    keep_recent = settings.get('keep_recent_messages', 5)
    
    # 如果历史记录长度未超过限制，不需要减负
    if len(history) <= max_length:
        return history
    
    # 计算需要减负的条数
    excess_count = len(history) - max_length
    
    if excess_count < reduction_interval:
        return history
    
    print(f"🔄 自动减负: {role_name} ({len(history)}条 超出{excess_count}条)")
    
    try:
        # 导入AI API相关模块
        import sys
        sys.path.append('..')
        from .utils import load_config
        
        # 分离要减负的记录和保留的记录
        to_reduce = history[:-keep_recent] if keep_recent > 0 else history
        to_keep = history[-keep_recent:] if keep_recent > 0 else []
        
        # 计算要压缩的记录数
        reduce_count = min(reduction_interval, len(to_reduce))
        
        if reduce_count <= 0:
            return history
        
        # 取出要压缩的记录
        records_to_compress = to_reduce[:reduce_count]
        remaining_records = to_reduce[reduce_count:]
        
        # 构建用于AI总结的文本
        chat_text = "\n".join(records_to_compress)
        
        # 获取模型配置
        config = load_config()
        model_tier = settings.get('reduction_model', 'medium_performance')
        model_tiers = config.get('model_tiers', {})
        
        if model_tier not in model_tiers:
            model_tier = 'medium_performance'
        
        default_model = model_tiers[model_tier].get('default_model', 'deepseek-v3')
        
        # 调用AI进行总结
        prompt = settings.get('reduction_prompt', '请将以下聊天记录整理成第三人称旁白形式的简洁总结，保留重要的情节发展、角色互动和关键信息。只需要返回总结内容本身，不需要添加[旁白]或任何其他前缀。')
        full_prompt = f"{prompt}\n\n聊天记录:\n{chat_text}"
        
        # 调用AI API进行总结
        summary_response = _call_ai_for_summary(full_prompt, default_model)
        
        if summary_response and summary_response.strip():
            # 创建新的历史记录列表
            new_history = []
            
            # 添加剩余的未压缩记录
            new_history.extend(remaining_records)
            
            # 添加AI总结作为旁白（使用统一的"角色: 内容"格式）
            summary_text = summary_response.strip()
            # 移除AI可能添加的[旁白]前缀
            if summary_text.startswith('[旁白]'):
                summary_text = summary_text[4:].strip()
            # 使用统一的格式：旁白: 内容
            summary_text = f"旁白: {summary_text}"
            new_history.append(summary_text)
            
            # 添加保留的最近记录
            new_history.extend(to_keep)
            
            print(f"✅ 减负完成: {len(history)} → {len(new_history)} 条 (压缩{reduce_count}条)")
            
            # 保存更新后的历史记录
            save_history(new_history, role_name)
            
            return new_history
        else:
            print("❌ AI总结失败，保持原有记录")
            return history
            
    except Exception as e:
        import traceback
        print(f"❌ 减负失败: {e}")
        traceback.print_exc()
        return history

def apply_full_history_reduction(history, role_name, keep_recent=3):
    """
    对所有聊天记录进行完整减负处理（指令专用）
    与普通减负不同，此函数会处理整个聊天记录，只保留最近几条
    
    Args:
        history: 历史记录列表
        role_name: 角色名称
        keep_recent: 保留最近的消息数量，默认3条（加上1条旁白总共4条）
    
    Returns:
        list: 处理后的历史记录
    """
    print(f"\n{'='*80}")
    print(f"🔄 完整聊天记录减负")
    print(f"{'='*80}")
    print(f"角色: {role_name} | 当前记录: {len(history) if history else 0} 条 | 保留最近: {keep_recent} 条")
    
    if not history or len(history) <= keep_recent:
        print(f"⚠️ 聊天记录太少，无需减负\n{'='*80}")
        return history
    
    try:
        # 导入AI API相关模块
        import sys
        sys.path.append('..')
        from .utils import load_config
        
        # 获取设置（函数定义在同一文件中）
        settings = load_chat_history_settings()
        
        # 分离要减负的记录和保留的记录
        to_reduce = history[:-keep_recent] if keep_recent > 0 else history
        to_keep = history[-keep_recent:] if keep_recent > 0 else []
        
        print(f"📦 要压缩: {len(to_reduce)} 条 | 保留最近: {len(to_keep)} 条")
        
        if not to_reduce:
            print(f"⚠️ 没有需要减负的记录\n{'='*80}")
            return history
        
        # 对所有要减负的记录进行处理
        chat_text = "\n".join(to_reduce)
        
        # 获取模型配置
        config = load_config()
        model_tier = settings.get('reduction_model', 'medium_performance')
        model_tiers = config.get('model_tiers', {})
        
        if model_tier not in model_tiers:
            print(f"⚠️ 无效的模型层级: {model_tier}，使用 medium_performance")
            model_tier = 'medium_performance'
        
        default_model = model_tiers[model_tier].get('default_model', 'deepseek-v3')
        print(f"🤖 使用模型: {default_model} | 文本长度: {len(chat_text)} 字符")
        
        # 调用AI进行总结
        prompt = settings.get('reduction_prompt', '请将以下聊天记录整理成第三人称旁白形式的简洁总结，保留重要的情节发展、角色互动和关键信息。只需要返回总结内容本身，不需要添加[旁白]或任何其他前缀。')
        full_prompt = f"{prompt}\n\n聊天记录:\n{chat_text}"
        
        # 调用AI API进行总结
        summary_response = _call_ai_for_summary(full_prompt, default_model)
        
        if summary_response and summary_response.strip():
            # 创建新的历史记录列表
            new_history = []
            
            # 添加AI总结作为旁白（使用统一的"角色: 内容"格式）
            summary_text = summary_response.strip()
            # 移除AI可能添加的[旁白]前缀
            if summary_text.startswith('[旁白]'):
                summary_text = summary_text[4:].strip()
            # 使用统一的格式：旁白: 内容
            summary_text = f"旁白: {summary_text}"
            new_history.append(summary_text)
            
            # 添加保留的最近记录
            new_history.extend(to_keep)
            
            print(f"✅ 减负完成: {len(history)} 条 → {len(new_history)} 条 (旁白1条 + 保留{len(to_keep)}条)")
            
            # 保存更新后的历史记录
            save_history(new_history, role_name)
            print(f"💾 已保存到文件\n{'='*80}")
            
            return new_history
        else:
            print(f"❌ AI总结失败，保持原有记录\n{'='*80}")
            return history
            
    except Exception as e:
        import traceback
        print(f"❌ 减负失败: {e}")
        print(traceback.format_exc())
        print(f"{'='*80}")
        return history

def save_history(history, role_name, story_data=None):
    path = PathManager.get_chat_records_dir() / f"{role_name}.json"
    
    # 加载现有数据
    existing_data = {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
            # 如果是旧格式，转换为新格式
            if isinstance(existing_data, list):
                existing_data = {
                    "对话历史": existing_data,
                    "数据书临时数据": {}
                }
    except:
        existing_data = {
            "对话历史": [],
            "数据书临时数据": {}
        }
    
    # 更新对话历史
    existing_data["对话历史"] = history
    
    # 智能更新数据书临时数据（避免重复写入）
    if story_data:
        if "数据书临时数据" not in existing_data:
            existing_data["数据书临时数据"] = {}
        
        # 检查每个数据书数据是否已存在且相同
        updated_stories = []
        for story_name, new_story_data in story_data.items():
            existing_story_data = existing_data["数据书临时数据"].get(story_name)
            
            if existing_story_data is None:
                # 如果不存在，直接添加
                existing_data["数据书临时数据"][story_name] = new_story_data
                updated_stories.append(f"新增: {story_name}")
            elif existing_story_data != new_story_data:
                # 如果存在但数据不同，更新数据
                existing_data["数据书临时数据"][story_name] = new_story_data
                updated_stories.append(f"更新: {story_name}")
            # 如果数据完全相同，跳过更新
        
        if updated_stories:
            print(f"数据书临时数据变更: {', '.join(updated_stories)}")
        else:
            print("数据书临时数据无变化，跳过重复写入")
    
    # 保存数据
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, ensure_ascii=False, indent=2)

def get_story_temp_data(role_name):
    """获取角色聊天记录中的数据书临时数据"""
    path = PathManager.get_chat_records_dir() / f"{role_name}.json"
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, dict) and "数据书临时数据" in data:
                return data["数据书临时数据"]
            else:
                return {}
    except:
        return {}

def save_story_temp_data(role_name, temp_data):
    """保存角色聊天记录中的数据书临时数据（智能去重）"""
    path = PathManager.get_chat_records_dir() / f"{role_name}.json"
    
    # 加载现有数据
    existing_data = {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
            # 如果是旧格式，转换为新格式
            if isinstance(existing_data, list):
                existing_data = {
                    "对话历史": existing_data,
                    "数据书临时数据": {}
                }
    except:
        existing_data = {
            "对话历史": [],
            "数据书临时数据": {}
        }
    
    # 智能更新数据书临时数据（避免不必要的写入）
    current_temp_data = existing_data.get("数据书临时数据", {})
    
    # 比较新旧数据是否相同
    if current_temp_data == temp_data:
        print(f"角色 {role_name} 的数据书临时数据无变化，跳过写入")
        return
    
    # 分析具体变化
    changed_stories = []
    for story_name, new_data in temp_data.items():
        if story_name not in current_temp_data:
            changed_stories.append(f"新增: {story_name}")
        elif current_temp_data[story_name] != new_data:
            changed_stories.append(f"更新: {story_name}")
    
    # 检查删除的数据书
    for story_name in current_temp_data:
        if story_name not in temp_data:
            changed_stories.append(f"移除: {story_name}")
    
    if changed_stories:
        print(f"角色 {role_name} 数据书临时数据变更: {', '.join(changed_stories)}")
    
    # 更新数据书临时数据
    existing_data["数据书临时数据"] = temp_data
    
    # 保存数据
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, ensure_ascii=False, indent=2)

def clear_story_temp_data(role_name):
    """清除角色聊天记录中的数据书临时数据"""
    path = PathManager.get_chat_records_dir() / f"{role_name}.json"
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, dict):
                data["数据书临时数据"] = {}
                with open(path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
    except:
        pass

def clear_chat_history(role_name):
    """清除角色的聊天记录，保留数据书临时数据"""
    path = PathManager.get_chat_records_dir() / f"{role_name}.json"
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, dict):
                # 保留数据书临时数据，只清空对话历史
                data["对话历史"] = []
                with open(path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
            elif isinstance(data, list):
                # 如果是旧格式，直接清空
                with open(path, 'w', encoding='utf-8') as f:
                    json.dump([], f, ensure_ascii=False, indent=2)
    except:
        pass

def get_temp_data_entry_log(role_name):
    """获取角色聊天记录中的临时数据录入记录"""
    path = PathManager.get_chat_records_dir() / f"{role_name}.json"
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, dict) and "临时数据录入记录" in data:
                return data["临时数据录入记录"]
            else:
                return {}
    except:
        return {}

def save_temp_data_entry_log(role_name, story_name, entry_info):
    """保存临时数据录入记录"""
    path = PathManager.get_chat_records_dir() / f"{role_name}.json"
    
    # 加载现有数据
    existing_data = {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
            # 如果是旧格式，转换为新格式
            if isinstance(existing_data, list):
                existing_data = {
                    "对话历史": existing_data,
                    "数据书临时数据": {},
                    "临时数据录入记录": {}
                }
    except:
        existing_data = {
            "对话历史": [],
            "数据书临时数据": {},
            "临时数据录入记录": {}
        }
    
    # 确保录入记录字段存在
    if "临时数据录入记录" not in existing_data:
        existing_data["临时数据录入记录"] = {}
    
    # 添加录入记录
    import datetime
    entry_info['timestamp'] = datetime.datetime.now().isoformat()
    existing_data["临时数据录入记录"][story_name] = entry_info
    
    # 保存数据
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, ensure_ascii=False, indent=2)
    
    print(f"保存录入记录: {role_name} - {story_name} - {entry_info.get('reason', '未知原因')}")