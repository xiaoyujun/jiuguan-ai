from API import stream_chat_response
import json
from pathlib import Path
import yaml
from web.utils import PathManager

# -----获取预设-----------------
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



# 获取全局世界书的所有内容
def load_global_world_book():
    path = PathManager.get_global_world_book_dir()
    contents = []
    for file_path in path.glob("*.yml"):
        try:
            raw = file_path.read_text(encoding="utf-8")
            obj = yaml.safe_load(raw)
            if obj is not None:
                if isinstance(obj, list):
                    contents.extend(obj)
                else:
                    contents.append(obj)
        except Exception:
            pass
    return yaml.dump(contents, default_flow_style=False, allow_unicode=True) if contents else ""




# 获取角色捆绑的数据书数据
def get_bound_story_data(role_name):
    """
    获取与指定角色捆绑的数据书数据（增强版，包括引用的数据书）
    
    参数:
    role_name (str): 角色名称，例如 'biabia'
    
    返回:
    dict: 角色捆绑的数据书数据，键为数据书名称，值为数据书内容（不包括关键词）
    """
    try:
        # 尝试使用新的引用管理器
        from web.core import get_bound_story_data_with_references
        return get_bound_story_data_with_references(role_name)
    except ImportError:
        # 如果引用管理器不可用，使用原有逻辑
        print("数据书引用管理器不可用，使用基础版本")
        pass
    
    # 混合逻辑：结合角色文件中的绑定设置和数据书文件中的绑定设置
    bound_stories = {}
    
    # 1. 从角色文件中读取绑定的数据书列表
    role_bound_stories = get_role_bound_storybooks(role_name)
    
    # 2. 从数据书文件中查找绑定此角色的数据书
    data_book_bound_stories = get_databook_bound_stories(role_name)
    
    # 合并两种方式的结果
    bound_stories.update(role_bound_stories)
    bound_stories.update(data_book_bound_stories)
    
    return bound_stories


def get_role_bound_storybooks(role_name):
    """
    从角色文件中读取绑定的数据书列表
    
    参数:
    role_name (str): 角色名称
    
    返回:
    dict: 绑定的数据书数据
    """
    bound_stories = {}
    
    try:
        # 读取角色文件
        role_file = PathManager.get_roles_dir() / f"{role_name}.yml"
        if not role_file.exists():
            return bound_stories
        
        import yaml
from web.utils import PathManager
        with open(role_file, 'r', encoding='utf-8') as f:
            role_data = yaml.safe_load(f) or {}
        
        # 获取绑定的数据书列表
        bound_storybook_names = role_data.get('绑定数据书', [])
        if not bound_storybook_names:
            return bound_stories
        
        # 读取对应的数据书文件
        data_path = PathManager.get_storybook_dir()
        if not data_path.exists():
            return bound_stories
        
        for storybook_name in bound_storybook_names:
            storybook_file = data_path / f"{storybook_name}.json"
            if storybook_file.exists():
                try:
                    raw = storybook_file.read_text(encoding="utf-8")
                    obj = json.loads(raw)
                    
                    if isinstance(obj, dict):
                        # 移除不需要的字段，只保留实际数据
                        story_content = {k: v for k, v in obj.items() 
                                       if k not in ["关键词", "捆绑角色", "捆绑玩家", "更新时间"]}
                        bound_stories[storybook_name] = story_content
                        print(f"从角色文件为 {role_name} 加载绑定数据书: {storybook_name}")
                        
                except Exception as e:
                    print(f"读取角色绑定的数据书 {storybook_name} 失败: {e}")
                    continue
    
    except Exception as e:
        print(f"从角色文件读取绑定数据书失败: {e}")
    
    return bound_stories


def get_databook_bound_stories(role_name):
    """
    从数据书文件中查找绑定此角色的数据书（原有逻辑）
    
    参数:
    role_name (str): 角色名称
    
    返回:
    dict: 绑定的数据书数据
    """
    bound_stories = {}
    path = PathManager.get_storybook_dir()
    
    if not path.exists():
        return bound_stories
    
    for file_path in path.glob("*.json"):
        try:
            raw = file_path.read_text(encoding="utf-8")
            obj = json.loads(raw)
            
            # 检查是否有捆绑角色字段，并且包含当前角色
            if isinstance(obj, dict) and "捆绑角色" in obj:
                bound_roles = obj["捆绑角色"]
                if isinstance(bound_roles, list) and role_name in bound_roles:
                    # 获取数据书名称（文件名不带扩展名）
                    story_name = file_path.stem
                    
                    # 移除不需要的字段（关键词、捆绑角色等），只保留实际数据
                    story_content = {k: v for k, v in obj.items() 
                                   if k not in ["关键词", "捆绑角色", "更新时间"]}
                    
                    bound_stories[story_name] = story_content
                    print(f"从数据书文件为 {role_name} 加载绑定数据书: {story_name}")
                    
        except Exception as e:
            print(f"读取数据书 {file_path} 失败: {e}")
            continue
    
    return bound_stories


# 获取所有关键词及其内容的映射
def get_all_keywords():
    contents = {}
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

# 获取当前聊天的角色信息
def load_current_role(role_name):
    path = PathManager.get_roles_dir() / f"{role_name}.yml"
    try:
        raw = path.read_text(encoding="utf-8")
        obj = yaml.safe_load(raw)
        if obj is None:
            return ""
        return yaml.dump(obj, default_flow_style=False, allow_unicode=True)
    except Exception:
        return ""


# 获取当前玩家的信息
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


# 

if __name__ == "__main__":
    # 这个文件的主要目的是从配置文件中获取足够的信息方便进行扮演 

    # 系统 的部分应该是 1.获取底层描述 2.获取当前聊天的角色  获取 当前玩家的信息(AI怎么称呼玩家) 方便ai进行扮演  2.获取全局世界书  
    
    # 加载系统信息
    base_description = load_base_description_text()
    global_world_book = load_global_world_book()
    current_role = load_current_role("少年")  # 假设当前角色是少年，可根据需要修改
    current_player = load_current_player()
    
    # 构建系统提示
    系统提示 = f"底层描述:\n{base_description}\n\n全局世界书:\n{global_world_book}\n\n你扮演的角色:\n{current_role}\n\n我扮演的角色:\n{current_player}"

    print(系统提示)
    
    玩家输入文本 = "你好呀，你知道我是谁吗，宠物店现在怎么样了，臭臭还好吗。你怎么样了。你是什么品种的"


    stream_chat_response(玩家输入文本, 系统提示)
