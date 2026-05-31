"""
临时数据提取器
从聊天记录中正则提取[]中的信息，并进行智能处理和录入
"""

import json
import re
import logging
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from .ai_core import call_ai_model

logger = logging.getLogger(__name__)


class TempDataExtractor:
    """临时数据提取器 - 从聊天记录中提取和处理[]数据"""
    
    def __init__(self):
        self.bracket_pattern = re.compile(r'\[([^\[\]]+)\]')
        self.hash_pattern = re.compile(r'#([^#]+)#')
        
    def extract_from_chat_history(self, role_name: str) -> Dict[str, Any]:
        """
        从聊天记录中提取所有[]数据并进行处理
        
        Args:
            role_name: 角色名称
            
        Returns:
            Dict: 提取和处理结果
        """
        try:
            # 读取聊天记录
            chat_data = self._load_chat_history(role_name)
            if not chat_data:
                return {'success': False, 'error': '无法读取聊天记录'}
            
            # 提取所有[]数据
            extracted_brackets = self._extract_bracket_data(chat_data)
            if not extracted_brackets:
                return {'success': True, 'message': '未发现需要处理的[]数据', 'data': {}}
            
            logger.info(f"从{role_name}聊天记录中提取到{len(extracted_brackets)}个[]数据")
            
            # 处理提取的数据
            processed_data = self._process_bracket_data(extracted_brackets, role_name)
            
            # 录入到临时数据
            if processed_data['success'] and processed_data['temp_data']:
                self._save_to_temp_data(role_name, processed_data['temp_data'])
            
            return processed_data
            
        except Exception as e:
            logger.error(f"提取临时数据失败: {e}")
            logger.error(traceback.format_exc())
            return {'success': False, 'error': str(e)}
    
    def extract_from_message(self, message: str, role_name: str) -> Dict[str, Any]:
        """
        从单条消息中提取[]和#内容#数据并处理
        
        Args:
            message: 消息内容
            role_name: 角色名称
            
        Returns:
            Dict: 处理结果，包含提取的数据和清理信息
        """
        try:
            # 提取[]数据
            brackets = self.bracket_pattern.findall(message)
            # 提取#内容#数据
            hashes = self.hash_pattern.findall(message)
            
            all_extracts = []
            extract_info = {
                'has_brackets': len(brackets) > 0,
                'has_hashes': len(hashes) > 0,
                'bracket_count': len(brackets),
                'hash_count': len(hashes)
            }
            
            if brackets:
                all_extracts.extend(brackets)
                logger.info(f"从消息中提取到{len(brackets)}个[]数据: {brackets}")
            
            if hashes:
                all_extracts.extend(hashes)
                logger.info(f"从消息中提取到{len(hashes)}个#内容#数据: {hashes}")
            
            if not all_extracts:
                return {'success': True, 'message': '消息中未发现[]或#内容#数据', 'data': {}, 'extract_info': extract_info}
            
            # 处理所有提取的数据
            processed_data = self._process_bracket_data(all_extracts, role_name)
            
            # 增量更新到临时数据
            if processed_data['success'] and processed_data['temp_data']:
                self._update_temp_data(role_name, processed_data['temp_data'])
            
            # 添加提取信息到返回结果
            processed_data['extract_info'] = extract_info
            
            return processed_data
            
        except Exception as e:
            logger.error(f"处理消息[]/#内容#数据失败: {e}")
            return {'success': False, 'error': str(e)}
    
    def _load_chat_history(self, role_name: str) -> Optional[Dict]:
        """加载聊天记录"""
        try:
            from web.utils import PathManager
            
            chat_file = PathManager.get_chat_records_dir() / f"{role_name}.json"
            if not chat_file.exists():
                return None
            
            with open(chat_file, 'r', encoding='utf-8') as f:
                return json.load(f)
                
        except Exception as e:
            logger.error(f"加载聊天记录失败: {e}")
            return None
    
    def _extract_bracket_data(self, chat_data: Dict) -> List[str]:
        """从聊天数据中提取所有[]内容"""
        brackets = []
        
        # 从对话历史中提取
        dialogue_history = chat_data.get('对话历史', [])
        for message in dialogue_history:
            if isinstance(message, str):
                found_brackets = self.bracket_pattern.findall(message)
                brackets.extend(found_brackets)
        
        # 去重并保持顺序
        unique_brackets = []
        seen = set()
        for bracket in brackets:
            if bracket not in seen:
                unique_brackets.append(bracket)
                seen.add(bracket)
        
        return unique_brackets
    
    def _process_bracket_data(self, brackets: List[str], role_name: str) -> Dict[str, Any]:
        """
        处理[]数据列表
        
        Args:
            brackets: []中的内容列表
            role_name: 角色名称
            
        Returns:
            Dict: 处理结果
        """
        try:
            processed_data = {}
            ai_processed_data = {}
            processing_details = []
            
            for bracket_content in brackets:
                # 尝试直接解析
                parsed_result = self._parse_bracket_content(bracket_content)
                
                if parsed_result['success']:
                    # 直接解析成功
                    self._merge_to_temp_data(processed_data, parsed_result['data'])
                    processing_details.append({
                        'content': bracket_content,
                        'method': 'direct_parse',
                        'result': parsed_result['data']
                    })
                else:
                    # 需要AI处理
                    ai_result = self._ai_process_bracket(bracket_content, role_name)
                    if ai_result['success']:
                        self._merge_to_temp_data(ai_processed_data, ai_result['data'])
                        processing_details.append({
                            'content': bracket_content,
                            'method': 'ai_process',
                            'result': ai_result['data']
                        })
                    else:
                        processing_details.append({
                            'content': bracket_content,
                            'method': 'failed',
                            'error': ai_result.get('error', '处理失败')
                        })
            
            # 合并所有处理后的数据
            final_temp_data = {**processed_data, **ai_processed_data}
            
            return {
                'success': True,
                'temp_data': final_temp_data,
                'processing_details': processing_details,
                'total_brackets': len(brackets),
                'processed_count': len([d for d in processing_details if d.get('method') != 'failed'])
            }
            
        except Exception as e:
            logger.error(f"处理[]数据时发生错误: {e}")
            return {'success': False, 'error': str(e)}
    
    def _parse_bracket_content(self, content: str) -> Dict[str, Any]:
        """
        直接解析[]内容
        支持格式: [对象.属性/值] 或 [对象.物品.状态] 或 [对象.属性: 数值/最大值]
        """
        try:
            # 移除首尾空格
            content = content.strip()
            
            # 匹配模式: 对象.属性: 数值/最大值 (如: 兰斯.生命值: 50/100)
            pattern_colon_slash = re.match(r'^([^.:]+)\.([^:]+):\s*(\d+)/(\d+)$', content)
            if pattern_colon_slash:
                obj_name, attr_name, current_value, max_value = pattern_colon_slash.groups()
                return {
                    'success': True,
                    'data': {
                        obj_name: {
                            attr_name: f"{current_value}/{max_value}"
                        }
                    }
                }
            
            # 匹配模式: 对象.属性/值
            pattern1 = re.match(r'^([^./]+)\.([^./]+)/(.+)$', content)
            if pattern1:
                obj_name, attr_name, value = pattern1.groups()
                return {
                    'success': True,
                    'data': {
                        obj_name: {
                            attr_name: value.strip()
                        }
                    }
                }
            
            # 匹配模式: 对象.物品.状态
            pattern2 = re.match(r'^([^.]+)\.([^.]+)\.([^.]+)$', content)
            if pattern2:
                obj_name, item_name, state = pattern2.groups()
                return {
                    'success': True,
                    'data': {
                        obj_name: {
                            f"{item_name}": state.strip()
                        }
                    }
                }
            
            # 匹配简单模式: 对象.属性
            pattern3 = re.match(r'^([^.]+)\.([^.]+)$', content)
            if pattern3:
                obj_name, attr_name = pattern3.groups()
                return {
                    'success': True,
                    'data': {
                        obj_name: {
                            attr_name: "已更新"
                        }
                    }
                }
            
            # 如果都不匹配，返回失败
            return {
                'success': False,
                'error': f'无法解析格式: {content}'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'解析失败: {str(e)}'
            }
    
    def _ai_process_bracket(self, content: str, role_name: str) -> Dict[str, Any]:
        """
        使用AI处理无法直接解析的[]数据
        """
        try:
            prompt = f"""你是一个数据处理专家，请分析以下[]中的内容，并将其转换为JSON格式的临时数据。

输入内容: [{content}]
角色名称: {role_name}

根据底层描述.yml的规则：
- 当属性进行变更，比如送礼物，检定，使用物品以[]进行包裹
- 格式应该是[对象.属性/物品.当前值/当前状态]
- 如果要更新物品之类的状态应该[对象.物品.当前状态]

请分析这个[]数据并转换为以下JSON格式：
{{
  "对象名": {{
    "属性名": "属性值",
    "物品名": "状态"
  }}
}}

如果无法处理，请返回: {{"error": "无法处理该数据"}}

只返回JSON，不要任何其他说明。"""

            ai_result = call_ai_model(
                prompt=prompt,
                function_name='temp_data_analysis',
                temperature=0.3,
                max_tokens=1024
            )
            
            if not ai_result['success']:
                return {'success': False, 'error': f'AI调用失败: {ai_result["error"]}'}
            
            # 解析AI返回的JSON
            try:
                ai_content = ai_result['content'].strip()
                
                # 清理markdown格式
                if ai_content.startswith('```json'):
                    ai_content = ai_content.replace('```json', '').replace('```', '').strip()
                elif ai_content.startswith('```'):
                    ai_content = ai_content.replace('```', '').strip()
                
                ai_data = json.loads(ai_content)
                
                # 检查是否返回错误
                if 'error' in ai_data:
                    return {'success': False, 'error': ai_data['error']}
                
                return {
                    'success': True,
                    'data': ai_data
                }
                
            except json.JSONDecodeError as e:
                logger.error(f"AI返回JSON解析失败: {e}, 内容: {ai_result['content']}")
                return {'success': False, 'error': f'AI返回数据格式错误: {str(e)}'}
                
        except Exception as e:
            logger.error(f"AI处理[]数据失败: {e}")
            return {'success': False, 'error': str(e)}
    
    def _merge_to_temp_data(self, target_data: Dict, source_data: Dict):
        """合并数据到目标字典（覆盖机制）"""
        for key, value in source_data.items():
            if key in target_data:
                if isinstance(target_data[key], dict) and isinstance(value, dict):
                    # 递归合并字典
                    target_data[key].update(value)
                else:
                    # 直接覆盖
                    target_data[key] = value
            else:
                target_data[key] = value
    
    def _save_to_temp_data(self, role_name: str, temp_data: Dict):
        """保存到临时数据（完全替换）"""
        try:
            chat_data = self._load_chat_history(role_name)
            if not chat_data:
                chat_data = {"对话历史": [], "数据书临时数据": {}}
            
            # 确保结构正确
            if "数据书临时数据" not in chat_data:
                chat_data["数据书临时数据"] = {}
            
            # 完全替换临时数据
            chat_data["数据书临时数据"] = temp_data
            
            # 保存
            self._save_chat_data(role_name, chat_data)
            
            logger.info(f"已保存临时数据到{role_name}的聊天记录: {list(temp_data.keys())}")
            
        except Exception as e:
            logger.error(f"保存临时数据失败: {e}")
    
    def _update_temp_data(self, role_name: str, new_data: Dict):
        """增量更新临时数据（覆盖机制）"""
        try:
            chat_data = self._load_chat_history(role_name)
            if not chat_data:
                chat_data = {"对话历史": [], "数据书临时数据": {}}
            
            # 确保结构正确
            if "数据书临时数据" not in chat_data:
                chat_data["数据书临时数据"] = {}
            
            # 增量合并（新数据覆盖旧数据）
            self._merge_to_temp_data(chat_data["数据书临时数据"], new_data)
            
            # 保存
            self._save_chat_data(role_name, chat_data)
            
            logger.info(f"已更新{role_name}的临时数据: {list(new_data.keys())}")
            
        except Exception as e:
            logger.error(f"更新临时数据失败: {e}")
    
    def _save_chat_data(self, role_name: str, chat_data: Dict):
        """保存聊天数据"""
        try:
            from web.utils import PathManager
            
            chat_file = PathManager.get_chat_records_dir() / f"{role_name}.json"
            
            with open(chat_file, 'w', encoding='utf-8') as f:
                json.dump(chat_data, f, ensure_ascii=False, indent=2)
                
        except Exception as e:
            logger.error(f"保存聊天数据失败: {e}")
            raise


# 全局实例
_temp_data_extractor = None

def get_temp_data_extractor() -> TempDataExtractor:
    """获取临时数据提取器单例"""
    global _temp_data_extractor
    if _temp_data_extractor is None:
        _temp_data_extractor = TempDataExtractor()
    return _temp_data_extractor
