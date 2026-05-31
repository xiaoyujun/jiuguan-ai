#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
酒馆角色卡AI导入器 - Web集成版本
将工具目录中的角色卡导入功能集成到web系统中
"""

import os
import sys
import json
import yaml
import base64
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# 尝试导入工具模块，如果不存在则使用简化版本
try:
    from json_extractor import JSONExtractor
    from character_translator import CharacterTranslator
    from file_manager import FileManager
except ImportError:
    # 工具模块不存在，使用简化版本（这是正常情况）
    JSONExtractor = None
    CharacterTranslator = None
    FileManager = None

class TavernCardAIImporter:
    """酒馆角色卡AI导入器"""
    
    def __init__(self):
        """初始化导入器"""
        self.extractor = JSONExtractor() if JSONExtractor else None
        self.translator = CharacterTranslator() if CharacterTranslator else None
        self.file_manager = FileManager() if FileManager else None
        
        # 如果工具模块不可用，使用简化版本（静默处理，这是正常情况）
        if not all([self.extractor, self.translator, self.file_manager]):
            # 静默使用简化版本，不输出警告（因为这是正常的设计）
            pass
    
    def extract_character_from_image(self, image_data: bytes, filename: str, auto_translate: bool = True) -> Dict:
        """
        从图片数据中提取角色信息
        
        Args:
            image_data: 图片的二进制数据
            filename: 图片文件名
            auto_translate: 是否自动翻译，默认为True
            
        Returns:
            提取到的角色数据字典
        """
        try:
            if self.extractor:
                # 使用完整版本的提取器
                return self._extract_with_full_extractor(image_data, filename, auto_translate)
            else:
                # 使用简化版本的提取器
                return self._extract_with_simple_extractor(image_data, filename)
        except Exception as e:
            raise Exception(f"从图片提取角色数据失败: {str(e)}")
    
    def _extract_with_full_extractor(self, image_data: bytes, filename: str, auto_translate: bool = True) -> Dict:
        """使用完整版提取器"""
        # 在当前目录创建临时文件（避免/tmp路径问题）
        temp_path = Path(__file__).parent.parent / f"temp_{filename}"
        
        try:
            # 保存临时图片文件
            with open(temp_path, 'wb') as f:
                f.write(image_data)
            
            print(f"📁 临时文件已保存: {temp_path}")
            
            # 使用工具模块提取数据
            print("🔍 正在提取角色数据...")
            extracted_data = self.extractor.extract_from_image(str(temp_path))
            
            if not extracted_data:
                raise Exception("未从图片中提取到有效的JSON数据")
            
            print(f"✅ 成功提取到 {len(extracted_data)} 个角色数据")
            
            # 处理提取到的数据
            for i, data_item in enumerate(extracted_data):
                print(f"📋 处理第 {i+1} 个角色数据...")
                character_info = self.extractor.get_character_info(data_item['data'])
                
                if character_info.get('name'):
                    print(f"🎭 找到角色: {character_info['name']}")
                    
                    if auto_translate and self.translator:
                        # 使用翻译器的完整流程进行AI翻译和数据整理
                        print("🤖 开始AI翻译和数据整理...")
                        processed_result = self.translator.process_character(character_info)
                        
                        if processed_result:
                            print("✅ AI翻译和数据整理完成")
                            # 转换为web系统需要的格式
                            web_format_data = self._convert_to_web_format(processed_result)
                            return web_format_data
                        else:
                            print("❌ AI翻译和数据整理失败，尝试使用原始数据")
                            # 如果AI处理失败，使用简化处理
                            return self._convert_tavern_data({'data': character_info})
                    else:
                        # 不使用翻译，直接转换原始数据
                        print("📝 跳过AI翻译，直接使用原始数据")
                        return self._convert_tavern_data({'data': character_info})
            
            raise Exception("未找到有效的角色数据")
            
        except Exception as e:
            print(f"❌ 提取过程中出错: {e}")
            raise e
            
        finally:
            # 清理临时文件
            try:
                if temp_path.exists():
                    temp_path.unlink()
                    print(f"🗑️ 临时文件已清理: {temp_path}")
            except Exception as e:
                print(f"⚠️ 清理临时文件失败: {e}")
    
    def _extract_with_simple_extractor(self, image_data: bytes, filename: str) -> Dict:
        """使用简化版提取器（备用方案）"""
        try:
            # 在PNG图片中查找base64编码的JSON数据
            data_str = image_data.decode('latin-1', errors='ignore')
            
            # 查找可能的base64编码数据
            import re
            base64_pattern = re.compile(r'[A-Za-z0-9+/]{100,}={0,2}')
            matches = base64_pattern.findall(data_str)
            
            for match in matches:
                try:
                    # 尝试解码base64
                    decoded = base64.b64decode(match).decode('utf-8', errors='ignore')
                    json_data = json.loads(decoded)
                    
                    # 验证是否是角色数据
                    if self._is_valid_character_data(json_data):
                        return self._convert_tavern_data(json_data)
                        
                except Exception:
                    continue
            
            raise Exception("未在图片中找到有效的角色数据")
            
        except Exception as e:
            raise Exception(f"简化提取器失败: {str(e)}")
    
    def _is_valid_character_data(self, data: Dict) -> bool:
        """验证是否是有效的角色数据"""
        if not isinstance(data, dict):
            return False
        
        # 检查是否有角色数据的关键字段
        if 'data' in data:
            char_data = data['data']
            return any(key in char_data for key in ['name', 'character_name', 'description'])
        
        return any(key in data for key in ['name', 'character_name', 'description'])
    
    def _convert_tavern_data(self, tavern_data: Dict) -> Dict:
        """转换酒馆角色卡数据为web系统格式"""
        data = tavern_data.get('data', tavern_data)
        
        # 清理文本函数
        def clean_text(text):
            if not text:
                return ''
            return str(text).strip()
        
        # 构建角色介绍
        intro_parts = []
        if data.get('description'):
            intro_parts.append(f"角色描述：{clean_text(data['description'])}")
        if data.get('personality'):
            intro_parts.append(f"性格特点：{clean_text(data['personality'])}")
        if data.get('scenario'):
            intro_parts.append(f"背景设定：{clean_text(data['scenario'])}")
        if data.get('first_mes'):
            intro_parts.append(f"开场白：{clean_text(data['first_mes'])}")
        if data.get('mes_example'):
            intro_parts.append(f"对话示例：{clean_text(data['mes_example'])}")
        
        character_name = clean_text(data.get('name') or data.get('character_name') or '未知角色')
        
        # 处理标签
        tags = []
        if data.get('tags'):
            if isinstance(data['tags'], list):
                tags = [clean_text(tag) for tag in data['tags'] if tag]
            elif isinstance(data['tags'], str):
                tags = [clean_text(data['tags'])]
        
        return {
            '名字': character_name,
            '介绍': '\n\n'.join(intro_parts),
            'voice_id': clean_text(data.get('voice_id', '')),
            'tags': tags,
            'role_name': character_name
        }
    
    def _convert_to_web_format(self, processed_result: Dict) -> Dict:
        """将工具处理结果转换为web格式"""
        print(f"🔄 转换处理结果为web格式: {processed_result}")
        
        # 如果已经包含yml_data，使用yml数据
        if 'yml_data' in processed_result:
            yml_data = processed_result['yml_data']
            character_name = yml_data.get('名字', processed_result.get('character_name', '未知角色'))
            
            # 从yml_data的介绍中提取标签信息（如果存在）
            tags = yml_data.get('tags', [])
            introduction = yml_data.get('介绍', '')
            
            # 如果yml数据中没有标签，尝试从介绍文本中提取
            if not tags and '标签：' in introduction:
                try:
                    # 查找标签行
                    lines = introduction.split('\n')
                    for line in lines:
                        if line.startswith('标签：'):
                            tag_text = line.replace('标签：', '').strip()
                            tags = [tag.strip() for tag in tag_text.split('、') if tag.strip()]
                            break
                except:
                    pass  # 如果提取失败就使用空列表
            
            return {
                '名字': character_name,
                '介绍': introduction,
                'voice_id': yml_data.get('voice_id', ''),
                'tags': tags,
                'role_name': character_name
            }
        
        # 如果已经是正确格式，直接返回
        if '名字' in processed_result:
            return processed_result
        
        # 否则进行格式转换
        character_name = processed_result.get('character_name', '未知角色')
        return {
            '名字': character_name,
            '介绍': processed_result.get('introduction', ''),
            'voice_id': processed_result.get('voice_id', ''),
            'tags': processed_result.get('tags', []),
            'role_name': character_name
        }
    
    def save_character_to_system(self, character_data: Dict, image_data: bytes, filename: str) -> Tuple[bool, str]:
        """
        将角色数据保存到系统中
        
        Args:
            character_data: 角色数据
            image_data: 角色头像图片数据
            filename: 原始文件名
            
        Returns:
            (成功标志, 错误信息或成功消息)
        """
        try:
            character_name = character_data.get('名字', character_data.get('role_name', '未知角色'))
            
            # 保存角色配置文件
            roles_dir = Path(__file__).parent.parent / '角色'
            roles_dir.mkdir(exist_ok=True)
            
            # 生成YML文件
            yml_data = {
                'voice_id': character_data.get('voice_id', ''),
                '介绍': character_data.get('介绍', ''),
                '名字': character_name,
                'tags': character_data.get('tags', [])
            }
            
            yml_file = roles_dir / f"{character_name}.yml"
            with open(yml_file, 'w', encoding='utf-8') as f:
                yaml.dump(yml_data, f, allow_unicode=True, default_flow_style=False, indent=2, sort_keys=False)
            
            # 保存头像图片（仅在有有效图片数据时）
            if image_data and filename:
                # 检测图片格式
                if filename.lower().endswith('.png'):
                    img_ext = 'png'
                elif filename.lower().endswith(('.jpg', '.jpeg')):
                    img_ext = 'jpg'
                else:
                    img_ext = 'png'  # 默认使用PNG
                
                img_file = roles_dir / f"{character_name}.{img_ext}"
                with open(img_file, 'wb') as f:
                    f.write(image_data)
            else:
                print("📷 跳过头像保存：无图片数据或文件名")
            
            return True, f"成功导入角色 '{character_name}'"
            
        except Exception as e:
            return False, f"保存角色失败: {str(e)}"
    
    def process_image_upload(self, image_data: bytes, filename: str, auto_translate: bool = True) -> Tuple[bool, str, Optional[Dict]]:
        """
        处理图片上传并导入角色
        
        Args:
            image_data: 图片二进制数据
            filename: 文件名
            auto_translate: 是否自动翻译，默认为True
            
        Returns:
            (成功标志, 消息, 角色数据)
        """
        try:
            # 1. 从图片中提取角色数据
            character_data = self.extract_character_from_image(image_data, filename, auto_translate)
            
            # 2. 保存到系统中
            success, message = self.save_character_to_system(character_data, image_data, filename)
            
            if success:
                return True, message, character_data
            else:
                return False, message, None
                
        except Exception as e:
            return False, f"处理失败: {str(e)}", None


# 创建全局实例
tavern_importer = TavernCardAIImporter()


def process_tavern_card_upload(image_data: bytes, filename: str, auto_translate: bool = True) -> Dict:
    """
    处理酒馆角色卡上传的主函数
    
    Args:
        image_data: 图片数据
        filename: 文件名
        auto_translate: 是否自动翻译，默认为True
        
    Returns:
        处理结果字典
    """
    success, message, character_data = tavern_importer.process_image_upload(image_data, filename, auto_translate)
    
    return {
        'success': success,
        'message': message,
        'character_data': character_data
    }


def ai_post_process_character_data(character_name: str, instruction: str, character_data: Dict) -> Dict:
    """
    AI后处理角色数据
    
    Args:
        character_name: 角色名称
        instruction: AI处理指令
        character_data: 原始角色数据
        
    Returns:
        处理结果字典
    """
    try:
        print(f"🤖 开始AI后处理角色: {character_name}")
        print(f"📝 处理指令: {instruction}")
        
        # 检查是否有可用的翻译器（具有AI功能）
        if tavern_importer.translator:
            print("✅ 使用完整版AI处理器")
            return _ai_process_with_full_translator(character_name, instruction, character_data)
        else:
            print("⚠️ 使用简化版AI处理器")
            return _ai_process_with_simple_method(character_name, instruction, character_data)
            
    except Exception as e:
        print(f"❌ AI后处理失败: {e}")
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'message': f'AI后处理失败: {str(e)}'
        }


def _ai_process_with_full_translator(character_name: str, instruction: str, character_data: Dict) -> Dict:
    """使用完整版翻译器进行AI处理"""
    try:
        # 构建AI处理的上下文
        current_intro = character_data.get('介绍', '')
        current_tags = character_data.get('tags', [])
        
        # 构建角色信息用于AI处理
        character_info = {
            'name': character_name,
            'description': current_intro,
            'tags': current_tags,
            'voice_id': character_data.get('voice_id', ''),
        }
        
        # 使用翻译器的AI能力进行后处理
        # 由于translator.process_character可能不支持custom_instruction参数，直接使用简化处理
        print("⚠️ 完整版翻译器参数不兼容，使用简化处理")
        return _ai_process_with_simple_method(character_name, instruction, character_data)
            
    except Exception as e:
        print(f"完整版AI处理器错误: {e}")
        # 如果完整版失败，回退到简化版
        return _ai_process_with_simple_method(character_name, instruction, character_data)


def _ai_process_with_simple_method(character_name: str, instruction: str, character_data: Dict) -> Dict:
    """使用AI模型进行角色数据处理"""
    try:
        print(f"🔄 开始AI处理")
        print(f"👤 角色名称: {character_name}")
        print(f"📝 处理指令: {instruction}")
        print(f"📊 原始数据: {character_data}")
        
        # 获取当前角色数据
        current_intro = character_data.get('介绍', '')
        current_tags = character_data.get('tags', [])
        
        # 根据指令类型进行简化处理
        processed_intro = current_intro
        processed_tags = current_tags.copy()
        
        # 简单的指令处理逻辑
        instruction_lower = instruction.lower()
        
        if '翻译' in instruction or 'translate' in instruction_lower:
            # 使用AI进行真正的翻译
            try:
                # 导入AI调用模块
                from web.ai_new import call_ai_model
                
                # 构建翻译提示词
                translate_prompt = f"""请将下面的英文角色介绍翻译成中文，保持原有的格式和结构。只返回翻译后的中文内容，不要包含任何解释或标记：

{current_intro}"""
                
                print(f"🤖 正在调用AI模型进行翻译...")
                ai_result = call_ai_model(translate_prompt, "summary", temperature=0.3)
                
                if ai_result.get('success') and ai_result.get('content'):
                    processed_intro = ai_result['content'].strip()
                    processed_tags.append("AI翻译") if "AI翻译" not in processed_tags else None
                    print(f"✅ AI翻译成功")
                else:
                    print(f"❌ AI翻译失败: {ai_result.get('error', '未知错误')}")
                    processed_intro = current_intro  # 保持原文
                    
            except Exception as e:
                print(f"❌ AI翻译调用异常: {e}")
                processed_intro = current_intro  # 保持原文
            
        elif '润色' in instruction or '优化' in instruction:
            # 使用AI进行角色描述润色
            try:
                from web.ai_new import call_ai_model
                
                polish_prompt = f"""请润色和优化下面的角色介绍，使其更加生动、详细和吸引人，保持原有的角色特色。只返回润色后的内容：

{current_intro}"""
                
                print(f"🤖 正在调用AI模型进行润色...")
                ai_result = call_ai_model(polish_prompt, "summary", temperature=0.7)
                
                if ai_result.get('success') and ai_result.get('content'):
                    processed_intro = ai_result['content'].strip()
                    processed_tags.append("AI润色") if "AI润色" not in processed_tags else None
                    print(f"✅ AI润色成功")
                else:
                    print(f"❌ AI润色失败: {ai_result.get('error', '未知错误')}")
                    processed_intro = current_intro
                    
            except Exception as e:
                print(f"❌ AI润色调用异常: {e}")
                processed_intro = current_intro
            
        elif '补充' in instruction or '细节' in instruction:
            # 使用AI补充角色细节
            try:
                from web.ai_new import call_ai_model
                
                enhance_prompt = f"""请为下面的角色补充更多的背景细节、性格特点和设定信息，使角色更加立体丰满。只返回补充细节后的完整角色介绍：

{current_intro}"""
                
                print(f"🤖 正在调用AI模型补充细节...")
                ai_result = call_ai_model(enhance_prompt, "summary", temperature=0.8)
                
                if ai_result.get('success') and ai_result.get('content'):
                    processed_intro = ai_result['content'].strip()
                    processed_tags.append("AI增强") if "AI增强" not in processed_tags else None
                    print(f"✅ AI补充细节成功")
                else:
                    print(f"❌ AI补充细节失败: {ai_result.get('error', '未知错误')}")
                    processed_intro = current_intro
                    
            except Exception as e:
                print(f"❌ AI补充细节调用异常: {e}")
                processed_intro = current_intro
            
        elif '本地化' in instruction:
            # 使用AI进行本地化处理
            try:
                from web.ai_new import call_ai_model
                
                localize_prompt = f"""请将下面的角色设定本地化，使其更适合中文语境和文化背景，调整名称、地点、文化元素等。只返回本地化后的角色介绍：

{current_intro}"""
                
                print(f"🤖 正在调用AI模型进行本地化...")
                ai_result = call_ai_model(localize_prompt, "summary", temperature=0.6)
                
                if ai_result.get('success') and ai_result.get('content'):
                    processed_intro = ai_result['content'].strip()
                    processed_tags.append("本地化") if "本地化" not in processed_tags else None
                    print(f"✅ AI本地化成功")
                else:
                    print(f"❌ AI本地化失败: {ai_result.get('error', '未知错误')}")
                    processed_intro = current_intro
                    
            except Exception as e:
                print(f"❌ AI本地化调用异常: {e}")
                processed_intro = current_intro
        
        else:
            # 处理自定义指令
            try:
                from web.ai_new import call_ai_model
                
                custom_prompt = f"""请根据指令"{instruction}"处理下面的角色介绍。只返回处理后的结果：

{current_intro}"""
                
                print(f"🤖 正在调用AI模型处理自定义指令...")
                ai_result = call_ai_model(custom_prompt, "summary", temperature=0.7)
                
                if ai_result.get('success') and ai_result.get('content'):
                    processed_intro = ai_result['content'].strip()
                    processed_tags.append("AI处理") if "AI处理" not in processed_tags else None
                    print(f"✅ AI自定义处理成功")
                else:
                    print(f"❌ AI自定义处理失败: {ai_result.get('error', '未知错误')}")
                    processed_intro = current_intro
                    
            except Exception as e:
                print(f"❌ AI自定义处理调用异常: {e}")
                processed_intro = current_intro
        
        # 构建更新后的数据
        updated_data = character_data.copy()
        updated_data['介绍'] = processed_intro
        updated_data['tags'] = processed_tags
        
        # 保存更新后的角色数据
        success, message = tavern_importer.save_character_to_system(
            updated_data,
            b'',  # 不更新头像
            ''
        )
        
        if success:
            return {
                'success': True,
                'message': f'AI成功处理角色 "{character_name}"',
                'processed_data': updated_data
            }
        else:
            return {
                'success': False,
                'message': f'保存处理结果失败: {message}'
            }
            
    except Exception as e:
        return {
            'success': False,
            'message': f'AI处理失败: {str(e)}'
        }