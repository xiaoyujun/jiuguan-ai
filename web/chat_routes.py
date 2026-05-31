"""
聊天功能模块
包含聊天处理、流式响应、音频生成等功能
"""
from flask import Blueprint, request, jsonify, Response
import sys
from pathlib import Path
import json
import yaml
import time
import threading
from web.config_loader import *
from web.history_manager import *
from web.audio_generator import get_role_voice_id, generate_single_sentence_audio
from web.core import clean_audio_files
from web.utils import ConfigManager, load_config, PathManager
from API import get_model_for_function, stream_chat_response, stream_chat_response_with_config
from web.role_utils import process_temp_role_request, get_role_data_for_chat, get_role_for_history_save, merge_temp_role_stories_to_data

import os
import glob

# 导入2.0架构向量化处理器
from web.vectorized_temp_data.architecture_2_0_integration import get_architecture_2_0_processor

chat_bp = Blueprint('chat', __name__)






def get_all_summary_keywords_from_storybooks():
    """
    从所有数据书中动态获取总结词列表
    """
    keywords = set()
    try:
        # 获取数据书目录
        storybook_dir = PathManager.get_storybook_dir()
        if not os.path.exists(storybook_dir):
            print(f"⚠️ [AI智能分析] 数据书目录不存在: {storybook_dir}")
            return []
        
        # 遍历所有数据书文件
        storybook_files = glob.glob(os.path.join(storybook_dir, "*.json"))
        print(f"📚 [AI智能分析] 扫描到 {len(storybook_files)} 个数据书文件")
        
        for file_path in storybook_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                # 只获取总结词，不使用关键词
                summary_words = data.get('总结词', [])
                if isinstance(summary_words, list):
                    for word in summary_words:
                        if word and isinstance(word, str) and word.strip():
                            keywords.add(word.strip())
                            
            except Exception as e:
                print(f"⚠️ [AI智能分析] 读取数据书失败 {file_path}: {e}")
                continue
        
        # 转换为列表并排序
        keywords_list = sorted(list(keywords))
        print(f"✅ [AI智能分析] 从数据书中收集到 {len(keywords_list)} 个唯一总结词")
        return keywords_list
        
    except Exception as e:
        print(f"❌ [AI智能分析] 获取数据书总结词失败: {e}")
        # 返回默认关键词作为备用
        return ["总结词", "关键词", "属性", "专长", "外貌特征"]



def process_sentence_with_keywords(sentence):
    """Process keywords from config_loader"""
    from config_loader import process_sentence_with_keywords as config_process
    return config_process(sentence)

def process_narrator_auto_mention(message, role_name):
    """
    处理旁白角色的自动@功能
    
    Args:
        message (str): 原始消息
        role_name (str): 当前角色名
        
    Returns:
        dict: 处理结果
    """
    try:
        import yaml
        from pathlib import Path
        import random
        
        # 检查消息是否已经包含@提及
        if '@' in message:
            return {
                'processed': False,
                'original_message': message,
                'processed_message': message,
                'reason': 'message_already_has_mention'
            }
        
        # 读取角色配置文件
        role_file = PathManager.get_roles_dir() / f"{role_name}.yml"
        if not role_file.exists():
            return {
                'processed': False,
                'original_message': message,
                'processed_message': message,
                'reason': 'role_file_not_found'
            }
        
        with open(role_file, 'r', encoding='utf-8') as f:
            role_data = yaml.safe_load(f) or {}
        
        # 检查是否为旁白角色
        role_category = role_data.get('角色类别', 'npc')
        if role_category != 'narrator':
            return {
                'processed': False,
                'original_message': message,
                'processed_message': message,
                'reason': 'not_narrator_role'
            }
        
        # 检查是否启用了自动@功能
        auto_mention = role_data.get('旁白自动提及', True)  # 默认启用
        if not auto_mention:
            return {
                'processed': False,
                'original_message': message,
                'processed_message': message,
                'reason': 'auto_mention_disabled'
            }
        
        # 获取角色捆绑配置
        role_binding_config = role_data.get('角色捆绑配置', {})
        if not role_binding_config.get('enabled', False):
            print(f"⚠️ 旁白角色 '{role_name}' 未启用角色捆绑功能")
            return {
                'processed': False,
                'original_message': message,
                'processed_message': message,
                'reason': 'role_binding_not_enabled'
            }
        
        # 获取捆绑的角色列表
        bound_roles = role_binding_config.get('boundRoles', [])
        if not bound_roles:
            print(f"⚠️ 旁白角色 '{role_name}' 没有捆绑任何角色")
            return {
                'processed': False,
                'original_message': message,
                'processed_message': message,
                'reason': 'no_bound_roles'
            }
        
        # 随机选择一个捆绑的角色
        selected_role = random.choice(bound_roles)
        processed_message = f"@{selected_role} {message}"
        
        print(f"🎭 旁白角色自动@处理成功:")
        print(f"   - 角色: {role_name}")
        print(f"   - 捆绑角色: {bound_roles}")
        print(f"   - 选中角色: {selected_role}")
        print(f"   - 原始消息: '{message}'")
        print(f"   - 处理后消息: '{processed_message}'")
        
        return {
            'processed': True,
            'original_message': message,
            'processed_message': processed_message,
            'selected_role': selected_role,
            'bound_roles': bound_roles,
            'narrator_role': role_name
        }
        
    except Exception as e:
        print(f"❌ 处理旁白角色自动@功能时出错: {e}")
        import traceback
        print(f"详细错误: {traceback.format_exc()}")
        return {
            'processed': False,
            'original_message': message,
            'processed_message': message,
            'error': str(e)
        }

@chat_bp.route('/chat', methods=['POST'])
def chat():
    print(f"\n{'='*80}")
    print(f"🎯 聊天API被调用")
    print(f"{'='*80}")
    
    try:
        # 详细记录请求信息
        print(f"📨 请求方法: {request.method}")
        print(f"📨 请求头: {dict(request.headers)}")
        print(f"📨 原始数据: {request.get_data()}")
        
        if not request.json:
            print(f"❌ 错误: 没有接收到JSON数据")
            return jsonify({'error': '没有接收到JSON数据'}), 400
            
        print(f"📨 接收到的JSON数据: {request.json}")
        
        user_input = request.json.get('message', '')
        role_name = request.json.get('role', 'biabia')  # 默认角色biabia
        new_topic = request.json.get('new_topic', False)
        self_speak = request.json.get('self_speak', False)  # 角色自说话模式
        manifest = request.json.get('manifest', False)  # 角色显现模式
        narrator_manifest = request.json.get('narrator_manifest', False)  # 旁白显现模式
        narrator_drive = request.json.get('narrator_drive', False)  # 旁白驱动模式
        auto_reply = request.json.get('auto_reply', False)  # 自动回复模式
        auto_dialogue = request.json.get('auto_dialogue', False)  # 自动对话生成模式
        
        # 多人聊天模式支持
        multi_chat_mode = request.json.get('multi_chat_mode', False)
        selected_roles = request.json.get('selected_roles', [])
        
        # 场景上下文支持
        scene_context = request.json.get('scene_context', None)
        
        # 检查是否是纪念指令
        if user_input.strip().startswith('/纪念'):
            print(f"📸 检测到纪念指令: {user_input}")
            try:
                # 解析指令参数（可选的消息数量）
                parts = user_input.strip().split()
                message_count = 5  # 默认5条
                
                if len(parts) > 1:
                    try:
                        message_count = int(parts[1])
                        if message_count < 1 or message_count > 50:
                            message_count = 5
                    except ValueError:
                        pass
                
                # 返回纪念指令响应
                return jsonify({
                    'content': f'📸 准备创建纪念（保存最近 {message_count} 条消息）...',
                    'voice_id': None,
                    'is_memory_command': True,
                    'role_name': role_name,
                    'message_count': message_count
                })
                    
            except Exception as e:
                print(f"❌ 纪念指令处理失败: {e}")
                return jsonify({
                    'content': f"❌ 纪念指令处理失败: {str(e)}",
                    'voice_id': None,
                    'is_memory_command': False
                })
        
        # 检查是否是自动指令
        if user_input.strip().startswith('/自动'):
            print(f"🤖 检测到自动指令: {user_input}")
            try:
                from web.auto_commands.auto_routes import auto_processor
                
                # 解析自动指令
                command_info = auto_processor.parse_auto_command(user_input)
                if not command_info:
                    return jsonify({
                        'content': '❌ 无效的自动指令格式，请使用 /自动 或 /自动 数字',
                        'voice_id': None
                    })
                
                # 验证用户登录状态
                auth_result = auto_processor.validate_user_session()
                if not auth_result['valid']:
                    return jsonify({
                        'content': f'❌ {auth_result["error"]}',
                        'voice_id': None,
                        'need_login': True
                    })
                
                # 获取聊天历史
                history = load_history(role_name)
                
                # 返回流式自动指令指示，前端将使用专门的流式API
                return jsonify({
                    'content': f'🤖 开始流式生成 {command_info["count"]} 条自动对话...',
                    'voice_id': None,
                    'is_auto_command': True,
                    'auto_stream': True,
                    'auto_count': command_info['count'],
                    'stream_url': '/api/auto_command_stream'
                })
                    
            except Exception as e:
                print(f"❌ 自动指令处理失败: {e}")
                return jsonify({
                    'content': f"❌ 自动指令处理失败: {str(e)}",
                    'voice_id': None,
                    'is_auto_command': False
                })
        
        # 检查是否是图片生成命令
        if user_input.strip() == '/生图':
            print(f"🎨 检测到图片生成命令")
            try:
                try:
                    from web.comfyui.image_generation_routes import handle_generate_image_command
                except ImportError:
                    # 如果导入失败，尝试其他路径
                    import os
                    import sys
                    comfyui_path = os.path.join(os.path.dirname(__file__), 'comfyui')
                    sys.path.insert(0, comfyui_path)
                    from image_generation_routes import handle_generate_image_command
                
                # 获取聊天历史
                history = load_history(role_name)
                
                # 处理图片生成命令
                image_result = handle_generate_image_command(role_name, history)
                
                if image_result['success']:
                    return jsonify({
                        'content': image_result['message'],
                        'voice_id': None,  # 图片生成不需要语音
                        'is_image_generation': True,
                        'image_paths': image_result.get('image_paths', []),
                        'prompt': image_result.get('prompt', '')
                    })
                else:
                    return jsonify({
                        'content': f"❌ {image_result.get('message', '图片生成失败')}",
                        'voice_id': None,
                        'is_image_generation': False
                    })
                    
            except Exception as e:
                print(f"❌ 图片生成命令处理失败: {e}")
                return jsonify({
                    'content': f"❌ 图片生成失败: {str(e)}",
                    'voice_id': None,
                    'is_image_generation': False
                })
        
        # 检查是否是第一人称图片生成命令
        if user_input.strip() == '/生成图片第一人称':
            print(f"🎨 检测到第一人称图片生成命令")
            try:
                try:
                    from web.comfyui.image_generation_routes import handle_generate_first_person_image_command
                except ImportError:
                    # 如果导入失败，尝试其他路径
                    import os
                    import sys
                    comfyui_path = os.path.join(os.path.dirname(__file__), 'comfyui')
                    sys.path.insert(0, comfyui_path)
                    from image_generation_routes import handle_generate_first_person_image_command
                
                # 获取聊天历史
                history = load_history(role_name)
                
                # 处理第一人称图片生成命令
                image_result = handle_generate_first_person_image_command(role_name, history)
                
                if image_result['success']:
                    return jsonify({
                        'content': image_result['message'],
                        'voice_id': None,  # 图片生成不需要语音
                        'is_image_generation': True,
                        'is_first_person': True,  # 标识这是第一人称视角图片
                        'image_paths': image_result.get('image_paths', []),
                        'prompt': image_result.get('prompt', '')
                    })
                else:
                    return jsonify({
                        'content': f"❌ {image_result.get('message', '第一人称图片生成失败')}",
                        'voice_id': None,
                        'is_image_generation': False
                    })
                    
            except Exception as e:
                print(f"❌ 第一人称图片生成命令处理失败: {e}")
                return jsonify({
                    'content': f"❌ 第一人称图片生成失败: {str(e)}",
                    'voice_id': None,
                    'is_image_generation': False
                })
        
        # 旁白角色自动@处理
        processed_message_result = process_narrator_auto_mention(user_input, role_name)
        if processed_message_result['processed']:
            user_input = processed_message_result['processed_message']
            print(f"🎭 旁白角色自动@处理: {processed_message_result['original_message']} -> {user_input}")
        
        # 分离概念：原始角色（用于数据存储）和回复角色（用于AI回复）
        original_role = role_name  # 保存原始角色名，用于数据存储
        responder_role = role_name  # 回复角色，可能会在多人聊天中改变
        
        # 如果启用了多人聊天模式，从选定的角色中智能选择一个回复
        if multi_chat_mode and selected_roles:
            selected_role = select_best_role_for_message(user_input, selected_roles, role_name)
            if selected_role:
                responder_role = selected_role
                print(f"👥 多人聊天模式：数据存储角色 '{original_role}'，回复角色 '{responder_role}'")
        
        print(f"📝 解析的参数:")
        print(f"   - user_input: '{user_input}'")
        print(f"   - original_role: '{original_role}' (数据存储)")
        print(f"   - responder_role: '{responder_role}' (AI回复)")
        print(f"   - new_topic: {new_topic}")
        print(f"   - self_speak: {self_speak}")
        print(f"   - manifest: {manifest}")
        print(f"   - narrator_manifest: {narrator_manifest}")
        print(f"   - narrator_drive: {narrator_drive}")
        print(f"   - auto_reply: {auto_reply}")
        print(f"   - auto_dialogue: {auto_dialogue}")
        print(f"   - multi_chat_mode: {multi_chat_mode}")
        if multi_chat_mode:
            print(f"   - selected_roles: {selected_roles}")
        print(f"   - scene_context: {scene_context}")
        
    except Exception as e:
        print(f"❌ 请求解析错误: {e}")
        import traceback
        print(f"详细错误: {traceback.format_exc()}")
        return jsonify({'error': f'请求解析错误: {str(e)}'}), 400

    # 处理临时角色请求
    temp_role, is_valid = process_temp_role_request(request.json)
    if not is_valid:
        print(f"警告: 临时角色 '{request.json.get('temp_role')}' 无效，将使用主角色")

    # 加载历史记录 - 使用原始角色（数据存储角色），应用聊天记录限制
    history = load_history(original_role, apply_limits=True)
    
    if new_topic:
        history = []
        clean_audio_files()  # 清理之前的音频文件

    # 加载系统信息
    base_description = load_base_description_text()
    # global_world_book = load_global_world_book()  # 已弃用：旧的世界书加载方式，现在使用关键词匹配系统（第507-524行）
    
    # 使用临时角色管理器获取角色数据 - 使用回复角色来获取AI扮演的角色
    if narrator_manifest or narrator_drive:
        # 旁白显现模式或旁白驱动模式：使用旁白角色
        current_role, is_temp_role, model_key = get_role_data_for_chat('旁白', None)
        print(f"使用旁白角色进行{'显现' if narrator_manifest else '驱动'}模式")
    else:
        current_role, is_temp_role, model_key = get_role_data_for_chat(responder_role, temp_role)
    current_player = load_current_player()

    # 获取玩家名称
    try:
        current_player_data = yaml.safe_load(current_player)
        player_name = current_player_data.get('名字', '用户') if current_player_data else '用户'
    except:
        player_name = '用户'
    print(f"🎯 [向量化数据管理] 启动2.0架构向量化临时数据处理流程")

    # 使用2.0架构处理用户输入，获取向量化上下文 - 使用回复角色进行分析
    try:
        processor = get_architecture_2_0_processor()
        vectorized_context, process_success, processing_details = processor.process_user_input(
            role_name=responder_role,  # 使用回复角色进行向量化分析
            user_input=user_input,
            include_player_data=True,
            player_name=player_name,
            temp_role=temp_role,
            multi_chat_participants=selected_roles if multi_chat_mode else None,
            log_role_name=original_role  # 使用原始角色进行日志记录
        )
        
        if process_success:
            print(f"✅ 2.0架构处理成功")
            print(f"📝 日志文件: {processing_details.get('transmission_details', {}).get('log_file', '无')}")
            print(f"📊 内容长度: {processing_details.get('transmission_details', {}).get('content_length', 0)} 字符")
        else:
            print(f"⚠️ 2.0架构处理失败，使用fallback模式")
            
    except Exception as e:
        print(f"❌ 2.0架构处理器错误: {e}")
        vectorized_context = ""
        process_success = False

    # 构建系统提示 - 优化结构，将场景信息前置
    系统提示 = f"底层描述:\n{base_description}\n\n"
    
    # 获取并添加数据书临时数据 - 使用原始角色（数据存储角色）
    from history_manager import get_story_temp_data
    story_temp_data = get_story_temp_data(original_role)
    
    if story_temp_data:
        # 直接使用临时数据，无需复杂的向量化处理
        temp_data_str = json.dumps(story_temp_data, ensure_ascii=False, indent=2)
        系统提示 += f"【重要】当前场景信息（数据书临时数据）- 请特别关注以下环境和情境信息：\n{temp_data_str}\n\n"
        print(f"📋 聊天使用临时数据，包含 {len(story_temp_data)} 个数据书")
    
    # 将向量化上下文移到角色身份定义之后，作为参考信息
    vectorized_reference = ""
    if process_success and vectorized_context:
        vectorized_reference = f"【其他角色参考信息】\n注意：以下是聊天中提到的其他角色信息，仅供你了解剧情背景，你绝不能扮演这些角色：\n{vectorized_context}\n\n"
    
    # 使用新的关键词世界书系统
    from web.core.keyword_world_book import keyword_worldbook
    _, keyword_match_info = keyword_worldbook.process_text_with_worldbook(user_input)
    
    if keyword_match_info['matched_count'] > 0:
        系统提示 += f"【关键词相关设定】\n{keyword_match_info['worldbook_context']}\n"
        
        # 统计触发模式
        keyword_triggered = 0
        always_active = 0
        for name, data in keyword_match_info['matched_entries'].items():
            trigger_mode = data.get('触发模式', 'keyword')
            if trigger_mode == 'always':
                always_active += 1
            else:
                keyword_triggered += 1
        
        print(f"📚 关键词世界书：匹配 {keyword_match_info['matched_count']} 个条目 (关键词触发: {keyword_triggered}, 全局生效: {always_active})")
    
    # 使用底层设定系统（开发者专用，用户不可见）
    from web.core.hidden_settings_manager import hidden_settings_manager
    
    print(f"🔧 开始处理底层设定系统...")
    print(f"🔧 用户输入内容: '{user_input}'")
    
    # 处理用户输入中的关键词匹配设定
    _, hidden_settings_info = hidden_settings_manager.process_text_with_hidden_settings(user_input)
    
    print(f"🔧 隐藏设定关键词匹配结果: {hidden_settings_info['matched_count']} 个")
    for name, data in hidden_settings_info['matched_settings'].items():
        keywords = data.get('关键词', [])
        print(f"   ✓ 匹配: {name} (关键词: {keywords})")
    
    # 同时获取始终生效的设定
    always_active_settings = {}
    all_settings = hidden_settings_manager.get_all_settings()
    print(f"🔧 总共加载的设定数量: {len(all_settings)}")
    
    for name, data in all_settings.items():
        if data and data.get('启用', True) and data.get('触发模式', 'keyword') == 'always':
            always_active_settings[name] = data
    
    print(f"🔧 始终生效的设定: {len(always_active_settings)} 个")
    
    # 合并设定
    total_matched_settings = {**hidden_settings_info['matched_settings'], **always_active_settings}
    
    if total_matched_settings:
        # 重新格式化所有匹配的设定
        formatted_settings = hidden_settings_manager.format_matched_settings_for_ai(total_matched_settings)
        系统提示 += f"{formatted_settings}\n"
        print(f"🔧 底层设定：匹配到 {len(total_matched_settings)} 个开发者设定（对用户不可见）")
        print(f"   - 关键词触发: {hidden_settings_info['matched_count']} 个")
        print(f"   - 始终生效: {len(always_active_settings)} 个")
        print(f"🔧 已将以下设定添加到系统提示中:")
        print(f"{formatted_settings}")
    else:
        print(f"🔧 没有匹配到任何底层设定")
    
    # 首先明确定义AI必须扮演的角色 - 最高优先级
    系统提示 += f"【最高优先级 - 你的角色身份】\n你必须严格扮演以下角色，这是你的唯一身份，不可改变：\n{current_role}\n\n"
    
    # 然后定义玩家角色 - 次高优先级
    系统提示 += f"【玩家角色身份】\n我（用户）扮演的角色：\n{current_player}\n\n"
    
    # 最后添加世界书等辅助信息
    # 系统提示 += f"【世界设定】\n{global_world_book}\n\n"  # 已弃用：旧的世界书加载方式会无条件加载所有世界书，现在使用关键词匹配系统
    
    # 添加场景上下文信息（如果有的话）
    if scene_context and scene_context.get('isActive'):
        scene_name = scene_context.get('sceneName', '未知场景')
        scene_description = scene_context.get('sceneDescription', '')
        if scene_description:
            系统提示 += f"【当前场景环境】\n场景：{scene_name}\n环境描述：{scene_description}\n这个场景描述将作为对话的背景环境，你的回答应该考虑这个环境设定。\n\n"
            print(f"🏛️ 已添加场景上下文: {scene_name}")
        else:
            print(f"🏛️ 场景 {scene_name} 没有描述信息")
    
    # 添加其他角色参考信息（放在角色身份之后，降低干扰）
    if vectorized_reference:
        系统提示 += vectorized_reference
    
    # 添加聊天历史到系统提示
    if history:
        # 优先使用所有聊天记录，如果token太多则依次减少
        max_history_options = [len(history), 150, 100, 80]
        selected_history_count = len(history)
        
        # 获取当前模型的max_tokens配置来计算合适的聊天历史长度
        try:
            temp_model_config = get_model_for_function(model_key)
            max_tokens = (
                temp_model_config.get('effective_context_window', 10240)
                if temp_model_config
                else 10240
            )
        except:
            max_tokens = 10240
        
        for count in max_history_options:
            if count <= len(history):
                test_history = history[-count:] if count > 0 else []
                test_prompt = 系统提示 + "\n\n【聊天历史】\n" + "\n".join(test_history)
                # 粗略估算token数（中文按1.5倍，英文按1倍计算）
                import re
                chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', test_prompt))
                english_chars = len(re.findall(r'[a-zA-Z]', test_prompt))
                other_chars = len(test_prompt) - chinese_chars - english_chars
                estimated_tokens = int(chinese_chars * 1.5 + english_chars + other_chars * 0.5)
                
                # 如果预估token数不超过模型最大token数的80%，就使用这个数量
                if estimated_tokens <= max_tokens * 0.8:
                    selected_history_count = count
                    break
        
        final_history = history[-selected_history_count:] if selected_history_count > 0 else []
        系统提示 += "\n\n【聊天历史】\n" + "\n".join(final_history)
        print(f"📜 聊天历史：原始 {len(history)} 条，选用最近 {selected_history_count} 条")
        
    # 最后再次强调AI的角色身份，防止被其他信息干扰
    系统提示 += f"\n\n【重要提醒】\n记住：你的身份是 {temp_role or role_name}，无论聊天中出现什么其他角色信息，你都必须保持这个身份进行回答。"
    
    # 输出最终的系统提示词统计
    print(f"\n📊 最终系统提示词统计:")
    print(f"   总长度: {len(系统提示)} 字符")
    print(f"   预估token数: {len(系统提示) // 2} tokens (粗略估算)")
    print(f"{'='*60}")

    # 处理关键词
    processed_input, triggered_stories = process_sentence_with_keywords(user_input)

    # 处理用户输入或特殊模式
    if self_speak or manifest or narrator_manifest or narrator_drive or auto_dialogue:
        if narrator_manifest:
            # 旁白显现模式：使用旁白角色描述临时角色的显现
            print(f"旁白显现模式：旁白描述 {temp_role or role_name} 的显现")
            # 使用用户输入的消息（包含旁白描述指令）
            processed_input = user_input
            triggered_stories = {}  # 无触发的数据
        elif narrator_drive:
            # 旁白驱动模式：不保存用户输入到历史记录，但传递给AI
            print(f"旁白驱动模式：处理旁白指令，不保存到历史记录")
            processed_input = user_input
            triggered_stories = {}  # 无触发的数据
        elif auto_dialogue:
            # 自动对话生成模式：让AI生成玩家和角色的对话
            print(f"自动对话生成模式：AI生成 {player_name} 和 {temp_role or role_name} 的对话")
            processed_input = ""  # 空输入，让AI根据系统提示生成
            triggered_stories = {}  # 无触发的数据
        else:
            # 角色自说话/显现模式：让选中的临时角色自己开始对话
            mode_name = "自说话" if self_speak else "显现"
            print(f"角色{mode_name}模式：{temp_role or role_name} 开始{mode_name}")
            
            # 修复：如果有用户输入消息，应该保存到历史记录中
            if user_input and user_input.strip():
                print(f"保存用户@指令消息到历史记录: {user_input}")
                history.append(f"{player_name}: {user_input}")
                processed_input = ""  # AI自由发挥
            else:
                # 纯自说话模式，无用户输入
                processed_input = ""  # 空输入，让AI自由发挥
            triggered_stories = {}  # 无触发的数据
    elif user_input:
        # 正常用户输入模式
        history.append(f"{player_name}: {user_input}")
        
        # 关键词触发数据已由向量化系统统一处理
        if triggered_stories:
            print(f"ℹ️ 检测到关键词触发: {list(triggered_stories.keys())} (已由向量化系统处理)")
        
        # 保存聊天记录（包含触发的数据书数据）- 使用原始角色（数据存储角色）
        save_history(history, original_role, triggered_stories)
        
        # 注意：临时数据的录入现在由向量化系统统一管理（第一步：关键词匹配录入）
        # 旧的大胆录入功能已被更智能的向量化系统取代，无需额外处理
        print(f"ℹ️ [数据管理] 临时数据录入由向量化系统统一管理，已在上述流程中完成")
        
        # 异步数据分析功能已移除

    response_text = ""
    
    # 检查是否启用语音自动播放
    config = ConfigManager.load_config()
    voice_settings = config.get('voice_settings', {})
    auto_play_enabled = voice_settings.get('auto_play', False)
    
    # 只有在启用自动播放时才获取语音ID - 使用回复角色的语音
    voice_id = None
    if auto_play_enabled:
        voice_id = get_role_voice_id(responder_role)
        print(f"🔊 语音自动播放已启用，回复角色: {responder_role}, 语音ID: {voice_id}")
    else:
        print(f"🔇 语音自动播放已关闭，不生成语音")
    
    sentence_buffer = ""  # 用于缓冲当前句子
    sentence_index = 0

    def generate():
        nonlocal response_text, sentence_buffer, sentence_index
        try:
            print(f"\n🚀 开始生成流式响应")
            print(f"📋 模型键: {model_key}")
            
            # 使用临时角色管理器获取的模型配置
            print(f"🔍 正在获取模型配置...")
            current_model_config = get_model_for_function(model_key)
            
            if not current_model_config:
                error_msg = f"无法获取模型配置 {model_key}"
                print(f"❌ 错误: {error_msg}")
                yield f"data: [ERROR] {error_msg}\n\n"
                return
            
            print(f"✅ 成功获取模型配置:")
            print(f"   - 模型名称: {current_model_config.get('name', 'unknown')}")
            print(f"   - 模型ID: {current_model_config.get('model', 'unknown')}")
            print(f"   - API地址: {current_model_config.get('base_url', 'unknown')}")
            print(f"   - API密钥: {'已设置' if current_model_config.get('key') else '未设置'}")
            
            # 如果是自说话模式，修改系统提示
            final_system_prompt = 系统提示
            if self_speak:
                self_speak_prompt = f"\n以第一人称，根据聊天记录，和{temp_role or role_name}的设定，表达自己的想法和感受。(注意区分你扮演的角色拥有的临时数据对于其他角色临时数据注意区分)上述聊天中可能存在其他角色注意分辨。"
                final_system_prompt += self_speak_prompt
            elif auto_reply:
                auto_reply_prompt = f"\n这是一个自动回复请求。请以{temp_role or role_name}的身份，根据当前的聊天历史和角色设定，主动继续对话或描述当前的情况。可以是对之前对话的延续、环境描述、内心独白或者推进剧情发展。"
                final_system_prompt += auto_reply_prompt
            elif auto_dialogue:
                # 使用已经获取的玩家名称（在前面已经定义）
                auto_dialogue_prompt = f"\n这是一个自动对话生成请求。请你扮演编剧，创造一个完整的对话场景。首先生成一句{player_name}可能说的话，然后以{temp_role or role_name}的身份回应。请按照以下格式输出：\n\n{player_name}: [玩家可能说的话]\n{temp_role or role_name}: [角色的回应]\n\n要求：1)玩家的话要符合当前情境和之前的对话; 2)角色的回应要符合其设定和性格; 3)推进剧情发展。"
                final_system_prompt += auto_dialogue_prompt
            
            # 为了兼容性，将完整配置传给stream_chat_response
            print(f"\n🤖 调用AI模型生成响应...")
            print(f"📝 用户输入长度: {len(processed_input)} 字符")
            print(f"📝 系统提示长度: {len(final_system_prompt)} 字符")
            
            chunk_count = 0
            for chunk in stream_chat_response_with_config(processed_input, final_system_prompt, current_model_config):
                chunk_count += 1
                if chunk_count == 1:
                    print(f"✅ 开始接收AI响应数据流...")
                if chunk_count % 10 == 0:  # 每10个chunk记录一次
                    print(f"📊 已接收 {chunk_count} 个数据块")
                response_text += chunk
                sentence_buffer += chunk
                
                # 对于自动对话模式，需要包装为JSON格式以便前端解析
                if auto_dialogue:
                    json_chunk = json.dumps({"content": chunk}, ensure_ascii=False)
                    yield f"data: {json_chunk}\n\n"
                else:
                    yield f"data: {chunk}\n\n"
                
                # 检查是否是句子结束的标志（句子以标点结束）
                if sentence_buffer and sentence_buffer[-1] in ['。', '！', '？', '!', '?', '.', '\n']:
                    # 只有在启用自动播放时才生成音频
                    if auto_play_enabled and sentence_buffer.strip():
                        try:
                            audio_file = generate_single_sentence_audio(sentence_buffer.strip(), voice_id, int(time.time() * 1000), sentence_index)
                            if audio_file:
                                yield f"data: [AUDIO]{audio_file.name}\n\n"
                                sentence_index += 1
                        except Exception as audio_e:
                            print(f"音频生成失败: {audio_e}")
                    sentence_buffer = ""  # 清空缓冲区
            
            # 处理剩余的句子缓冲区
            if auto_play_enabled and sentence_buffer.strip():
                try:
                    audio_file = generate_single_sentence_audio(sentence_buffer.strip(), voice_id, int(time.time() * 1000), sentence_index)
                    if audio_file:
                        yield f"data: [AUDIO]{audio_file.name}\n\n"
                except Exception as audio_e:
                    print(f"最终音频生成失败: {audio_e}")
            
            # 添加AI响应到历史
            if response_text:
                try:
                    # 使用临时角色管理器获取正确的角色名称
                    if narrator_drive or narrator_manifest:
                        # 旁白驱动或旁白显现模式：使用"旁白"作为发言者
                        history_role_name = '旁白'
                    else:
                        # 历史记录中使用回复角色名称，但保存到原始角色文件中
                        history_role_name = get_role_for_history_save(responder_role, temp_role)
                    history.append(f"{history_role_name}: {response_text}")
                    save_history(history, original_role)  # 保存到原始角色（数据存储角色）
                except Exception as save_e:
                    print(f"保存历史失败: {save_e}")
                
                # 临时数据录入：从AI响应中提取[]数据
                try:
                    from web.ai_new.temp_data_extractor import get_temp_data_extractor
                    import re
                    
                    print(f"🔍 [临时数据录入] 开始从AI响应中提取[]数据...")
                    temp_extractor = get_temp_data_extractor()
                    
                    # 从AI响应中提取临时数据 - 使用原始角色（数据存储角色）
                    extraction_result = temp_extractor.extract_from_message(response_text, original_role)
                    
                    if extraction_result['success']:
                        extracted_data = extraction_result.get('temp_data', {})
                        extract_info = extraction_result.get('extract_info', {})
                        
                        if extracted_data:
                            print(f"✅ [临时数据录入] 成功提取到临时数据: {list(extracted_data.keys())}")
                            
                            # 发送临时数据更新通知
                            try:
                                temp_data_json = json.dumps(extracted_data, ensure_ascii=False, default=str)
                                yield f"data: [TEMP_DATA_EXTRACTED]{temp_data_json}\n\n"
                            except Exception as json_e:
                                print(f"临时数据JSON序列化失败: {json_e}")
                            
                            # 根据提取信息发送不同的清理信号
                            try:
                                has_brackets = extract_info.get('has_brackets', False)
                                has_hashes = extract_info.get('has_hashes', False)
                                
                                if has_brackets:
                                    # 检查是否需要清理[]数据
                                    cleaned_response = re.sub(r'\[([^\[\]]+)\]', '', response_text).strip()
                                    if cleaned_response != response_text:
                                        print(f"🧹 [临时数据录入] 清理响应文本，移除[]数据")
                                        yield f"data: [CLEAN_EXTRACTED_DATA]\n\n"
                                
                                if has_hashes:
                                    # 检查是否需要清理#内容#数据
                                    cleaned_response = re.sub(r'#([^#]+)#', '', response_text).strip()
                                    if cleaned_response != response_text:
                                        print(f"🧹 [临时数据录入] 清理响应文本，移除#内容#数据")
                                        yield f"data: [CLEAN_HASH_DATA]\n\n"
                                        
                            except Exception as clean_e:
                                print(f"清理响应文本失败: {clean_e}")
                        else:
                            print(f"ℹ️ [临时数据录入] AI响应中未发现[]或#内容#数据")
                    else:
                        print(f"⚠️ [临时数据录入] 提取失败: {extraction_result.get('error', '未知错误')}")
                        
                except Exception as temp_extract_e:
                    print(f"❌ [临时数据录入] 临时数据提取异常: {temp_extract_e}")
                    import traceback
                    print(f"详细错误: {traceback.format_exc()}")
                
                # 异步分析功能已移除
                
                # 立即获取当前的数据书临时数据（不等待分析结果）- 使用原始角色
                try:
                    from history_manager import get_story_temp_data
                    current_temp_data = get_story_temp_data(original_role)
                    
                    # 安全地序列化JSON数据
                    if current_temp_data:
                        try:
                            temp_data_json = json.dumps(current_temp_data, ensure_ascii=False, default=str)
                            yield f"data: [TEMP_DATA]{temp_data_json}\n\n"
                        except (TypeError, ValueError) as json_e:
                            print(f"JSON序列化临时数据失败: {json_e}")
                            yield f"data: [TEMP_DATA]{{}}\n\n"
                    else:
                        yield f"data: [TEMP_DATA]{{}}\n\n"
                        
                except Exception as temp_data_e:
                    print(f"获取临时数据失败: {temp_data_e}")
                    try:
                        yield f"data: [TEMP_DATA_ERROR]{str(temp_data_e)}\n\n"
                    except:
                        pass  # 如果连错误信息都无法发送，就静默处理
                        
        except Exception as e:
            error_msg = f"流式响应异常: {str(e)}"
            print(f"❌ {error_msg}")
            import traceback
            print(f"详细错误堆栈: {traceback.format_exc()}")
            try:
                yield f"data: [ERROR] {error_msg}\n\n"
            except Exception as yield_error:
                print(f"❌ 无法发送错误信息到客户端: {yield_error}")
                pass  # 如果连错误信息都无法发送，就静默处理
        
        # 确保生成器正常结束
        try:
            yield f"data: [DONE]\n\n"
        except:
            pass

    response = Response(generate(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    response.headers['Connection'] = 'keep-alive'
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response
