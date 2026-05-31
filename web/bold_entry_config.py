"""
大胆录入配置文件
控制临时数据大胆录入功能的各种参数和开关
"""

import json
import os
from pathlib import Path

from web.utils import PathManager

class BoldEntryConfig:
    """大胆录入配置管理器"""
    
    def __init__(self, config_file=None):
        self.config_file = Path(config_file) if config_file else PathManager.get_bold_entry_config_path()
        self.default_config = {
            # 主开关
            "enabled": True,
            "debug_mode": True,
            
            # 录入阈值配置
            "confidence_thresholds": {
                "high": 0.8,     # 高置信度阈值
                "medium": 0.5,   # 中等置信度阈值  
                "low": 0.2       # 低置信度阈值
            },
            
            # 信息类别开关
            "category_switches": {
                "emotions": True,      # 情绪信息
                "actions": True,       # 行为信息
                "locations": True,     # 位置信息
                "relationships": True, # 关系信息
                "items": True,         # 物品信息
                "environment": True,   # 环境信息
                "time_references": True, # 时间信息
                "other_info": True     # 其他信息
            },
            
            # 录入频率控制
            "frequency_control": {
                "max_entries_per_message": 10,  # 每条消息最大录入数
                "min_interval_seconds": 5,      # 最小录入间隔（秒）
                "max_duplicate_entries": 3      # 最大重复录入次数
            },
            
            # 关键词权重
            "keyword_weights": {
                "emotion_keywords": 1.2,     # 情绪关键词权重
                "action_keywords": 1.0,      # 行为关键词权重
                "location_keywords": 1.1,    # 位置关键词权重
                "relationship_keywords": 0.9, # 关系关键词权重
                "item_keywords": 0.8,        # 物品关键词权重
                "environment_keywords": 0.7   # 环境关键词权重
            },
            
            # 多样性分析配置
            "diversity_analysis": {
                "enabled": True,
                "analyze_context": True,      # 分析上下文
                "analyze_patterns": True,     # 分析模式
                "analyze_trends": True,       # 分析趋势
                "min_diversity_score": 0.3   # 最小多样性分数
            },
            
            # 向量化优化配置
            "vectorization_optimization": {
                "enabled": True,
                "similarity_threshold": 0.01,  # 降低相似度阈值
                "max_relevant_items": 8,       # 增加最大相关项目数
                "include_low_confidence": True  # 包含低置信度信息
            }
        }
        
        self.config = self.load_config()
    
    def load_config(self):
        """加载配置文件"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    loaded_config = json.load(f)
                    # 合并默认配置和加载的配置
                    config = self.default_config.copy()
                    config.update(loaded_config)
                    return config
            else:
                # 如果配置文件不存在，创建默认配置文件
                self.save_config(self.default_config)
                return self.default_config.copy()
        except Exception as e:
            print(f"加载配置文件失败，使用默认配置: {e}")
            return self.default_config.copy()
    
    def save_config(self, config=None):
        """保存配置文件"""
        try:
            config_to_save = config or self.config
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config_to_save, f, ensure_ascii=False, indent=2)
            print(f"配置文件已保存: {self.config_file}")
        except Exception as e:
            print(f"保存配置文件失败: {e}")
    
    def get(self, key, default=None):
        """获取配置值"""
        keys = key.split('.')
        value = self.config
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        return value
    
    def set(self, key, value):
        """设置配置值"""
        keys = key.split('.')
        config = self.config
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        config[keys[-1]] = value
        self.save_config()
    
    def is_enabled(self):
        """检查大胆录入功能是否启用"""
        return self.get('enabled', True)
    
    def is_category_enabled(self, category):
        """检查特定类别是否启用"""
        return self.get(f'category_switches.{category}', True)
    
    def get_confidence_threshold(self, level):
        """获取置信度阈值"""
        return self.get(f'confidence_thresholds.{level}', 0.5)
    
    def get_keyword_weight(self, keyword_type):
        """获取关键词权重"""
        return self.get(f'keyword_weights.{keyword_type}', 1.0)
    
    def is_diversity_analysis_enabled(self):
        """检查多样性分析是否启用"""
        return self.get('diversity_analysis.enabled', True)
    
    def get_max_entries_per_message(self):
        """获取每条消息最大录入数"""
        return self.get('frequency_control.max_entries_per_message', 10)
    
    def get_vectorization_config(self):
        """获取向量化配置"""
        return self.get('vectorization_optimization', {})


# 全局配置实例
_bold_config = None

def get_bold_entry_config():
    """获取全局大胆录入配置实例"""
    global _bold_config
    if _bold_config is None:
        _bold_config = BoldEntryConfig()
    return _bold_config


if __name__ == "__main__":
    # 测试配置
    config = BoldEntryConfig()
    
    print("大胆录入配置测试:")
    print(f"功能启用: {config.is_enabled()}")
    print(f"情绪分析启用: {config.is_category_enabled('emotions')}")
    print(f"高置信度阈值: {config.get_confidence_threshold('high')}")
    print(f"情绪关键词权重: {config.get_keyword_weight('emotion_keywords')}")
    print(f"多样性分析启用: {config.is_diversity_analysis_enabled()}")
    print(f"每条消息最大录入数: {config.get_max_entries_per_message()}")
    
    # 测试设置配置
    config.set('enabled', False)
    print(f"设置后功能启用: {config.is_enabled()}")
    
    # 恢复设置
    config.set('enabled', True)
    print(f"恢复后功能启用: {config.is_enabled()}")
