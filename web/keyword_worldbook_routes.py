"""
关键词世界书管理路由
提供基于关键词的智能世界书管理功能
"""

from flask import Blueprint, request, jsonify, render_template
from web.core.keyword_world_book import keyword_worldbook

keyword_worldbook_bp = Blueprint('keyword_worldbook', __name__)


@keyword_worldbook_bp.route('/keyword_worldbook')
def keyword_worldbook_page():
    """关键词世界书管理页面"""
    return render_template('keyword_worldbook.html')


@keyword_worldbook_bp.route('/api/keyword_worldbook/entries')
def get_all_entries():
    """获取所有条目"""
    try:
        query = request.args.get('query', '')
        category = request.args.get('category', '')
        
        if query or category:
            entries = keyword_worldbook.search_entries(query, category if category else None)
        else:
            entries = keyword_worldbook.get_all_entries()
        
        return jsonify({
            'success': True,
            'data': entries
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@keyword_worldbook_bp.route('/api/keyword_worldbook/categories')
def get_categories():
    """获取所有分类"""
    try:
        categories = keyword_worldbook.get_categories()
        return jsonify({
            'success': True,
            'data': categories
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@keyword_worldbook_bp.route('/api/keyword_worldbook/entries', methods=['POST'])
def create_entry():
    """创建新条目"""
    try:
        data = request.json
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        keywords = data.get('keywords', [])
        category = data.get('category', '默认').strip()
        priority = data.get('priority', 1)
        trigger_mode = data.get('trigger_mode', 'keyword').strip()
        
        if not name:
            return jsonify({
                'success': False,
                'error': '条目名称不能为空'
            }), 400
        
        if not description:
            return jsonify({
                'success': False,
                'error': '条目描述不能为空'
            }), 400
        
        # 确保关键词是列表
        if isinstance(keywords, str):
            keywords = [k.strip() for k in keywords.split(',') if k.strip()]
        elif not isinstance(keywords, list):
            keywords = [name]
        
        # 如果没有提供关键词，使用名称作为关键词（仅在关键词模式下）
        if not keywords and trigger_mode == 'keyword':
            keywords = [name]
        elif trigger_mode == 'always':
            # 全局生效模式可以没有关键词
            keywords = keywords or []
        
        success = keyword_worldbook.create_entry(
            name=name,
            description=description,
            keywords=keywords,
            category=category,
            priority=priority,
            trigger_mode=trigger_mode
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': '条目创建成功'
            })
        else:
            return jsonify({
                'success': False,
                'error': '条目已存在或创建失败'
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@keyword_worldbook_bp.route('/api/keyword_worldbook/entries/<entry_name>', methods=['PUT'])
def update_entry(entry_name):
    """更新条目"""
    try:
        data = request.json
        new_name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        keywords = data.get('keywords', [])
        category = data.get('category', '默认').strip()
        priority = data.get('priority', 1)
        enabled = data.get('enabled', True)
        trigger_mode = data.get('trigger_mode', 'keyword').strip()
        
        if not new_name:
            return jsonify({
                'success': False,
                'error': '条目名称不能为空'
            }), 400
        
        if not description:
            return jsonify({
                'success': False,
                'error': '条目描述不能为空'
            }), 400
        
        # 确保关键词是列表
        if isinstance(keywords, str):
            keywords = [k.strip() for k in keywords.split(',') if k.strip()]
        elif not isinstance(keywords, list):
            keywords = [new_name]
        
        # 如果没有提供关键词，使用名称作为关键词（仅在关键词模式下）
        if not keywords and trigger_mode == 'keyword':
            keywords = [new_name]
        elif trigger_mode == 'always':
            # 全局生效模式可以没有关键词
            keywords = keywords or []
        
        success = keyword_worldbook.update_entry(
            old_name=entry_name,
            new_name=new_name,
            description=description,
            keywords=keywords,
            category=category,
            priority=priority,
            enabled=enabled,
            trigger_mode=trigger_mode
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': '条目更新成功'
            })
        else:
            return jsonify({
                'success': False,
                'error': '条目不存在或更新失败'
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@keyword_worldbook_bp.route('/api/keyword_worldbook/entries/<entry_name>', methods=['DELETE'])
def delete_entry(entry_name):
    """删除条目"""
    try:
        success = keyword_worldbook.delete_entry(entry_name)
        
        if success:
            return jsonify({
                'success': True,
                'message': '条目删除成功'
            })
        else:
            return jsonify({
                'success': False,
                'error': '条目不存在或删除失败'
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@keyword_worldbook_bp.route('/api/keyword_worldbook/match', methods=['POST'])
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
        
        processed_text, match_info = keyword_worldbook.process_text_with_worldbook(text)
        
        return jsonify({
            'success': True,
            'data': {
                'original_text': text,
                'processed_text': processed_text,
                'matched_entries': match_info['matched_entries'],
                'worldbook_context': match_info['worldbook_context'],
                'matched_count': match_info['matched_count']
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@keyword_worldbook_bp.route('/api/keyword_worldbook/entries/<entry_name>')
def get_entry(entry_name):
    """获取单个条目详情"""
    try:
        entry = keyword_worldbook.get_entry_by_name(entry_name)
        
        if entry:
            return jsonify({
                'success': True,
                'data': entry
            })
        else:
            return jsonify({
                'success': False,
                'error': '条目不存在'
            }), 404
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@keyword_worldbook_bp.route('/api/keyword_worldbook/batch/import', methods=['POST'])
def batch_import():
    """批量导入条目"""
    try:
        data = request.json
        entries = data.get('entries', {})
        mode = data.get('mode', 'skip')  # skip: 跳过已存在, overwrite: 覆盖已存在
        
        if not entries:
            return jsonify({
                'success': False,
                'error': '没有提供导入数据'
            }), 400
        
        success_count = 0
        fail_count = 0
        skipped_count = 0
        errors = []
        
        for entry_name, entry_data in entries.items():
            try:
                existing_entry = keyword_worldbook.get_entry_by_name(entry_name)
                
                if existing_entry and mode == 'skip':
                    skipped_count += 1
                    continue
                
                name = entry_data.get('名字', entry_name)
                description = entry_data.get('描述', '')
                keywords = entry_data.get('关键词', [entry_name])
                category = entry_data.get('分类', '默认')
                priority = entry_data.get('优先级', 2)
                enabled = entry_data.get('启用', True)
                trigger_mode = entry_data.get('触发模式', 'keyword')
                
                if existing_entry:
                    # 覆盖模式
                    result = keyword_worldbook.update_entry(
                        old_name=entry_name,
                        new_name=name,
                        description=description,
                        keywords=keywords,
                        category=category,
                        priority=priority,
                        enabled=enabled,
                        trigger_mode=trigger_mode
                    )
                else:
                    # 新建
                    result = keyword_worldbook.create_entry(
                        name=name,
                        description=description,
                        keywords=keywords,
                        category=category,
                        priority=priority,
                        trigger_mode=trigger_mode
                    )
                
                if result:
                    success_count += 1
                else:
                    fail_count += 1
                    errors.append(f"{entry_name}: 导入失败")
                    
            except Exception as e:
                fail_count += 1
                errors.append(f"{entry_name}: {str(e)}")
        
        return jsonify({
            'success': True,
            'data': {
                'success_count': success_count,
                'fail_count': fail_count,
                'skipped_count': skipped_count,
                'errors': errors
            },
            'message': f'导入完成: 成功{success_count}个, 跳过{skipped_count}个, 失败{fail_count}个'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@keyword_worldbook_bp.route('/api/keyword_worldbook/batch/export', methods=['POST'])
def batch_export():
    """批量导出条目"""
    try:
        data = request.json
        entry_names = data.get('entries', [])
        export_all = data.get('export_all', False)
        
        all_entries = keyword_worldbook.get_all_entries()
        
        if export_all:
            export_data = all_entries
        elif entry_names:
            export_data = {name: all_entries[name] for name in entry_names if name in all_entries}
        else:
            return jsonify({
                'success': False,
                'error': '没有指定要导出的条目'
            }), 400
        
        return jsonify({
            'success': True,
            'data': export_data,
            'count': len(export_data)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@keyword_worldbook_bp.route('/api/keyword_worldbook/batch/toggle', methods=['POST'])
def batch_toggle():
    """批量启用/禁用条目"""
    try:
        data = request.json
        entry_names = data.get('entries', [])
        enabled = data.get('enabled', True)
        
        if not entry_names:
            return jsonify({
                'success': False,
                'error': '没有指定要操作的条目'
            }), 400
        
        success_count = 0
        fail_count = 0
        errors = []
        
        for entry_name in entry_names:
            try:
                entry_data = keyword_worldbook.get_entry_by_name(entry_name)
                if not entry_data:
                    fail_count += 1
                    errors.append(f"{entry_name}: 条目不存在")
                    continue
                
                result = keyword_worldbook.update_entry(
                    old_name=entry_name,
                    new_name=entry_data.get('名字', entry_name),
                    description=entry_data.get('描述', ''),
                    keywords=entry_data.get('关键词', [entry_name]),
                    category=entry_data.get('分类', '默认'),
                    priority=entry_data.get('优先级', 2),
                    enabled=enabled,
                    trigger_mode=entry_data.get('触发模式', 'keyword')
                )
                
                if result:
                    success_count += 1
                else:
                    fail_count += 1
                    errors.append(f"{entry_name}: 操作失败")
                    
            except Exception as e:
                fail_count += 1
                errors.append(f"{entry_name}: {str(e)}")
        
        return jsonify({
            'success': True,
            'data': {
                'success_count': success_count,
                'fail_count': fail_count,
                'errors': errors
            },
            'message': f'操作完成: 成功{success_count}个, 失败{fail_count}个'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500