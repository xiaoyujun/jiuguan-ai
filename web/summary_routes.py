"""
新的异步并发总结路由
支持多数据书选择、并发处理和详细失败报告
"""

from flask import Blueprint, request, jsonify, render_template
import json
import time
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from web.async_summary_manager import async_summary_manager
from web.history_manager import load_history, clear_story_temp_data
from web.core import StoryBookManager, StoryReferenceManager
from web.utils import PathManager

summary_bp = Blueprint('summary', __name__)

def _get_match_reason(is_matched, is_bound, bind_info):
    """获取匹配原因"""
    reasons = []
    if is_bound:
        reasons.append(f"绑定({', '.join(bind_info)})")
    if is_matched:
        reasons.append("匹配总结词")
    if not reasons:
        reasons.append("未匹配总结词")
    return ', '.join(reasons)

@summary_bp.route('/summary')
def summary_page():
    """显示总结页面 (新版并发处理)"""
    role = request.args.get('role', 'biabia')
    event_data = request.args.get('event_data')  # 新增：事件数据参数
    
    # 获取当前玩家信息
    try:
        current_player_path = PathManager.get_players_dir() / "当前挑选玩家.json"
        current_player = "未知玩家"
        if current_player_path.exists():
            with open(current_player_path, 'r', encoding='utf-8') as f:
                player_data = json.load(f)
                current_player = player_data.get('selected_player', '未知玩家')
        print(f"📝 总结功能 - 当前角色: {role}, 当前玩家: {current_player}")
    except Exception as e:
        print(f"❌ 获取当前玩家信息失败: {e}")
        current_player = "未知玩家"
    
    # 检查是否是事件数据模式
    if event_data:
        try:
            # 解析事件数据
            event_info = json.loads(event_data)
            event_name = event_info.get('event_name', '')
            event_description = event_info.get('event_description', '')
            participants = event_info.get('participants', [])
            storybooks = event_info.get('storybooks', [])
            history = event_info.get('history', [])
            
            # 提取事件对话内容
            sentences = []
            for msg in history:
                if isinstance(msg, dict) and 'message' in msg:
                    sentences.append(msg['message'])
                elif isinstance(msg, str) and ': ' in msg:
                    sentences.append(msg.split(': ', 1)[1])
            
            full_text = ' '.join(sentences)
            
            if not full_text.strip():
                return render_template('enhanced_summary.html', 
                                     role=role, 
                                     story_books=[],
                                     error_message='事件记录为空',
                                     is_event_mode=True,
                                     event_name=event_name)
        except Exception as e:
            print(f"解析事件数据失败: {e}")
            return render_template('enhanced_summary.html', 
                                 role=role, 
                                 story_books=[],
                                 error_message=f'事件数据解析失败: {str(e)}',
                                 is_event_mode=True)
    else:
        # 原有的聊天记录模式
        history = load_history(role)
        if not history:
            return render_template('enhanced_summary.html', 
                                 role=role, 
                                 story_books=[],
                                 error_message='没有找到聊天记录')
        
        # 提取聊天内容
        sentences = []
        for msg in history[-20:]:  # 只取最近20条
            if isinstance(msg, str) and ': ' in msg:
                sentences.append(msg.split(': ', 1)[1])
        
        full_text = ' '.join(sentences)
        
        if not full_text.strip():
            return render_template('enhanced_summary.html', 
                                 role=role, 
                                 story_books=[],
                                 error_message='聊天记录为空')
    
    # 获取数据书信息并检查总结词匹配
    story_manager = StoryBookManager()
    story_books_info = []
    # 获取角色和玩家绑定的数据书
    story_ref_manager = StoryReferenceManager()
    bound_role_stories = set()
    bound_player_stories = set()
    
    try:
        # 获取角色绑定的数据书
        role_bound_data = story_ref_manager.get_bound_story_data_with_references(role)
        bound_role_stories = set(role_bound_data.keys())
        print(f"📚 角色 '{role}' 绑定的数据书: {bound_role_stories}")
        
        # 获取玩家绑定的数据书
        player_bound_data = story_ref_manager.get_player_bound_story_data(current_player)
        bound_player_stories = set(player_bound_data.keys())
        print(f"📚 玩家 '{current_player}' 绑定的数据书: {bound_player_stories}")
    except Exception as e:
        print(f"❌ 获取绑定数据书失败: {e}")
    
    # 合并所有绑定的数据书
    all_bound_stories = bound_role_stories | bound_player_stories
    print(f"📚 所有绑定的数据书: {all_bound_stories}")
    
    matched_stories = []
    unmatched_stories = []
    bound_stories = []  # 绑定的数据书列表
    
    for json_file in story_manager.story_dir.glob("*.json"):
        try:
            data = story_manager._load_story_file(json_file)
            if data:
                keywords = data.get('总结词', []) + data.get('捆绑角色', [])
                story_name = json_file.stem
                
                # 检查是否匹配总结词
                is_matched = story_manager._check_keyword_match(data, full_text, story_name)
                
                # 检查是否是绑定的数据书
                is_bound = story_name in all_bound_stories
                is_role_bound = story_name in bound_role_stories
                is_player_bound = story_name in bound_player_stories
                
                # 构建绑定信息
                bind_info = []
                if is_role_bound:
                    bind_info.append(f"角色({role})")
                if is_player_bound:
                    bind_info.append(f"玩家({current_player})")
                
                story_info = {
                    'name': story_name,
                    'keywords': keywords[:5],  # 只显示前5个总结词
                    'total_keywords': len(keywords),
                    'has_events': '事件' in data and len(data.get('事件', [])) > 0,
                    'attributes_count': len(data.get('属性', {})) if isinstance(data.get('属性'), dict) else 0,
                    'is_matched': is_matched,  # 新增：标记是否匹配
                    'is_bound': is_bound,  # 新增：标记是否绑定
                    'is_role_bound': is_role_bound,  # 新增：标记角色绑定
                    'is_player_bound': is_player_bound,  # 新增：标记玩家绑定
                    'bind_info': ', '.join(bind_info),  # 绑定信息文本
                    'match_reason': _get_match_reason(is_matched, is_bound, bind_info)
                }
                
                # 按优先级分类：绑定的数据书 > 匹配的数据书 > 未匹配的数据书
                if is_bound:
                    bound_stories.append(story_info)
                elif is_matched:
                    matched_stories.append(story_info)
                else:
                    unmatched_stories.append(story_info)
                    
        except Exception as e:
            print(f"加载数据书 {json_file.name} 失败: {e}")
    
    # 按优先级排序：绑定的数据书 > 匹配的数据书 > 未匹配的数据书
    story_books_info = bound_stories + matched_stories + unmatched_stories
    
    # 获取自动选中的数据书列表（绑定的数据书）
    auto_selected_stories = [story['name'] for story in bound_stories]
    print(f"📚 自动选中的绑定数据书: {auto_selected_stories}")
    
    # 准备模板数据
    template_data = {
        'role': role,
        'current_player': current_player,  # 新增：当前玩家
        'story_books': story_books_info,
        'bound_count': len(bound_stories),  # 新增：绑定数据书数量
        'matched_count': len(matched_stories),
        'total_count': len(story_books_info),
        'auto_selected_stories': auto_selected_stories,  # 新增：自动选中的数据书
        'chat_content': full_text[:200] + "..." if len(full_text) > 200 else full_text
    }
    
    # 如果是事件模式，添加事件相关信息
    if event_data:
        template_data.update({
            'is_event_mode': True,
            'event_name': event_info.get('event_name', ''),
            'event_description': event_info.get('event_description', ''),
            'participants': event_info.get('participants', []),
            'storybooks': event_info.get('storybooks', []),
            'event_history': event_info.get('history', [])
        })
    
    return render_template('enhanced_summary.html', **template_data)

@summary_bp.route('/start_summary', methods=['POST'])
def start_summary():
    """启动异步总结 (新版并发处理)"""
    try:
        data = request.json
        role_name = data.get('role', 'biabia')
        selected_stories = data.get('selected_stories', [])  # 选中的数据书列表
        max_workers = data.get('max_workers', 3)  # 最大并发数
        event_data = data.get('event_data')  # 新增：事件数据
        
        # 检查是否是事件数据模式
        if event_data:
            # 处理事件数据
            event_info = event_data
            history = event_info.get('history', [])
            
            # 提取事件对话内容
            sentences = []
            for msg in history:
                if isinstance(msg, dict) and 'message' in msg:
                    sentences.append(msg['message'])
                elif isinstance(msg, str) and ': ' in msg:
                    sentences.append(msg.split(': ', 1)[1])
            
            full_text = ' '.join(sentences)
            
            if not full_text.strip():
                return jsonify({
                    'success': False, 
                    'error': '事件记录为空'
                }), 400
        else:
            # 原有的聊天记录模式
            history = load_history(role_name)
            if not history:
                return jsonify({
                    'success': False, 
                    'error': '没有找到聊天记录'
                }), 400
            
            # 提取句子
            sentences = []
            for msg in history:
                if isinstance(msg, str) and ': ' in msg:
                    sentences.append(msg.split(': ', 1)[1])
            
            full_text = ' '.join(sentences)
            
            if not full_text.strip():
                return jsonify({
                    'success': False, 
                    'error': '聊天记录为空'
                }), 400
        
        # 创建异步处理会话
        session_id = async_summary_manager.create_session(
            role_name=role_name,
            sentence=full_text,
            selected_stories=selected_stories
        )
        
        # 启动处理
        if async_summary_manager.start_session(session_id):
            return jsonify({
                'success': True,
                'session_id': session_id,
                'redirect_url': f'/summary_progress?session_id={session_id}&role={role_name}'
            })
        else:
            return jsonify({
                'success': False,
                'error': '启动处理失败'
            }), 500
            
    except Exception as e:
        print(f"启动总结失败: {e}")
        return jsonify({
            'success': False,
            'error': f'启动失败: {str(e)}'
        }), 500

@summary_bp.route('/summary_progress')
def summary_progress_page():
    """显示总结进度页面 (新版并发处理)"""
    session_id = request.args.get('session_id')
    role = request.args.get('role', 'biabia')
    
    if not session_id:
        return "缺少会话ID", 400
    
    return render_template('enhanced_summary_progress.html', 
                         session_id=session_id, 
                         role=role)

@summary_bp.route('/get_progress/<session_id>')
def get_progress(session_id):
    """获取总结进度 (新版并发处理)"""
    try:
        status = async_summary_manager.get_session_status(session_id)
        if not status:
            return jsonify({'error': '会话不存在'}), 404
        
        return jsonify(status)
    except Exception as e:
        print(f"获取进度失败: {e}")
        return jsonify({'error': f'获取进度失败: {str(e)}'}), 500

@summary_bp.route('/retry_failed_tasks/<session_id>', methods=['POST'])
def retry_failed_tasks(session_id):
    """重试失败的任务 (新版并发处理)"""
    try:
        success = async_summary_manager.retry_failed_tasks(session_id)
        if success:
            return jsonify({
                'success': True,
                'message': '已启动重试处理'
            })
        else:
            return jsonify({
                'success': False,
                'message': '没有可重试的任务'
            })
    except Exception as e:
        print(f"重试失败: {e}")
        return jsonify({
            'success': False,
            'error': f'重试失败: {str(e)}'
        }), 500

@summary_bp.route('/stop_session/<session_id>', methods=['POST'])
def stop_session(session_id):
    """停止会话处理 (新版并发处理)"""
    try:
        session = async_summary_manager.get_session(session_id)
        if not session:
            return jsonify({'error': '会话不存在'}), 404
        
        session.stop_processing()
        return jsonify({
            'success': True,
            'message': '处理已停止'
        })
    except Exception as e:
        print(f"停止会话失败: {e}")
        return jsonify({
            'success': False,
            'error': f'停止失败: {str(e)}'
        }), 500

@summary_bp.route('/confirm_update', methods=['POST'])
def confirm_update():
    """保存总结结果 (新版并发处理)"""
    try:
        data = request.json or {}
        session_id = data.get('session_id')
        selected_tasks = data.get('selected_tasks', [])  # 选中要保存的任务
        
        if not session_id:
            return jsonify({'error': '缺少会话ID'}), 400
            
        session = async_summary_manager.get_session(session_id)
        if not session:
            return jsonify({'error': '会话不存在'}), 404
        
        # 获取结果
        all_results = session.get_results_for_save()
        
        if not all_results:
            return jsonify({
                'success': False,
                'message': '没有可保存的结果'
            })
        
        # 过滤选中的任务
        if selected_tasks:
            filtered_results = []
            for path, modification_result in all_results:
                story_name = path.stem
                if story_name in selected_tasks:
                    filtered_results.append((path, modification_result))
            results_to_save = filtered_results
        else:
            results_to_save = all_results
        
        if not results_to_save:
            return jsonify({
                'success': False,
                'message': '没有选中要保存的任务'
            })
        
        # 应用修改到文件
        story_manager = StoryBookManager()
        saved_count = 0
        failed_saves = []
        
        for path, modification_result in results_to_save:
            try:
                modifications = modification_result.get('modifications', [])
                if modifications:
                    result = story_manager.apply_modifications(path, modifications)
                    if result['success']:
                        saved_count += 1
                        print(f"已保存 {path.name}")
                    else:
                        failed_saves.append(f"{path.stem}: {result['message']}")
            except Exception as e:
                failed_saves.append(f"{path.stem}: {str(e)}")
        
        # 清理临时数据
        if saved_count > 0:
            clear_story_temp_data(session.role_name)
        
        # 准备响应
        response = {
            'success': saved_count > 0,
            'saved_count': saved_count,
            'total_count': len(results_to_save),
            'message': f'成功保存 {saved_count}/{len(results_to_save)} 个数据书'
        }
        
        if failed_saves:
            response['failed_saves'] = failed_saves
            response['message'] += f'，{len(failed_saves)} 个保存失败'
        
        return jsonify(response)
        
    except Exception as e:
        print(f"保存结果失败: {e}")
        return jsonify({
            'success': False,
            'error': f'保存失败: {str(e)}'
        }), 500

@summary_bp.route('/get_story_details', methods=['POST'])
def get_story_details():
    """获取数据书详细信息"""
    try:
        data = request.json
        story_names = data.get('story_names', [])
        role_name = data.get('role', 'biabia')
        
        story_manager = StoryBookManager()
        details = {}
        
        # 加载临时数据
        temp_story_data = story_manager._load_temp_data(role_name)
        
        for story_name in story_names:
            story_file = story_manager.story_dir / f"{story_name}.json"
            if story_file.exists():
                try:
                    original_data = story_manager._load_story_file(story_file)
                    if original_data:
                        # 合并临时数据
                        if story_name in temp_story_data:
                            merged_data = story_manager._merge_temp_data(original_data, temp_story_data[story_name])
                        else:
                            merged_data = original_data
                        
                        details[story_name] = {
                            'keywords': merged_data.get('总结词', []) + merged_data.get('捆绑角色', []),
                            'has_events': '事件' in merged_data and len(merged_data.get('事件', [])) > 0,
                            'events_count': len(merged_data.get('事件', [])) if '事件' in merged_data else 0,
                            'attributes_count': len(merged_data.get('属性', {})) if isinstance(merged_data.get('属性'), dict) else 0,
                            'description': merged_data.get('描述', '')[:100] + '...' if len(merged_data.get('描述', '')) > 100 else merged_data.get('描述', ''),
                            'has_temp_data': story_name in temp_story_data
                        }
                except Exception as e:
                    details[story_name] = {'error': f'加载失败: {str(e)}'}
        
        return jsonify(details)
        
    except Exception as e:
        print(f"获取数据书详情失败: {e}")
        return jsonify({'error': f'获取详情失败: {str(e)}'}), 500

@summary_bp.route('/preview_result/<session_id>/<task_name>')
def preview_result(session_id, task_name):
    """获取任务预览结果"""
    try:
        session = async_summary_manager.get_session(session_id)
        if not session:
            return jsonify({'error': '会话不存在'}), 404
        
        # 获取任务信息
        task = session.tasks.get(task_name)
        if not task:
            return jsonify({'error': '任务不存在'}), 404
        
        if task.status != 'completed':
            return jsonify({'error': '任务未完成'}), 400
        
        # 获取修改结果
        result_data = task.result_data
        if not result_data:
            return jsonify({'error': '没有结果数据'}), 400
        
        modifications = result_data.get('modifications', [])
        modification_result = result_data.get('modification_result', {})
        
        # 构建预览数据
        preview_data = {
            'task_name': task_name,
            'story_name': task.story_name,
            'status': task.status,
            'processing_time': task.end_time - task.start_time if task.start_time and task.end_time else 0,
            'modifications_count': len(modifications),
            'modifications': modifications,
            'modification_result': modification_result,
            'logs': task.logs[-5:]  # 最后5条日志
        }
        
        return jsonify({
            'success': True,
            'data': preview_data
        })
        
    except Exception as e:
        print(f"获取预览结果失败: {e}")
        return jsonify({
            'success': False,
            'error': f'获取预览结果失败: {str(e)}'
        }), 500

@summary_bp.route('/save_preview_modifications', methods=['POST'])
def save_preview_modifications():
    """保存预览界面的修改内容到数据书文件"""
    try:
        data = request.json or {}
        session_id = data.get('session_id')
        task_name = data.get('task_name')
        modifications = data.get('modifications', {})
        
        if not session_id or not task_name:
            return jsonify({
                'success': False,
                'error': '缺少必要参数'
            }), 400
        
        if not modifications:
            return jsonify({
                'success': False,
                'error': '没有修改内容'
            }), 400
        
        print(f"📝 保存预览修改 - 会话: {session_id}, 任务: {task_name}")
        print(f"🔧 修改内容: {modifications}")
        
        # 获取会话和任务信息
        session = async_summary_manager.get_session(session_id)
        if not session:
            return jsonify({
                'success': False,
                'error': '会话不存在'
            }), 404
        
        task = session.tasks.get(task_name)
        if not task:
            return jsonify({
                'success': False,
                'error': '任务不存在'
            }), 404
        
        if task.status != 'completed':
            return jsonify({
                'success': False,
                'error': '任务未完成，无法保存修改'
            }), 400
        
        # 获取原始修改要求
        result_data = task.result_data
        if not result_data:
            return jsonify({
                'success': False,
                'error': '没有结果数据'
            }), 400
        
        original_modifications = result_data.get('modifications', [])
        
        # 应用用户的修改
        updated_modifications = []
        for i, original_mod in enumerate(original_modifications):
            if str(i) in modifications:
                # 用户修改了这个项目
                updated_mod = original_mod.copy()
                updated_mod['value'] = modifications[str(i)]
                updated_modifications.append(updated_mod)
                print(f"✏️ 修改项 {i}: {original_mod['value']} -> {modifications[str(i)]}")
            else:
                # 保持原始值
                updated_modifications.append(original_mod)
        
        # 导入数据书管理器
        sys.path.append(str(Path(__file__).parent.parent))
        from web.core import StoryBookManager
        
        story_manager = StoryBookManager()
        
        # 检查是否尝试添加事件到没有事件字段的数据书
        story_file = story_manager.story_dir / f"{task_name}.json"
        if story_file.exists():
            original_data = story_manager._load_story_file(story_file)
            if original_data:
                # 检查修改中是否包含添加事件操作
                has_add_event = any(mod.get('operation') == 'add_event' for mod in updated_modifications)
                
                # 检查原始数据书是否有事件字段
                has_events_field = False
                if '属性' in original_data and isinstance(original_data['属性'], dict):
                    has_events_field = '事件' in original_data['属性']
                else:
                    has_events_field = '事件' in original_data
                
                if has_add_event and not has_events_field:
                    return jsonify({
                        'success': False,
                        'error': f'该数据书原本没有事件字段或事件格式不统一，如果进行保存将会创建事件字段。是否继续保存？',
                        'warning_type': 'missing_events_field',
                        'story_name': task_name
                    }), 400

        # 应用修改到数据书文件
        try:
            save_result = story_manager.apply_modifications_to_storybook(
                task_name, 
                updated_modifications
            )
            
            if save_result.get('success', False):
                print(f"✅ 成功保存修改到数据书: {task_name}")
                return jsonify({
                    'success': True,
                    'message': f'修改已保存到数据书 {task_name}',
                    'applied_count': len(updated_modifications),
                    'save_result': save_result
                })
            else:
                error_msg = save_result.get('error', '保存失败')
                print(f"❌ 保存修改失败: {error_msg}")
                return jsonify({
                    'success': False,
                    'error': f'保存失败: {error_msg}'
                }), 500
                
        except Exception as save_error:
            print(f"❌ 保存修改异常: {save_error}")
            return jsonify({
                'success': False,
                'error': f'保存异常: {str(save_error)}'
            }), 500
        
    except Exception as e:
        print(f"❌ 保存预览修改失败: {e}")
        return jsonify({
            'success': False,
            'error': f'保存失败: {str(e)}'
        }), 500

@summary_bp.route('/force_save_preview_modifications', methods=['POST'])
def force_save_preview_modifications():
    """强制保存预览界面的修改内容到数据书文件（忽略事件字段检查）"""
    try:
        data = request.json or {}
        session_id = data.get('session_id')
        task_name = data.get('task_name')
        modifications = data.get('modifications', {})
        
        if not session_id or not task_name:
            return jsonify({
                'success': False,
                'error': '缺少必要参数'
            }), 400
        
        if not modifications:
            return jsonify({
                'success': False,
                'error': '没有修改内容'
            }), 400
        
        print(f"📝 强制保存预览修改 - 会话: {session_id}, 任务: {task_name}")
        print(f"🔧 修改内容: {modifications}")
        
        # 获取会话和任务信息
        session = async_summary_manager.get_session(session_id)
        if not session:
            return jsonify({
                'success': False,
                'error': '会话不存在'
            }), 404
        
        task = session.tasks.get(task_name)
        if not task:
            return jsonify({
                'success': False,
                'error': '任务不存在'
            }), 404
        
        if task.status != 'completed':
            return jsonify({
                'success': False,
                'error': '任务未完成，无法保存修改'
            }), 400
        
        # 获取原始修改要求
        result_data = task.result_data
        if not result_data:
            return jsonify({
                'success': False,
                'error': '没有结果数据'
            }), 400
        
        original_modifications = result_data.get('modifications', [])
        
        # 应用用户的修改
        updated_modifications = []
        for i, original_mod in enumerate(original_modifications):
            if str(i) in modifications:
                # 用户修改了这个项目
                updated_mod = original_mod.copy()
                updated_mod['value'] = modifications[str(i)]
                updated_modifications.append(updated_mod)
                print(f"✏️ 修改项 {i}: {original_mod['value']} -> {modifications[str(i)]}")
            else:
                # 保持原始值
                updated_modifications.append(original_mod)
        
        # 导入数据书管理器
        sys.path.append(str(Path(__file__).parent.parent))
        from web.core import StoryBookManager
        
        story_manager = StoryBookManager()
        
        # 对于添加事件操作，如果数据书没有事件字段，先创建它
        story_file = story_manager.story_dir / f"{task_name}.json"
        if story_file.exists():
            original_data = story_manager._load_story_file(story_file)
            if original_data:
                # 检查修改中是否包含添加事件操作
                has_add_event = any(mod.get('operation') == 'add_event' for mod in updated_modifications)
                
                # 检查原始数据书是否有事件字段
                has_events_field = False
                if '属性' in original_data and isinstance(original_data['属性'], dict):
                    has_events_field = '事件' in original_data['属性']
                else:
                    has_events_field = '事件' in original_data
                
                if has_add_event and not has_events_field:
                    # 创建事件字段
                    if '属性' in original_data and isinstance(original_data['属性'], dict):
                        original_data['属性']['事件'] = []
                    else:
                        original_data['事件'] = []
                    
                    # 保存更新后的数据结构
                    with open(story_file, 'w', encoding='utf-8') as f:
                        json.dump(original_data, f, ensure_ascii=False, indent=2)
                    
                    print(f"✅ 为数据书 {task_name} 创建了事件字段")

        # 应用修改到数据书文件
        try:
            save_result = story_manager.apply_modifications_to_storybook(
                task_name, 
                updated_modifications
            )
            
            if save_result.get('success', False):
                print(f"✅ 成功强制保存修改到数据书: {task_name}")
                return jsonify({
                    'success': True,
                    'message': f'修改已保存到数据书 {task_name}（已创建事件字段）',
                    'applied_count': len(updated_modifications),
                    'save_result': save_result
                })
            else:
                error_msg = save_result.get('error', '保存失败')
                print(f"❌ 强制保存修改失败: {error_msg}")
                return jsonify({
                    'success': False,
                    'error': f'保存失败: {error_msg}'
                }), 500
                
        except Exception as save_error:
            print(f"❌ 强制保存修改异常: {save_error}")
            return jsonify({
                'success': False,
                'error': f'保存异常: {str(save_error)}'
            }), 500
        
    except Exception as e:
        print(f"❌ 强制保存预览修改失败: {e}")
        return jsonify({
            'success': False,
            'error': f'保存失败: {str(e)}'
        }), 500

@summary_bp.route('/cleanup_session/<session_id>', methods=['POST'])
def cleanup_session(session_id):
    """清理会话资源"""
    try:
        async_summary_manager.cleanup_session(session_id)
        return jsonify({
            'success': True,
            'message': '会话已清理'
        })
    except Exception as e:
        print(f"清理会话失败: {e}")
        return jsonify({
            'success': False,
            'error': f'清理失败: {str(e)}'
        }), 500

# 兼容性路由：支持旧的调用方式
@summary_bp.route('/summarize_async', methods=['POST'])
def summarize_async():
    """兼容旧版本的异步总结接口"""
    try:
        role_name = request.json.get('role', 'biabia')
        
        # 重定向到新的启动接口
        return start_summary()
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
