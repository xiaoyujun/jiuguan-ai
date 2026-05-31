# -*- coding: utf-8 -*-
"""
游戏分数处理器 - 简化版
=====================

将所有游戏的分数统一转换为D100格式的具体数字，传入聊天框。

支持的游戏类型：
- D100骰子检定 (直接使用结果)
- FPS定位微调 (根据得分转换为D100)
- 其他游戏 (可扩展)

作者: AI助手
日期: 2025-09-20
"""

import math
from typing import Dict, Any, Optional


class GameScoreProcessor:
    """游戏分数处理器 - 简化版"""
    
    def __init__(self):
        """初始化游戏分数处理器"""
        # 游戏转换配置
        self.game_configs = {
            'd100': {
                'name': '命运之骰',
                'conversion': 'direct'  # 直接使用结果
            },
            'fps': {
                'name': 'FPS定位微调',
                'conversion': 'score_based',  # 基于分数转换
                'max_expected_score': 2000,  # 预期最高分
                'accuracy_weight': 0.4,      # 准确率权重
                'score_weight': 0.6          # 分数权重
            },
            'fc': {
                'name': 'FC红白机游戏',
                'conversion': 'fc_based',     # FC游戏专用转换
                'time_weight': 0.6,          # 游戏时长权重
                'achievement_weight': 0.4     # 成就权重
            },
            'flappy_bird': {
                'name': '像素鸟飞行',
                'conversion': 'flappy_based', # FlappyBird专用转换
                'score_weight': 0.7,         # 分数权重
                'achievement_weight': 0.3     # 成就权重
            },
        }
    
    def convert_to_d100(self, game_type: str, score_data: Dict[str, Any]) -> int:
        """
        将游戏分数转换为D100数值
        
        Args:
            game_type: 游戏类型
            score_data: 分数数据
            
        Returns:
            D100数值 (1-100)
        """
        config = self.game_configs.get(game_type)
        if not config:
            # 未知游戏类型，使用默认转换
            return self._default_conversion(score_data)
        
        conversion_type = config['conversion']
        
        if conversion_type == 'direct':
            return self._convert_d100_direct(score_data)
        elif conversion_type == 'score_based':
            return self._convert_fps_to_d100(score_data, config)
        elif conversion_type == 'fc_based':
            return self._convert_fc_to_d100(score_data, config)
        elif conversion_type == 'flappy_based':
            return self._convert_flappy_to_d100(score_data, config)
        else:
            return self._default_conversion(score_data)
    
    def _convert_d100_direct(self, score_data: Dict[str, Any]) -> int:
        """D100直接转换"""
        result = score_data.get('result', 50)
        return max(1, min(100, int(result)))
    
    def _convert_fps_to_d100(self, score_data: Dict[str, Any], config: Dict[str, Any]) -> int:
        """FPS游戏转换为D100"""
        score = score_data.get('score', 0)
        accuracy = score_data.get('accuracy', 0)
        
        # 分数部分 (0-60分)
        max_score = config['max_expected_score']
        score_part = min(60, (score / max_score) * 60)
        
        # 准确率部分 (0-40分)
        accuracy_part = (accuracy / 100) * 40
        
        # 合计并确保在1-100范围内
        total = score_part + accuracy_part
        return max(1, min(100, int(total)))
    
    def _convert_fc_to_d100(self, score_data: Dict[str, Any], config: Dict[str, Any]) -> int:
        """FC游戏转换为D100"""
        play_time_minutes = score_data.get('play_time_minutes', 0)
        achievements_count = score_data.get('achievements_count', 0)
        total_achievements = score_data.get('total_achievements', 3)
        
        # 时长部分 (0-60分) - 基于游戏时长
        # 10分钟以上获得满分，线性递增
        time_part = min(60, (play_time_minutes / 10) * 60)
        
        # 成就部分 (0-40分) - 基于成就完成度
        achievement_ratio = achievements_count / max(1, total_achievements)
        achievement_part = achievement_ratio * 40
        
        # 合计并确保在1-100范围内
        total = time_part + achievement_part
        return max(1, min(100, int(total)))
    
    def _convert_flappy_to_d100(self, score_data: Dict[str, Any], config: Dict[str, Any]) -> int:
        """FlappyBird游戏转换为D100"""
        score = score_data.get('score', 0)
        achievements_count = score_data.get('achievements_count', 0)
        total_achievements = score_data.get('total_achievements', 5)
        
        # 分数部分 (0-70分) - 基于游戏得分
        # 分数转换：0-10分线性增长，10-50分缓慢增长，50+分逐渐趋近满分
        if score <= 10:
            score_part = (score / 10) * 35  # 0-35分
        elif score <= 50:
            score_part = 35 + ((score - 10) / 40) * 25  # 35-60分
        else:
            score_part = 60 + min(10, (score - 50) / 10)  # 60-70分
        
        # 成就部分 (0-30分) - 基于成就完成度
        achievement_ratio = achievements_count / max(1, total_achievements)
        achievement_part = achievement_ratio * 30
        
        # 合计并确保在1-100范围内
        total = score_part + achievement_part
        return max(1, min(100, int(total)))
    
    def _default_conversion(self, score_data: Dict[str, Any]) -> int:
        """默认转换逻辑"""
        score = score_data.get('score', 50)
        if score <= 0:
            return 1
        elif score >= 1000:
            return 100
        else:
            # 简单的线性转换
            return max(1, min(100, int(score / 10)))
    
    def format_chat_message(self, game_type: str, player_name: str, d100_result: int) -> str:
        """
        格式化聊天消息
        
        Args:
            game_type: 游戏类型
            player_name: 玩家名称
            d100_result: D100结果
            
        Returns:
            格式化的聊天消息
        """
        # 统一格式：使用通用的"一次检定"描述
        return f"({player_name}进行了一次检定)检定结果为:d{d100_result}"
    
    def process_game_result(self, game_type: str, player_name: str, score_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        处理游戏结果
        
        Args:
            game_type: 游戏类型
            player_name: 玩家名称
            score_data: 分数数据
            
        Returns:
            处理结果
        """
        try:
            # 转换为D100
            d100_result = self.convert_to_d100(game_type, score_data)
            
            # 格式化消息
            chat_message = self.format_chat_message(game_type, player_name, d100_result)
            
            return {
                'success': True,
                'game_type': game_type,
                'player_name': player_name,
                'd100_result': d100_result,
                'chat_message': chat_message,
                'raw_score_data': score_data
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'game_type': game_type,
                'player_name': player_name
            }
    
    def add_game_config(self, game_type: str, name: str, conversion_config: Dict[str, Any]):
        """
        添加新游戏配置
        
        Args:
            game_type: 游戏类型标识
            name: 游戏名称
            conversion_config: 转换配置
        """
        self.game_configs[game_type] = {
            'name': name,
            **conversion_config
        }
    
    def get_supported_games(self) -> list:
        """获取支持的游戏类型"""
        return list(self.game_configs.keys())


# 创建全局实例
game_score_processor = GameScoreProcessor()


def process_game_score(game_type: str, player_name: str, score_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    处理游戏分数的便捷函数
    
    Args:
        game_type: 游戏类型
        player_name: 玩家名称
        score_data: 分数数据
        
    Returns:
        处理结果，包含d100_result和chat_message
    """
    return game_score_processor.process_game_result(game_type, player_name, score_data)


def convert_score_to_d100(game_type: str, score_data: Dict[str, Any]) -> int:
    """
    将分数转换为D100的便捷函数
    
    Args:
        game_type: 游戏类型
        score_data: 分数数据
        
    Returns:
        D100数值
    """
    return game_score_processor.convert_to_d100(game_type, score_data)
