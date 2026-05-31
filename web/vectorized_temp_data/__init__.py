"""
语义搜索数据处理模块

实现基于语义搜索的智能数据处理功能：
1. 使用硬编码特征映射和模糊匹配进行智能搜索
2. 根据用户输入找到最相关的数据书
3. 格式化数据内容供大语言模型使用
4. 将传入给大语言模型的内容记录到txt文件
5. 支持分层搜索和多种搜索策略

此模块集成了最优的语义搜索解决方案。
"""

from .config_manager import VectorizedConfigManager, get_vectorized_config_manager
from .semantic_search_engine import SemanticSearchEngine, get_semantic_search_engine
from .semantic_search_api import (
    smart_search, fuzzy_search, name_search, tolerant_search, 
    precise_search, tiered_search, search_by_category,
    get_semantic_engine, get_engine_status
)
from .temp_data_recorder import TempDataRecorder, get_temp_data_recorder
from .simple_processor import SimpleProcessor, get_simple_processor

# 聊天集成处理器
from .architecture_2_0_integration import get_architecture_2_0_processor

__all__ = [
    # 核心类
    'VectorizedConfigManager',
    'SemanticSearchEngine',
    'TempDataRecorder',
    'SimpleProcessor',
    
    # 单例获取函数
    'get_vectorized_config_manager',
    'get_semantic_search_engine',
    'get_semantic_engine',
    'get_temp_data_recorder',
    'get_simple_processor',
    'get_architecture_2_0_processor',  # 聊天集成处理器
    
    # 搜索API函数
    'smart_search',
    'fuzzy_search', 
    'name_search',
    'tolerant_search',
    'precise_search',
    'tiered_search',
    'search_by_category',
    'get_engine_status',
]
