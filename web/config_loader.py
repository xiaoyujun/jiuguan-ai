from pathlib import Path
import json
import yaml

from web.utils import PathManager

def load_base_description_text():
    path = PathManager.get_base_description_path()
    try:
        raw = path.read_text(encoding="utf-8")
    except Exception:
        return ""
    try:
        obj = yaml.safe_load(raw)
        if obj is None:
            return ""
        return yaml.dump(obj, default_flow_style=False, allow_unicode=True)
    except Exception:
        return raw

# load_global_world_book() 函数已删除
# 原因：旧的世界书加载方式会无条件加载所有世界书，导致prompt过长
# 现在使用智能关键词匹配系统：web.core.keyword_world_book.keyword_worldbook

def get_all_keywords():
    contents = {}
    # 关键词世界书
    path = PathManager.get_keyword_world_book_dir()
    for file_path in path.glob("*.yml"):
        try:
            raw = file_path.read_text(encoding="utf-8")
            obj = yaml.safe_load(raw)
            if isinstance(obj, dict) and "关键词" in obj and "描述" in obj:
                for kw in obj["关键词"]:
                    contents[kw] = obj["描述"]
        except Exception:
            pass
    # 数据书
    path = PathManager.get_storybook_dir()
    for file_path in path.glob("*.json"):
        try:
            raw = file_path.read_text(encoding="utf-8")
            obj = json.loads(raw)
            if isinstance(obj, dict) and "关键词" in obj:
                keywords = obj["关键词"]
                # 移除关键词部分
                other_parts = {k: v for k, v in obj.items() if k != "关键词"}
                content = json.dumps(other_parts, ensure_ascii=False, indent=2)
                for kw in keywords:
                    contents[kw] = content
        except Exception:
            pass
    return contents

def _exact_keyword_match(keyword: str, text: str) -> bool:
    """
    精确关键词匹配，支持中文和英文，避免部分匹配导致的误触发
    
    参数:
    keyword: 要匹配的关键词
    text: 要搜索的文本
    
    返回:
    bool: 是否精确匹配
    """
    import re
    
    # 如果关键词包含中文，使用简单的字符串匹配
    if re.search(r'[\u4e00-\u9fff]', keyword):
        # 中文关键词：检查是否存在完整匹配
        # 对于中文，我们简化处理：只要关键词存在于文本中就认为匹配
        return keyword in text
    else:
        # 英文关键词：使用单词边界
        pattern = r'\b' + re.escape(keyword) + r'\b'
        return bool(re.search(pattern, text))

def process_sentence_with_keywords(sentence):
    """
    处理句子中的关键词，现在支持数据书引用关系
    """
    try:
        # 尝试使用增强的引用处理
        import sys
        parent_dir = Path(__file__).parent.parent
        sys.path.insert(0, str(parent_dir))
        from web.core import process_keyword_triggers_with_references
        
        # 使用引用管理器处理关键词
        processed_sentence, triggered_stories = process_keyword_triggers_with_references(sentence)
        
        if triggered_stories:
            # 构建包含所有相关数据的句子
            all_keywords = get_all_keywords()
            placeholders = {}
            placeholder_counter = 0
            
            for keyword in all_keywords:
                # 使用精确匹配检查关键词
                if _exact_keyword_match(keyword, sentence):
                    placeholder = f"__PLACEHOLDER_{placeholder_counter}__"
                    sentence = sentence.replace(keyword, placeholder)
                    placeholders[placeholder] = keyword
                    placeholder_counter += 1
            
            for placeholder, keyword in placeholders.items():
                content = all_keywords[keyword]
                sentence = sentence.replace(placeholder, f"{keyword} ({content})")
            
            return processed_sentence, triggered_stories
        
    except ImportError:
        print("数据书引用管理器不可用，使用基础关键词处理")
    except Exception as e:
        print(f"使用引用管理器时出错: {e}，回退到基础处理")
    
    # 原有逻辑（兼容性保证） - 使用精确匹配
    all_keywords = get_all_keywords()
    placeholders = {}
    placeholder_counter = 0
    triggered_stories = {}  # 记录被触发的数据书数据
    
    for keyword in all_keywords:
        # 使用精确匹配检查关键词
        if _exact_keyword_match(keyword, sentence):
            placeholder = f"__PLACEHOLDER_{placeholder_counter}__"
            sentence = sentence.replace(keyword, placeholder)
            placeholders[placeholder] = keyword
            placeholder_counter += 1
            
            # 查找关键词对应的数据书文件
            story_file = find_story_by_keyword(keyword)
            if story_file:
                triggered_stories[story_file] = get_story_data(story_file)
                print(f"基础关键词触发: {story_file} (关键词: {keyword})")
    
    for placeholder, keyword in placeholders.items():
        content = all_keywords[keyword]
        sentence = sentence.replace(placeholder, f"{keyword} ({content})")
    
    return sentence, triggered_stories

def find_story_by_keyword(keyword):
    """根据关键词找到对应的数据书文件名"""
    path = PathManager.get_storybook_dir()
    for file_path in path.glob("*.json"):
        try:
            raw = file_path.read_text(encoding="utf-8")
            obj = json.loads(raw)
            if isinstance(obj, dict) and "关键词" in obj:
                if keyword in obj["关键词"]:
                    return file_path.stem
        except Exception:
            pass
    return None

def get_story_data(story_name):
    """获取完整的数据书数据"""
    path = PathManager.get_storybook_dir() / f"{story_name}.json"
    try:
        raw = path.read_text(encoding="utf-8")
        return json.loads(raw)
    except Exception:
        return None

def load_current_role(role_name):
    path = PathManager.get_roles_dir() / f"{role_name}.yml"
    try:
        raw = path.read_text(encoding="utf-8")
        obj = yaml.safe_load(raw)
        if obj is None:
            return ""
        
        # 过滤掉智能指令字段，只保留角色的基本信息
        filtered_obj = {}
        for key, value in obj.items():
            if key not in ['智能指令']:  # 排除智能指令字段
                filtered_obj[key] = value
        
        return yaml.dump(filtered_obj, default_flow_style=False, allow_unicode=True)
    except Exception:
        return ""

def load_current_player():
    # 先读取当前挑选玩家的JSON文件
    selection_path = PathManager.get_players_dir() / "当前挑选玩家.json"
    try:
        with open(selection_path, 'r', encoding='utf-8') as f:
            selection_data = json.load(f)
        selected_player = selection_data.get('selected_player')
        
        if selected_player:
            # 根据选择的玩家读取对应的yml文件
            player_path = PathManager.get_players_dir() / f"{selected_player}.yml"
            try:
                raw = player_path.read_text(encoding="utf-8")
                obj = yaml.safe_load(raw)
                if obj is None:
                    return ""
                return yaml.dump(obj, default_flow_style=False, allow_unicode=True)
            except Exception:
                # 如果读取失败，回退到默认行为
                pass
    except Exception:
        # 如果读取选择文件失败，回退到默认行为
        pass
    
    # 回退：读取当前玩家.yml文件（兼容旧逻辑）
    path = PathManager.get_players_dir() / "当前玩家.yml"
    try:
        raw = path.read_text(encoding="utf-8")
        obj = yaml.safe_load(raw)
        if obj is None:
            return ""
        return yaml.dump(obj, default_flow_style=False, allow_unicode=True)
    except Exception:
        return ""

def get_available_roles():
    path = PathManager.get_roles_dir()
    roles = []
    for file_path in path.glob("*.yml"):
        role_name = file_path.stem
        # 隐藏旁白角色，不在角色面板中显示
        if role_name != '旁白':
            roles.append(role_name)
    return roles
