"""
角色工具模块
提供角色管理相关的工具函数，替代原来的temp_role_manager
"""
import sys
from pathlib import Path
import yaml
import json
from web.config_loader import load_current_role, get_available_roles
from web.history_manager import get_story_temp_data, save_story_temp_data


def process_temp_role_request(request_data):
    """处理临时角色请求
    
    Args:
        request_data: 请求数据字典
        
    Returns:
        tuple: (temp_role, is_valid)
    """
    temp_role = request_data.get('temp_role')
    
    if temp_role:
        # 简单验证临时角色是否存在
        available_roles = get_available_roles()
        is_valid = temp_role in available_roles
        if not is_valid:
            print(f"警告: 临时角色 '{temp_role}' 不在可用角色列表中")
            return None, False
    else:
        is_valid = True  # 空值表示不使用临时角色，这是有效的
    
    return temp_role, is_valid


def get_role_data_for_chat(role_name, temp_role=None):
    """为聊天获取角色数据
    
    Args:
        role_name: 主角色名称
        temp_role: 临时角色名称（可选）
        
    Returns:
        tuple: (role_data, is_temp_role, model_key)
    """
    try:
        if temp_role:
            # 使用临时角色
            role_data = load_current_role(temp_role)
            print(f"使用临时角色: {temp_role}")
            is_temp_role = True
        else:
            # 使用主角色
            role_data = load_current_role(role_name)
            print(f"使用主角色: {role_name}")
            is_temp_role = False
        
        # 获取模型键
        model_key = get_model_key_for_role(temp_role)
        
        return role_data, is_temp_role, model_key
        
    except Exception as e:
        print(f"加载角色数据失败: {e}")
        return "", False, 'chat'


def get_role_for_history_save(role_name, temp_role=None):
    """获取用于保存历史记录的角色名称"""
    if temp_role:
        return temp_role
    return role_name


def get_model_key_for_role(temp_role=None):
    """根据角色类型获取模型键"""
    if temp_role and temp_role == '旁白':
        return 'narrator'
    return 'chat'


def merge_temp_role_stories_to_data(role_name, temp_role, existing_temp_data):
    """将临时角色的绑定数据书合并到现有临时数据中
    
    Args:
        role_name: 主角色名称
        temp_role: 临时角色名称
        existing_temp_data: 现有的临时数据
        
    Returns:
        tuple: (merged_temp_data, stories_added)
    """
    if not temp_role:
        return existing_temp_data, False
    
    # 加载临时角色的绑定数据书
    temp_role_stories = load_bound_stories_for_temp_role(temp_role)
    
    if not temp_role_stories:
        return existing_temp_data, False
    
    # 合并数据
    merged_data = existing_temp_data.copy()
    stories_added = False
    
    for story_name, story_data in temp_role_stories.items():
        if story_name not in merged_data:
            # 只有当临时数据中没有这个数据书时，才添加绑定数据
            merged_data[story_name] = story_data
            print(f"添加临时角色 {temp_role} 的绑定数据书到临时数据: {story_name}")
            stories_added = True
        else:
            print(f"数据书 {story_name} 已存在于临时数据中，保留现有数据")
    
    return merged_data, stories_added


def load_bound_stories_for_temp_role(temp_role):
    """加载临时角色的绑定数据书数据
    
    Args:
        temp_role: 临时角色名称
        
    Returns:
        dict: 绑定数据书数据
    """
    if not temp_role:
        return {}
    
    try:
        # 导入绑定数据书加载函数
        from pathlib import Path
        parent_dir = Path(__file__).parent.parent
        if str(parent_dir) not in sys.path:
            sys.path.insert(0, str(parent_dir))
        from 聊天 import get_bound_story_data
        
        bound_stories = get_bound_story_data(temp_role)
        if bound_stories:
            print(f"为临时角色 {temp_role} 加载了 {len(bound_stories)} 个绑定数据书: {list(bound_stories.keys())}")
        else:
            print(f"临时角色 {temp_role} 没有绑定数据书")
        
        return bound_stories
    except Exception as e:
        print(f"加载临时角色 {temp_role} 的绑定数据书失败: {e}")
        import traceback
        print(f"详细错误: {traceback.format_exc()}")
        return {}


# 便捷函数，保持向后兼容性
def get_available_roles_list():
    """获取可用角色列表"""
    try:
        return get_available_roles()
    except Exception as e:
        print(f"获取角色列表失败: {e}")
        return []


def validate_role_exists(role_name):
    """验证角色是否存在"""
    if not role_name:
        return False
    
    available_roles = get_available_roles_list()
    return role_name in available_roles
