#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
语义搜索API - 提供统一的搜索接口
整合硬编码特征映射和模糊匹配的智能搜索功能
"""

from typing import List, Dict, Any, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# 全局搜索引擎实例
_semantic_engine = None

def get_semantic_engine():
    """获取语义搜索引擎实例（懒加载）"""
    global _semantic_engine
    if _semantic_engine is None:
        try:
            from .semantic_search_engine import get_semantic_search_engine
            from .config_manager import get_vectorized_config_manager
            
            config_manager = get_vectorized_config_manager()
            _semantic_engine = get_semantic_search_engine(config_manager)
            logger.info("语义搜索引擎初始化完成")
        except Exception as e:
            logger.error(f"语义搜索引擎初始化失败: {e}")
            raise
    return _semantic_engine

def reload_search_engine():
    """重新加载搜索引擎（当用户配置更新时调用）"""
    global _semantic_engine
    if _semantic_engine is not None:
        try:
            _semantic_engine.reload_feature_maps()
            logger.info("语义搜索引擎特征映射已重新加载")
        except Exception as e:
            logger.error(f"重新加载语义搜索引擎失败: {e}")
            # 如果重新加载失败，重新初始化引擎
            _semantic_engine = None
            get_semantic_engine()
    else:
        # 如果引擎未初始化，直接初始化
        get_semantic_engine()

def smart_search(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    智能搜索 - 自动选择最佳搜索策略
    
    Args:
        query: 搜索查询
        max_results: 最大返回结果数量
        
    Returns:
        搜索结果列表
        
    Example:
        >>> results = smart_search("一个喜欢跑步的女生")
        >>> results = smart_search("Jade")
    """
    try:
        engine = get_semantic_engine()
        results = engine.smart_search(query, top_k=max_results)
        return _format_results(results)
    except Exception as e:
        logger.error(f"智能搜索失败: {e}")
        return []

def fuzzy_search(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    模糊搜索 - 支持拼写错误和变体
    
    Args:
        query: 搜索查询（可能有拼写错误）
        max_results: 最大返回结果数量
        
    Returns:
        模糊搜索结果
        
    Example:
        >>> results = fuzzy_search("喜欢运动的女孩子")
        >>> results = fuzzy_search("Jad")  # 拼错的Jade
    """
    try:
        engine = get_semantic_engine()
        results = engine.smart_search(query, top_k=max_results)
        return _format_results(results, match_type="fuzzy")
    except Exception as e:
        logger.error(f"模糊搜索失败: {e}")
        return []

def name_search(name: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    名称搜索 - 专门用于角色名称的模糊匹配
    
    Args:
        name: 角色名称（可能有拼写错误）
        max_results: 最大返回结果数量
        
    Returns:
        名称匹配结果
        
    Example:
        >>> results = name_search("Jad")  # 找到Jade
        >>> results = name_search("兰")    # 找到兰斯
    """
    try:
        engine = get_semantic_engine()
        results = engine.fuzzy_name_search(name, top_k=max_results)
        
        formatted_results = []
        for character_key, score, character_data in results:
            # 提取角色名称
            char_name = character_key
            if "属性" in character_data and "状态" in character_data["属性"]:
                char_name = character_data["属性"]["状态"].get("名称", character_key)
            
            formatted_result = {
                "name": char_name,
                "key": character_key,
                "score": score / 100.0,  # 转换为0-1范围
                "match_type": "name_fuzzy",
                "tags": character_data.get("总结词", []),
                "description": character_data.get("描述", ""),
                "full_data": character_data
            }
            formatted_results.append(formatted_result)
        
        return formatted_results
    except Exception as e:
        logger.error(f"名称搜索失败: {e}")
        return []

def tolerant_search(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    容错搜索 - 高容错率的搜索
    
    Args:
        query: 搜索查询（可能有很多错误）
        max_results: 最大返回结果数量
        
    Returns:
        高容错搜索结果
        
    Example:
        >>> results = tolerant_search("田经建将")  # 田径健将的错误拼写
        >>> results = tolerant_search("魔发师")    # 魔法师的错误拼写
    """
    return fuzzy_search(query, max_results)

def precise_search(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    精确搜索 - 基于硬编码特征的精确匹配
    
    Args:
        query: 搜索查询
        max_results: 最大返回结果数量
        
    Returns:
        精确搜索结果
    """
    try:
        engine = get_semantic_engine()
        results = engine.smart_search(query, top_k=max_results)
        return _format_results(results, match_type="precise")
    except Exception as e:
        logger.error(f"精确搜索失败: {e}")
        return []

def tiered_search(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    分层搜索 - 根据相关度返回不同详细程度的数据
    
    Args:
        query: 搜索查询
        max_results: 最大返回结果数量
        
    Returns:
        分层搜索结果，包含格式化的输出
    """
    try:
        engine = get_semantic_engine()
        results = engine.search_with_tiers(query, top_k=max_results)
        
        formatted_results = []
        for character_key, formatted_output, score, relevance_level in results:
            # 获取角色基本信息
            character_data = engine.characters_data.get(character_key, {})
            char_name = character_key
            if "属性" in character_data and "状态" in character_data["属性"]:
                char_name = character_data["属性"]["状态"].get("名称", character_key)
            
            formatted_result = {
                "name": char_name,
                "key": character_key,
                "score": round(score, 3),
                "relevance_level": relevance_level,
                "formatted_output": formatted_output,
                "match_type": "tiered",
                "tags": character_data.get("总结词", []),
                "description": character_data.get("描述", "")
            }
            formatted_results.append(formatted_result)
        
        return formatted_results
    except Exception as e:
        logger.error(f"分层搜索失败: {e}")
        return []

def search_by_category(query: str, category: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    按类别搜索
    
    Args:
        query: 搜索查询
        category: 搜索类别 (female, sports, athlete, etc.)
        max_results: 最大返回结果数量
        
    Returns:
        分类搜索结果
    """
    # 根据类别调整查询
    category_queries = {
        "female": f"{query} 女生 女性",
        "sports": f"{query} 运动 体育",
        "athlete": f"{query} 女生 运动 田径",
        "student": f"{query} 学生 学院",
        "artist": f"{query} 艺术 绘画",
        "adventurer": f"{query} 冒险 探险",
        "elf": f"{query} 精灵",
        "dark_elf": f"{query} 黑暗精灵"
    }
    
    enhanced_query = category_queries.get(category, query)
    return smart_search(enhanced_query, max_results)

def multi_search(queries: List[str], max_results: int = 5) -> Dict[str, List[Dict[str, Any]]]:
    """
    多查询搜索 - 同时执行多个搜索查询
    
    Args:
        queries: 搜索查询列表
        max_results: 每个查询的最大返回结果数量
        
    Returns:
        多查询搜索结果字典
    """
    results = {}
    for query in queries:
        results[query] = smart_search(query, max_results)
    return results

def get_search_suggestions(partial_query: str, max_suggestions: int = 5) -> List[str]:
    """
    获取搜索建议
    
    Args:
        partial_query: 部分查询内容
        max_suggestions: 最大建议数量
        
    Returns:
        搜索建议列表
    """
    try:
        engine = get_semantic_engine()
        
        # 基于现有角色数据生成建议
        suggestions = []
        
        # 从角色名称生成建议
        for character_key, character_data in engine.characters_data.items():
            if "属性" in character_data and "状态" in character_data["属性"]:
                name = character_data["属性"]["状态"].get("名称", character_key)
                if partial_query.lower() in name.lower():
                    suggestions.append(name)
            
            # 从总结词生成建议
            if "总结词" in character_data:
                for word in character_data["总结词"]:
                    if partial_query.lower() in str(word).lower():
                        suggestions.append(f"喜欢{word}的角色")
        
        # 去重并限制数量
        suggestions = list(set(suggestions))[:max_suggestions]
        return suggestions
        
    except Exception as e:
        logger.error(f"获取搜索建议失败: {e}")
        return []

def get_engine_status() -> Dict[str, Any]:
    """
    获取搜索引擎状态
    
    Returns:
        引擎状态信息
    """
    try:
        engine = get_semantic_engine()
        return engine.get_engine_info()
    except Exception as e:
        logger.error(f"获取引擎状态失败: {e}")
        return {"error": str(e)}

def _format_results(results: List[tuple], match_type: str = "smart") -> List[Dict[str, Any]]:
    """格式化搜索结果"""
    formatted_results = []
    
    for character_key, score, character_data in results:
        # 提取角色名称
        name = character_key
        if "属性" in character_data and "状态" in character_data["属性"]:
            name = character_data["属性"]["状态"].get("名称", character_key)
        
        formatted_result = {
            "name": name,
            "key": character_key,
            "score": round(score, 3),
            "match_type": match_type,
            "tags": character_data.get("总结词", []),
            "description": character_data.get("描述", ""),
            "full_data": character_data
        }
        formatted_results.append(formatted_result)
    
    return formatted_results

# 便捷别名
search = smart_search           # 主搜索接口（智能）
fuzzy = fuzzy_search           # 模糊搜索
name = name_search             # 名称搜索
tolerant = tolerant_search     # 容错搜索
precise = precise_search       # 精确搜索
tiered = tiered_search         # 分层搜索

def demo_semantic_api():
    """演示语义搜索API"""
    print("=" * 60)
    print("语义搜索API演示")
    print("=" * 60)
    
    test_cases = [
        ("smart_search", "一个喜欢跑步的女生", "智能搜索"),
        ("fuzzy_search", "喜欢运动的女孩子", "模糊搜索"),
        ("name_search", "Jad", "名称搜索"),
        ("tolerant_search", "田经建将", "容错搜索"),
        ("precise_search", "田径健将", "精确搜索"),
        ("tiered_search", "运动女生", "分层搜索")
    ]
    
    for func_name, query, description in test_cases:
        print(f"\n{description} - '{query}':")
        print("-" * 40)
        
        try:
            # 调用相应的函数
            if func_name == "smart_search":
                results = smart_search(query, 3)
            elif func_name == "fuzzy_search":
                results = fuzzy_search(query, 3)
            elif func_name == "name_search":
                results = name_search(query, 3)
            elif func_name == "tolerant_search":
                results = tolerant_search(query, 3)
            elif func_name == "precise_search":
                results = precise_search(query, 3)
            elif func_name == "tiered_search":
                results = tiered_search(query, 3)
                # 分层搜索的结果格式不同
                for i, result in enumerate(results, 1):
                    print(f"{i}. {result['name']} (得分: {result['score']}, {result['relevance_level']})")
                continue
            
            if not results:
                print("没有找到相关结果")
                continue
            
            for i, result in enumerate(results, 1):
                print(f"{i}. {result['name']} (得分: {result['score']})")
                print(f"   类型: {result['match_type']}")
                if result['tags']:
                    print(f"   特征: {', '.join(result['tags'][:3])}")
                    
        except Exception as e:
            print(f"搜索失败: {e}")

if __name__ == "__main__":
    demo_semantic_api()
