#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
2.0架构集成模块
为聊天系统提供统一的数据处理接口
"""

import logging
from typing import Dict, Any, Tuple, Optional, List

from web.utils import PathManager

logger = logging.getLogger(__name__)

def get_architecture_2_0_processor():
    """
    获取2.0架构处理器
    这是聊天系统的主要入口点
    """
    try:
        from .simple_processor import get_simple_processor
        return ChatIntegratedProcessor(get_simple_processor())
    except Exception as e:
        logger.error(f"2.0架构处理器初始化失败: {e}")
        raise

class ChatIntegratedProcessor:
    """
    聊天集成处理器
    专门为聊天系统设计，分析聊天内容并自动引入相关数据书
    """
    
    def __init__(self, simple_processor):
        self.simple_processor = simple_processor
        self.semantic_engine = simple_processor.semantic_engine
        logger.info("聊天集成处理器初始化完成")
    
    def process_user_input(self, role_name: str, user_input: str, 
                          include_player_data: bool = True, 
                          player_name: str = None,
                          temp_role: str = None,
                          multi_chat_participants: list = None,
                          log_role_name: str = None) -> Tuple[str, bool, Dict[str, Any]]:
        """
        处理聊天中的用户输入
        
        核心功能：分析聊天内容，自动识别并引入相关角色的数据书作为提示词
        
        Args:
            role_name: 当前对话的角色名称（用于AI回复）
            user_input: 用户输入的聊天内容
            include_player_data: 是否包含玩家数据
            player_name: 玩家名称
            temp_role: 临时角色
            multi_chat_participants: 多人聊天参与者列表（可选）
            log_role_name: 用于日志记录的角色名称（可选，默认使用role_name）
            
        Returns:
            (context, success, details) - 上下文内容、是否成功、处理详情
        """
        try:
            logger.info(f"🔍 [聊天分析] 分析用户输入: {user_input[:50]}...")
            
            # 获取当前玩家信息
            if not player_name:
                player_name = self._get_current_player_name()
            
            # 多人聊天模式日志
            if multi_chat_participants:
                logger.info(f"👥 [多人聊天] 参与者: {multi_chat_participants}")
            
            logger.info(f"🎭 [角色上下文] 当前聊天角色: {role_name}, 当前玩家: {player_name}")
            
            # 分析聊天内容，提取可能提到的角色和概念，并传入角色上下文和多人聊天参与者信息
            chat_analysis = self._analyze_chat_content(user_input, role_name, player_name, multi_chat_participants)
            
            # 基于聊天分析结果进行智能搜索
            relevant_context = self._search_relevant_storybooks(chat_analysis, role_name, player_name)
            
            # 确保AI自己的角色数据和当前玩家数据始终被包含（最高优先级）
            priority_context = self._ensure_priority_character_data(role_name, player_name)
            if priority_context:
                relevant_context = priority_context + "\n\n" + relevant_context
            
            # 添加玩家数据（如果需要）
            if include_player_data:
                player_context = self.simple_processor._get_player_data(player_name)
                if player_context:
                    relevant_context += f"\n\n{player_context}"
            
            # 记录详细的聊天分析日志
            import time
            processing_start_time = time.time()
            
            processing_details = {
                "chat_analysis": chat_analysis,
                "matched_storybooks": len(chat_analysis.get("matched_storybooks", [])),
                "total_context_length": len(relevant_context),
                "processing_time": f"{(time.time() - processing_start_time) * 1000:.1f}ms",
                "transmission_details": {
                    "content_length": len(relevant_context),
                    "log_file": None
                }
            }
            
            # 记录详细的分析过程到日志文件
            try:
                # 使用log_role_name进行日志记录，如果没有提供则使用role_name
                actual_log_role = log_role_name if log_role_name else role_name
                log_file = self.simple_processor.temp_data_recorder.record_chat_analysis(
                    role_name=actual_log_role,
                    user_input=user_input,
                    chat_analysis=chat_analysis,
                    final_context=relevant_context,
                    processing_details=processing_details
                )
                processing_details["transmission_details"]["log_file"] = log_file
                logger.info(f"📝 [详细日志] 已记录到: {log_file}")
            except Exception as e:
                logger.error(f"❌ [详细日志] 记录失败: {e}")
            
            success = len(relevant_context) > 0
            
            logger.info(f"✅ [聊天分析] 处理完成: 找到{len(chat_analysis.get('matched_storybooks', []))}个相关数据书")
            
            return relevant_context, success, processing_details
            
        except Exception as e:
            logger.error(f"❌ [聊天分析] 处理失败: {e}")
            return "", False, {"error": str(e)}
    
    def _get_current_player_name(self) -> str:
        """
        获取当前玩家名称
        """
        try:
            from pathlib import Path
            import json
            
            # 尝试从当前挑选玩家文件获取
            current_player_file = PathManager.get_players_dir() / "当前挑选玩家.json"
            if current_player_file.exists():
                with open(current_player_file, 'r', encoding='utf-8') as f:
                    player_data = json.load(f)
                    selected_player = player_data.get('selected_player')
                    if selected_player:
                        logger.info(f"🎮 [玩家获取] 当前玩家: {selected_player}")
                        return selected_player
            
            # 回退到默认值
            logger.warning("⚠️ [玩家获取] 未找到当前玩家，使用默认值: 用户")
            return "用户"
            
        except Exception as e:
            logger.error(f"❌ [玩家获取] 获取当前玩家失败: {e}")
            return "用户"
    
    def _analyze_chat_content(self, user_input: str, current_role: str, current_player: str = None, 
                            multi_chat_participants: list = None) -> Dict[str, Any]:
        """
        分析聊天内容，识别提到的角色、关系和概念
        
        这是核心功能：从聊天内容中识别出用户提到的其他角色
        
        Args:
            user_input: 用户输入
            current_role: 当前聊天角色
            current_player: 当前玩家
            multi_chat_participants: 多人聊天参与者列表（可选）
        """
        try:
            multi_chat_info = f", 多人聊天参与者: {multi_chat_participants}" if multi_chat_participants else ""
            logger.info(f"📝 [内容分析] 开始分析聊天内容 (角色: {current_role}, 玩家: {current_player}{multi_chat_info})")
            
            # 使用语义搜索引擎分析用户输入
            search_results = self.semantic_engine.smart_search(user_input, top_k=8)
            
            matched_storybooks = {}
            analysis_details = []
            
            # 处理搜索结果，包含所有相关角色（但AI自己的角色和玩家角色会在优先级处理中单独处理）
            for character_key, score, character_data in search_results:
                # 跳过当前AI角色和玩家角色（这些会在优先级处理中单独添加）
                if character_key == current_role or character_key == current_player:
                    continue
                
                # 角色关系加权：包含多人聊天参与者信息
                adjusted_score = self._adjust_score_for_role_context(
                    score, character_key, character_data, current_role, current_player, multi_chat_participants
                )
                
                # 设置较低的阈值，因为聊天中提到其他角色时可能只是简单提及
                if adjusted_score > 0.05:  # 更低的阈值，更容易捕获相关角色
                    matched_storybooks[character_key] = character_data
                    analysis_details.append({
                        'character_name': character_key,
                        'relevance_score': adjusted_score,
                        'original_score': score,  # 保存原始得分用于调试
                        'analysis_type': 'chat_mention',
                        'reason': self._get_match_reason(user_input, character_data, adjusted_score),
                        'context_boost': adjusted_score > score  # 标记是否受到上下文加权
                    })
            
            # 特别处理：检查是否直接提到了角色名称
            direct_mentions = self._detect_direct_character_mentions(user_input, current_role)
            for mentioned_character in direct_mentions:
                if mentioned_character not in matched_storybooks:
                    # 尝试获取这个角色的数据
                    character_data = self._get_character_data_by_name(mentioned_character)
                    if character_data:
                        matched_storybooks[mentioned_character] = character_data
                        analysis_details.append({
                            'character_name': mentioned_character,
                            'relevance_score': 0.8,  # 直接提及给高分
                            'analysis_type': 'direct_mention',
                            'reason': f'直接提到了角色名称: {mentioned_character}'
                        })
            
            logger.info(f"📊 [内容分析] 完成: 识别出{len(matched_storybooks)}个相关角色")
            
            return {
                "matched_storybooks": matched_storybooks,
                "analysis_details": analysis_details,
                "total_matches": len(matched_storybooks)
            }
            
        except Exception as e:
            logger.error(f"❌ [内容分析] 分析失败: {e}")
            return {"matched_storybooks": {}, "analysis_details": [], "total_matches": 0}
    
    def _detect_direct_character_mentions(self, user_input: str, current_role: str) -> list:
        """
        检测聊天中直接提到的角色名称
        """
        try:
            # 获取所有角色数据
            all_characters = self.semantic_engine.characters_data
            mentioned_characters = []
            
            user_input_lower = user_input.lower()
            
            for character_key, character_data in all_characters.items():
                if character_key == current_role:
                    continue
                
                # 检查角色键名
                if character_key.lower() in user_input_lower:
                    mentioned_characters.append(character_key)
                    continue
                
                # 检查角色的实际名称
                if "属性" in character_data and "状态" in character_data["属性"]:
                    actual_name = character_data["属性"]["状态"].get("名称", "")
                    if actual_name and actual_name.lower() in user_input_lower:
                        mentioned_characters.append(character_key)
                        continue
            
            if mentioned_characters:
                logger.info(f"🎯 [直接提及] 检测到角色: {', '.join(mentioned_characters)}")
            
            return mentioned_characters
            
        except Exception as e:
            logger.error(f"❌ [直接提及] 检测失败: {e}")
            return []
    
    def _adjust_score_for_role_context(self, original_score: float, character_key: str, 
                                     character_data: Dict[str, Any], current_role: str, 
                                     current_player: str, multi_chat_participants: list = None) -> float:
        """
        根据角色上下文调整相关度得分
        
        Args:
            original_score: 原始得分
            character_key: 角色键名
            character_data: 角色数据
            current_role: 当前聊天角色
            current_player: 当前玩家
            multi_chat_participants: 多人聊天参与者列表（可选）
            
        Returns:
            调整后的得分
        """
        try:
            adjusted_score = original_score
            boost_reasons = []
            
            # 从配置获取权重
            role_context_config = self.simple_processor.semantic_engine.config.get("role_context_config", {})
            chat_analysis_config = self.simple_processor.semantic_engine.config.get("chat_analysis", {})
            context_weights = chat_analysis_config.get("role_context_weights", {})
            multi_chat_config = chat_analysis_config.get("multi_chat_mode", {})
            
            # 检查是否为多人聊天模式
            is_multi_chat = multi_chat_participants is not None and len(multi_chat_participants) > 1
            
            # 1. 多人聊天模式下的特殊处理
            if is_multi_chat and multi_chat_config.get("enable_enhanced_binding", True):
                # 1.1 检查是否为多人聊天参与者的捆绑数据书
                if self._is_character_bound_to_multi_chat_participants(character_key, multi_chat_participants):
                    multi_chat_boost = context_weights.get("multi_chat_bound_character", 2.0)
                    binding_multiplier = multi_chat_config.get("binding_boost_multiplier", 1.5)
                    final_boost = multi_chat_boost * binding_multiplier
                    adjusted_score *= final_boost
                    boost_reasons.append(f"多人聊天捆绑角色(x{final_boost:.1f})")
                
                # 1.2 检查是否为多人聊天参与者
                elif character_key in multi_chat_participants:
                    participant_boost = context_weights.get("multi_chat_participant", 1.8)
                    participant_multiplier = multi_chat_config.get("participant_boost", 1.3)
                    final_boost = participant_boost * participant_multiplier
                    adjusted_score *= final_boost
                    boost_reasons.append(f"多人聊天参与者(x{final_boost:.1f})")
            
            # 2. 检查是否与当前玩家有绑定关系
            if self._is_character_bound_to_player(character_key, current_player):
                player_boost = context_weights.get("player_bound_character", role_context_config.get("player_binding_boost", 1.5))
                adjusted_score *= player_boost
                boost_reasons.append(f"与玩家{current_player}绑定(x{player_boost:.1f})")
            
            # 3. 检查是否与当前聊天角色有关系
            relationship_boost = self._get_character_relationship_boost(character_key, current_role)
            if relationship_boost > 1.0:
                role_boost = context_weights.get("related_character", role_context_config.get("role_relationship_boost", 1.3))
                adjusted_score *= (relationship_boost * role_boost)
                boost_reasons.append(f"与{current_role}有关系(x{relationship_boost * role_boost:.1f})")
            
            # 4. 检查角色数据中是否提到当前玩家或当前角色
            mention_boost = self._get_character_mention_boost(character_data, current_role, current_player)
            if mention_boost > 1.0:
                mention_weight = context_weights.get("mentioned_character", role_context_config.get("mention_boost", 1.2))
                adjusted_score *= (mention_boost * mention_weight)
                boost_reasons.append(f"数据中提及相关角色(x{mention_boost * mention_weight:.1f})")
            
            # 记录加权信息
            if boost_reasons:
                logger.info(f"🔗 [角色关系] {character_key} 得分调整: {original_score:.3f} → {adjusted_score:.3f} ({'; '.join(boost_reasons)})")
            
            return adjusted_score
            
        except Exception as e:
            logger.error(f"❌ [角色关系] 得分调整失败: {e}")
            return original_score
    
    def _is_character_bound_to_multi_chat_participants(self, character_key: str, participants: list) -> bool:
        """
        检查角色数据书是否与多人聊天参与者有绑定关系（使用自动同名绑定逻辑）
        
        Args:
            character_key: 角色键名
            participants: 多人聊天参与者列表
            
        Returns:
            bool: 是否有绑定关系
        """
        try:
            # 使用自动绑定逻辑
            import sys
            from pathlib import Path
            parent_dir = Path(__file__).parent.parent.parent
            if str(parent_dir) not in sys.path:
                sys.path.insert(0, str(parent_dir))
            
            from auto_binding_utils import is_character_bound_auto
            
            is_bound = is_character_bound_auto(character_key, participants)
            if is_bound:
                logger.info(f"🔗 [自动绑定] 数据书{character_key}与多人聊天参与者绑定")
            
            return is_bound
            
        except Exception as e:
            logger.warning(f"⚠️ [自动绑定] 检查数据书{character_key}与参与者绑定关系失败: {e}")
            return False
    
    def _is_character_bound_to_player(self, character_key: str, player_name: str) -> bool:
        """
        检查角色是否与玩家绑定
        """
        try:
            # 这里可以检查角色数据书中的绑定信息
            # 或者通过其他方式检查角色与玩家的关系
            from pathlib import Path
            import json
            
            # 检查数据书中是否有绑定玩家的字段
            storybook_dir = PathManager.get_storybook_dir()
            storybook_file = storybook_dir / f"{character_key}.json"
            
            if storybook_file.exists():
                with open(storybook_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # 检查捆绑玩家字段
                    bound_players = data.get("捆绑玩家", [])
                    if isinstance(bound_players, list) and player_name in bound_players:
                        return True
                    elif isinstance(bound_players, str) and bound_players == player_name:
                        return True
            
            return False
            
        except Exception as e:
            logger.warning(f"⚠️ [绑定检查] 检查角色{character_key}与玩家{player_name}绑定关系失败: {e}")
            return False
    
    def _get_character_relationship_boost(self, character_key: str, current_role: str) -> float:
        """
        获取角色关系加权系数
        """
        try:
            # 可以根据角色之间的关系设置不同的加权
            # 例如：朋友、敌人、恋人等关系可以有不同的权重
            
            # 这里可以扩展更复杂的关系判断逻辑
            # 目前先返回默认值
            return 1.0
            
        except Exception as e:
            logger.warning(f"⚠️ [关系加权] 获取角色{character_key}与{current_role}关系加权失败: {e}")
            return 1.0
    
    def _get_character_mention_boost(self, character_data: Dict[str, Any], 
                                   current_role: str, current_player: str) -> float:
        """
        检查角色数据中是否提到当前角色或玩家，返回加权系数
        """
        try:
            boost = 1.0
            
            # 检查描述中是否提到当前角色
            description = character_data.get("描述", "")
            if current_role in description:
                boost *= 1.3
            
            # 检查总结词中是否有相关内容
            summary_words = character_data.get("总结词", [])
            for word in summary_words:
                if current_role in str(word) or current_player in str(word):
                    boost *= 1.2
                    break
            
            # 检查关键词
            keywords = character_data.get("关键词", [])
            for keyword in keywords:
                if current_role in str(keyword) or current_player in str(keyword):
                    boost *= 1.2
                    break
            
            return boost
            
        except Exception as e:
            logger.warning(f"⚠️ [提及检查] 检查角色数据提及失败: {e}")
            return 1.0
    
    def _ensure_priority_character_data(self, current_role: str, current_player: str) -> str:
        """
        确保AI自己的角色数据和当前玩家数据始终被包含在上下文中（最高优先级）
        
        Args:
            current_role: 当前AI扮演的角色
            current_player: 当前玩家角色
            
        Returns:
            优先级角色数据的格式化字符串
        """
        try:
            priority_parts = []
            
            # 1. 确保AI自己的角色数据书被包含
            ai_role_data = self._get_character_storybook_data(current_role)
            if ai_role_data:
                formatted_ai_data = self.simple_processor._format_priority_role_data(current_role, ai_role_data, is_ai_role=True)
                priority_parts.append(formatted_ai_data)
                logger.info(f"🎯 [优先级数据] 已确保AI角色 {current_role} 的数据书被包含")
            
            # 2. 确保当前玩家的角色数据书被包含（如果存在）
            if current_player and current_player != "用户" and current_player != current_role:
                player_role_data = self._get_character_storybook_data(current_player)
                if player_role_data:
                    formatted_player_data = self.simple_processor._format_priority_role_data(current_player, player_role_data, is_ai_role=False)
                    priority_parts.append(formatted_player_data)
                    logger.info(f"🎮 [优先级数据] 已确保玩家角色 {current_player} 的数据书被包含")
            
            return "\n\n".join(priority_parts) if priority_parts else ""
            
        except Exception as e:
            logger.error(f"❌ [优先级数据] 确保优先级角色数据失败: {e}")
            return ""
    
    def _get_character_storybook_data(self, character_name: str) -> Optional[Dict[str, Any]]:
        """
        获取指定角色的数据书数据 - 使用自动绑定逻辑
        
        Args:
            character_name: 角色名称
            
        Returns:
            角色数据书数据，如果不存在则返回None
        """
        try:
            # 使用自动绑定逻辑获取角色数据书
            import sys
            from pathlib import Path
            parent_dir = Path(__file__).parent.parent.parent
            if str(parent_dir) not in sys.path:
                sys.path.insert(0, str(parent_dir))
            
            from auto_binding_utils import get_character_storybook_data_auto
            
            storybook_data = get_character_storybook_data_auto(character_name)
            if storybook_data:
                logger.info(f"✅ [自动绑定] 为角色 {character_name} 找到数据书")
                return storybook_data
            
            # 如果自动绑定失败，回退到原有逻辑
            return self._get_character_storybook_data_legacy(character_name)
            
        except Exception as e:
            logger.warning(f"⚠️ [数据获取] 自动绑定失败，回退到传统方式: {e}")
            return self._get_character_storybook_data_legacy(character_name)
    
    def _get_character_storybook_data_legacy(self, character_name: str) -> Optional[Dict[str, Any]]:
        """原有的获取角色数据书逻辑"""
        try:
            from pathlib import Path
            import json
            
            # 检查数据书目录中是否有该角色的数据
            storybook_dir = PathManager.get_storybook_dir()
            storybook_file = storybook_dir / f"{character_name}.json"
            
            if storybook_file.exists():
                with open(storybook_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            
            # 如果数据书目录没有，检查是否在语义搜索引擎的数据中
            if character_name in self.semantic_engine.characters_data:
                return self.semantic_engine.characters_data[character_name]
            
            return None
            
        except Exception as e:
            logger.warning(f"⚠️ [数据获取] 获取角色 {character_name} 的数据书失败: {e}")
            return None
    
    def _get_character_data_by_name(self, character_name: str) -> Optional[Dict[str, Any]]:
        """
        根据角色名称获取角色数据
        """
        try:
            all_characters = self.semantic_engine.characters_data
            
            # 首先尝试直接匹配键名
            if character_name in all_characters:
                return all_characters[character_name]
            
            # 然后尝试匹配实际名称
            for character_key, character_data in all_characters.items():
                if "属性" in character_data and "状态" in character_data["属性"]:
                    actual_name = character_data["属性"]["状态"].get("名称", "")
                    if actual_name and actual_name.lower() == character_name.lower():
                        return character_data
            
            return None
            
        except Exception as e:
            logger.error(f"❌ [角色数据获取] 失败: {e}")
            return None
    
    def _get_match_reason(self, user_input: str, character_data: Dict[str, Any], score: float) -> str:
        """
        分析匹配原因，用于调试和日志
        """
        reasons = []
        
        # 检查总结词匹配
        summary_words = character_data.get("总结词", [])
        for word in summary_words:
            if str(word).lower() in user_input.lower():
                reasons.append(f"总结词匹配: {word}")
        
        # 检查关键词匹配
        keywords = character_data.get("关键词", [])
        for word in keywords:
            if str(word).lower() in user_input.lower():
                reasons.append(f"关键词匹配: {word}")
        
        # 检查描述匹配
        description = character_data.get("描述", "")
        if description:
            # 简单的词汇重叠检查
            user_words = set(user_input.lower().split())
            desc_words = set(description.lower().split())
            overlap = user_words.intersection(desc_words)
            if len(overlap) > 2:
                reasons.append(f"描述匹配: {len(overlap)}个词汇重叠")
        
        if not reasons:
            reasons.append(f"语义相似度: {score:.3f}")
        
        return "; ".join(reasons[:2])  # 只返回前两个原因
    
    def _search_relevant_storybooks(self, chat_analysis: Dict[str, Any], current_role: str, current_player: str = None) -> str:
        """
        根据聊天分析结果搜索相关数据书并格式化 - 支持动态压缩
        """
        try:
            matched_storybooks = chat_analysis.get("matched_storybooks", {})
            analysis_details = chat_analysis.get("analysis_details", [])
            
            if not matched_storybooks:
                logger.info("📝 [数据书搜索] 未找到相关数据书")
                return ""
            
            # 按相关度排序数据书
            sorted_storybooks = self._sort_storybooks_by_relevance(matched_storybooks, analysis_details)
            
            # 估算总数据量
            total_estimated_size = self._estimate_total_data_size(sorted_storybooks)
            
            # 应用动态压缩策略并格式化数据书内容
            context_parts = []
            processed_count = 0
            
            for position, (character_key, character_data, relevance_score) in enumerate(sorted_storybooks):
                # 使用动态压缩过滤数据
                filtered_data = self.semantic_engine.filter_data_by_position(
                    character_data, position, len(sorted_storybooks), total_estimated_size
                )
                
                # 如果数据被完全过滤掉（超过最大限制），跳过
                if not filtered_data:
                    logger.info(f"📝 [动态压缩] 跳过第{position+1}个数据书: {character_key} (超过最大限制)")
                    continue
                
                # 格式化内容
                formatted_content = self.simple_processor._format_storybook_for_llm(character_key, filtered_data)
                if formatted_content:
                    # 添加压缩级别标记
                    compression_level = self._get_compression_level_name(position, len(sorted_storybooks), total_estimated_size)
                    formatted_content = f"=== 其他信息: {character_key} ===\n" + \
                                      f"相关度得分: {relevance_score:.3f} | 压缩级别: {compression_level}\n" + \
                                      formatted_content.split('\n', 1)[1] if '\n' in formatted_content else formatted_content
                    
                    context_parts.append(formatted_content)
                    processed_count += 1
            
            final_context = "\n\n".join(context_parts)
            
            logger.info(f"📚 [数据书搜索] 生成上下文: {len(final_context)}字符，处理{processed_count}/{len(matched_storybooks)}个数据书")
            logger.info(f"📊 [动态压缩] 总数据量估算: {total_estimated_size}字符，压缩策略已应用")
            
            return final_context
            
        except Exception as e:
            logger.error(f"❌ [数据书搜索] 搜索失败: {e}")
            return ""
    
    def _sort_storybooks_by_relevance(self, matched_storybooks: Dict[str, Any], 
                                    analysis_details: List[Dict[str, Any]]) -> List[Tuple[str, Dict[str, Any], float]]:
        """
        按相关度排序数据书
        
        Returns:
            List of (character_key, character_data, relevance_score)
        """
        # 创建相关度映射
        relevance_map = {}
        for detail in analysis_details:
            character_name = detail.get('character_name')
            relevance_score = detail.get('relevance_score', 0.0)
            if character_name:
                relevance_map[character_name] = relevance_score
        
        # 排序
        sorted_items = []
        for character_key, character_data in matched_storybooks.items():
            relevance_score = relevance_map.get(character_key, 0.0)
            sorted_items.append((character_key, character_data, relevance_score))
        
        # 按相关度降序排序
        sorted_items.sort(key=lambda x: x[2], reverse=True)
        
        return sorted_items
    
    def _estimate_total_data_size(self, sorted_storybooks: List[Tuple[str, Dict[str, Any], float]]) -> int:
        """
        估算总数据量大小
        
        Args:
            sorted_storybooks: 排序后的数据书列表
            
        Returns:
            估算的总字符数
        """
        import json
        total_size = 0
        
        for character_key, character_data, _ in sorted_storybooks:
            # 简单估算：将数据转为JSON字符串并计算长度
            try:
                data_str = json.dumps(character_data, ensure_ascii=False)
                total_size += len(data_str)
            except:
                # 如果转换失败，使用粗略估算
                total_size += 2000  # 假设每个数据书约2000字符
        
        return total_size
    
    def _get_compression_level_name(self, position: int, total_count: int, data_size_estimate: int) -> str:
        """
        获取压缩级别名称用于显示
        """
        # 获取动态压缩配置
        dynamic_config = self.semantic_engine.config.get("dynamic_compression", {})
        
        compression_level = self.semantic_engine._determine_compression_level(
            position, total_count, data_size_estimate, dynamic_config
        )
        
        level_names = {
            "full": "完整显示",
            "medium": "中等压缩", 
            "high": "高度压缩",
            "extreme": "极度压缩"
        }
        
        return level_names.get(compression_level, "未知压缩")
    
    def get_processor_info(self) -> Dict[str, Any]:
        """获取处理器信息"""
        base_info = self.simple_processor.get_processor_info()
        base_info.update({
            "integration_type": "ChatIntegratedProcessor",
            "integration_version": "1.0",
            "chat_features": [
                "聊天内容分析",
                "角色名称识别", 
                "自动数据书引入",
                "上下文智能构建"
            ]
        })
        return base_info
