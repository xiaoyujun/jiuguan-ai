"""
事件管理路由模块
用于处理数据书中事件的管理操作，包括查看、编辑、添加和清理
"""

from flask import Blueprint, request, jsonify
import os
import json
import logging
from datetime import datetime

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

event_manager_bp = Blueprint('event_manager', __name__)

STORIES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), '数据书')

def load_story_file(filename):
    """加载数据书文件"""
    try:
        filepath = os.path.join(STORIES_DIR, filename)
        if not os.path.exists(filepath):
            logger.error(f"数据书文件不存在: {filename}")
            return None
            
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            logger.info(f"成功加载数据书: {filename}")
            return data
    except Exception as e:
        logger.error(f"加载数据书文件失败 {filename}: {str(e)}")
        return None

def save_story_file(filename, data):
    """保存数据书文件"""
    try:
        filepath = os.path.join(STORIES_DIR, filename)
        
        # 更新时间戳
        data['更新时间'] = datetime.now().isoformat()
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"成功保存数据书: {filename}")
        return True
    except Exception as e:
        logger.error(f"保存数据书文件失败 {filename}: {str(e)}")
        return False

@event_manager_bp.route('/api/event-manager/scan', methods=['GET'])
def scan_story_events():
    """扫描所有数据书中的事件数据"""
    try:
        if not os.path.exists(STORIES_DIR):
            logger.error(f"数据书目录不存在: {STORIES_DIR}")
            return jsonify({'error': '数据书目录不存在'}), 404
        
        event_data = []
        
        # 遍历数据书目录
        for filename in os.listdir(STORIES_DIR):
            if filename.endswith('.json'):
                story_data = load_story_file(filename)
                if story_data:
                    # 检查是否有事件数据
                    events = []
                    
                    # 检查属性中的事件字段
                    if '属性' in story_data:
                        if '事件' in story_data['属性']:
                            attr_events = story_data['属性']['事件']
                            if isinstance(attr_events, list):
                                events.extend(attr_events)
                            elif isinstance(attr_events, dict):
                                # 处理字典形式的事件数据，如 "事件": {"0": "和马鲛鱼做爱"}
                                for event_key, event_value in attr_events.items():
                                    if isinstance(event_value, str) and event_value.strip():
                                        events.append(event_value)
                            elif isinstance(attr_events, str) and attr_events.strip():
                                events.append(attr_events)
                    
                    # 如果有事件数据，添加到结果中
                    if events:
                        story_info = {
                            'filename': filename,
                            'name': filename.replace('.json', ''),
                            'events': events,
                            'event_count': len(events),
                            'description': story_data.get('描述', ''),
                            'tags': story_data.get('标签', []),
                            'update_time': story_data.get('更新时间', '')
                        }
                        event_data.append(story_info)
        
        logger.info(f"扫描完成，找到 {len(event_data)} 个包含事件的数据书")
        for story in event_data:
            logger.info(f"  - {story['name']}: {story['event_count']} 个事件")
        return jsonify({
            'success': True,
            'data': event_data,
            'total_stories': len(event_data)
        })
        
    except Exception as e:
        logger.error(f"扫描事件数据失败: {str(e)}")
        return jsonify({'error': f'扫描失败: {str(e)}'}), 500

@event_manager_bp.route('/api/event-manager/clear', methods=['POST'])
def clear_story_events():
    """清理选定数据书中的事件"""
    try:
        data = request.get_json()
        
        if not data or 'stories' not in data:
            return jsonify({'error': '请提供要清理的数据书列表'}), 400
        
        stories_to_clear = data['stories']
        clear_type = data.get('clear_type', 'all')  # all: 清空所有事件, selected: 清空选定事件
        selected_events = data.get('selected_events', [])  # 选定的事件内容
        
        success_count = 0
        failed_stories = []
        
        for story_filename in stories_to_clear:
            try:
                # 加载数据书
                story_data = load_story_file(story_filename)
                if not story_data:
                    failed_stories.append({'filename': story_filename, 'error': '无法加载文件'})
                    continue
                
                # 清理事件
                if '属性' in story_data and '事件' in story_data['属性']:
                    original_events = story_data['属性']['事件']
                    
                    if clear_type == 'all':
                        # 清空所有事件
                        if isinstance(original_events, dict):
                            story_data['属性']['事件'] = {}
                        else:
                            story_data['属性']['事件'] = []
                        logger.info(f"清空数据书 {story_filename} 的所有事件")
                    elif clear_type == 'selected' and selected_events:
                        # 清空选定的事件
                        if isinstance(original_events, list):
                            # 过滤掉选定的事件
                            remaining_events = [event for event in original_events if event not in selected_events]
                            story_data['属性']['事件'] = remaining_events
                            logger.info(f"清理数据书 {story_filename} 中的选定事件")
                        elif isinstance(original_events, dict):
                            # 处理字典形式的事件，删除值匹配的键值对
                            remaining_events = {}
                            for key, value in original_events.items():
                                if value not in selected_events:
                                    remaining_events[key] = value
                            story_data['属性']['事件'] = remaining_events
                            logger.info(f"清理数据书 {story_filename} 中的选定事件（字典格式）")
                        else:
                            # 如果事件是字符串且在选定列表中，则清空
                            if original_events in selected_events:
                                story_data['属性']['事件'] = []
                
                # 保存文件
                if save_story_file(story_filename, story_data):
                    success_count += 1
                else:
                    failed_stories.append({'filename': story_filename, 'error': '保存失败'})
                    
            except Exception as e:
                failed_stories.append({'filename': story_filename, 'error': str(e)})
                logger.error(f"清理数据书 {story_filename} 失败: {str(e)}")
        
        logger.info(f"事件清理完成，成功: {success_count}, 失败: {len(failed_stories)}")
        
        return jsonify({
            'success': True,
            'message': f'清理完成，成功处理 {success_count} 个数据书',
            'success_count': success_count,
            'failed_count': len(failed_stories),
            'failed_stories': failed_stories
        })
        
    except Exception as e:
        logger.error(f"清理事件失败: {str(e)}")
        return jsonify({'error': f'清理失败: {str(e)}'}), 500

@event_manager_bp.route('/api/event-manager/preview', methods=['POST'])
def preview_cleanup():
    """预览清理操作，不实际执行"""
    try:
        data = request.get_json()
        
        if not data or 'stories' not in data:
            return jsonify({'error': '请提供要预览的数据书列表'}), 400
        
        stories_to_preview = data['stories']
        clear_type = data.get('clear_type', 'all')
        selected_events = data.get('selected_events', [])
        
        preview_data = []
        
        for story_filename in stories_to_preview:
            story_data = load_story_file(story_filename)
            if story_data and '属性' in story_data and '事件' in story_data['属性']:
                original_events = story_data['属性']['事件']
                
                if clear_type == 'all':
                    if isinstance(original_events, list):
                        events_to_remove = original_events
                        remaining_events = []
                    elif isinstance(original_events, dict):
                        events_to_remove = list(original_events.values())
                        remaining_events = []
                    else:
                        events_to_remove = [original_events]
                        remaining_events = []
                elif clear_type == 'selected':
                    if isinstance(original_events, list):
                        events_to_remove = [event for event in original_events if event in selected_events]
                        remaining_events = [event for event in original_events if event not in selected_events]
                    elif isinstance(original_events, dict):
                        events_to_remove = [value for value in original_events.values() if value in selected_events]
                        remaining_events = [value for value in original_events.values() if value not in selected_events]
                    else:
                        events_to_remove = [original_events] if original_events in selected_events else []
                        remaining_events = [] if original_events in selected_events else [original_events]
                
                # 格式化显示的原始事件
                if isinstance(original_events, list):
                    display_original_events = original_events
                elif isinstance(original_events, dict):
                    display_original_events = list(original_events.values())
                else:
                    display_original_events = [original_events]
                
                preview_info = {
                    'filename': story_filename,
                    'name': story_filename.replace('.json', ''),
                    'original_events': display_original_events,
                    'events_to_remove': events_to_remove,
                    'remaining_events': remaining_events,
                    'will_be_cleared': len(events_to_remove) > 0
                }
                preview_data.append(preview_info)
        
        return jsonify({
            'success': True,
            'preview_data': preview_data
        })
        
    except Exception as e:
        logger.error(f"预览失败: {str(e)}")
        return jsonify({'error': f'预览失败: {str(e)}'}), 500

@event_manager_bp.route('/api/event-manager/edit', methods=['POST'])
def edit_event():
    """编辑数据书中的单个事件"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': '请提供编辑数据'}), 400
        
        filename = data.get('filename')
        event_index = data.get('event_index')
        new_event_text = data.get('new_event_text', '').strip()
        
        if not filename:
            return jsonify({'error': '请提供数据书文件名'}), 400
        
        if event_index is None:
            return jsonify({'error': '请提供事件索引'}), 400
        
        if not new_event_text:
            return jsonify({'error': '事件内容不能为空'}), 400
        
        # 加载数据书
        story_data = load_story_file(filename)
        if not story_data:
            return jsonify({'error': '无法加载数据书文件'}), 404
        
        # 检查事件是否存在
        if '属性' not in story_data or '事件' not in story_data['属性']:
            return jsonify({'error': '数据书中不存在事件数据'}), 404
        
        events = story_data['属性']['事件']
        
        if isinstance(events, list):
            if event_index < 0 or event_index >= len(events):
                return jsonify({'error': '事件索引超出范围'}), 400
            
            # 更新列表形式的事件
            old_event_text = events[event_index]
            events[event_index] = new_event_text
            
        elif isinstance(events, dict):
            # 处理字典形式的事件
            event_keys = list(events.keys())
            if event_index < 0 or event_index >= len(event_keys):
                return jsonify({'error': '事件索引超出范围'}), 400
            
            # 获取对应的键并更新值
            event_key = event_keys[event_index]
            old_event_text = events[event_key]
            events[event_key] = new_event_text
            
        else:
            # 如果事件不是列表或字典，转换为列表
            if event_index != 0:
                return jsonify({'error': '事件索引超出范围'}), 400
            
            old_event_text = events if events else ""
            events = [new_event_text]
            story_data['属性']['事件'] = events
        
        # 保存文件
        if save_story_file(filename, story_data):
            logger.info(f"成功编辑事件: {filename}[{event_index}] '{old_event_text}' -> '{new_event_text}'")
            return jsonify({
                'success': True,
                'message': '事件编辑成功',
                'old_event': old_event_text,
                'new_event': new_event_text
            })
        else:
            return jsonify({'error': '保存文件失败'}), 500
        
    except Exception as e:
        logger.error(f"编辑事件失败: {str(e)}")
        return jsonify({'error': f'编辑失败: {str(e)}'}), 500

@event_manager_bp.route('/api/event-manager/add', methods=['POST'])
def add_event():
    """向数据书添加新事件"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': '请提供添加数据'}), 400
        
        filename = data.get('filename')
        new_event_text = data.get('event_text', '').strip()
        
        if not filename:
            return jsonify({'error': '请提供数据书文件名'}), 400
        
        if not new_event_text:
            return jsonify({'error': '事件内容不能为空'}), 400
        
        # 加载数据书
        story_data = load_story_file(filename)
        if not story_data:
            return jsonify({'error': '无法加载数据书文件'}), 404
        
        # 确保事件数据结构存在
        if '属性' not in story_data:
            story_data['属性'] = {}
        
        if '事件' not in story_data['属性']:
            story_data['属性']['事件'] = []
        
        events = story_data['属性']['事件']
        
        if isinstance(events, list):
            # 添加到列表
            events.append(new_event_text)
        elif isinstance(events, dict):
            # 添加到字典，使用下一个可用的数字键
            next_key = str(len(events))
            while next_key in events:
                next_key = str(int(next_key) + 1)
            events[next_key] = new_event_text
        else:
            # 如果既不是列表也不是字典，转换为列表
            events = [events] if events else []
            events.append(new_event_text)
            story_data['属性']['事件'] = events
        
        # 保存文件
        if save_story_file(filename, story_data):
            # 计算事件总数
            event_count = len(events) if isinstance(events, (list, dict)) else 1
            
            logger.info(f"成功添加事件: {filename} + '{new_event_text}'")
            return jsonify({
                'success': True,
                'message': '事件添加成功',
                'new_event': new_event_text,
                'event_count': event_count
            })
        else:
            return jsonify({'error': '保存文件失败'}), 500
        
    except Exception as e:
        logger.error(f"添加事件失败: {str(e)}")
        return jsonify({'error': f'添加失败: {str(e)}'}), 500

@event_manager_bp.route('/api/event-manager/delete', methods=['POST'])
def delete_event():
    """删除数据书中的单个事件"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': '请提供删除数据'}), 400
        
        filename = data.get('filename')
        event_index = data.get('event_index')
        
        if not filename:
            return jsonify({'error': '请提供数据书文件名'}), 400
        
        if event_index is None:
            return jsonify({'error': '请提供事件索引'}), 400
        
        # 加载数据书
        story_data = load_story_file(filename)
        if not story_data:
            return jsonify({'error': '无法加载数据书文件'}), 404
        
        # 检查事件是否存在
        if '属性' not in story_data or '事件' not in story_data['属性']:
            return jsonify({'error': '数据书中不存在事件数据'}), 404
        
        events = story_data['属性']['事件']
        
        if isinstance(events, list):
            if event_index < 0 or event_index >= len(events):
                return jsonify({'error': '事件索引超出范围'}), 400
            
            # 删除列表中的事件
            deleted_event = events.pop(event_index)
            
        elif isinstance(events, dict):
            # 处理字典形式的事件
            event_keys = list(events.keys())
            if event_index < 0 or event_index >= len(event_keys):
                return jsonify({'error': '事件索引超出范围'}), 400
            
            # 获取对应的键并删除
            event_key = event_keys[event_index]
            deleted_event = events.pop(event_key)
            
        else:
            # 如果事件不是列表或字典
            if event_index != 0:
                return jsonify({'error': '事件索引超出范围'}), 400
            
            deleted_event = events if events else ""
            story_data['属性']['事件'] = []
        
        # 保存文件
        if save_story_file(filename, story_data):
            # 计算剩余事件总数
            event_count = len(events) if isinstance(events, (list, dict)) else 0
            
            logger.info(f"成功删除事件: {filename}[{event_index}] '{deleted_event}'")
            return jsonify({
                'success': True,
                'message': '事件删除成功',
                'deleted_event': deleted_event,
                'event_count': event_count
            })
        else:
            return jsonify({'error': '保存文件失败'}), 500
        
    except Exception as e:
        logger.error(f"删除事件失败: {str(e)}")
        return jsonify({'error': f'删除失败: {str(e)}'}), 500