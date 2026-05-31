"""
API路由模块
包含角色、数据书、玩家、配置等各种API端点
"""
from flask import Blueprint, request, jsonify, send_from_directory
import json
import yaml
import datetime
from pathlib import Path
from web.config_loader import *
from web.history_manager import *
from web.utils import ConfigManager, DataManager, PathManager
from web.crud_operations import role_crud, storybook_crud, player_crud, global_worldbook_crud, create_crud_routes

# 导入数据书引用管理器
import sys
sys.path.append(str(Path(__file__).parent.parent))

# 导入酒馆角色卡AI导入器
from web.tavern_card_importer import process_tavern_card_upload
# from web.ai import StoryBookAgent  # 已迁移到新架构
from web.ai_new import GlobalModifier, CoreGenerator

api_bp = Blueprint('api', __name__)

def rename_role_files(old_name: str, new_name: str) -> bool:
    """重命名角色相关的所有文件"""
    try:
        roles_dir = PathManager.get_roles_dir()
        
        # 重命名YML文件
        old_yml = roles_dir / f"{old_name}.yml"
        new_yml = roles_dir / f"{new_name}.yml"
        
        if old_yml.exists():
            old_yml.rename(new_yml)
        
        # 重命名头像文件（支持多种格式）
        image_extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp']
        for ext in image_extensions:
            old_img = roles_dir / f"{old_name}.{ext}"
            new_img = roles_dir / f"{new_name}.{ext}"
            
            if old_img.exists():
                old_img.rename(new_img)
                break  # 只重命名找到的第一个头像文件
        
        return True
        
    except Exception as e:
        print(f"重命名角色文件失败: {e}")
        return False

# 角色管理页面路由（重定向到新版）
@api_bp.route('/role-manager')
def role_manager():
    """旧版角色管理页面（重定向到新版）"""
    from flask import redirect
    return redirect('/character-management')

@api_bp.route('/character-management')
def character_management():
    """新版角色管理中心"""
    from flask import render_template
    return render_template('character_management.html')

@api_bp.route('/test-export-import')
def test_export_import():
    """导出导入功能测试页面"""
    from flask import render_template
    return render_template('test_export_import.html')

@api_bp.route('/test-category')
def test_category():
    """角色类别测试页面"""
    from flask import send_from_directory
    import os
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return send_from_directory(project_root, 'test_category_log.html')

# 增强的删除功能，支持头像文件删除
def enhanced_delete_role(role_name):
    """增强的角色删除功能，包括头像文件"""
    try:
        print(f"尝试删除角色: {role_name}")
        
        if not role_crud.exists(role_name):
            return {'success': False, 'error': '角色不存在'}, 404
        
        # 删除角色数据文件
        if role_crud.delete(role_name):
            # 删除头像文件（如果存在）
            roles_dir = PathManager.get_roles_dir()
            deleted_files = [f"{role_name}.yml"]
            
            for ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
                avatar_file = roles_dir / f"{role_name}.{ext}"
                if avatar_file.exists():
                    avatar_file.unlink()
                    deleted_files.append(f"{role_name}.{ext}")
                    break
            
            # 从所有数据书中移除该角色的绑定关系
            cleanup_role_from_storybooks(role_name)
            
            print(f"成功删除文件: {deleted_files}")
            return {'success': True, 'deleted_files': deleted_files}, 200
        else:
            return {'success': False, 'error': '删除角色失败'}, 500
    except Exception as e:
        print(f"删除角色失败: {str(e)}")
        return {'success': False, 'error': str(e)}, 500

def update_storybook_bindings(role_name, bound_storybooks, is_rename=False, old_role_name=None):
    """
    更新数据书的捆绑角色字段（双向绑定，一对一约束）
    
    参数:
    role_name: 角色名称
    bound_storybooks: 绑定的数据书列表（一对一约束，最多只能有一个）
    is_rename: 是否为重命名操作
    old_role_name: 重命名前的角色名称
    """
    try:
        storybook_dir = PathManager.get_storybook_dir()
        if not storybook_dir.exists():
            return
        
        print(f"开始处理双向绑定（一对一约束）：角色 {role_name}，绑定数据书 {bound_storybooks}")
        
        # 一对一约束：确保bound_storybooks最多只有一个元素
        if len(bound_storybooks) > 1:
            print(f"⚠️ [一对一约束] 角色 {role_name} 尝试绑定多个数据书，只保留第一个: {bound_storybooks[0]}")
            bound_storybooks = [bound_storybooks[0]]
        
        # 先从所有数据书中移除该角色的绑定（不管是重命名还是重新绑定）
        for storybook_file in storybook_dir.glob("*.json"):
            try:
                with open(storybook_file, 'r', encoding='utf-8') as f:
                    storybook_data = json.load(f)
                
                changed = False
                # 如果是重命名操作，移除旧角色名
                if is_rename and old_role_name and "捆绑角色" in storybook_data and old_role_name in storybook_data["捆绑角色"]:
                    storybook_data["捆绑角色"].remove(old_role_name)
                    print(f"从数据书 {storybook_file.stem} 中移除旧角色名 {old_role_name}")
                    changed = True
                
                # 移除当前角色名（为了确保一对一约束）
                if "捆绑角色" in storybook_data and role_name in storybook_data["捆绑角色"]:
                    # 只有当这个数据书不在新的绑定列表中时才移除
                    if storybook_file.stem not in bound_storybooks:
                        storybook_data["捆绑角色"].remove(role_name)
                        print(f"从数据书 {storybook_file.stem} 中移除角色 {role_name}（一对一约束）")
                        changed = True
                
                if changed:
                    storybook_data["更新时间"] = datetime.datetime.now().isoformat()
                    with open(storybook_file, 'w', encoding='utf-8') as f:
                        json.dump(storybook_data, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"处理数据书 {storybook_file} 时出错: {e}")
                continue
        
        # 处理当前绑定的数据书（现在最多只有一个）
        for storybook_name in bound_storybooks:
            storybook_file = storybook_dir / f"{storybook_name}.json"
            if storybook_file.exists():
                try:
                    with open(storybook_file, 'r', encoding='utf-8') as f:
                        storybook_data = json.load(f)
                    
                    # 确保捆绑角色字段存在
                    if "捆绑角色" not in storybook_data:
                        storybook_data["捆绑角色"] = []
                    
                    # 添加角色名到绑定列表（如果不存在）
                    if role_name not in storybook_data["捆绑角色"]:
                        storybook_data["捆绑角色"].append(role_name)
                        storybook_data["更新时间"] = datetime.datetime.now().isoformat()
                        
                        with open(storybook_file, 'w', encoding='utf-8') as f:
                            json.dump(storybook_data, f, ensure_ascii=False, indent=2)
                        print(f"已将角色 {role_name} 添加到数据书 {storybook_name} 的绑定列表")
                    else:
                        print(f"角色 {role_name} 已存在于数据书 {storybook_name} 的绑定列表中")
                
                except Exception as e:
                    print(f"更新数据书 {storybook_name} 的绑定失败: {e}")
            else:
                print(f"数据书文件 {storybook_name}.json 不存在")
        
        # 移除当前角色不再绑定的数据书中的角色名
        for storybook_file in storybook_dir.glob("*.json"):
            storybook_name = storybook_file.stem
            if storybook_name not in bound_storybooks:
                try:
                    with open(storybook_file, 'r', encoding='utf-8') as f:
                        storybook_data = json.load(f)
                    
                    if "捆绑角色" in storybook_data and role_name in storybook_data["捆绑角色"]:
                        storybook_data["捆绑角色"].remove(role_name)
                        storybook_data["更新时间"] = datetime.datetime.now().isoformat()
                        
                        with open(storybook_file, 'w', encoding='utf-8') as f:
                            json.dump(storybook_data, f, ensure_ascii=False, indent=2)
                        print(f"从数据书 {storybook_name} 中移除角色 {role_name}")
                
                except Exception as e:
                    print(f"处理数据书 {storybook_file} 时出错: {e}")
                    continue
        
        print(f"角色 {role_name} 的双向绑定处理完成")
        
    except Exception as e:
        print(f"更新数据书绑定失败: {e}")

def cleanup_role_from_storybooks(role_name):
    """
    从所有数据书中移除指定角色的绑定关系
    
    参数:
    role_name: 要移除的角色名称
    """
    try:
        storybook_dir = PathManager.get_storybook_dir()
        if not storybook_dir.exists():
            return
        
        print(f"开始清理角色 {role_name} 的数据书绑定关系")
        
        # 遍历所有数据书文件
        for storybook_file in storybook_dir.glob("*.json"):
            try:
                with open(storybook_file, 'r', encoding='utf-8') as f:
                    storybook_data = json.load(f)
                
                # 检查并移除角色绑定
                if "捆绑角色" in storybook_data and role_name in storybook_data["捆绑角色"]:
                    storybook_data["捆绑角色"].remove(role_name)
                    storybook_data["更新时间"] = datetime.datetime.now().isoformat()
                    
                    with open(storybook_file, 'w', encoding='utf-8') as f:
                        json.dump(storybook_data, f, ensure_ascii=False, indent=2)
                    print(f"已从数据书 {storybook_file.stem} 中移除角色 {role_name}")
            
            except Exception as e:
                print(f"处理数据书 {storybook_file} 时出错: {e}")
                continue
        
        print(f"角色 {role_name} 的数据书绑定关系清理完成")
        
    except Exception as e:
        print(f"清理角色数据书绑定失败: {e}")

# 角色相关API
@api_bp.route('/roles')
def get_roles():
    roles = DataManager.get_available_roles()
    return jsonify(roles)

@api_bp.route('/api/roles')
def get_all_roles():
    """获取所有角色数据"""
    try:
        roles_data = role_crud.get_all()
        
        # 直接返回角色数据对象，前端期望这种格式
        return jsonify(roles_data)
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/roles', methods=['POST'])
def create_role():
    """创建新角色"""
    try:
        data = request.json
        print(f"🚀 [Backend] 创建角色请求数据: {data}")
        
        # 兼容前端发送的字段名称：支持 role_name 和 名字 两种字段
        role_name = data.get('role_name') or data.get('名字')
        
        if not role_name:
            print(f"❌ [Backend] 角色名称为空")
            return jsonify({'success': False, 'error': '角色名称不能为空'}), 400
        
        if role_crud.exists(role_name):
            print(f"❌ [Backend] 角色已存在: {role_name}")
            return jsonify({'success': False, 'error': '角色已存在'}), 400
        
        # 准备角色数据
        role_data = {}
        if '名字' in data:
            role_data['名字'] = data['名字']
        if '介绍' in data:
            role_data['介绍'] = data['介绍']
        if 'voice_id' in data:
            role_data['voice_id'] = data['voice_id']
        if 'tags' in data:
            role_data['tags'] = data['tags']
        if '绑定数据书' in data:
            role_data['绑定数据书'] = data['绑定数据书']
        if '自定义字段' in data:
            role_data['自定义字段'] = data['自定义字段']
        if '智能指令' in data:
            role_data['智能指令'] = data['智能指令']
        if '角色捆绑配置' in data:
            role_data['角色捆绑配置'] = data['角色捆绑配置']
        
        # 旁白角色特殊字段
        if '角色类别' in data:
            role_data['角色类别'] = data['角色类别']
            print(f"📝 [Backend] 设置角色类别: {data['角色类别']}")
        else:
            print(f"⚠️ [Backend] 请求数据中未找到角色类别字段")
            
        if '旁白自动提及' in data:
            role_data['旁白自动提及'] = data['旁白自动提及']
            print(f"📝 [Backend] 设置旁白自动提及: {data['旁白自动提及']}")
        
        print(f"💾 [Backend] 准备保存角色数据: {role_data}")
        
        if role_crud.create(role_name, role_data):
            print(f"✅ [Backend] 角色创建成功: {role_name}")
            
            # 处理双向绑定：更新数据书的捆绑角色字段
            if '绑定数据书' in data:
                update_storybook_bindings(role_name, data['绑定数据书'])
            
            return jsonify({'success': True})
        else:
            print(f"❌ [Backend] 角色创建失败: {role_name}")
            return jsonify({'success': False, 'error': '创建角色失败'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/roles/<path:role_name>', methods=['PUT'])
def update_role(role_name):
    """更新角色"""
    try:
        data = request.json
        print(f"🔄 [Backend] 更新角色请求 - 角色名: {role_name}")
        print(f"📦 [Backend] 更新数据: {data}")
        
        # 获取现有数据
        existing_data = role_crud.get_by_name(role_name) or {}
        print(f"📋 [Backend] 现有角色数据: {existing_data}")
        
        # 检查是否需要重命名文件
        new_name = data.get('名字')
        need_rename = new_name and new_name != role_name
        
        if need_rename:
            # 检查新名称是否已存在
            if role_crud.exists(new_name):
                return jsonify({'success': False, 'error': '角色名称已存在'}), 400
            
            # 重命名文件
            success = rename_role_files(role_name, new_name)
            if not success:
                return jsonify({'success': False, 'error': '重命名角色文件失败'}), 500
        
        # 更新相关字段
        if 'voice_id' in data:
            existing_data['voice_id'] = data['voice_id']
        if '名字' in data:
            existing_data['名字'] = data['名字']
        if '介绍' in data:
            existing_data['介绍'] = data['介绍']
        if 'tags' in data:
            existing_data['tags'] = data['tags']
        if '绑定数据书' in data:
            existing_data['绑定数据书'] = data['绑定数据书']
        if '自定义字段' in data:
            existing_data['自定义字段'] = data['自定义字段']
        if '智能指令' in data:
            existing_data['智能指令'] = data['智能指令']
        if '角色捆绑配置' in data:
            existing_data['角色捆绑配置'] = data['角色捆绑配置']
        
        # 旁白角色特殊字段
        if '角色类别' in data:
            old_category = existing_data.get('角色类别', '未设置')
            existing_data['角色类别'] = data['角色类别']
            print(f"📝 [Backend] 角色类别更新: {old_category} -> {data['角色类别']}")
        else:
            print(f"⚠️ [Backend] 更新数据中未找到角色类别字段")
            
        if '旁白自动提及' in data:
            existing_data['旁白自动提及'] = data['旁白自动提及']
            print(f"📝 [Backend] 旁白自动提及更新: {data['旁白自动提及']}")
        
        # 使用新的名称保存数据
        save_name = new_name if need_rename else role_name
        print(f"💾 [Backend] 准备保存更新后的角色数据到: {save_name}")
        print(f"📄 [Backend] 最终角色数据: {existing_data}")
        
        if role_crud.update(save_name, existing_data):
            print(f"✅ [Backend] 角色更新成功: {save_name}")
            # 如果重命名了，删除旧文件
            if need_rename:
                role_crud.delete(role_name)
            
            # 处理双向绑定：更新数据书的捆绑角色字段
            if '绑定数据书' in data:
                update_storybook_bindings(save_name, data['绑定数据书'], is_rename=need_rename, old_role_name=role_name if need_rename else None)
            
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': '更新角色失败'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/roles/<path:role_name>')
def get_role(role_name):
    """获取单个角色数据"""
    try:
        role_data = role_crud.get_by_name(role_name)
        if role_data is None:
            return jsonify({'success': False, 'error': '角色不存在'}), 404
        
        return jsonify(role_data)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/roles/<path:role_name>/avatar')
def get_role_avatar(role_name):
    """获取角色头像"""
    try:
        roles_dir = PathManager.get_roles_dir()
        
        # 查找头像文件
        for ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
            avatar_file = roles_dir / f"{role_name}.{ext}"
            if avatar_file.exists():
                return send_from_directory(roles_dir, f"{role_name}.{ext}")
        
        # 如果没有找到头像，返回默认头像
        return send_from_directory('static', 'images/default-avatar.svg')
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/roles/<path:role_name>/avatar', methods=['POST'])
def upload_role_avatar(role_name):
    """上传角色头像"""
    try:
        if 'avatar' not in request.files:
            return jsonify({'success': False, 'error': '没有头像文件'}), 400
        
        file = request.files['avatar']
        
        if file.filename == '':
            return jsonify({'success': False, 'error': '没有选择文件'}), 400
        
        # 检查文件类型
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        if not ('.' in file.filename and 
                file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return jsonify({'success': False, 'error': '不支持的文件类型'}), 400
        
        # 检查文件大小 (50MB限制)
        if request.content_length and request.content_length > 50 * 1024 * 1024:
            return jsonify({'success': False, 'error': '文件大小不能超过50MB'}), 400
        
        roles_dir = PathManager.get_roles_dir()
        roles_dir.mkdir(exist_ok=True)
        
        # 删除现有头像文件
        for ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
            old_file = roles_dir / f"{role_name}.{ext}"
            if old_file.exists():
                old_file.unlink()
        
        # 保存新头像文件
        file_ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{role_name}.{file_ext}"
        file_path = roles_dir / filename
        
        file.save(file_path)
        
        return jsonify({
            'success': True, 
            'message': '头像上传成功',
            'avatar_url': f'/api/roles/{role_name}/avatar'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/roles/<path:role_name>/clear-introduction', methods=['POST'])
def clear_role_introduction(role_name):
    """清空角色介绍字段"""
    try:
        print(f"🧹 [Backend] 清空角色介绍请求 - 角色名: {role_name}")
        
        # 获取现有角色数据
        existing_data = role_crud.get_by_name(role_name)
        if existing_data is None:
            return jsonify({'success': False, 'error': '角色不存在'}), 404
        
        # 记录原始介绍长度
        original_intro_length = len(existing_data.get('介绍', ''))
        print(f"📊 [Backend] 原始介绍长度: {original_intro_length}")
        
        # 清空介绍字段
        existing_data['介绍'] = ''
        
        # 保存修改后的数据
        success = role_crud.update(role_name, existing_data)
        if success:
            print(f"✅ [Backend] 角色 {role_name} 的介绍字段已清空")
            return jsonify({
                'success': True,
                'message': f'角色 {role_name} 的介绍字段已清空',
                'original_length': original_intro_length
            })
        else:
            print(f"❌ [Backend] 清空角色 {role_name} 介绍失败")
            return jsonify({'success': False, 'error': '清空介绍字段失败'}), 500
            
    except Exception as e:
        print(f"❌ [Backend] 清空角色介绍时出错: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# 删除角色路由已移至 delete_service.py

# 数据书相关API
@api_bp.route('/api/storybooks')
def get_all_storybooks():
    """获取所有数据书列表 - 为角色管理页面提供兼容接口"""
    try:
        storybooks_data = storybook_crud.get_all()
        
        # 转换为前端期望的格式
        storybooks_list = []
        for storybook_name, storybook_data in storybooks_data.items():
            storybook_info = {
                'name': storybook_name,
                'display_name': storybook_data.get('总结词', [storybook_name])[0] if storybook_data.get('总结词') else storybook_name,
                'summary': storybook_data.get('总结词', []),
                'keywords': storybook_data.get('关键词', []),
                'tags': storybook_data.get('标签', []),
                'description': storybook_data.get('描述', ''),
                'data': storybook_data
            }
            storybooks_list.append(storybook_info)
        
        return jsonify({
            'success': True,
            'storybooks': storybooks_list
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/stories')
def get_all_stories():
    stories_dir = PathManager.get_storybook_dir()
    stories_data = {}
    
    if stories_dir.exists():
        for json_file in stories_dir.glob("*.json"):
            story_name = json_file.stem
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    story_data = json.load(f)
                stories_data[story_name] = story_data
            except Exception as e:
                print(f"加载数据书 {story_name} 失败: {e}")
    
    return jsonify(stories_data)


@api_bp.route('/api/stories', methods=['POST'])
def create_story():
    try:
        data = request.json
        story_name = data.get('story_name')
        
        if not story_name:
            return jsonify({'success': False, 'error': '数据书名称不能为空'}), 400
        
        stories_dir = PathManager.get_storybook_dir()
        stories_dir.mkdir(exist_ok=True)
        
        # 检查数据书是否已存在
        json_file = stories_dir / f"{story_name}.json"
        
        if json_file.exists():
            return jsonify({'success': False, 'error': '数据书已存在'}), 400
        
        # 创建数据书文件 - 使用更通用的结构
        story_data = {
            '总结词': data.get('总结词', []),
            '关键词': data.get('关键词', []),
            '属性': data.get('属性', {}),
            '标签': data.get('标签', []),  # 新增标签字段
            '描述': data.get('描述', ''),  # 新增描述字段
            '捆绑角色': data.get('捆绑角色', []),  # 新增捆绑角色字段
            '捆绑玩家': data.get('捆绑玩家', []),  # 新增捆绑玩家字段
            '创建时间': datetime.datetime.now().isoformat(),
            '更新时间': datetime.datetime.now().isoformat()
        }
        
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(story_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/bind_story_to_role', methods=['POST'])
def bind_story_to_role():
    """将数据书绑定到角色，并可选择移除角色简介"""
    try:
        data = request.json
        story_name = data.get('story_name')
        role_name = data.get('role_name')
        remove_role_description = data.get('remove_role_description', False)
        
        # 添加调试日志
        print(f"🔗 [绑定请求] 数据书: {story_name}, 角色: {role_name}, 移除简介: {remove_role_description}")
        
        if not story_name or not role_name:
            return jsonify({'success': False, 'error': '数据书名称和角色名称不能为空'}), 400
        
        # 获取目录路径
        stories_dir = PathManager.get_storybook_dir()
        roles_dir = PathManager.get_roles_dir()
        
        # 检查数据书是否存在
        story_file = stories_dir / f"{story_name}.json"
        if not story_file.exists():
            return jsonify({'success': False, 'error': f'数据书 "{story_name}" 不存在'}), 404
        
        # 检查角色是否存在
        role_file = roles_dir / f"{role_name}.yml"
        if not role_file.exists():
            return jsonify({'success': False, 'error': f'角色 "{role_name}" 不存在'}), 404
        
        # 更新数据书，添加绑定角色
        with open(story_file, 'r', encoding='utf-8') as f:
            story_data = json.load(f)
        
        # 确保捆绑角色字段存在
        if '捆绑角色' not in story_data:
            story_data['捆绑角色'] = []
        
        print(f"🔗 [绑定前] 数据书当前绑定角色: {story_data.get('捆绑角色', [])}")
        
        # 添加角色到绑定列表（如果还未绑定）
        if role_name not in story_data['捆绑角色']:
            story_data['捆绑角色'].append(role_name)
            print(f"🔗 [绑定中] 添加角色 '{role_name}' 到绑定列表")
        else:
            print(f"🔗 [绑定跳过] 角色 '{role_name}' 已在绑定列表中")
        
        # 更新时间戳
        story_data['更新时间'] = datetime.datetime.now().isoformat()
        
        print(f"🔗 [绑定后] 数据书最终绑定角色: {story_data.get('捆绑角色', [])}")
        
        # 保存更新的数据书
        with open(story_file, 'w', encoding='utf-8') as f:
            json.dump(story_data, f, ensure_ascii=False, indent=2)
        
        print(f"🔗 [保存完成] 数据书 '{story_name}' 已更新")
        
        # 如果需要移除角色简介
        if remove_role_description:
            try:
                print(f"🔗 [角色清理] 开始处理角色文件: {role_file}")
                with open(role_file, 'r', encoding='utf-8') as f:
                    role_data = yaml.safe_load(f) or {}
                
                # 备份原始介绍信息
                original_intro = role_data.get('介绍', '')
                
                print(f"🔗 [角色清理] 原始介绍: '{original_intro}'")
                print(f"🔗 [角色清理] 原始介绍长度: {len(original_intro) if original_intro else 0}")
                
                # 移除或清空介绍信息（只有当介绍不为空时才清空）
                if '介绍' in role_data and original_intro and original_intro.strip():
                    role_data['介绍'] = ''
                    print(f"🔗 [角色清理] 已清空介绍字段")
                else:
                    print(f"🔗 [角色清理] 介绍字段已为空或不存在，跳过清理")
                
                # 添加数据书绑定记录 (一对一绑定约束)
                if '绑定数据书' not in role_data:
                    role_data['绑定数据书'] = []
                
                # 检查是否已有绑定的数据书
                if role_data['绑定数据书'] and story_name not in role_data['绑定数据书']:
                    # 解除之前的绑定
                    old_story = role_data['绑定数据书'][0]
                    print(f"🔗 [一对一约束] 角色已绑定数据书 '{old_story}'，将解除旧绑定")
                    
                    # 从旧数据书中移除角色绑定
                    try:
                        old_story_file = stories_dir / f"{old_story}.json"
                        if old_story_file.exists():
                            with open(old_story_file, 'r', encoding='utf-8') as f:
                                old_story_data = json.load(f)
                            
                            if '捆绑角色' in old_story_data and role_name in old_story_data['捆绑角色']:
                                old_story_data['捆绑角色'].remove(role_name)
                                old_story_data['更新时间'] = datetime.datetime.now().isoformat()
                                
                                with open(old_story_file, 'w', encoding='utf-8') as f:
                                    json.dump(old_story_data, f, ensure_ascii=False, indent=2)
                                print(f"🔗 [解除绑定] 已从数据书 '{old_story}' 中移除角色 '{role_name}'")
                    except Exception as e:
                        print(f"解除旧数据书绑定失败: {e}")
                    
                    # 清空绑定列表并设置新绑定
                    role_data['绑定数据书'] = [story_name]
                    print(f"🔗 [角色清理] 已替换数据书绑定: {old_story} -> {story_name}")
                elif story_name not in role_data['绑定数据书']:
                    # 没有之前的绑定，直接设置
                    role_data['绑定数据书'] = [story_name]
                    print(f"🔗 [角色清理] 已添加数据书绑定: {story_name}")
                else:
                    print(f"🔗 [角色清理] 数据书 '{story_name}' 已在绑定列表中")
                
                # 可选：添加数据书引用注释（只有当原本有介绍时才添加）
                if original_intro and original_intro.strip():
                    role_data['数据书引用'] = f"详细信息已转移至数据书: {story_name}"
                    print(f"🔗 [角色清理] 已添加数据书引用注释")
                else:
                    print(f"🔗 [角色清理] 原始介绍为空，跳过添加引用注释")
                
                # 保存更新的角色文件
                with open(role_file, 'w', encoding='utf-8') as f:
                    yaml.dump(role_data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
                
                print(f"🔗 [角色清理] 角色文件已更新保存")
                
                return jsonify({
                    'success': True,
                    'message': f'成功绑定数据书 "{story_name}" 与角色 "{role_name}"，并清理了角色简介信息',
                    'removed_description': bool(original_intro or original_opening)
                })
                
            except Exception as e:
                print(f"移除角色简介失败: {e}")
                return jsonify({
                    'success': True,
                    'message': f'成功绑定数据书 "{story_name}" 与角色 "{role_name}"，但清理角色简介时出现问题: {str(e)}',
                    'removed_description': False
                })
        else:
            # 在不清理介绍的情况下，也需要处理角色文件的数据书绑定 (一对一约束)
            try:
                print(f"🔗 [角色绑定] 开始处理角色文件: {role_file}")
                with open(role_file, 'r', encoding='utf-8') as f:
                    role_data = yaml.safe_load(f) or {}
                
                # 添加数据书绑定记录 (一对一绑定约束)
                if '绑定数据书' not in role_data:
                    role_data['绑定数据书'] = []
                
                # 检查是否已有绑定的数据书
                if role_data['绑定数据书'] and story_name not in role_data['绑定数据书']:
                    # 解除之前的绑定
                    old_story = role_data['绑定数据书'][0]
                    print(f"🔗 [一对一约束] 角色已绑定数据书 '{old_story}'，将解除旧绑定")
                    
                    # 从旧数据书中移除角色绑定
                    try:
                        old_story_file = stories_dir / f"{old_story}.json"
                        if old_story_file.exists():
                            with open(old_story_file, 'r', encoding='utf-8') as f:
                                old_story_data = json.load(f)
                            
                            if '捆绑角色' in old_story_data and role_name in old_story_data['捆绑角色']:
                                old_story_data['捆绑角色'].remove(role_name)
                                old_story_data['更新时间'] = datetime.datetime.now().isoformat()
                                
                                with open(old_story_file, 'w', encoding='utf-8') as f:
                                    json.dump(old_story_data, f, ensure_ascii=False, indent=2)
                                print(f"🔗 [解除绑定] 已从数据书 '{old_story}' 中移除角色 '{role_name}'")
                    except Exception as e:
                        print(f"解除旧数据书绑定失败: {e}")
                    
                    # 清空绑定列表并设置新绑定
                    role_data['绑定数据书'] = [story_name]
                    print(f"🔗 [角色绑定] 已替换数据书绑定: {old_story} -> {story_name}")
                elif story_name not in role_data['绑定数据书']:
                    # 没有之前的绑定，直接设置
                    role_data['绑定数据书'] = [story_name]
                    print(f"🔗 [角色绑定] 已添加数据书绑定: {story_name}")
                else:
                    print(f"🔗 [角色绑定] 数据书 '{story_name}' 已在绑定列表中")
                
                # 保存更新的角色文件
                with open(role_file, 'w', encoding='utf-8') as f:
                    yaml.dump(role_data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
                
                print(f"🔗 [角色绑定] 角色文件已更新保存")
                
            except Exception as e:
                print(f"更新角色绑定失败: {e}")
            
            return jsonify({
                'success': True,
                'message': f'成功绑定数据书 "{story_name}" 与角色 "{role_name}"',
                'removed_description': False
            })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/check_role_storybook_binding/<path:role_name>', methods=['GET'])
def check_role_storybook_binding(role_name):
    """检查角色当前的数据书绑定状态（使用自动绑定逻辑）"""
    try:
        roles_dir = PathManager.get_roles_dir()
        role_file = roles_dir / f"{role_name}.yml"
        
        if not role_file.exists():
            return jsonify({'success': False, 'error': f'角色 "{role_name}" 不存在'}), 404
        
        # 读取角色文件
        with open(role_file, 'r', encoding='utf-8') as f:
            role_data = yaml.safe_load(f) or {}
        
        # 使用自动绑定逻辑检查绑定状态
        try:
            import sys
            from pathlib import Path
            parent_dir = Path(__file__).parent.parent
            if str(parent_dir) not in sys.path:
                sys.path.insert(0, str(parent_dir))
            
            from auto_binding_utils import check_character_storybook_exists
            
            # 检查是否有同名数据书
            has_same_name = check_character_storybook_exists(role_name)
            
            if has_same_name:
                return jsonify({
                    'success': True,
                    'has_binding': True,
                    'bound_storybook': role_name,
                    'binding_type': 'auto',
                    'message': f'角色 "{role_name}" 通过自动绑定绑定同名数据书'
                })
            else:
                return jsonify({
                    'success': True,
                    'has_binding': False,
                    'bound_storybook': None,
                    'binding_type': 'none',
                    'message': f'角色 "{role_name}" 没有同名数据书，未绑定任何数据书'
                })
        except Exception as auto_error:
            print(f"自动绑定检查失败: {auto_error}")
            return jsonify({'success': False, 'error': f'检查绑定状态失败: {str(auto_error)}'}), 500
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/unbind_role_storybook', methods=['POST'])
def unbind_role_storybook():
    """解除角色与数据书的绑定关系"""
    try:
        data = request.json
        role_name = data.get('role_name')
        
        if not role_name:
            return jsonify({'success': False, 'error': '角色名称不能为空'}), 400
        
        roles_dir = PathManager.get_roles_dir()
        stories_dir = PathManager.get_storybook_dir()
        role_file = roles_dir / f"{role_name}.yml"
        
        if not role_file.exists():
            return jsonify({'success': False, 'error': f'角色 "{role_name}" 不存在'}), 404
        
        # 检查是否为自动绑定
        try:
            import sys
            from pathlib import Path
            parent_dir = Path(__file__).parent.parent
            if str(parent_dir) not in sys.path:
                sys.path.insert(0, str(parent_dir))
            
            from auto_binding_utils import check_character_storybook_exists
            
            # 如果是自动绑定，提示无需解绑
            if check_character_storybook_exists(role_name):
                return jsonify({
                    'success': True, 
                    'message': f'角色 "{role_name}" 使用自动同名绑定，无需手动解绑。要取消绑定请删除同名数据书文件。'
                })
            else:
                return jsonify({
                    'success': True, 
                    'message': f'角色 "{role_name}" 没有同名数据书，无绑定关系可解除。'
                })
        except Exception as auto_error:
            print(f"自动绑定检查失败: {auto_error}")
            return jsonify({'success': False, 'error': f'检查绑定状态失败: {str(auto_error)}'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/stories/<path:story_name>', methods=['PUT'])
def update_story(story_name):
    try:
        data = request.json
        print(f"📝 更新数据书: {story_name}")
        print(f"📋 接收到的数据: {data}")
        stories_dir = PathManager.get_storybook_dir()
        stories_dir.mkdir(exist_ok=True)
        
        # 更新数据书文件
        json_file = stories_dir / f"{story_name}.json"
        story_data = {}
        if json_file.exists():
            with open(json_file, 'r', encoding='utf-8') as f:
                story_data = json.load(f)
        
        # 更新数据 - 使用更通用的结构
        if '总结词' in data:
            story_data['总结词'] = data['总结词']
        if '关键词' in data:
            story_data['关键词'] = data['关键词']
        if '属性' in data:
            story_data['属性'] = data['属性']
        if '标签' in data:
            story_data['标签'] = data['标签']
        if '描述' in data:
            story_data['描述'] = data['描述']
        if '捆绑角色' in data:
            story_data['捆绑角色'] = data['捆绑角色']
        if '捆绑玩家' in data:
            story_data['捆绑玩家'] = data['捆绑玩家']
        
        # 更新时间戳
        story_data['更新时间'] = datetime.datetime.now().isoformat()
        
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(story_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# 删除数据书路由已移至 delete_service.py


# 数据书批量导入API
@api_bp.route('/api/stories/batch_import', methods=['POST'])
def batch_import_stories():
    """批量导入数据书"""
    try:
        data = request.json
        stories_data = data.get('stories', {})
        import_mode = data.get('import_mode', 'skip')  # skip, overwrite, rename
        
        if not stories_data:
            return jsonify({'success': False, 'error': '没有提供数据书数据'}), 400
        
        stories_dir = PathManager.get_storybook_dir()
        stories_dir.mkdir(exist_ok=True)
        
        results = {
            'total': 0,
            'success': 0,
            'skipped': 0,
            'errors': 0,
            'error_details': []
        }
        
        for story_name, story_data in stories_data.items():
            results['total'] += 1
            
            try:
                final_story_name = story_name
                json_file = stories_dir / f"{story_name}.json"
                
                # 检查是否存在同名数据书
                if json_file.exists():
                    if import_mode == 'skip':
                        results['skipped'] += 1
                        continue
                    elif import_mode == 'rename':
                        counter = 1
                        while (stories_dir / f"{story_name}_{counter}.json").exists():
                            counter += 1
                        final_story_name = f"{story_name}_{counter}"
                        json_file = stories_dir / f"{final_story_name}.json"
                
                # 准备数据书数据
                processed_story_data = {
                    '总结词': story_data.get('总结词', []),
                    '关键词': story_data.get('关键词', []),
                    '属性': story_data.get('属性', {}),
                    '标签': story_data.get('标签', []),
                    '描述': story_data.get('描述', ''),
                    '捆绑角色': story_data.get('捆绑角色', []),
                    '捆绑玩家': story_data.get('捆绑玩家', []),
                    '创建时间': story_data.get('创建时间', datetime.datetime.now().isoformat()),
                    '更新时间': datetime.datetime.now().isoformat()
                }
                
                
                with open(json_file, 'w', encoding='utf-8') as f:
                    json.dump(processed_story_data, f, ensure_ascii=False, indent=2)
                
                results['success'] += 1
                
            except Exception as e:
                results['errors'] += 1
                results['error_details'].append({
                    'story_name': story_name,
                    'error': str(e)
                })
        
        return jsonify({
            'success': True,
            'results': results
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# 玩家相关API
@api_bp.route('/api/current_player')
def get_current_player_info():
    """获取当前玩家信息"""
    try:
        players_dir = PathManager.get_players_dir()
        
        # 先读取当前挑选玩家的JSON文件
        selection_file = players_dir / "当前挑选玩家.json"
        if selection_file.exists():
            with open(selection_file, 'r', encoding='utf-8') as f:
                selection_data = json.load(f)
            selected_player = selection_data.get('selected_player')
            
            if selected_player:
                # 根据选择的玩家读取对应的yml文件
                player_file = players_dir / f"{selected_player}.yml"
                if player_file.exists():
                    with open(player_file, 'r', encoding='utf-8') as f:
                        player_data = yaml.safe_load(f) or {}
                    return jsonify({
                        'success': True,
                        'player': player_data,
                        'selected_player': selected_player,
                        'selection_info': selection_data
                    })
        
        # 回退：读取当前玩家.yml文件（兼容旧逻辑）
        current_player_file = players_dir / "当前玩家.yml"
        if current_player_file.exists():
            with open(current_player_file, 'r', encoding='utf-8') as f:
                player_data = yaml.safe_load(f) or {}
            return jsonify({
                'success': True,
                'player': player_data,
                'fallback_mode': True
            })
        else:
            return jsonify({
                'success': False,
                'error': '未找到当前玩家信息'
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@api_bp.route('/api/players')
def get_all_players():
    """获取所有玩家列表"""
    try:
        players_dir = PathManager.get_players_dir()
        players_list = []
        
        if players_dir.exists():
            for yml_file in players_dir.glob("*.yml"):
                # 跳过当前玩家.yml文件（兼容性文件）
                if yml_file.name == "当前玩家.yml":
                    continue
                    
                player_name = yml_file.stem
                try:
                    with open(yml_file, 'r', encoding='utf-8') as f:
                        player_data = yaml.safe_load(f)
                    
                    # 检查是否有头像文件
                    has_avatar = False
                    for ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
                        avatar_file = players_dir / f"{player_name}.{ext}"
                        if avatar_file.exists():
                            has_avatar = True
                            break
                    
                    # 构建玩家信息
                    player_info = {
                        'name': player_data.get('名字', player_name),
                        'file_name': player_name,
                        'avatar': has_avatar,
                        'description': player_data.get('介绍', ''),
                        'data': player_data
                    }
                    
                    players_list.append(player_info)
                    
                except Exception as e:
                    print(f"加载玩家 {player_name} 失败: {e}")
                    # 即使加载失败，也添加基本信息
                    players_list.append({
                        'name': player_name,
                        'file_name': player_name,
                        'avatar': False,
                        'description': '加载失败',
                        'data': {}
                    })
        
        return jsonify({
            'success': True,
            'players': players_list,
            'count': len(players_list)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api_bp.route('/api/players', methods=['POST'])
def create_player():
    try:
        data = request.json
        # 支持两种字段名：'名字' 和 'player_name'（向后兼容）
        player_name = data.get('名字') or data.get('player_name')
        
        if not player_name:
            return jsonify({'success': False, 'error': '玩家名称不能为空'}), 400
        
        players_dir = PathManager.get_players_dir()
        players_dir.mkdir(exist_ok=True)
        
        # 检查玩家是否已存在
        yml_file = players_dir / f"{player_name}.yml"
        
        if yml_file.exists():
            return jsonify({'success': False, 'error': '玩家已存在'}), 400
        
        # 创建玩家文件
        player_data = {
            '名字': player_name,
            '介绍': data.get('介绍', '新玩家，待编辑...')
        }
        
        # 添加语音ID（如果提供）
        if 'voice_id' in data and data['voice_id']:
            player_data['voice_id'] = data['voice_id']
        
        with open(yml_file, 'w', encoding='utf-8') as f:
            yaml.dump(player_data, f, allow_unicode=True, default_flow_style=False)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/players/<path:player_name>')
def get_player(player_name):
    """获取单个玩家数据"""
    try:
        players_dir = PathManager.get_players_dir()
        yml_file = players_dir / f"{player_name}.yml"
        
        if not yml_file.exists():
            return jsonify({'success': False, 'error': '玩家不存在'}), 404
        
        with open(yml_file, 'r', encoding='utf-8') as f:
            player_data = yaml.safe_load(f) or {}
        
        return jsonify(player_data)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/players/<path:player_name>', methods=['PUT'])
def update_player(player_name):
    try:
        data = request.json
        players_dir = PathManager.get_players_dir()
        players_dir.mkdir(exist_ok=True)
        
        # 更新玩家文件
        yml_file = players_dir / f"{player_name}.yml"
        player_data = {}
        if yml_file.exists():
            with open(yml_file, 'r', encoding='utf-8') as f:
                player_data = yaml.safe_load(f) or {}
        
        # 支持两种字段名：'名字' 和 'player_name'（向后兼容）
        if '名字' in data:
            player_data['名字'] = data['名字']
        elif 'player_name' in data:
            player_data['名字'] = data['player_name']
            
        if '介绍' in data:
            player_data['介绍'] = data['介绍']
        
        # 更新语音ID
        if 'voice_id' in data:
            if data['voice_id']:  # 如果提供了值
                player_data['voice_id'] = data['voice_id']
            elif 'voice_id' in player_data:  # 如果是空字符串，删除该字段
                del player_data['voice_id']
        
        with open(yml_file, 'w', encoding='utf-8') as f:
            yaml.dump(player_data, f, allow_unicode=True, default_flow_style=False)
        
        # 如果设置为当前玩家
        if data.get('set_as_current'):
            selection_file = players_dir / "当前挑选玩家.json"
            selection_data = {
                "selected_player": player_name,
                "selected_time": datetime.datetime.now().isoformat()
            }
            with open(selection_file, 'w', encoding='utf-8') as f:
                json.dump(selection_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/players/<path:player_name>', methods=['DELETE'])
def delete_player(player_name):
    """删除玩家"""
    try:
        players_dir = PathManager.get_players_dir()
        yml_file = players_dir / f"{player_name}.yml"
        
        if not yml_file.exists():
            return jsonify({'success': False, 'error': '玩家不存在'}), 404
        
# 允许删除任何玩家，包括当前选中的玩家
        
        # 删除玩家文件
        yml_file.unlink()
        
        # 删除头像文件（如果存在）
        for ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
            avatar_file = players_dir / f"{player_name}.{ext}"
            if avatar_file.exists():
                avatar_file.unlink()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/players/select', methods=['POST'])
def select_player():
    try:
        data = request.json
        player_name = data.get('player_name')
        
        if not player_name:
            return jsonify({'success': False, 'error': '玩家名称不能为空'}), 400
        
        players_dir = PathManager.get_players_dir()
        player_file = players_dir / f"{player_name}.yml"
        
        if not player_file.exists():
            return jsonify({'success': False, 'error': '玩家不存在'}), 404
        
        # 更新当前挑选玩家的JSON文件
        selection_file = players_dir / "当前挑选玩家.json"
        selection_data = {
            "selected_player": player_name,
            "selected_time": datetime.datetime.now().isoformat()
        }
        
        with open(selection_file, 'w', encoding='utf-8') as f:
            json.dump(selection_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'message': f'已选择玩家: {player_name}'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# 玩家头像相关API
@api_bp.route('/api/players/<path:player_name>/avatar')
def get_player_avatar(player_name):
    """获取玩家头像"""
    try:
        players_dir = PathManager.get_players_dir()
        
        # 查找头像文件
        for ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
            avatar_file = players_dir / f"{player_name}.{ext}"
            if avatar_file.exists():
                return send_from_directory(players_dir, f"{player_name}.{ext}")
        
        # 如果没有找到头像，返回默认头像
        return send_from_directory('static', 'images/default-avatar.svg')
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/players/<path:player_name>/avatar', methods=['POST'])
def upload_player_avatar(player_name):
    """上传玩家头像"""
    try:
        if 'avatar' not in request.files:
            return jsonify({'success': False, 'error': '没有头像文件'}), 400
        
        file = request.files['avatar']
        
        if file.filename == '':
            return jsonify({'success': False, 'error': '没有选择文件'}), 400
        
        # 检查文件类型
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        if not ('.' in file.filename and 
                file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return jsonify({'success': False, 'error': '不支持的文件类型'}), 400
        
        # 检查文件大小 (50MB限制)
        if request.content_length and request.content_length > 50 * 1024 * 1024:
            return jsonify({'success': False, 'error': '文件大小不能超过50MB'}), 400
        
        players_dir = PathManager.get_players_dir()
        players_dir.mkdir(exist_ok=True)
        
        # 删除现有头像文件
        for ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
            old_file = players_dir / f"{player_name}.{ext}"
            if old_file.exists():
                old_file.unlink()
        
        # 保存新头像文件
        file_ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{player_name}.{file_ext}"
        file_path = players_dir / filename
        
        file.save(file_path)
        
        return jsonify({
            'success': True, 
            'message': '头像上传成功',
            'avatar_url': f'/api/players/{player_name}/avatar'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/players/<path:player_name>/avatar', methods=['DELETE'])
def delete_player_avatar(player_name):
    """删除玩家头像"""
    try:
        players_dir = PathManager.get_players_dir()
        
        # 删除所有可能的头像文件
        deleted = False
        for ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
            avatar_file = players_dir / f"{player_name}.{ext}"
            if avatar_file.exists():
                avatar_file.unlink()
                deleted = True
        
        if deleted:
            return jsonify({
                'success': True,
                'message': '头像删除成功'
            })
        else:
            return jsonify({
                'success': False,
                'error': '没有找到头像文件'
            }), 404
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# 其他API
@api_bp.route('/api/upload-avatar', methods=['POST'])
def upload_avatar():
    try:
        if 'avatar' not in request.files:
            return jsonify({'success': False, 'error': '没有头像文件'}), 400
        
        file = request.files['avatar']
        name = request.form.get('name')  # 改为通用的 name 参数
        item_type = request.form.get('type', 'role')  # 新增类型参数，默认为角色
        
        if not file or not name:
            return jsonify({'success': False, 'error': '缺少必要参数'}), 400
        
        if file.filename == '':
            return jsonify({'success': False, 'error': '没有选择文件'}), 400
        
        # 检查文件类型
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        if not ('.' in file.filename and 
                file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return jsonify({'success': False, 'error': '不支持的文件类型'}), 400
        
        # 根据类型确定保存目录
        if item_type == 'player':
            target_dir = PathManager.get_players_dir()
        else:
            target_dir = PathManager.get_roles_dir()
        
        # 确保目录存在
        target_dir.mkdir(exist_ok=True)
        
        # 保存头像文件
        filename = f"{name}.png"
        file_path = target_dir / filename
        
        # 如果是其他格式，先保存为临时文件然后转换
        if file.filename.rsplit('.', 1)[1].lower() != 'png':
            # 这里简单起见，直接保存为原格式
            filename = f"{name}.{file.filename.rsplit('.', 1)[1].lower()}"
            file_path = target_dir / filename
        
        file.save(file_path)
        
        return jsonify({'success': True, 'filename': filename})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/global_worldbook')
def get_global_worldbook():
    try:
        worldbook_dir = PathManager.get_global_world_book_dir()
        worldbook_data = {}
        
        if worldbook_dir.exists():
            for yml_file in worldbook_dir.glob("*.yml"):
                entry_name = yml_file.stem
                try:
                    with open(yml_file, 'r', encoding='utf-8') as f:
                        entry_data = yaml.safe_load(f)
                    worldbook_data[entry_name] = entry_data
                except Exception as e:
                    print(f"加载世界书条目 {entry_name} 失败: {e}")
        
        return jsonify(worldbook_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/api/global_worldbook', methods=['POST'])
def create_global_worldbook_entry():
    try:
        data = request.json
        entry_name = data.get('entry_name')
        
        if not entry_name:
            return jsonify({'success': False, 'error': '条目名称不能为空'}), 400
        
        worldbook_dir = PathManager.get_global_world_book_dir()
        worldbook_dir.mkdir(exist_ok=True)
        
        # 检查条目是否已存在
        yml_file = worldbook_dir / f"{entry_name}.yml"
        
        if yml_file.exists():
            return jsonify({'success': False, 'error': '条目已存在'}), 400
        
        # 创建世界书条目文件
        entry_data = {
            '名字': entry_name,
            '介绍': data.get('介绍', '新条目，待编辑...')
        }
        
        with open(yml_file, 'w', encoding='utf-8') as f:
            yaml.dump(entry_data, f, allow_unicode=True, default_flow_style=False)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/api/global_worldbook/<path:entry_name>', methods=['PUT'])
def update_global_worldbook_entry(entry_name):
    try:
        data = request.json
        worldbook_dir = PathManager.get_global_world_book_dir()
        worldbook_dir.mkdir(exist_ok=True)
        
        # 更新世界书条目文件
        yml_file = worldbook_dir / f"{entry_name}.yml"
        entry_data = {}
        if yml_file.exists():
            with open(yml_file, 'r', encoding='utf-8') as f:
                entry_data = yaml.safe_load(f) or {}
        
        if '名字' in data:
            entry_data['名字'] = data['名字']
        if '介绍' in data:
            entry_data['介绍'] = data['介绍']
        
        with open(yml_file, 'w', encoding='utf-8') as f:
            yaml.dump(entry_data, f, allow_unicode=True, default_flow_style=False)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# 删除世界书条目路由已移至 delete_service.py

# 数据分析相关API已移除 - 临时数据分析功能不再需要



# 数据保存管理器相关API
@api_bp.route('/api/temp_data', methods=['POST'])
def get_temp_data_post():
    """获取角色临时数据（POST方法）"""
    try:
        data = request.json
        role_name = data.get('role_name')
        
        if not role_name:
            return jsonify({'success': False, 'error': '角色名称不能为空'}), 400
        
        from history_manager import get_story_temp_data
        temp_data = get_story_temp_data(role_name)
        
        return jsonify({
            'success': True,
            'temp_data': temp_data or {},
            'message': f'成功获取角色 {role_name} 的临时数据'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'获取临时数据失败: {str(e)}'
        }), 500


@api_bp.route('/api/clear_temp_data', methods=['POST'])
def clear_temp_data():
    """清除角色临时数据"""
    try:
        data = request.json
        role_name = data.get('role_name')
        
        if not role_name:
            return jsonify({'success': False, 'error': '角色名称不能为空'}), 400
        
        from history_manager import save_story_temp_data
        save_story_temp_data(role_name, {})
        
        return jsonify({
            'success': True,
            'message': f'已清除角色 {role_name} 的临时数据'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'清除临时数据失败: {str(e)}'
        }), 500


@api_bp.route('/api/get_all_summary_words', methods=['GET'])
def get_all_summary_words():
    """获取所有数据书的总结词"""
    try:
        import os
        import json
        from web.utils import PathManager
        
        storybook_dir = PathManager.get_storybook_dir()
        summary_words = {}
        
        if os.path.exists(storybook_dir):
            for filename in os.listdir(storybook_dir):
                if filename.endswith('.json'):
                    storybook_name = filename[:-5]  # 移除 .json 扩展名
                    filepath = os.path.join(storybook_dir, filename)
                    
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            
                        # 获取总结词
                        words = data.get('总结词', [])
                        if words and isinstance(words, list):
                            summary_words[storybook_name] = words
                            
                    except Exception as e:
                        print(f"读取数据书 {filename} 失败: {e}")
                        continue
        
        return jsonify({
            'success': True,
            'summary_words': summary_words,
            'message': f'成功获取 {len(summary_words)} 个数据书的总结词'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'获取总结词失败: {str(e)}'
        }), 500


# =============================================================================
# 酒馆角色卡AI导入功能
# =============================================================================

@api_bp.route('/api/import-tavern-card', methods=['POST'])
def import_tavern_card():
    """AI导入酒馆角色卡"""
    try:
        # 检查是否有上传的文件
        if 'image' not in request.files:
            return jsonify({
                'success': False,
                'error': '未找到上传的图片文件'
            }), 400
        
        file = request.files['image']
        
        # 检查文件是否为空
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': '未选择文件'
            }), 400
        
        # 检查文件类型
        if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            return jsonify({
                'success': False,
                'error': '只支持PNG、JPG、JPEG格式的图片文件'
            }), 400
        
        # 读取文件数据
        image_data = file.read()
        
        # 检查文件大小
        if len(image_data) > 50 * 1024 * 1024:  # 50MB限制
            return jsonify({
                'success': False,
                'error': '图片文件太大，请上传小于50MB的文件'
            }), 400
        
        # 获取是否自动翻译的参数，默认为False（不自动翻译）
        auto_translate = request.form.get('auto_translate', 'false').lower() == 'true'
        
        # 处理酒馆角色卡导入
        result = process_tavern_card_upload(image_data, file.filename, auto_translate)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': result['message'],
                'character_data': result['character_data']
            })
        else:
            return jsonify({
                'success': False,
                'error': result['message']
            }), 400
            
    except Exception as e:
        print(f"酒馆角色卡导入错误: {e}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'error': f'导入失败: {str(e)}'
        }), 500

# =============================================================================
# 游戏工具API
# =============================================================================

@api_bp.route('/api/send_dice_result', methods=['POST'])
def send_dice_result():
    """发送游戏结果到聊天（兼容旧API名称）"""
    return send_game_result()


@api_bp.route('/api/send_game_result', methods=['POST'])
def send_game_result():
    """发送游戏结果到聊天（统一转换为D100格式）"""
    try:
        data = request.json
        
        # 兼容旧格式 (直接消息)
        if 'message' in data and 'dice_type' in data:
            message = data.get('message', '')
            game_type = data.get('dice_type', 'd100')
            
            if not message:
                return jsonify({
                    'success': False,
                    'error': '消息不能为空'
                }), 400
                

            print(f"📝 消息: {message}")
            
        else:
            # 新格式：转换分数为D100
            game_type = data.get('game_type', 'd100')
            score_data = data.get('score_data', {})
            
            if not score_data:
                return jsonify({
                    'success': False,
                    'error': '分数数据不能为空'
                }), 400
            
            print(f"📊 分数数据: {score_data}")
            
            # 获取当前玩家信息
            try:
                players_dir = PathManager.get_players_dir()
                selection_file = players_dir / "当前挑选玩家.json"
                if selection_file.exists():
                    with open(selection_file, 'r', encoding='utf-8') as f:
                        selection_data = json.load(f)
                    player_name = selection_data.get('selected_player', '玩家')
                else:
                    player_name = '玩家'
            except:
                player_name = '玩家'
            
            # 使用游戏分数处理器转换为D100
            from web.game_Tools.game_score_processor import process_game_score
            
            result = process_game_score(game_type, player_name, score_data)
            
            if not result['success']:
                return jsonify({
                    'success': False,
                    'error': result.get('error', '处理游戏结果失败')
                }), 500
            
            message = result['chat_message']
            d100_result = result['d100_result']
            
            print(f"📝 转换后消息: {message}")
            print(f"🎲 D100结果: {d100_result}")
        
        # 获取当前角色信息
        try:
            # 优先从请求中获取角色（前端传递的当前选中角色）
            current_role = request.form.get('role') or request.json.get('role')
            
            if current_role and current_role != 'default':
                print(f"🎭 使用前端传递的角色: {current_role}")
            else:
                # 如果没有指定角色或者是默认角色，尝试获取系统第一个可用角色
                try:
                    from web.config_loader import get_available_roles
                    available_roles = get_available_roles()
                    if available_roles:
                        current_role = available_roles[0]
                        print(f"🎭 使用第一个可用角色: {current_role}")
                    else:
                        current_role = 'default'
                        print(f"⚠️ 没有可用角色，使用默认: {current_role}")
                except Exception as e:
                    current_role = 'default'
                    print(f"⚠️ 获取角色列表失败: {e}, 使用默认: {current_role}")
            
            print(f"🎭 最终使用的角色: {current_role}")
            
        except Exception as e:
            print(f"❌ 获取角色失败: {e}")
            current_role = 'default'
        
        try:
            print(f"🎯 模拟聊天气泡发送检定结果: {message}")
            
            # 构造模拟聊天请求，就像从气泡发送消息一样
            chat_request_data = {
                'message': message,  # 检定结果消息
                'role': current_role,
                'new_topic': False
            }
            
            print(f"📨 模拟聊天请求数据: {chat_request_data}")
            
            # 导入聊天处理函数
            from web.chat_routes import chat
            from flask import current_app
            
            # 在当前应用上下文中创建模拟请求上下文
            with current_app.test_request_context(
                path='/chat',
                method='POST',
                json=chat_request_data,
                headers={'Content-Type': 'application/json'}
            ):
                try:
                    # 调用聊天API，这会返回一个流式响应
                    chat_response = chat()
                    print(f"✅ 已模拟发送聊天消息")
                    print(f"🔄 聊天API响应类型: {type(chat_response)}")
                    
                    # 关键修复：消费流式响应以触发AI生成
                    if hasattr(chat_response, 'response'):
                        print(f"🤖 开始消费AI流式响应以触发生成...")
                        chunk_count = 0
                        ai_response_text = ""
                        
                        try:
                            # 迭代流式响应，让AI真正生成内容
                            for chunk in chat_response.response:
                                chunk_count += 1
                                if isinstance(chunk, bytes):
                                    chunk_data = chunk.decode('utf-8')
                                else:
                                    chunk_data = str(chunk)
                                
                                # 提取实际的AI响应内容
                                if chunk_data.startswith('data: ') and not chunk_data.startswith('data: ['):
                                    ai_content = chunk_data[6:].strip()  # 移除 'data: ' 前缀
                                    if ai_content and ai_content != '[DONE]':
                                        ai_response_text += ai_content
                                
                                # 每处理100个chunk显示一次进度
                                if chunk_count % 100 == 0:
                                    print(f"🔄 已处理 {chunk_count} 个响应块...")
                            
                            print(f"✅ AI流式响应处理完成！")
                            print(f"📊 总共处理了 {chunk_count} 个数据块")
                            print(f"📝 AI响应长度: {len(ai_response_text)} 字符")
                            if ai_response_text:
                                print(f"📄 AI响应预览: {ai_response_text[:100]}...")
                            
                        except Exception as stream_error:
                            print(f"⚠️ 流式响应处理出错: {stream_error}")
                            # 继续执行，不中断主流程
                    else:
                        print(f"⚠️ 响应对象没有response属性: {dir(chat_response)}")
                    
                except Exception as chat_error:
                    print(f"⚠️ 聊天API调用出错: {chat_error}")
                    # 即使聊天调用失败，也不抛出异常，继续执行
                
                return jsonify({
                    'success': True,
                    'message': '游戏结果已发送到聊天，AI正在回复',
                    'game_type': game_type,
                    'chat_message': message,
                    'trigger_ui_update': True,  # 通知前端更新界面
                    'auto_reply_triggered': True  # 标识已触发自动回复
                })
            
        except Exception as e:
            print(f"❌ 模拟聊天发送失败: {e}")
            import traceback
            traceback.print_exc()
            
            # 如果模拟聊天失败，回退到简单的消息保存
            try:
                from web.history_manager import load_history, save_history
                history = load_history(current_role)
                
                # 添加玩家的检定结果消息
                player_message = f"{player_name}: {message}"
                history.append(player_message)
                save_history(history, current_role)
                
                print(f"⚠️ 回退到简单消息保存: {player_message}")
                
                return jsonify({
                    'success': True,
                    'message': '游戏结果已发送到聊天（回退模式）',
                    'game_type': game_type,
                    'chat_message': message,
                    'trigger_ui_update': True
                })
                
            except Exception as save_error:
                print(f"❌ 回退保存也失败: {save_error}")
                return jsonify({
                    'success': False,
                    'error': '发送游戏结果失败'
                }), 500
        
        return jsonify({
            'success': True,
            'message': '游戏结果已发送到聊天',
            'game_type': game_type,
            'chat_message': message
        })
        
    except Exception as e:
        print(f"❌ 发送游戏结果失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/api/get_current_player', methods=['GET'])
def get_current_player():
    """获取当前玩家信息"""
    try:
        players_dir = PathManager.get_players_dir()
        selection_file = players_dir / "当前挑选玩家.json"
        if selection_file.exists():
            with open(selection_file, 'r', encoding='utf-8') as f:
                selection_data = json.load(f)
            player_name = selection_data.get('selected_player', '玩家')
        else:
            player_name = '玩家'
        
        return jsonify({
            'success': True,
            'player': {
                'name': player_name
            }
        })
        
    except Exception as e:
        print(f"❌ 获取当前玩家失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'player': {
                'name': '玩家'
            }
        }), 200  # 返回200状态码，避免前端报错


@api_bp.route('/api/test_game_api', methods=['POST'])
def test_game_api():
    """测试游戏API端点"""
    try:
        data = request.json or {}
        
        return jsonify({
            'success': True,
            'message': 'API测试成功',
            'received_data': data,
            'timestamp': __import__('datetime').datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ 测试API失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/api/ai-post-process-character', methods=['POST'])
def ai_post_process_character():
    """AI后处理角色数据"""
    try:
        data = request.json
        if not data:
            return jsonify({
                'success': False,
                'error': '未收到数据'
            }), 400
        
        character_name = data.get('character_name')
        instruction = data.get('instruction')
        character_data = data.get('character_data')
        
        if not character_name:
            return jsonify({
                'success': False,
                'error': '角色名称不能为空'
            }), 400
        
        if not instruction:
            return jsonify({
                'success': False,
                'error': 'AI处理指令不能为空'
            }), 400
        
        # 导入AI处理模块
        try:
            from web.tavern_card_importer import ai_post_process_character_data
            
            # 调用AI后处理功能
            result = ai_post_process_character_data(character_name, instruction, character_data)
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'message': result['message'],
                    'processed_data': result.get('processed_data')
                })
            else:
                return jsonify({
                    'success': False,
                    'error': result['message']
                }), 400
                
        except ImportError as ie:
            print(f"AI后处理模块导入失败: {ie}")
            return jsonify({
                'success': False,
                'error': 'AI后处理功能暂时不可用'
            }), 500
            
    except Exception as e:
        print(f"AI后处理错误: {e}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'error': f'AI后处理失败: {str(e)}'
        }), 500

@api_bp.route('/api/organize_stories_with_agent', methods=['POST'])
def organize_stories_with_agent():
    """使用智能指令组织整理数据书"""
    try:
        data = request.json
        instruction = data.get('instruction')
        role_name = data.get('role_name')
        chat_history = data.get('chat_history', [])
        
        if not instruction:
            return jsonify({
                'success': False,
                'error': '指令内容不能为空'
            }), 400
        
        if not role_name:
            return jsonify({
                'success': False,
                'error': '角色名称不能为空'
            }), 400
        
        # 使用新架构的全局修改器
        modifier = GlobalModifier()
        
        # 构建包含聊天记录的完整指令
        if chat_history:
            # 将聊天记录转换为文本格式
            chat_text = "\n".join([f"{msg.get('sender', 'Unknown')}: {msg.get('content', '')}" 
                                 for msg in chat_history if msg.get('content')])
            
            full_instruction = f"{instruction}\n\n最新聊天记录：\n{chat_text}"
        else:
            full_instruction = instruction
        
        # 执行智能整理 - 使用新架构
        result = modifier.modify_storybooks_directly(
            modification_instruction=full_instruction,
            target_stories=None,  # 让AI自动选择
            is_silent=False
        )
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': result['message'],
                'data': result['data']
            })
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 400
            
    except Exception as e:
        print(f"智能指令执行错误: {e}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'error': f'智能指令执行失败: {str(e)}'
        }), 500

@api_bp.route('/api/execute_command_group', methods=['POST'])
def execute_command_group():
    """执行智能指令组 - 依次执行组内的所有指令"""
    try:
        data = request.json
        role_name = data.get('role_name')
        group_name = data.get('group_name')
        commands = data.get('commands', [])
        chat_history = data.get('chat_history', [])
        
        if not role_name:
            return jsonify({
                'success': False,
                'error': '角色名称不能为空'
            }), 400
            
        if not group_name:
            return jsonify({
                'success': False,
                'error': '指令组名称不能为空'
            }), 400
            
        if not commands:
            return jsonify({
                'success': False,
                'error': '指令组中没有指令'
            }), 400
        
        print(f"🎯 开始执行指令组 '{group_name}'，共 {len(commands)} 个指令")
        
        # 使用新架构的全局修改器
        modifier = GlobalModifier()
        
        # 将聊天记录转换为文本格式（如果有的话）
        chat_text = ""
        if chat_history:
            chat_text = "\n".join([f"{msg.get('sender', 'Unknown')}: {msg.get('content', '')}" 
                                 for msg in chat_history if msg.get('content')])
        
        results = []
        total_executed = 0
        total_success = 0
        
        # 依次执行每个指令
        for index, command in enumerate(commands):
            command_name = command.get('名称', f'指令{index + 1}')
            command_content = command.get('内容', '')
            
            if not command_content:
                print(f"⚠️ 跳过空指令: {command_name}")
                results.append({
                    'success': False,
                    'command_name': command_name,
                    'error': '指令内容为空',
                    'index': index
                })
                continue
            
            print(f"🔄 执行指令 {index + 1}/{len(commands)}: {command_name}")
            
            try:
                # 构建包含聊天记录的完整指令
                if chat_text:
                    full_instruction = f"{command_content}\n\n最新聊天记录：\n{chat_text}"
                else:
                    full_instruction = command_content
                
                # 执行单个指令 - 使用新架构
                result = modifier.modify_storybooks_directly(
                    modification_instruction=full_instruction,
                    target_stories=None,  # 让AI自动选择
                    is_silent=False
                )
                
                if result['success']:
                    total_success += 1
                    print(f"✅ 指令 {command_name} 执行成功")
                    results.append({
                        'success': True,
                        'command_name': command_name,
                        'message': result.get('message', '执行成功'),
                        'data': result.get('data', {}),
                        'index': index
                    })
                else:
                    print(f"❌ 指令 {command_name} 执行失败: {result.get('error', '未知错误')}")
                    results.append({
                        'success': False,
                        'command_name': command_name,
                        'error': result.get('error', '执行失败'),
                        'index': index
                    })
                
                total_executed += 1
                
            except Exception as e:
                print(f"❌ 指令 {command_name} 执行异常: {e}")
                results.append({
                    'success': False,
                    'command_name': command_name,
                    'error': f'执行异常: {str(e)}',
                    'index': index
                })
        
        # 构建返回结果
        success_rate = total_success / total_executed if total_executed > 0 else 0
        
        return jsonify({
            'success': True,
            'message': f'指令组 "{group_name}" 执行完成，成功率: {total_success}/{total_executed} ({success_rate:.1%})',
            'data': {
                'group_name': group_name,
                'total_commands': len(commands),
                'executed_count': total_executed,
                'success_count': total_success,
                'success_rate': success_rate,
                'results': results
            }
        })
        
    except Exception as e:
        print(f"指令组执行错误: {e}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'error': f'指令组执行失败: {str(e)}'
        }), 500




@api_bp.route('/api/extract-text-from-image', methods=['POST'])
def extract_text_from_image():
    """从图片中提取文本描述"""
    try:
        # 检查是否有上传的文件
        if 'image' not in request.files:
            return jsonify({
                'success': False,
                'error': '未找到上传的图片文件'
            }), 400
        
        file = request.files['image']
        
        # 检查文件是否为空
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': '未选择文件'
            }), 400
        
        # 检查文件类型
        if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            return jsonify({
                'success': False,
                'error': '只支持PNG、JPG、JPEG格式的图片文件'
            }), 400
        
        # 读取文件数据
        image_data = file.read()
        
        # 检查文件大小
        if len(image_data) > 50 * 1024 * 1024:  # 50MB限制
            return jsonify({
                'success': False,
                'error': '图片文件太大，请上传小于50MB的文件'
            }), 400
        
        # 调用文本提取功能
        result = _extract_text_from_image_data(image_data, file.filename)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"图片文本提取失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'图片文本提取失败: {str(e)}'
        }), 500


def _extract_text_from_image_data(image_data: bytes, filename: str) -> dict:
    """从图片数据中提取文本"""
    try:
        from web.ai_new import call_ai_model
        import base64
        
        print(f"🖼️ 开始从图片 '{filename}' 提取文本")
        print(f"📊 图片大小: {len(image_data)} bytes")
        
        # 将图片转换为base64编码
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        # 构建AI提示词进行OCR和文本提取
        system_prompt = """你是一个专业的图片文字识别和角色描述提取助手。请仔细分析上传的图片，提取其中的所有文本内容，特别关注角色相关的描述信息。

请按以下要求处理：

1. 识别图片中的所有文字内容
2. 如果图片包含角色描述、人物设定、故事背景等信息，请完整提取
3. 保持原文的格式和结构
4. 如果有多段文本，请按逻辑顺序组织
5. 忽略无关的装饰性文字或水印

请直接返回提取到的文本内容，不要添加任何解释或标记。如果图片中没有可识别的文字，请返回"未能识别到文字内容"。"""
        
        # 尝试多个视觉模型进行图片文本识别
        vision_models = ["vision"]  # 可以在此添加更多备用模型
        last_error = None
        
        for i, model_function in enumerate(vision_models):
            try:
                print(f"🤖 正在调用AI模型进行图片文本识别... (尝试 {i+1}/{len(vision_models)})")
                ai_result = call_ai_model(
                    system_prompt, 
                    model_function,  # 使用视觉模型
                    temperature=0.1,  # 低温度确保准确性
                    image_data=image_base64  # 传递图片数据
                )
                
                if ai_result.get('success'):
                    # 成功则立即返回结果
                    break
                else:
                    last_error = ai_result.get("error", "未知错误")
                    print(f"❌ 模型 {model_function} 调用失败: {last_error}")
                    
            except Exception as e:
                last_error = str(e)
                print(f"❌ 模型 {model_function} 调用异常: {last_error}")
                continue
        else:
            # 所有模型都失败了
            error_msg = last_error or "所有视觉模型调用失败"
            
            # 检查是否是模型不支持视觉的错误
            if "not a VLM" in error_msg or "Vision Language Model" in error_msg or "404" in error_msg:
                return {
                    'success': False,
                    'error': '当前配置的AI模型不支持图片识别功能。请在系统设置中配置支持视觉的模型（如Qwen2-VL）或手动输入文本内容。',
                    'error_type': 'model_not_supported'
                }
            
            return {
                'success': False,
                'error': f'AI文本识别失败: {error_msg}'
            }
        
        if not ai_result.get('success'):
            error_msg = ai_result.get("error", "未知错误")
            return {
                'success': False,
                'error': f'AI文本识别失败: {error_msg}'
            }
        
        extracted_text = ai_result.get('content', '').strip()
        if not extracted_text or extracted_text == "未能识别到文字内容":
            return {
                'success': False,
                'error': '图片中未识别到有效的文本内容'
            }
        
        print(f"✅ 成功提取文本，长度: {len(extracted_text)} 字符")
        print(f"📝 提取内容预览: {extracted_text[:100]}...")
        
        return {
            'success': True,
            'extracted_text': extracted_text,
            'image_filename': filename,
            'image_size': len(image_data),
            'text_length': len(extracted_text)
        }
        
    except Exception as e:
        print(f"❌ 图片文本提取过程异常: {e}")
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'error': f'图片文本提取失败: {str(e)}'
        }

@api_bp.route('/api/config', methods=['GET'])
def get_config():
    """获取完整配置信息"""
    try:
        config = ConfigManager.load_config()
        return jsonify(config)
    except Exception as e:
        print(f"获取配置失败: {e}")
        return jsonify({'error': '获取配置失败'}), 500

@api_bp.route('/api/config/voice_settings', methods=['GET'])
def get_voice_settings():
    """获取语音设置"""
    try:
        config = ConfigManager.load_config()
        voice_settings = config.get('voice_settings', {})
        return jsonify(voice_settings)
    except Exception as e:
        print(f"❌ 获取语音设置失败: {e}")
        return jsonify({'error': '获取语音设置失败'}), 500

@api_bp.route('/api/config/voice_settings', methods=['PUT'])
def update_voice_settings():
    """更新语音设置"""
    try:
        if not request.json:
            return jsonify({'error': '无效的请求数据'}), 400
            
        config = ConfigManager.load_config()
        voice_settings = config.get('voice_settings', {})
        
        # 更新语音设置
        voice_settings.update(request.json)
        config['voice_settings'] = voice_settings
        
        # 保存配置
        ConfigManager.save_config(config)
        
        return jsonify({'success': True, 'voice_settings': voice_settings})
    except Exception as e:
        print(f"❌ 更新语音设置失败: {e}")
        return jsonify({'error': '更新语音设置失败'}), 500

@api_bp.route('/api/ai_analyze_chat_history', methods=['POST'])
def ai_analyze_chat_history():
    """AI智能分析聊天记录并更新数据书"""
    try:
        data = request.json
        role_name = data.get('role_name')
        chat_history = data.get('chat_history', [])
        analyze_all = data.get('analyze_all', False)
        trigger_message = data.get('trigger_message', '')
        trigger_index = data.get('trigger_index', -1)
        
        if not role_name:
            return jsonify({
                'success': False,
                'error': '角色名称不能为空'
            }), 400
        
        if not chat_history:
            return jsonify({
                'success': False,
                'error': '聊天记录为空，无法进行分析'
            }), 400
        
        print(f"🧠 开始AI智能分析聊天记录 - 角色: {role_name}, 记录数: {len(chat_history)}")
        
        # 使用新架构的全局修改器进行聊天记录分析
        from web.ai_new import GlobalModifier
        
        modifier = GlobalModifier()
        
        # 构建分析指令
        if analyze_all:
            instruction = f"""请分析角色 {role_name} 的完整聊天记录，提取重要信息并更新相关数据书。
            
重点关注：
1. 角色性格特征和行为模式
2. 重要的故事情节和事件
3. 角色关系和互动
4. 新出现的物品、地点、概念
5. 角色能力和技能的展现

请根据分析结果，智能地更新绑定的数据书内容。"""
        else:
            instruction = f"""请分析角色 {role_name} 最新的聊天内容，特别是触发消息："{trigger_message}"
            
基于这次对话的内容，提取新的信息并更新相关数据书：
1. 新的角色特征或行为
2. 重要的故事发展
3. 新的物品、地点或概念
4. 角色状态的变化

请智能地更新绑定的数据书，确保信息的准确性和一致性。"""
        
        # 将聊天记录转换为文本格式
        chat_text = ""
        for i, msg in enumerate(chat_history):
            if isinstance(msg, dict):
                sender = msg.get('sender', 'Unknown')
                content = msg.get('content', '')
                timestamp = msg.get('timestamp', '')
            else:
                # 兼容字符串格式的聊天记录
                content = str(msg)
                sender = 'Unknown'
                timestamp = ''
            
            if content.strip():
                chat_text += f"[{i+1}] {sender}: {content}\n"
        
        full_instruction = f"{instruction}\n\n聊天记录：\n{chat_text}"
        
        # 执行AI分析 - 使用新架构
        result = modifier.modify_storybooks_directly(
            modification_instruction=full_instruction,
            target_stories=None,  # 让AI自动选择相关的数据书
            is_silent=False
        )
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': result.get('message', 'AI智能分析完成'),
                'data': result.get('data', {}),
                'updated': True,
                'executed_count': result.get('data', {}).get('executed_count', 0)
            })
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'AI分析失败')
            }), 500
            
    except Exception as e:
        print(f"❌ AI智能分析失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'AI分析过程中发生错误: {str(e)}'
        }), 500


# ========== 数据书管理相关API ==========

@api_bp.route('/api/storybook/<storybook_name>', methods=['GET'])
def get_storybook_content(storybook_name):
    """获取数据书内容"""
    try:
        storybooks_dir = PathManager.get_storybook_dir()
        storybook_file = storybooks_dir / f"{storybook_name}.json"
        
        if not storybook_file.exists():
            return jsonify({'success': False, 'error': f'数据书 "{storybook_name}" 不存在'}), 404
        
        with open(storybook_file, 'r', encoding='utf-8') as f:
            storybook_data = json.load(f)
        
        return jsonify({
            'success': True,
            'data': storybook_data
        })
        
    except Exception as e:
        print(f"获取数据书内容失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/api/storybook/save', methods=['POST'])
def save_storybook():
    """保存数据书并绑定到角色"""
    try:
        data = request.json
        storybook_name = data.get('name')
        storybook_data = data.get('data')
        bind_to_role = data.get('bind_to_role')
        
        if not storybook_name or not storybook_data:
            return jsonify({'success': False, 'error': '数据书名称和内容不能为空'}), 400
        
        storybooks_dir = PathManager.get_storybook_dir()
        storybook_file = storybooks_dir / f"{storybook_name}.json"
        
        # 确保数据书包含必要的元数据
        if not isinstance(storybook_data, dict):
            storybook_data = {}
        
        # 添加元数据
        storybook_data['更新时间'] = datetime.datetime.now().isoformat()
        storybook_data['创建时间'] = storybook_data.get('创建时间', datetime.datetime.now().isoformat())
        
        # 如果需要绑定到角色，设置绑定信息
        if bind_to_role:
            if '捆绑角色' not in storybook_data:
                storybook_data['捆绑角色'] = []
            if bind_to_role not in storybook_data['捆绑角色']:
                storybook_data['捆绑角色'] = [bind_to_role]  # 一对一约束
        
        # 保存数据书文件
        with open(storybook_file, 'w', encoding='utf-8') as f:
            json.dump(storybook_data, f, ensure_ascii=False, indent=2)
        
        # 如果指定了角色绑定，更新角色文件
        if bind_to_role:
            roles_dir = PathManager.get_roles_dir()
            role_file = roles_dir / f"{bind_to_role}.yml"
            
            if role_file.exists():
                with open(role_file, 'r', encoding='utf-8') as f:
                    role_data = yaml.safe_load(f) or {}
                
                # 更新角色的绑定数据书字段
                if '绑定数据书' not in role_data:
                    role_data['绑定数据书'] = []
                
                # 一对一约束：先清除旧绑定
                if role_data['绑定数据书'] and storybook_name not in role_data['绑定数据书']:
                    # 解除之前的绑定
                    old_storybook = role_data['绑定数据书'][0]
                    try:
                        old_storybook_file = storybooks_dir / f"{old_storybook}.json"
                        if old_storybook_file.exists():
                            with open(old_storybook_file, 'r', encoding='utf-8') as f:
                                old_data = json.load(f)
                            if '捆绑角色' in old_data and bind_to_role in old_data['捆绑角色']:
                                old_data['捆绑角色'].remove(bind_to_role)
                                old_data['更新时间'] = datetime.datetime.now().isoformat()
                                with open(old_storybook_file, 'w', encoding='utf-8') as f:
                                    json.dump(old_data, f, ensure_ascii=False, indent=2)
                    except Exception as e:
                        print(f"解除旧绑定失败: {e}")
                
                # 设置新绑定
                role_data['绑定数据书'] = [storybook_name]
                
                with open(role_file, 'w', encoding='utf-8') as f:
                    yaml.dump(role_data, f, allow_unicode=True, default_flow_style=False)
        
        return jsonify({
            'success': True,
            'message': '数据书保存成功'
        })
        
    except Exception as e:
        print(f"保存数据书失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/api/storybook/generate-from-description', methods=['POST'])
def generate_storybook_from_description():
    """通过角色描述生成数据书"""
    try:
        data = request.json
        character_name = data.get('character_name')
        description = data.get('description')
        
        if not character_name or not description:
            return jsonify({'success': False, 'error': '角色名称和描述不能为空'}), 400
        
        # 使用AI新架构生成数据书
        generator = CoreGenerator()
        
        # 使用标准化的角色数据书生成方法
        result = generator.generate_storybook(
            template_type='character',
            user_description=description,
            target_name=character_name
        )
        
        if result['success']:
            try:
                # AI新架构直接返回解析后的数据
                generated_json = result['data']
                
                return jsonify({
                    'success': True,
                    'data': generated_json
                })
            except json.JSONDecodeError as e:
                # 如果生成的不是有效JSON，返回错误
                return jsonify({
                    'success': False,
                    'error': f'AI生成的内容不是有效的JSON格式: {str(e)}'
                }), 400
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'AI生成失败')
            }), 500
            
    except Exception as e:
        print(f"AI生成数据书失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/api/storybook/unbind', methods=['POST'])
def unbind_storybook():
    """解除数据书与角色的绑定"""
    try:
        data = request.json
        role_name = data.get('role_name')
        storybook_name = data.get('storybook_name')
        
        if not role_name or not storybook_name:
            return jsonify({'success': False, 'error': '角色名称和数据书名称不能为空'}), 400
        
        # 从角色文件中移除绑定
        roles_dir = PathManager.get_roles_dir()
        role_file = roles_dir / f"{role_name}.yml"
        
        if role_file.exists():
            with open(role_file, 'r', encoding='utf-8') as f:
                role_data = yaml.safe_load(f) or {}
            
            if '绑定数据书' in role_data and storybook_name in role_data['绑定数据书']:
                role_data['绑定数据书'].remove(storybook_name)
                
                with open(role_file, 'w', encoding='utf-8') as f:
                    yaml.dump(role_data, f, allow_unicode=True, default_flow_style=False)
        
        # 从数据书文件中移除角色绑定
        storybooks_dir = PathManager.get_storybook_dir()
        storybook_file = storybooks_dir / f"{storybook_name}.json"
        
        if storybook_file.exists():
            with open(storybook_file, 'r', encoding='utf-8') as f:
                storybook_data = json.load(f)
            
            if '捆绑角色' in storybook_data and role_name in storybook_data['捆绑角色']:
                storybook_data['捆绑角色'].remove(role_name)
                storybook_data['更新时间'] = datetime.datetime.now().isoformat()
                
                with open(storybook_file, 'w', encoding='utf-8') as f:
                    json.dump(storybook_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'success': True,
            'message': '绑定已解除'
        })
        
    except Exception as e:
        print(f"解除绑定失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ========== 聊天记录减负API ==========

@api_bp.route('/api/full_chat_history_reduction', methods=['POST'])
def full_chat_history_reduction():
    """完整聊天记录减负API"""
    try:
        data = request.json
        role_name = data.get('role_name')
        
        if not role_name:
            return jsonify({
                'success': False,
                'error': '角色名称不能为空'
            }), 400
        
        print(f"🔄 开始执行完整聊天记录减负 - 角色: {role_name}")
        
        # 导入减负函数
        from web.history_manager import apply_full_history_reduction, load_history, save_history
        
        # 加载聊天历史
        history = load_history(role_name)
        
        if not history:
            return jsonify({
                'success': False,
                'error': '该角色没有聊天记录'
            }), 400
        
        original_count = len(history)
        print(f"📊 原始记录数: {original_count}")
        
        # 执行减负处理
        reduced_history = apply_full_history_reduction(history, role_name)
        
        if reduced_history is None:
            return jsonify({
                'success': False,
                'error': '减负处理失败，请检查日志获取详细信息'
            }), 500
        
        new_count = len(reduced_history)
        print(f"📊 减负后记录数: {new_count}")
        
        # 保存减负后的历史记录
        save_history(reduced_history, role_name)
        
        return jsonify({
            'success': True,
            'message': f'聊天记录减负完成！记录数从 {original_count} 条减少到 {new_count} 条',
            'original_count': original_count,
            'new_count': new_count,
            'reduced_count': original_count - new_count
        })
        
    except Exception as e:
        print(f"❌ 完整聊天记录减负失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'减负过程中发生错误: {str(e)}'
        }), 500

