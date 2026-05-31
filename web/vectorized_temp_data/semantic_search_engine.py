#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
语义搜索引擎 - 最终优化版本
基于硬编码特征映射和模糊匹配的智能搜索系统
"""

import sys
import os
# 添加父目录到路径以导入警告抑制模块
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import suppress_warnings  # 必须在其他导入之前

import json
import re
import jieba
from typing import List, Dict, Any, Tuple, Set
from collections import Counter, defaultdict
import math
from pathlib import Path

from web.utils import PathManager

# 导入 fuzzywuzzy
try:
    from fuzzywuzzy import fuzz
    from fuzzywuzzy import process
    FUZZYWUZZY_AVAILABLE = True
except ImportError:
    FUZZYWUZZY_AVAILABLE = False
    print("⚠️ 警告: fuzzywuzzy 未安装，模糊搜索功能将受限")

class SemanticSearchEngine:
    """语义搜索引擎 - 集成硬编码特征映射和模糊匹配"""
    
    def __init__(self, config_manager=None, config_file: str = None):
        """
        初始化语义搜索引擎
        
        Args:
            config_manager: 配置管理器实例
            config_file: 配置文件路径（可选）
        """
        if config_manager:
            self.config_manager = config_manager
            self.data_directory = config_manager.get_current_storybook_dir()
        else:
            from .config_manager import get_vectorized_config_manager
            self.config_manager = get_vectorized_config_manager()
            self.data_directory = self.config_manager.get_current_storybook_dir()
        
        # 加载配置
        self.config = self._load_config(config_file)
        
        self.characters_data = {}
        self.word_freq = {}
        self.doc_word_freq = {}
        self.doc_keys = []
        
        # 从配置文件构建特征映射
        self.feature_maps = self._build_feature_maps_from_config()
        
        # 从配置文件加载模糊匹配配置
        self.fuzzy_config = self.config["fuzzy_config"]
        
        # 加载数据和构建索引
        self.load_data()
        self.build_search_index()
        if FUZZYWUZZY_AVAILABLE:
            self.build_fuzzy_index()
    
    def _load_config(self, config_file: str = None) -> Dict[str, Any]:
        """加载配置文件"""
        if config_file and Path(config_file).exists():
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"⚠️ 配置文件加载失败: {e}，使用默认配置")
        
        # 尝试从当前目录加载语义搜索配置
        semantic_config = Path(__file__).parent / "semantic_search_config.json"
        if semantic_config.exists():
            try:
                with open(semantic_config, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"⚠️ 语义搜索配置加载失败: {e}，使用默认配置")
        
        # 备用：尝试从语义匹配目录加载配置
        fallback_config = Path(__file__).parent / "语义匹配" / "search_config.json"
        if fallback_config.exists():
            try:
                with open(fallback_config, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"⚠️ 备用配置加载失败: {e}，使用默认配置")
        
        return self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """获取默认配置"""
        return {
            "data_directory": "数据书",
            "feature_maps": {
                "gender": {
                    "female_keywords": {"女生": 2.0, "女孩": 2.0, "女性": 2.0, "她": 1.5},
                    "male_keywords": {"男生": -1.5, "男孩": -1.5, "男性": -1.5, "他": -0.8}
                },
                "sports": {
                    "running_keywords": {"跑步": 3.0, "跑": 2.0, "田径": 2.5},
                    "general_sports_keywords": {"运动": 1.5, "体育": 1.5, "健身": 1.5}
                },
                "personality": {
                    "positive_traits": {"阳光": 1.5, "开朗": 1.5, "活泼": 1.5, "乐观": 1.5}
                }
            },
            "fuzzy_config": {"min_score": 60, "max_results": 10},
            "search_weights": {"feature_score_weight": 0.6, "fuzzy_score_weight": 0.3},
            "relevance_thresholds": {"high_relevance": 0.7, "medium_relevance": 0.4, "low_relevance": 0.1},
            "return_fields": {
                "high_relevance": "complete",
                "medium_relevance": {"include_fields": ["总结词", "关键词", "属性.状态", "属性.外貌特征", "标签", "描述"]},
                "low_relevance": {"include_fields": ["属性.状态.名称", "属性.外貌特征", "总结词"]}
            }
        }
    
    def _build_feature_maps_from_config(self) -> Dict[str, Dict[str, float]]:
        """从配置文件构建特征映射表，合并用户自定义配置"""
        feature_maps = {}
        config_maps = self.config.get("feature_maps", {})
        
        # 首先构建基础特征映射
        for category, category_config in config_maps.items():
            feature_map = {}
            if isinstance(category_config, dict):
                for subcategory, keywords in category_config.items():
                    if isinstance(keywords, dict):
                        feature_map.update(keywords)
            feature_maps[category] = feature_map
        
        # 合并用户自定义配置
        user_feature_maps = self._load_user_feature_maps()
        if user_feature_maps:
            for category, category_data in user_feature_maps.items():
                if category not in feature_maps:
                    feature_maps[category] = {}
                
                if isinstance(category_data, dict):
                    for subcategory, keywords in category_data.items():
                        if isinstance(keywords, dict):
                            # 用户配置优先，会覆盖同名关键词
                            feature_maps[category].update(keywords)
        
        return feature_maps
    
    def _load_user_feature_maps(self) -> Dict[str, Any]:
        """加载用户自定义特征映射"""
        try:
            user_config_path = PathManager.get_user_semantic_config_path()
            if user_config_path.exists():
                with open(user_config_path, 'r', encoding='utf-8') as f:
                    user_config = json.load(f)
                    return user_config.get('user_feature_maps', {})
        except Exception as e:
            print(f"⚠️ 加载用户语义配置失败: {e}")
        
        return {}
    
    def reload_feature_maps(self):
        """重新加载特征映射（当用户配置更新时调用）"""
        print("🔄 重新加载特征映射...")
        self.feature_maps = self._build_feature_maps_from_config()
        print("✅ 特征映射已更新")
    
    def load_data(self):
        """加载所有数据书文件"""
        print(f"正在从 {self.data_directory} 加载数据书...")
        
        if not self.data_directory.exists():
            print(f"⚠️ 数据书目录不存在: {self.data_directory}")
            return
        
        for json_file in self.data_directory.glob("*.json"):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                    # 跳过非角色数据文件
                    if json_file.stem in ['keyword_suggestion_history', 'search_history', 'temp_data']:
                        continue
                    
                    # 只处理字典类型的数据（角色数据）
                    if isinstance(data, dict):
                        self.characters_data[json_file.stem] = data
                    else:
                        print(f"跳过非角色数据文件: {json_file.name} (类型: {type(data)})")
            except Exception as e:
                print(f"加载文件 {json_file} 时出错: {e}")
        
        print(f"成功加载 {len(self.characters_data)} 个数据文件")
    
    def extract_searchable_text(self, data: Dict[str, Any]) -> str:
        """从角色数据中提取可搜索的文本"""
        # 安全检查数据类型
        if not isinstance(data, dict):
            print(f"⚠️ 警告: data 类型错误: {type(data)}")
            return ""
            
        searchable_parts = []
        
        # 添加总结词 (高权重)
        if "总结词" in data and data["总结词"]:
            searchable_parts.extend([f"{word} {word}" for word in data["总结词"]])
        
        # 添加关键词
        if "关键词" in data and data["关键词"]:
            searchable_parts.extend(data["关键词"])
        
        # 添加标签
        if "标签" in data and data["标签"]:
            searchable_parts.extend(data["标签"])
        
        # 添加描述
        if "描述" in data and data["描述"]:
            searchable_parts.append(data["描述"])
        
        # 添加属性中的文本信息
        if "属性" in data and isinstance(data["属性"], dict):
            attributes = data["属性"]
            
            # 状态信息
            if "状态" in attributes and isinstance(attributes["状态"], dict):
                for key, value in attributes["状态"].items():
                    if isinstance(value, str):
                        searchable_parts.append(value)
            
            # 外貌特征
            if "外貌特征" in attributes and isinstance(attributes["外貌特征"], dict):
                for key, value in attributes["外貌特征"].items():
                    if isinstance(value, str):
                        searchable_parts.append(value)
            
            # 社交关系
            if "社交关系" in attributes and isinstance(attributes["社交关系"], dict):
                for key, value in attributes["社交关系"].items():
                    if isinstance(value, list):
                        searchable_parts.extend([str(v) for v in value])
                    elif isinstance(value, str):
                        searchable_parts.append(value)
        
        return " ".join(str(part) for part in searchable_parts if part)
    
    def preprocess_text(self, text: str) -> List[str]:
        """文本预处理和分词"""
        if not text:
            return []
        
        text = re.sub(r'\s+', ' ', text.strip())
        text = re.sub(r'[^\w\s\u4e00-\u9fff]', ' ', text)
        
        words = list(jieba.cut(text.lower()))
        
        text_config = self.config.get("text_processing", {})
        min_length = text_config.get("min_word_length", 1)
        
        filtered_words = [
            word.strip() for word in words 
            if len(word.strip()) >= min_length and not word.strip().isdigit()
        ]
        
        return filtered_words
    
    def build_search_index(self):
        """构建搜索索引"""
        print("正在构建搜索索引...")
        
        all_words = []
        self.doc_word_freq = {}
        self.doc_keys = list(self.characters_data.keys())
        
        for key, data in self.characters_data.items():
            searchable_text = self.extract_searchable_text(data)
            words = self.preprocess_text(searchable_text)
            
            word_count = Counter(words)
            self.doc_word_freq[key] = word_count
            all_words.extend(words)
        
        self.word_freq = Counter(all_words)
        print(f"搜索索引构建完成，共 {len(self.word_freq)} 个不同词汇")
    
    def build_fuzzy_index(self):
        """构建模糊匹配索引"""
        if not FUZZYWUZZY_AVAILABLE:
            return
        
        print("正在构建模糊匹配索引...")
        
        self.fuzzy_index = {
            "character_names": [],
            "summary_words": [],
            "tags": [],
            "descriptions": [],
            "all_text": []
        }
        
        for key, data in self.characters_data.items():
            # 角色名称
            if "属性" in data and "状态" in data["属性"] and isinstance(data["属性"]["状态"], dict):
                name = data["属性"]["状态"].get("名称", key)
                self.fuzzy_index["character_names"].append(f"{name}|{key}")
            
            # 总结词
            if "总结词" in data and data["总结词"]:
                for word in data["总结词"]:
                    self.fuzzy_index["summary_words"].append(f"{word}|{key}")
            
            # 标签
            if "标签" in data and data["标签"]:
                for tag in data["标签"]:
                    self.fuzzy_index["tags"].append(f"{tag}|{key}")
            
            # 描述片段
            if "描述" in data and data["描述"]:
                description = data["描述"]
                sentences = [s.strip() for s in re.split(r'[。！？.]', description) if s.strip()]
                text_config = self.config.get("text_processing", {})
                max_sentences = text_config.get("max_description_sentences", 3)
                min_sentence_length = text_config.get("min_sentence_length", 10)
                for sentence in sentences[:max_sentences]:
                    if len(sentence) > min_sentence_length:
                        self.fuzzy_index["descriptions"].append(f"{sentence}|{key}")
        
        print("模糊匹配索引构建完成")
    
    def calculate_feature_score(self, words: List[str], character_data: Dict[str, Any]) -> float:
        """计算基于硬编码特征的得分"""
        total_score = 0.0
        
        # 检查各种特征匹配
        for category, feature_map in self.feature_maps.items():
            category_score = 0.0
            
            for word in words:
                if word in feature_map:
                    category_score += feature_map[word]
            
            # 根据角色特征调整得分
            if category == "gender":
                is_female = self._is_female_character(character_data)
                weights = self.config.get("search_weights", {})
                if is_female and category_score > 0:
                    total_score += category_score * weights.get("gender_match_boost", 1.5)
                elif not is_female and category_score < 0:
                    total_score += abs(category_score) * weights.get("gender_mismatch_penalty", 0.5)
            
            elif category == "sports":
                has_sports_traits = self._has_sports_traits(character_data)
                weights = self.config.get("search_weights", {})
                if has_sports_traits:
                    total_score += category_score * weights.get("sports_match_boost", 2.0)
                else:
                    total_score += category_score * weights.get("sports_no_match_penalty", 0.3)
            
            else:
                total_score += category_score
        
        return max(0, total_score)
    
    def _is_female_character(self, character_data: Dict[str, Any]) -> bool:
        """判断角色是否为女性"""
        # 安全检查数据类型
        if not isinstance(character_data, dict):
            print(f"⚠️ 警告: character_data 类型错误: {type(character_data)}")
            return False
        
        # 检查标签
        tags = character_data.get("标签", [])
        for tag in tags:
            if isinstance(tag, str):
                tag_lower = tag.lower()
                if any(female_word in tag_lower for female_word in ["female", "woman", "girl"]):
                    return True
                if any(male_word in tag_lower for male_word in ["male", "man", "boy"]):
                    return False
        
        # 检查文本中的性别线索
        all_text = ""
        if "总结词" in character_data and character_data["总结词"]:
            all_text += " ".join(str(w) for w in character_data["总结词"])
        if "关键词" in character_data and character_data["关键词"]:
            all_text += " ".join(str(w) for w in character_data["关键词"])
        if "描述" in character_data and character_data["描述"]:
            all_text += character_data["描述"]
        
        all_text = all_text.lower()
        
        gender_detection = self.config.get("gender_detection", {})
        female_indicators = gender_detection.get("female_indicators", ["她", "女", "girl", "woman", "female"])
        male_indicators = gender_detection.get("male_indicators", ["他", "男", "boy", "man", "male"])
        
        female_count = sum(1 for word in female_indicators if word in all_text)
        male_count = sum(1 for word in male_indicators if word in all_text)
        
        if female_count > male_count:
            return True
        elif male_count > female_count:
            return False
        
        # 默认检查是否有外貌特征字段（通常女性角色更可能有详细外貌描述）
        return "外貌特征" in character_data.get("属性", {})
    
    def _has_sports_traits(self, character_data: Dict[str, Any]) -> bool:
        """判断角色是否有运动特征"""
        sports_detection = self.config.get("sports_detection", {})
        
        # 检查总结词
        summary_words = character_data.get("总结词", [])
        summary_keywords = sports_detection.get("summary_keywords", ["田径", "运动", "健将"])
        
        for word in summary_words:
            if any(keyword in str(word).lower() for keyword in summary_keywords):
                return True
        
        # 检查标签
        tags = character_data.get("标签", [])
        tag_keywords = sports_detection.get("tag_keywords", ["田径", "运动", "健将"])
        for tag in tags:
            if any(keyword in str(tag).lower() for keyword in tag_keywords):
                return True
        
        # 检查描述
        description = character_data.get("描述", "")
        description_indicators = sports_detection.get("description_indicators", ["田径", "跑步", "运动"])
        return any(indicator in description for indicator in description_indicators)
    
    def calculate_fuzzy_score(self, query: str, character_key: str, character_data: Dict[str, Any]) -> float:
        """计算模糊匹配得分"""
        # 安全检查数据类型
        if not isinstance(character_data, dict):
            print(f"⚠️ 警告: character_data 类型错误: {type(character_data)}")
            return 0.0
        if not FUZZYWUZZY_AVAILABLE:
            return 0.0
        
        total_score = 0.0
        max_score = 0.0
        weights = self.config.get("fuzzy_weights", {})
        
        # 角色名称匹配
        if "属性" in character_data and "状态" in character_data["属性"] and isinstance(character_data["属性"]["状态"], dict):
            name = character_data["属性"]["状态"].get("名称", character_key)
            name_score = fuzz.partial_ratio(query, name) / 100.0
            total_score += name_score * weights.get("name_weight", 2.0)
            max_score = max(max_score, name_score)
        
        # 总结词匹配
        if "总结词" in character_data and character_data["总结词"]:
            summary_text = " ".join(str(w) for w in character_data["总结词"])
            summary_score = fuzz.partial_ratio(query, summary_text) / 100.0
            total_score += summary_score * weights.get("summary_weight", 1.5)
            max_score = max(max_score, summary_score)
        
        # 标签匹配
        if "标签" in character_data and character_data["标签"]:
            tags_text = " ".join(str(t) for t in character_data["标签"])
            tags_score = fuzz.partial_ratio(query, tags_text) / 100.0
            total_score += tags_score * weights.get("tags_weight", 1.2)
            max_score = max(max_score, tags_score)
        
        # 描述匹配
        if "描述" in character_data and character_data["描述"]:
            desc_score = fuzz.partial_ratio(query, character_data["描述"]) / 100.0
            total_score += desc_score * weights.get("description_weight", 1.0)
            max_score = max(max_score, desc_score)
        
        avg_score = total_score / 4.0
        max_ratio = weights.get("max_score_ratio", 0.6)
        avg_ratio = weights.get("avg_score_ratio", 0.4)
        combined_score = max_score * max_ratio + avg_score * avg_ratio
        
        return combined_score
    
    def smart_search(self, query: str, top_k: int = 5) -> List[Tuple[str, float, Dict[str, Any]]]:
        """
        智能搜索 - 自动选择最佳搜索策略
        """
        if not query or not query.strip():
            return []
        
        query_words = self.preprocess_text(query)
        
        if not query_words:
            return []
        
        # 计算每个角色的综合得分
        all_scores = []
        for doc_key in self.doc_keys:
            character_data = self.characters_data[doc_key]
            
            # 硬编码特征得分
            feature_score = self.calculate_feature_score(query_words, character_data)
            
            # 模糊匹配得分
            fuzzy_score = self.calculate_fuzzy_score(query, doc_key, character_data)
            
            # 精确匹配奖励
            precision_bonus = self._calculate_precision_bonus(query_words, character_data)
            
            # 综合得分
            weights = self.config.get("search_weights", {})
            final_score = (feature_score * weights.get("feature_score_weight", 0.6) + 
                          fuzzy_score * weights.get("fuzzy_score_weight", 0.3) + 
                          precision_bonus * weights.get("precision_bonus_weight", 0.1))
            
            all_scores.append((doc_key, final_score))
        
        # 排序并返回结果
        all_scores.sort(key=lambda x: x[1], reverse=True)
        
        results = []
        for doc_key, score in all_scores[:top_k]:
            character_data = self.characters_data[doc_key]
            results.append((doc_key, score, character_data))
        
        return results
    
    def _calculate_precision_bonus(self, query_words: List[str], character_data: Dict[str, Any]) -> float:
        """计算精确匹配奖励分数"""
        bonus = 0.0
        precision_config = self.config.get("precision_bonus", {})
        
        all_text = self.extract_searchable_text(character_data).lower()
        
        high_value_words = precision_config.get("high_value_words", ["跑步", "田径", "运动"])
        medium_value_words = precision_config.get("medium_value_words", ["喜欢", "阳光", "开朗"])
        high_bonus = precision_config.get("high_value_bonus", 0.2)
        medium_bonus = precision_config.get("medium_value_bonus", 0.1)
        default_bonus = precision_config.get("default_bonus", 0.05)
        
        for word in query_words:
            if word in all_text:
                if word in high_value_words:
                    bonus += high_bonus
                elif word in medium_value_words:
                    bonus += medium_bonus
                else:
                    bonus += default_bonus
        
        # 特殊组合奖励
        if "跑步" in query_words and "女生" in query_words:
            is_female = self._is_female_character(character_data)
            has_sports = self._has_sports_traits(character_data)
            if is_female and has_sports:
                bonus += precision_config.get("special_combination_bonus", 0.5)
            elif is_female:
                bonus += precision_config.get("gender_only_bonus", 0.2)
        
        return bonus
    
    def fuzzy_name_search(self, name: str, top_k: int = 5) -> List[Tuple[str, int, Dict[str, Any]]]:
        """按名称进行模糊搜索"""
        if not FUZZYWUZZY_AVAILABLE or not hasattr(self, 'fuzzy_index'):
            return []
        
        name_matches = process.extract(
            name,
            self.fuzzy_index["character_names"],
            limit=top_k,
            scorer=fuzz.ratio
        )
        
        results = []
        min_score = self.config.get("fuzzy_config", {}).get("name_search_min_score", 30)
        for match_text, score in name_matches:
            if score >= min_score:
                character_key = match_text.split("|")[1]
                character_data = self.characters_data[character_key]
                results.append((character_key, score, character_data))
        
        return results
    
    def search_with_tiers(self, query: str, top_k: int = 5) -> List[Tuple[str, str, float, str]]:
        """
        分层搜索 - 根据相关度阈值返回不同详细程度的数据
        
        Returns:
            List of (character_key, formatted_output, score, relevance_level)
        """
        # 使用智能搜索获取结果
        search_results = self.smart_search(query, top_k)
        
        formatted_results = []
        
        for character_key, score, character_data in search_results:
            # 确定相关度级别
            thresholds = self.config.get("relevance_thresholds", {
                "high_relevance": 0.7,
                "medium_relevance": 0.4,
                "low_relevance": 0.1
            })
            
            if score >= thresholds["high_relevance"]:
                relevance_level = "高相关度"
            elif score >= thresholds["medium_relevance"]:
                relevance_level = "中等相关度"
            else:
                relevance_level = "低相关度"
            
            # 根据相关度过滤数据
            filtered_data = self.filter_data_by_relevance(character_data, score)
            
            # 格式化输出
            formatted_output = self.format_character_output(
                character_key, filtered_data, score, relevance_level
            )
            
            formatted_results.append((character_key, formatted_output, score, relevance_level))
        
        return formatted_results
    
    def filter_data_by_relevance(self, character_data: Dict[str, Any], relevance_score: float) -> Dict[str, Any]:
        """根据相关度过滤数据 - 旧版本方法，保持兼容性"""
        thresholds = self.config.get("relevance_thresholds", {
            "high_relevance": 0.7,
            "medium_relevance": 0.4,
            "low_relevance": 0.1
        })
        
        return_fields_config = self.config.get("return_fields", {
            "high_relevance": "complete",
            "medium_relevance": {
                "include_fields": ["总结词", "关键词", "属性.状态", "属性.外貌特征", "标签", "描述"]
            },
            "low_relevance": {
                "include_fields": ["属性.状态.名称", "属性.外貌特征", "总结词"]
            }
        })
        
        # 确定相关度级别
        if relevance_score >= thresholds["high_relevance"]:
            relevance_level = "high_relevance"
        elif relevance_score >= thresholds["medium_relevance"]:
            relevance_level = "medium_relevance"
        else:
            relevance_level = "low_relevance"
        
        # 获取对应的返回字段配置
        field_config = return_fields_config[relevance_level]
        
        # 如果是完整返回
        if field_config == "complete":
            return character_data.copy()
        
        # 根据字段配置过滤数据
        filtered_data = {}
        include_fields = field_config.get("include_fields", [])
        
        for field_path in include_fields:
            value = self._get_nested_value(character_data, field_path)
            if value is not None:
                self._set_nested_value(filtered_data, field_path, value)
        
        return filtered_data
    
    def filter_data_by_position(self, character_data: Dict[str, Any], position: int, total_count: int, 
                               data_size_estimate: int = 0) -> Dict[str, Any]:
        """
        根据位置和总数量动态过滤数据
        
        Args:
            character_data: 角色数据
            position: 当前位置（0-based）
            total_count: 总数据书数量
            data_size_estimate: 数据大小估计（字符数）
        
        Returns:
            过滤后的数据
        """
        # 获取动态压缩配置
        dynamic_config = self.config.get("dynamic_compression", {
            "max_storybooks": 15,
            "full_display_count": 4,
            "compression_levels": {
                "full": "complete",
                "medium": {
                    "include_fields": ["总结词", "关键词", "属性.状态", "属性.外貌特征", "标签", "描述"]
                },
                "high": {
                    "include_fields": ["总结词", "属性.状态.名称", "属性.外貌特征", "描述"]
                },
                "extreme": {
                    "include_fields": ["总结词", "属性.状态.名称", "属性.外貌特征"]
                }
            },
            "size_thresholds": {
                "large_dataset": 50000,  # 超过5万字符认为是大数据集
                "medium_dataset": 20000  # 超过2万字符认为是中等数据集
            }
        })
        
        # 超过最大数量限制，直接忽略
        if position >= dynamic_config["max_storybooks"]:
            return {}
        
        # 前N个完全显示
        if position < dynamic_config["full_display_count"]:
            return character_data.copy()
        
        # 确定压缩级别
        compression_level = self._determine_compression_level(
            position, total_count, data_size_estimate, dynamic_config
        )
        
        field_config = dynamic_config["compression_levels"][compression_level]
        
        # 如果是完整返回
        if field_config == "complete":
            return character_data.copy()
        
        # 根据字段配置过滤数据
        filtered_data = {}
        include_fields = field_config.get("include_fields", [])
        
        for field_path in include_fields:
            value = self._get_nested_value(character_data, field_path)
            if value is not None:
                self._set_nested_value(filtered_data, field_path, value)
        
        return filtered_data
    
    def _determine_compression_level(self, position: int, total_count: int, 
                                   data_size_estimate: int, config: Dict[str, Any]) -> str:
        """
        确定压缩级别
        
        Args:
            position: 当前位置
            total_count: 总数量
            data_size_estimate: 数据大小估计
            config: 动态压缩配置
            
        Returns:
            压缩级别 ('full', 'medium', 'high', 'extreme')
        """
        # 前4个完全显示
        if position < config["full_display_count"]:
            return "full"
        
        # 根据数据集大小和位置确定压缩级别
        size_thresholds = config["size_thresholds"]
        
        # 大数据集情况
        if data_size_estimate > size_thresholds["large_dataset"]:
            if position < 8:  # 5-8位置中等压缩
                return "medium"
            elif position < 12:  # 9-12位置高压缩
                return "high"
            else:  # 13-15位置极度压缩
                return "extreme"
        
        # 中等数据集情况
        elif data_size_estimate > size_thresholds["medium_dataset"]:
            if position < 10:  # 5-10位置中等压缩
                return "medium"
            else:  # 11-15位置高压缩
                return "high"
        
        # 小数据集情况
        else:
            if position < 12:  # 5-12位置中等压缩
                return "medium"
            else:  # 13-15位置高压缩
                return "high"
    
    def _get_nested_value(self, data: Dict[str, Any], field_path: str) -> Any:
        """根据字段路径获取嵌套字典的值"""
        keys = field_path.split('.')
        current = data
        
        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                return None
        
        return current
    
    def _set_nested_value(self, data: Dict[str, Any], field_path: str, value: Any) -> None:
        """根据字段路径设置嵌套字典的值"""
        keys = field_path.split('.')
        current = data
        
        for key in keys[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]
        
        current[keys[-1]] = value
    
    def format_character_output(self, character_key: str, character_data: Dict[str, Any], score: float, relevance_level: str) -> str:
        """格式化角色输出"""
        output_lines = []
        
        # 数据书标题
        output_lines.append("=" * 50)
        output_lines.append(f"数据书: {character_key}")
        output_lines.append(f"相关度: {score:.3f} ({relevance_level})")
        output_lines.append("=" * 50)
        
        # 格式化数据内容
        def format_dict(data: Dict[str, Any], indent: int = 0) -> List[str]:
            lines = []
            indent_str = "  " * indent
            
            for key, value in data.items():
                if isinstance(value, dict):
                    lines.append(f"{indent_str}{key}:")
                    lines.extend(format_dict(value, indent + 1))
                elif isinstance(value, list):
                    lines.append(f"{indent_str}{key}: {', '.join(str(v) for v in value)}")
                else:
                    lines.append(f"{indent_str}{key}: {value}")
            
            return lines
        
        output_lines.extend(format_dict(character_data))
        output_lines.append("")  # 空行分隔
        
        return "\n".join(output_lines)
    
    def get_engine_info(self) -> Dict[str, Any]:
        """获取搜索引擎信息"""
        return {
            "engine_type": "SemanticSearchEngine",
            "version": "2.0",
            "data_loaded": len(self.characters_data),
            "fuzzy_available": FUZZYWUZZY_AVAILABLE,
            "config": {
                "data_directory": str(self.data_directory),
                "feature_categories": list(self.feature_maps.keys()),
                "total_features": sum(len(fm) for fm in self.feature_maps.values())
            }
        }

# 全局单例
_semantic_engine = None

def get_semantic_search_engine(config_manager=None) -> SemanticSearchEngine:
    """获取语义搜索引擎单例"""
    global _semantic_engine
    if _semantic_engine is None:
        _semantic_engine = SemanticSearchEngine(config_manager)
    return _semantic_engine

# 便捷函数
def semantic_search(query: str, top_k: int = 5, config_manager=None) -> List[Tuple[str, float, Dict[str, Any]]]:
    """语义搜索便捷函数"""
    engine = get_semantic_search_engine(config_manager)
    return engine.smart_search(query, top_k)

def semantic_search_with_tiers(query: str, top_k: int = 5, config_manager=None) -> List[Tuple[str, str, float, str]]:
    """分层语义搜索便捷函数"""
    engine = get_semantic_search_engine(config_manager)
    return engine.search_with_tiers(query, top_k)
