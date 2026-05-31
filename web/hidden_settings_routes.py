"""
底层设定管理路由
提供基于关键词的隐藏设定管理功能，仅供开发者使用
"""

from flask import Blueprint, request, jsonify, render_template
from web.core.hidden_settings_manager import hidden_settings_manager

hidden_settings_bp = Blueprint('hidden_settings', __name__)


@hidden_settings_bp.route('/dev/hidden_settings')
def hidden_settings_page():
    """底层设定管理页面（开发者专用）"""
    return render_template('dev/hidden_settings.html')


@hidden_settings_bp.route('/api/dev/hidden_settings/entries')
def get_all_settings():
    """获取所有底层设定"""
    try:
        query = request.args.get('query', '')
        category = request.args.get('category', '')
        
        if query or category:
            settings = hidden_settings_manager.search_settings(query, category if category else None)
        else:
            settings = hidden_settings_manager.get_all_settings()
        
        return jsonify({
            'success': True,
            'data': settings
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@hidden_settings_bp.route('/api/dev/hidden_settings/categories')
def get_categories():
    """获取所有分类"""
    try:
        categories = hidden_settings_manager.get_categories()
        return jsonify({
            'success': True,
            'data': categories
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@hidden_settings_bp.route('/api/dev/hidden_settings/entries', methods=['POST'])
def create_setting():
    """创建新的底层设定"""
    try:
        data = request.json
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        content = data.get('content', '').strip()
        keywords = data.get('keywords', [])
        category = data.get('category', '系统').strip()
        priority = data.get('priority', 1)
        trigger_mode = data.get('trigger_mode', 'keyword')
        
        if not name:
            return jsonify({
                'success': False,
                'error': '设定名称不能为空'
            }), 400
        
        if not description:
            return jsonify({
                'success': False,
                'error': '设定描述不能为空'
            }), 400
        
        if not content:
            return jsonify({
                'success': False,
                'error': '设定内容不能为空'
            }), 400
        
        # 确保关键词是列表
        if isinstance(keywords, str):
            keywords = [k.strip() for k in keywords.split(',') if k.strip()]
        elif not isinstance(keywords, list):
            keywords = [name]
        
        # 如果没有提供关键词，使用名称作为关键词
        if not keywords:
            keywords = [name]
        
        success = hidden_settings_manager.create_setting(
            name=name,
            description=description,
            content=content,
            keywords=keywords,
            category=category,
            priority=priority,
            trigger_mode=trigger_mode
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': '底层设定创建成功'
            })
        else:
            return jsonify({
                'success': False,
                'error': '设定已存在或创建失败'
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@hidden_settings_bp.route('/api/dev/hidden_settings/entries/<setting_name>', methods=['PUT'])
def update_setting(setting_name):
    """更新底层设定"""
    try:
        data = request.json
        new_name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        content = data.get('content', '').strip()
        keywords = data.get('keywords', [])
        category = data.get('category', '系统').strip()
        priority = data.get('priority', 1)
        trigger_mode = data.get('trigger_mode', 'keyword')
        enabled = data.get('enabled', True)
        
        if not new_name:
            return jsonify({
                'success': False,
                'error': '设定名称不能为空'
            }), 400
        
        if not description:
            return jsonify({
                'success': False,
                'error': '设定描述不能为空'
            }), 400
        
        if not content:
            return jsonify({
                'success': False,
                'error': '设定内容不能为空'
            }), 400
        
        # 确保关键词是列表
        if isinstance(keywords, str):
            keywords = [k.strip() for k in keywords.split(',') if k.strip()]
        elif not isinstance(keywords, list):
            keywords = [new_name]
        
        if not keywords:
            keywords = [new_name]
        
        success = hidden_settings_manager.update_setting(
            old_name=setting_name,
            new_name=new_name,
            description=description,
            content=content,
            keywords=keywords,
            category=category,
            priority=priority,
            trigger_mode=trigger_mode,
            enabled=enabled
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': '底层设定更新成功'
            })
        else:
            return jsonify({
                'success': False,
                'error': '设定不存在或更新失败'
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@hidden_settings_bp.route('/api/dev/hidden_settings/entries/<setting_name>', methods=['DELETE'])
def delete_setting(setting_name):
    """删除底层设定"""
    try:
        success = hidden_settings_manager.delete_setting(setting_name)
        
        if success:
            return jsonify({
                'success': True,
                'message': '底层设定删除成功'
            })
        else:
            return jsonify({
                'success': False,
                'error': '设定不存在或删除失败'
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@hidden_settings_bp.route('/api/dev/hidden_settings/match', methods=['POST'])
def match_keywords():
    """匹配文本中的关键词"""
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({
                'success': False,
                'error': '文本不能为空'
            }), 400
        
        processed_text, match_info = hidden_settings_manager.process_text_with_hidden_settings(text)
        
        return jsonify({
            'success': True,
            'data': {
                'original_text': text,
                'processed_text': processed_text,
                'matched_settings': match_info['matched_settings'],
                'settings_context': match_info['settings_context'],
                'matched_count': match_info['matched_count']
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@hidden_settings_bp.route('/api/dev/hidden_settings/entries/<setting_name>')
def get_setting(setting_name):
    """获取单个底层设定详情"""
    try:
        setting = hidden_settings_manager.get_setting_by_name(setting_name)
        
        if setting:
            return jsonify({
                'success': True,
                'data': setting
            })
        else:
            return jsonify({
                'success': False,
                'error': '设定不存在'
            }), 404
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@hidden_settings_bp.route('/api/dev/hidden_settings/trigger_modes')
def get_trigger_modes():
    """获取所有触发模式选项"""
    try:
        trigger_modes = [
            {'value': 'keyword', 'label': '关键词触发', 'description': '当文本中包含指定关键词时触发'},
            {'value': 'always', 'label': '始终生效', 'description': '无论什么情况都会生效'},
            {'value': 'conditional', 'label': '条件触发', 'description': '根据特定条件触发（预留功能）'}
        ]
        
        return jsonify({
            'success': True,
            'data': trigger_modes
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
