"""
自动指令路由
处理 /自动 指令的后端逻辑
"""

from flask import Blueprint, request, jsonify, session, render_template
from typing import Optional, Dict, Any, List
import re
import time
import json
import os
from datetime import datetime

# 创建蓝图
auto_command_bp = Blueprint('auto_command', __name__, 
                           template_folder='templates',
                           static_folder='static',
                           static_url_path='/static/auto_commands')

class AutoCommandProcessor:
    """自动指令处理器"""
    
    def __init__(self):
        self.active_sessions = {}  # 存储活跃的自动对话会话
        
    def parse_auto_command(self, message: str) -> Optional[Dict[str, Any]]:
        """
        解析自动指令
        支持格式：
        - /自动 -> 默认3条
        - /自动 5 -> 生成5条
        - /自动 10 -> 生成10条
        """
        # 移除首尾空白
        message = message.strip()
        
        # 检查是否是自动指令
        if not message.startswith('/自动'):
            return None
            
        # 提取数字部分
        match = re.match(r'^/自动\s*(\d+)?$', message)
        if not match:
            return None
            
        # 获取条数，默认为3
        count_str = match.group(1)
        count = int(count_str) if count_str else 3
        
        # 限制最大条数（防止滥用）
        max_count = 20
        if count > max_count:
            count = max_count
            
        return {
            'command': 'auto',
            'count': count,
            'original_message': message
        }
    
    def validate_user_session(self) -> Dict[str, Any]:
        """验证用户登录状态"""
        try:
            # 检查聊天模块的登录状态（与全局认证中间件保持一致）
            if not session.get('logged_in_chat', False):
                return {
                    'valid': False,
                    'error': '用户未登录，请先登录后使用自动指令'
                }
            
            return {
                'valid': True,
                'module': 'chat',
                'session_info': 'logged_in_chat'
            }
            
        except Exception as e:
            print(f"❌ 用户会话验证失败: {e}")
            return {
                'valid': False,
                'error': '会话验证失败，请重新登录'
            }
    
    def generate_auto_dialogue(self, role_name: str, count: int, chat_history: List[Dict]) -> Dict[str, Any]:
        """
        生成自动对话
        """
        try:
            print(f"🤖 开始生成自动对话：角色={role_name}, 条数={count}")
            
            # 导入所需模块（延迟导入避免循环依赖）
            from web.history_manager import load_history, save_history
            import sys
            from pathlib import Path
            sys.path.append(str(Path(__file__).parent.parent.parent))
            from API import stream_chat_response_with_config, get_model_for_function
            
            results = []
            current_history = chat_history.copy() if chat_history else load_history(role_name)
            
            for i in range(count):
                print(f"🎯 生成第 {i+1}/{count} 条对话")
                
                try:
                    # 加载系统信息和数据书数据
                    from web.config_loader import load_base_description_text, load_current_role, load_current_player
                    from web.history_manager import get_story_temp_data
                    import yaml
                    
                    base_description = load_base_description_text()
                    current_role = load_current_role(role_name)
                    current_player = load_current_player()
                    
                    # 获取玩家名称
                    try:
                        current_player_data = yaml.safe_load(current_player)
                        player_name = current_player_data.get('名字', '用户') if current_player_data else '用户'
                    except:
                        player_name = '用户'
                    
                    # 获取数据书临时数据
                    story_temp_data = get_story_temp_data(role_name)
                    
                    # 构建系统提示 - 与主聊天系统保持一致
                    系统提示 = f"底层描述:\n{base_description}\n\n"
                    
                    if story_temp_data:
                        temp_data_str = json.dumps(story_temp_data, ensure_ascii=False, indent=2)
                        系统提示 += f"【重要】当前场景信息（数据书临时数据）- 请特别关注以下环境和情境信息：\n{temp_data_str}\n\n"
                        print(f"📋 自动对话使用临时数据，包含 {len(story_temp_data)} 个数据书")
                    
                    系统提示 += f"你扮演的角色:\n{current_role}\n\n我扮演的角色:\n{current_player}"
                    
                    # 构建提示词让AI自说话
                    auto_prompt = f"请以{role_name}的身份继续对话，自然地表达角色的想法或进行下一步行动。"
                    
                    # 获取模型配置
                    model_config = get_model_for_function('chat')
                    if not model_config:
                        print(f"❌ 无法获取聊天模型配置")
                        break
                    
                    # 构建聊天历史为文本格式
                    history_text = ""
                    if current_history:
                        # 添加最近的对话历史作为上下文
                        recent_history = current_history[-10:] if len(current_history) > 10 else current_history
                        history_lines = []
                        for msg in recent_history:
                            if isinstance(msg, dict):
                                # 字典格式：包含content和sender字段
                                content = msg.get('content', '')
                                sender = msg.get('sender', '')
                                if content and sender:
                                    history_lines.append(f"{sender}: {content}")
                            elif isinstance(msg, str) and msg.strip():
                                # 字符串格式：直接使用
                                history_lines.append(msg.strip())
                        
                        if history_lines:
                            history_text = "\n\n最近的对话历史:\n" + "\n".join(history_lines)
                    
                    # 构建完整的系统提示（包含历史记录）
                    full_system_prompt = 系统提示 + history_text
                    
                    # 调用AI（使用带配置的API调用方式）
                    response_text = ""
                    try:
                        for chunk in stream_chat_response_with_config(auto_prompt, full_system_prompt, model_config):
                            if chunk and isinstance(chunk, str):
                                response_text += chunk
                            elif chunk:
                                print(f"⚠️ 收到非字符串chunk: {type(chunk)} = {chunk}")
                    except Exception as stream_error:
                        print(f"❌ 流式响应错误: {stream_error}")
                        raise stream_error
                    
                    if response_text.strip():
                        # 清理AI回复，移除可能的角色名前缀
                        response_text = response_text.strip()
                        if response_text.startswith(f"{role_name}:"):
                            response_text = response_text[len(f"{role_name}:"):].strip()
                        
                        # 构建消息对象（用于返回给前端）
                        message = {
                            'content': response_text,
                            'sender': role_name,
                            'timestamp': datetime.now().isoformat(),
                            'voice_id': None,
                            'auto_generated': True
                        }
                        
                        results.append(message)
                        
                        # 更新历史记录（保持与现有格式一致，使用字符串格式）
                        history_message = f"{role_name}: {response_text}"
                        current_history.append(history_message)
                        
                        # 添加短暂延迟，模拟自然对话节奏
                        time.sleep(0.5)
                        
                    else:
                        print(f"⚠️ 第 {i+1} 条对话生成失败，AI返回为空")
                        break
                        
                except Exception as e:
                    print(f"❌ 生成第 {i+1} 条对话时出错: {e}")
                    break
            
            # 保存更新后的历史记录到文件
            if results:
                try:
                    # 确保角色名称是字符串，而不是数组
                    print(f"DEBUG: 保存历史记录，角色名称: '{role_name}', 类型: {type(role_name)}")
                    save_history(role_name, current_history)
                    print(f"✅ 已保存 {len(results)} 条自动生成的对话到历史记录")
                    
                    # 验证保存结果
                    updated_history = load_history(role_name)
                    print(f"✅ 验证：历史记录现在有 {len(updated_history)} 条")
                except Exception as e:
                    print(f"⚠️ 保存历史记录失败: {e}")
                    import traceback
                    print(f"详细错误: {traceback.format_exc()}")
            
            return {
                'success': True,
                'messages': results,
                'count': len(results),
                'role_name': role_name
            }
            
        except Exception as e:
            print(f"❌ 自动对话生成失败: {e}")
            import traceback
            traceback.print_exc()
            
            return {
                'success': False,
                'error': f'自动对话生成失败: {str(e)}',
                'messages': [],
                'count': 0
            }
    
    def generate_auto_dialogue_stream(self, role_name: str, count: int, chat_history: List[Dict]):
        """
        流式生成自动对话
        """
        try:
            print(f"🤖 开始流式生成自动对话：角色={role_name}, 条数={count}")
            
            # 导入所需模块（延迟导入避免循环依赖）
            from web.history_manager import load_history, save_history
            import sys
            from pathlib import Path
            sys.path.append(str(Path(__file__).parent.parent.parent))
            from API import stream_chat_response_with_config, get_model_for_function
            
            current_history = chat_history.copy() if chat_history else load_history(role_name)
            
            for i in range(count):
                print(f"🎯 流式生成第 {i+1}/{count} 条对话")
                
                # 发送开始生成的信号
                yield {
                    'type': 'start',
                    'index': i + 1,
                    'total': count,
                    'message': f'开始生成第 {i+1} 条对话...'
                }
                
                try:
                    # 加载系统信息和数据书数据
                    from web.config_loader import load_base_description_text, load_current_role, load_current_player
                    from web.history_manager import get_story_temp_data
                    import yaml
                    
                    base_description = load_base_description_text()
                    current_role = load_current_role(role_name)
                    current_player = load_current_player()
                    
                    # 获取玩家名称
                    try:
                        current_player_data = yaml.safe_load(current_player)
                        player_name = current_player_data.get('名字', '用户') if current_player_data else '用户'
                    except:
                        player_name = '用户'
                    
                    # 获取数据书临时数据
                    story_temp_data = get_story_temp_data(role_name)
                    
                    # 构建系统提示 - 与主聊天系统保持一致
                    系统提示 = f"底层描述:\n{base_description}\n\n"
                    
                    if story_temp_data:
                        temp_data_str = json.dumps(story_temp_data, ensure_ascii=False, indent=2)
                        系统提示 += f"【重要】当前场景信息（数据书临时数据）- 请特别关注以下环境和情境信息：\n{temp_data_str}\n\n"
                        print(f"📋 流式自动对话使用临时数据，包含 {len(story_temp_data)} 个数据书")
                    
                    系统提示 += f"你扮演的角色:\n{current_role}\n\n我扮演的角色:\n{current_player}"
                    
                    # 构建提示词让AI自说话
                    auto_prompt = f"请以{role_name}的身份继续对话，自然地表达角色的想法或进行下一步行动。"
                    
                    # 获取模型配置
                    model_config = get_model_for_function('chat')
                    if not model_config:
                        yield {
                            'type': 'error',
                            'message': '❌ 无法获取聊天模型配置'
                        }
                        break
                    
                    # 构建聊天历史为文本格式
                    history_text = ""
                    if current_history:
                        # 添加最近的对话历史作为上下文
                        recent_history = current_history[-10:] if len(current_history) > 10 else current_history
                        history_lines = []
                        for msg in recent_history:
                            if isinstance(msg, dict):
                                # 字典格式：包含content和sender字段
                                content = msg.get('content', '')
                                sender = msg.get('sender', '')
                                if content and sender:
                                    history_lines.append(f"{sender}: {content}")
                            elif isinstance(msg, str) and msg.strip():
                                # 字符串格式：直接使用
                                history_lines.append(msg.strip())
                        
                        if history_lines:
                            history_text = "\n\n最近的对话历史:\n" + "\n".join(history_lines)
                    
                    # 构建完整的系统提示（包含历史记录）
                    full_system_prompt = 系统提示 + history_text
                    
                    # 调用AI（使用带配置的API调用方式）
                    response_text = ""
                    try:
                        for chunk in stream_chat_response_with_config(auto_prompt, full_system_prompt, model_config):
                            if chunk and isinstance(chunk, str):
                                response_text += chunk
                    except Exception as stream_error:
                        print(f"❌ 流式响应错误: {stream_error}")
                        yield {
                            'type': 'error',
                            'message': f'AI生成失败: {str(stream_error)}'
                        }
                        break
                    
                    if response_text.strip():
                        # 清理AI回复，移除可能的角色名前缀
                        response_text = response_text.strip()
                        if response_text.startswith(f"{role_name}:"):
                            response_text = response_text[len(f"{role_name}:"):].strip()
                        
                        # 构建消息对象（用于返回给前端）
                        message = {
                            'content': response_text,
                            'sender': role_name,
                            'timestamp': datetime.now().isoformat(),
                            'voice_id': None,
                            'auto_generated': True
                        }
                        
                        # 更新历史记录（保持与现有格式一致，使用字符串格式）
                        history_message = f"{role_name}: {response_text}"
                        current_history.append(history_message)
                        
                        # 实时保存历史记录
                        try:
                            save_history(role_name, current_history)
                            print(f"✅ 已保存第 {i+1} 条自动对话到历史记录")
                        except Exception as e:
                            print(f"⚠️ 保存第 {i+1} 条对话失败: {e}")
                        
                        # 发送生成完成的消息
                        yield {
                            'type': 'message',
                            'index': i + 1,
                            'total': count,
                            'data': message,
                            'message': f'第 {i+1} 条对话生成完成'
                        }
                        
                        # 添加短暂延迟，模拟自然对话节奏
                        time.sleep(0.5)
                        
                    else:
                        print(f"⚠️ 第 {i+1} 条对话生成失败，AI返回为空")
                        yield {
                            'type': 'error',
                            'message': f'第 {i+1} 条对话生成失败，AI返回为空'
                        }
                        break
                        
                except Exception as e:
                    print(f"❌ 生成第 {i+1} 条对话时出错: {e}")
                    yield {
                        'type': 'error',
                        'message': f'生成第 {i+1} 条对话时出错: {str(e)}'
                    }
                    break
            
        except Exception as e:
            print(f"❌ 流式自动对话生成失败: {e}")
            yield {
                'type': 'error',
                'message': f'流式生成失败: {str(e)}'
            }

# 创建全局处理器实例
auto_processor = AutoCommandProcessor()

@auto_command_bp.route('/api/auto_command', methods=['POST'])
def handle_auto_command():
    """处理自动指令API（非流式）"""
    try:
        # 获取请求数据
        data = request.json
        if not data:
            return jsonify({
                'success': False,
                'error': '请求数据为空'
            }), 400
        
        message = data.get('message', '').strip()
        role_name = data.get('role', '')
        chat_history = data.get('chat_history', [])
        
        print(f"🎯 接收到自动指令请求: message='{message}', role='{role_name}'")
        
        # 验证基本参数
        if not message:
            return jsonify({
                'success': False,
                'error': '消息内容不能为空'
            }), 400
            
        if not role_name:
            return jsonify({
                'success': False,
                'error': '角色名称不能为空'
            }), 400
        
        # 解析自动指令
        command_info = auto_processor.parse_auto_command(message)
        if not command_info:
            return jsonify({
                'success': False,
                'error': '无效的自动指令格式，请使用 /自动 或 /自动 数字'
            }), 400
        
        # 验证用户登录状态
        auth_result = auto_processor.validate_user_session()
        if not auth_result['valid']:
            return jsonify({
                'success': False,
                'error': auth_result['error'],
                'need_login': True
            }), 401
        
        # 生成自动对话
        result = auto_processor.generate_auto_dialogue(
            role_name=role_name,
            count=command_info['count'],
            chat_history=chat_history
        )
        
        if result['success']:
            return jsonify({
                'success': True,
                'command': 'auto',
                'count': result['count'],
                'messages': result['messages'],
                'role_name': result['role_name'],
                'message': f"✅ 成功生成 {result['count']} 条自动对话"
            })
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 500
            
    except Exception as e:
        print(f"❌ 自动指令处理失败: {e}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'error': f'自动指令处理失败: {str(e)}'
        }), 500

@auto_command_bp.route('/api/auto_command_stream', methods=['POST'])
def handle_auto_command_stream():
    """处理自动指令API（流式）"""
    try:
        # 获取请求数据
        data = request.json
        if not data:
            yield f"data: {json.dumps({'error': '请求数据为空'})}\n\n"
            return
        
        message = data.get('message', '').strip()
        role_name = data.get('role', '')
        chat_history = data.get('chat_history', [])
        
        print(f"🎯 接收到流式自动指令请求: message='{message}', role='{role_name}'")
        
        # 验证基本参数
        if not message:
            yield f"data: {json.dumps({'error': '消息内容不能为空'})}\n\n"
            return
            
        if not role_name:
            yield f"data: {json.dumps({'error': '角色名称不能为空'})}\n\n"
            return
        
        # 解析自动指令
        command_info = auto_processor.parse_auto_command(message)
        if not command_info:
            yield f"data: {json.dumps({'error': '无效的自动指令格式，请使用 /自动 或 /自动 数字'})}\n\n"
            return
        
        # 验证用户登录状态
        auth_result = auto_processor.validate_user_session()
        if not auth_result['valid']:
            yield f"data: {json.dumps({'error': auth_result['error'], 'need_login': True})}\n\n"
            return
        
        # 流式生成自动对话
        def generate_stream():
            try:
                for message_data in auto_processor.generate_auto_dialogue_stream(
                    role_name=role_name,
                    count=command_info['count'],
                    chat_history=chat_history
                ):
                    yield f"data: {json.dumps(message_data, ensure_ascii=False)}\n\n"
                
                # 发送完成信号
                yield f"data: {json.dumps({'type': 'complete', 'message': '自动对话生成完成'})}\n\n"
                
            except Exception as e:
                print(f"❌ 流式自动对话生成失败: {e}")
                yield f"data: {json.dumps({'error': f'生成失败: {str(e)}'})}\n\n"
        
        # 设置流式响应头
        from flask import Response
        return Response(
            generate_stream(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            }
        )
        
    except Exception as e:
        print(f"❌ 流式自动指令处理失败: {e}")
        return f"data: {json.dumps({'error': f'处理失败: {str(e)}'})}\n\n"

@auto_command_bp.route('/api/auto_command/status', methods=['GET'])
def get_auto_command_status():
    """获取自动指令状态"""
    try:
        # 验证用户登录状态
        auth_result = auto_processor.validate_user_session()
        
        return jsonify({
            'success': True,
            'logged_in': auth_result['valid'],
            'module': auth_result.get('module') if auth_result['valid'] else None,
            'features': {
                'auto_dialogue': True,
                'max_count': 20,
                'default_count': 3
            }
        })
        
    except Exception as e:
        print(f"❌ 获取自动指令状态失败: {e}")
        return jsonify({
            'success': False,
            'error': f'获取状态失败: {str(e)}'
        }), 500

@auto_command_bp.route('/auto_help')
def auto_help_page():
    """自动指令帮助页面"""
    return render_template('auto_help.html')

@auto_command_bp.route('/api/auto_command/help', methods=['GET'])
def get_auto_command_help():
    """获取自动指令帮助信息"""
    try:
        help_info = {
            'command': '/自动',
            'description': '让当前对话的角色连续生成多条对话',
            'usage': [
                {
                    'format': '/自动',
                    'description': '生成3条自动对话（默认）'
                },
                {
                    'format': '/自动 5',
                    'description': '生成5条自动对话'
                },
                {
                    'format': '/自动 10',
                    'description': '生成10条自动对话'
                }
            ],
            'notes': [
                '需要登录后才能使用',
                '最多支持生成20条对话',
                '自动生成的对话会保存到聊天历史',
                '生成过程中会保持角色的一致性'
            ],
            'examples': [
                '/自动',
                '/自动 3',
                '/自动 8'
            ]
        }
        
        return jsonify({
            'success': True,
            'help': help_info
        })
        
    except Exception as e:
        print(f"❌ 获取帮助信息失败: {e}")
        return jsonify({
            'success': False,
            'error': f'获取帮助信息失败: {str(e)}'
        }), 500