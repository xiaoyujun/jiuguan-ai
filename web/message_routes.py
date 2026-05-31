"""
消息管理模块
包含编辑、删除、重新生成消息等功能
"""
from flask import Blueprint, request, jsonify, Response
import sys
from pathlib import Path
import json
import yaml
import time
from web.config_loader import *
from web.history_manager import *
from web.audio_generator import get_role_voice_id, generate_single_sentence_audio
from web.utils import ConfigManager
from API import get_model_for_function, stream_chat_response

message_bp = Blueprint('message', __name__)

@message_bp.route('/edit_message', methods=['POST'])
def edit_message():
    """编辑聊天历史中的消息"""
    try:
        data = request.json
        role_name = data.get('role', 'biabia')
        message_index = data.get('message_index')
        new_content = data.get('new_content', '')
        
        if message_index is None:
            return jsonify({'success': False, 'error': '缺少消息索引'}), 400
        
        if not new_content.strip():
            return jsonify({'success': False, 'error': '消息内容不能为空'}), 400
        
        # 加载当前历史
        history = load_history(role_name)
        
        # 检查索引是否有效
        if message_index < 0 or message_index >= len(history):
            return jsonify({'success': False, 'error': '消息索引无效'}), 400
        
        # 更新消息
        history[message_index] = new_content.strip()
        
        # 保存更新后的历史
        save_history(history, role_name)
        
        return jsonify({'success': True, 'message': '消息已更新'})
        
    except Exception as e:
        print(f"编辑消息失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# 删除消息路由已移至 delete_service.py

@message_bp.route('/regenerate_message', methods=['POST'])
def regenerate_message():
    """重新生成AI消息"""
    try:
        data = request.json
        print(f"\n🔍 收到重新生成消息请求")
        print(f"📋 请求数据: {data}")
        
        role_name = data.get('role', 'biabia')  # 主角色
        ai_role = data.get('ai_role', role_name)  # AI角色名
        message_index = data.get('message_index')
        original_text = data.get('original_text', '')
        
        print(f"🎭 解析参数:")
        print(f"  - role_name: {role_name}")
        print(f"  - ai_role: {ai_role}")
        print(f"  - message_index: {message_index} (type: {type(message_index)})")
        print(f"  - original_text: {len(original_text) if original_text else 0} 字符")
        
        if message_index is None:
            error_msg = '缺少消息索引'
            print(f"❌ 错误: {error_msg}")
            return jsonify({'success': False, 'error': error_msg}), 400
        
        # 加载历史记录
        history = load_history(role_name)
        print(f"📚 历史记录长度: {len(history)}")
        print(f"📚 历史记录内容:")
        for i, msg in enumerate(history):
            print(f"  [{i}] {msg[:50]}...")
        
        # 检查索引是否有效
        if message_index < 0 or message_index >= len(history):
            error_msg = f'消息索引无效: {message_index}, 历史记录长度: {len(history)}'
            print(f"❌ 错误: {error_msg}")
            print(f"📚 完整历史记录: {history}")
            return jsonify({'success': False, 'error': error_msg}), 400
        
        # 获取消息之前的历史作为上下文
        context_history = history[:message_index] if message_index > 0 else []
        
        # 加载系统信息
        base_description = load_base_description_text()
        current_role = load_current_role(ai_role)
        current_player = load_current_player()
        
        # 获取玩家名称
        try:
            current_player_data = yaml.safe_load(current_player)
            player_name = current_player_data.get('名字', '用户') if current_player_data else '用户'
        except:
            player_name = '用户'
        
        # 获取数据书临时数据
        from history_manager import get_story_temp_data
        story_temp_data = get_story_temp_data(role_name)
        
        # 构建系统提示
        系统提示 = f"底层描述:\n{base_description}\n\n"
        
        if story_temp_data:
            # 直接使用临时数据，无需复杂的向量化处理
            import json
            temp_data_str = json.dumps(story_temp_data, ensure_ascii=False, indent=2)
            系统提示 += f"【重要】当前场景信息（数据书临时数据）- 请特别关注以下环境和情境信息：\n{temp_data_str}\n\n"
            print(f"📋 消息重生成使用临时数据，包含 {len(story_temp_data)} 个数据书")
        
        系统提示 += f"你扮演的角色:\n{current_role}\n\n我扮演的角色:\n{current_player}"
        
        # 添加聊天历史到系统提示
        if context_history:
            系统提示 += "\n\n聊天历史:\n" + "\n".join(context_history[-50:])  # 最近50条作为上下文
        
        # 准备重新生成的提示词
        if ai_role == '旁白':
            regenerate_prompt = '请重新描述当前情况，可以从不同角度或用新的方式来叙述当前的场景和事件。'
        else:
            regenerate_prompt = f'请以{ai_role}的身份重新回应当前的对话情况，你可以用不同的方式、语气或角度来回应。'
        
        # 生成流式响应
        def generate():
            response_text = ""
            
            try:
                # 检查是否启用语音自动播放
                config = ConfigManager.load_config()
                voice_settings = config.get('voice_settings', {})
                auto_play_enabled = voice_settings.get('auto_play', False)
                
                # 只有在启用自动播放时才获取语音ID
                voice_id = None
                if auto_play_enabled:
                    voice_id = get_role_voice_id(ai_role)
                    print(f"🔊 重新生成消息：语音自动播放已启用")
                else:
                    print(f"🔇 重新生成消息：语音自动播放已关闭")
                
                sentence_buffer = ""
                sentence_index = 0
                # 根据角色类型选择模型键名
                model_key = None
                if ai_role == '旁白':
                    # 从配置中获取旁白模型键名
                    config = ConfigManager.load_config()
                    model_assignments = config.get('model_assignments', {})
                    model_key = model_assignments.get('narrator', 'deepseek-v3')
                else:
                    # 从配置中获取聊天模型键名
                    config = ConfigManager.load_config()
                    model_assignments = config.get('model_assignments', {})
                    model_key = model_assignments.get('chat', 'deepseek-v3')
                
                print(f"🎯 重新生成消息 - 使用模型键: {model_key}")
                
                # 调用stream_chat_response并检查返回值
                response_generator = stream_chat_response(regenerate_prompt, 系统提示, model_key)
                if response_generator is None:
                    error_msg = "AI响应生成器为空，可能是API配置错误"
                    print(f"❌ 错误: {error_msg}")
                    yield f"data: [ERROR] {error_msg}\n\n"
                    return
                
                print(f"🚀 开始处理重新生成的流式响应")
                chunk_count = 0
                for chunk in response_generator:
                    if chunk is None:
                        continue
                    chunk_count += 1
                    response_text += chunk
                    sentence_buffer += chunk
                    yield f"data: {chunk}\n\n"
                    
                    # 检查是否是句子结束的标志
                    if sentence_buffer and sentence_buffer[-1] in ['。', '！', '？', '!', '?', '.', '\n']:
                        if auto_play_enabled and sentence_buffer.strip():
                            try:
                                audio_file = generate_single_sentence_audio(sentence_buffer.strip(), voice_id, int(time.time() * 1000), sentence_index)
                                if audio_file:
                                    yield f"data: [AUDIO]{audio_file.name}\n\n"
                                    sentence_index += 1
                            except Exception as audio_e:
                                print(f"音频生成失败: {audio_e}")
                        sentence_buffer = ""
                
                print(f"✅ 流式响应处理完成 - 总计接收到 {chunk_count} 个 chunk，生成文本长度: {len(response_text)}")
                
                # 处理剩余的句子缓冲区
                if auto_play_enabled and sentence_buffer.strip():
                    try:
                        audio_file = generate_single_sentence_audio(sentence_buffer.strip(), voice_id, int(time.time() * 1000), sentence_index)
                        if audio_file:
                            yield f"data: [AUDIO]{audio_file.name}\n\n"
                    except Exception as audio_e:
                        print(f"最终音频生成失败: {audio_e}")
                
                # 更新历史记录中的消息
                if response_text.strip():
                    new_content = f"{ai_role}: {response_text.strip()}"
                    history[message_index] = new_content
                    save_history(history, role_name)
                    print(f"💾 历史记录已更新，消息索引: {message_index}")
                else:
                    print(f"⚠️ 警告: 生成的回复内容为空，不更新历史记录")
                
            except Exception as e:
                error_msg = str(e)
                print(f"❌ 重新生成消息异常: {e}")
                print(f"❌ 异常类型: {type(e).__name__}")
                
                # 根据异常类型返回不同的错误信息
                if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
                    yield f"data: [ERROR] 请求超时，AI服务器响应较慢，请稍后重试\n\n"
                elif "connection" in error_msg.lower() or "network" in error_msg.lower():
                    yield f"data: [ERROR] 网络连接问题，请检查网络或稍后重试\n\n"
                elif "api" in error_msg.lower() or "key" in error_msg.lower():
                    yield f"data: [ERROR] API配置错误，请检查模型配置\n\n"
                else:
                    yield f"data: [ERROR] {error_msg}\n\n"
            
            except GeneratorExit:
                # 客户端断开连接的情况
                print("🔌 客户端断开连接，停止生成")
                return
            
            finally:
                yield f"data: [DONE]\n\n"
        
        # 创建带有更好连接管理的Response
        response = Response(generate(), mimetype='text/event-stream')
        response.headers['Cache-Control'] = 'no-cache'
        response.headers['Connection'] = 'keep-alive'
        response.headers['X-Accel-Buffering'] = 'no'  # 禁用Nginx缓冲
        return response
        
    except Exception as e:
        print(f"重新生成消息失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
