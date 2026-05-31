"""
AI新架构模块
基于优化逻辑重构的AI功能模块

包含：
1. 整体生成器 (CoreGenerator) - 非增量模式，用于生成角色数据书
2. 全局修改器 (GlobalModifier) - 增量Agent模式，用于临时数据分析、总结等
3. 智能筛选器 (SmartFilter) - 根据提示词筛选，用于智能指令、AI智能总结、多人聊天等
4. 提示词管理器 (PromptManager) - 统一管理AI提示词
5. 应用路由 (application_routes) - 处理各种明细任务
"""

from .core_generator import CoreGenerator
from .global_modifier import GlobalModifier
from .smart_filter import SmartFilter
from .temp_data_extractor import TempDataExtractor, get_temp_data_extractor
from .prompt_manager import PromptManager
from .application_routes import ai_new_bp
from .ai_core import call_ai_model

__all__ = [
    'CoreGenerator',
    'GlobalModifier',
    'SmartFilter',
    'TempDataExtractor',
    'get_temp_data_extractor',
    'PromptManager',
    'ai_new_bp',
    'call_ai_model'
]

# 版本信息
__version__ = '1.0.0'
__description__ = 'AI新架构模块 - 基于优化逻辑的重构版本'

# 模块功能映射
FEATURES = {
    '整体生成': {
        'class': 'CoreGenerator',
        'description': '非增量模式，用于按照特定数据书模板生成角色的数据书',
        'use_cases': ['角色管理页面', '批量生成数据书', '角色数据书创建']
    },
    '全局修改': {
        'class': 'GlobalModifier', 
        'description': '增量Agent模式，对数据进行全局修改',
        'use_cases': ['临时数据分析', '总结', 'AI智能指令', 'AI智能总结', '数据书修改']
    },
    '智能筛选': {
        'class': 'SmartFilter',
        'description': '根据提示词进行筛选',
        'use_cases': ['智能指令', 'AI智能总结', '多人聊天模式筛选回复者', '内容筛选']
    },
    '提示词管理': {
        'class': 'PromptManager',
        'description': '统一管理传送给AI的提示词',
        'use_cases': ['提示词模板管理', 'AI指令生成', '动态提示词构建']
    }
}

def get_feature_info(feature_name: str = None):
    """
    获取功能信息
    
    Args:
        feature_name: 功能名称，如果为None则返回所有功能信息
        
    Returns:
        功能信息字典
    """
    if feature_name:
        return FEATURES.get(feature_name)
    return FEATURES

def get_module_info():
    """
    获取模块信息
    
    Returns:
        模块信息字典
    """
    return {
        'name': 'AI新架构模块',
        'version': __version__,
        'description': __description__,
        'features': list(FEATURES.keys()),
        'classes': [
            'CoreGenerator',
            'GlobalModifier', 
            'SmartFilter',
            'PromptManager'
        ],
        'routes': '/ai_new/*'
    }
