"""
配置切换路由模块
实现游戏配置的切换功能，包括配置导入导出
"""
from flask import Blueprint, request, jsonify, send_file
import json
import shutil
import os
import zipfile
import tempfile
from pathlib import Path
from datetime import datetime
from web.utils import PathManager

config_switch_bp = Blueprint('config_switch', __name__)

class ConfigSwitcher:
    """配置切换管理器"""
    
    @staticmethod
    def create_new_config(config_name, config_folder, config_description="", copy_from_current=False):
        """
        创建新的游戏配置
        
        Args:
            config_name: 配置显示名称
            config_folder: 配置文件夹名称
            config_description: 配置描述
            copy_from_current: 是否从当前配置复制基础文件
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            game_config_dir = PathManager.get_game_configs_dir()
            new_config_path = game_config_dir / config_folder
            
            # 检查配置文件夹是否已存在
            if new_config_path.exists():
                return False, f'配置文件夹 "{config_folder}" 已存在'
            
            # 创建游戏配置目录（如果不存在）
            game_config_dir.mkdir(exist_ok=True)
            
            # 创建新配置目录
            new_config_path.mkdir(parents=True)
            
            # 创建基础目录结构
            subdirs = ['角色', '玩家', '数据书', '聊天记录', '全局世界书', '日志']
            for subdir in subdirs:
                (new_config_path / subdir).mkdir(exist_ok=True)
            
            # 创建配置名称文件
            config_name_file = new_config_path / '当前配置名称.json'
            config_data = {
                '当前配置名称': config_name
            }
            if config_description:
                config_data['描述'] = config_description
                
            with open(config_name_file, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, ensure_ascii=False, indent=2)
            
            # 如果选择从当前配置复制基础文件
            if copy_from_current:
                try:
                    # 复制全局世界书
                    current_worldbook_dir = PathManager.get_global_world_book_dir()
                    new_worldbook_dir = new_config_path / '全局世界书'
                    if current_worldbook_dir.exists():
                        for file in current_worldbook_dir.glob('*.yml'):
                            if file.is_file():
                                shutil.copy2(file, new_worldbook_dir / file.name)
                    
                    # 复制底层描述文件
                    bottom_desc_file = PathManager.get_base_description_path()
                    if bottom_desc_file.exists():
                        shutil.copy2(bottom_desc_file, new_config_path / '底层描述.yml')
                    
                    print(f"已从当前配置复制基础文件到新配置 {config_folder}")
                    
                except Exception as e:
                    print(f"复制基础文件时发生警告: {e}")
                    # 不让复制失败影响配置创建
            
            # 创建默认的全局世界书文件（如果不存在）
            default_worldbook = new_config_path / '全局世界书' / '默认.yml'
            if not default_worldbook.exists():
                default_content = f"""# {config_name} - 全局世界书

# 基础设定
世界观: |
  这是一个新的游戏世界。

# 基础规则
规则:
  - 基础游戏规则
  - 角色扮演规则

# 背景设定
背景: |
  {config_description if config_description else '待完善的世界背景设定'}
"""
                with open(default_worldbook, 'w', encoding='utf-8') as f:
                    f.write(default_content)
            
            return True, f'配置 "{config_name}" 创建成功！\n\n配置文件夹: {config_folder}\n已创建基础目录结构和默认文件。'
            
        except Exception as e:
            print(f"创建配置失败: {e}")
            # 清理可能创建的文件
            try:
                if 'new_config_path' in locals() and new_config_path.exists():
                    shutil.rmtree(new_config_path)
            except:
                pass
            return False, f'创建配置时发生错误: {str(e)}'

    @staticmethod
    def get_available_configs():
        """获取所有可用的配置"""
        configs = []
        game_config_dir = PathManager.get_game_configs_dir()
        
        if not game_config_dir.exists():
            return configs
            
        # 扫描游戏配置目录
        for config_dir in game_config_dir.iterdir():
            if config_dir.is_dir():
                config_name_file = config_dir / '当前配置名称.json'
                if config_name_file.exists():
                    try:
                        with open(config_name_file, 'r', encoding='utf-8') as f:
                            config_data = json.load(f)
                            config_name = config_data.get('当前配置名称', config_dir.name)
                            configs.append({
                                'folder_name': config_dir.name,
                                'display_name': config_name,
                                'is_active': False  # 稍后设置
                            })
                    except Exception as e:
                        print(f"读取配置文件失败 {config_name_file}: {e}")
                        configs.append({
                            'folder_name': config_dir.name,
                            'display_name': config_dir.name,
                            'is_active': False
                        })
        
        # 获取当前激活的配置
        current_config = ConfigSwitcher.get_current_config()
        for config in configs:
            if config['display_name'] == current_config:
                config['is_active'] = True
                break
                
        return configs
    
    @staticmethod
    def get_current_config():
        """获取当前激活的配置名称"""
        current_config_file = PathManager.get_current_config_name_path()
        if current_config_file.exists():
            try:
                with open(current_config_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return data.get('当前配置名称', '默认')
            except Exception as e:
                print(f"读取当前配置文件失败: {e}")
        return '默认'
    
    @staticmethod
    def backup_current_config():
        """备份当前配置到游戏配置目录"""
        try:
            current_config_name = ConfigSwitcher.get_current_config()
            
            # 如果是"默认"配置，不进行备份
            if current_config_name == '默认':
                return True
                
            # 在游戏配置目录中找到对应的文件夹
            game_config_dir = PathManager.get_game_configs_dir()
            target_dir = None
            
            for config_dir in game_config_dir.iterdir():
                if config_dir.is_dir():
                    config_name_file = config_dir / '当前配置名称.json'
                    if config_name_file.exists():
                        try:
                            with open(config_name_file, 'r', encoding='utf-8') as f:
                                config_data = json.load(f)
                                if config_data.get('当前配置名称') == current_config_name:
                                    target_dir = config_dir
                                    break
                        except:
                            continue
            
            if not target_dir:
                print(f"未找到配置 {current_config_name} 的目标目录")
                return False
                
            # 备份文件夹列表
            folders_to_backup = ['角色', '玩家', '数据书', '全局世界书', '聊天记录']
            files_to_backup = ['当前配置名称.json']
            
            # 备份文件夹
            for folder in folders_to_backup:
                source_folder = PathManager.get_named_data_dir(folder)
                target_folder = target_dir / folder
                
                if source_folder.exists():
                    # 删除目标文件夹（如果存在）
                    if target_folder.exists():
                        shutil.rmtree(target_folder)
                    # 复制源文件夹到目标
                    shutil.copytree(source_folder, target_folder)
            
            # 备份文件
            for file in files_to_backup:
                source_file = PathManager.get_named_data_file(file)
                target_file = target_dir / file
                
                if source_file.exists():
                    shutil.copy2(source_file, target_file)
            
            print(f"配置 {current_config_name} 备份成功到 {target_dir}")
            return True
            
        except Exception as e:
            print(f"备份当前配置失败: {e}")
            return False
    
    @staticmethod
    def switch_to_config(config_folder_name):
        """切换到指定配置"""
        try:
            # 先备份当前配置
            if not ConfigSwitcher.backup_current_config():
                print("备份当前配置失败，但继续切换")
            
            # 获取目标配置目录
            source_dir = PathManager.get_game_configs_dir() / config_folder_name
            
            if not source_dir.exists():
                return False, f"配置目录不存在: {config_folder_name}"
            
            # 需要切换的文件夹列表
            folders_to_switch = ['角色', '玩家', '数据书', '全局世界书', '聊天记录']
            files_to_switch = ['当前配置名称.json']
            
            # 切换文件夹
            for folder in folders_to_switch:
                source_folder = source_dir / folder
                target_folder = PathManager.get_named_data_dir(folder)
                
                # 删除当前文件夹（如果存在）
                if target_folder.exists():
                    shutil.rmtree(target_folder)
                
                # 复制源文件夹到根目录
                if source_folder.exists():
                    shutil.copytree(source_folder, target_folder)
                else:
                    # 如果源文件夹不存在，创建空文件夹
                    target_folder.mkdir(exist_ok=True)
            
            # 切换文件
            for file in files_to_switch:
                source_file = source_dir / file
                target_file = PathManager.get_named_data_file(file)
                
                if source_file.exists():
                    shutil.copy2(source_file, target_file)
            
            # 获取新配置的名称
            config_name_file = source_dir / '当前配置名称.json'
            new_config_name = config_folder_name
            
            if config_name_file.exists():
                try:
                    with open(config_name_file, 'r', encoding='utf-8') as f:
                        config_data = json.load(f)
                        new_config_name = config_data.get('当前配置名称', config_folder_name)
                except:
                    pass
            
            print(f"成功切换到配置: {new_config_name}")
            return True, f"成功切换到配置: {new_config_name}"
            
        except Exception as e:
            print(f"切换配置失败: {e}")
            return False, f"切换配置失败: {str(e)}"
    
    @staticmethod
    def export_config(config_folder_name=None):
        """
        导出配置到ZIP文件
        
        Args:
            config_folder_name: 要导出的配置文件夹名称，如果为None则导出当前配置
            
        Returns:
            tuple: (success, zip_file_path, config_name)
        """
        try:
            # 确定要导出的配置
            if config_folder_name:
                # 导出指定配置
                source_dir = PathManager.get_game_configs_dir() / config_folder_name
                if not source_dir.exists():
                    return False, None, f"配置目录不存在: {config_folder_name}"
                
                # 获取配置显示名称
                config_name_file = source_dir / '当前配置名称.json'
                if config_name_file.exists():
                    try:
                        with open(config_name_file, 'r', encoding='utf-8') as f:
                            config_data = json.load(f)
                            config_display_name = config_data.get('当前配置名称', config_folder_name)
                    except:
                        config_display_name = config_folder_name
                else:
                    config_display_name = config_folder_name
                    
                folders_to_export = []
                files_to_export = []
                
                # 检查配置目录中的文件夹和文件
                for folder_name in ['角色', '玩家', '数据书', '全局世界书', '聊天记录']:
                    folder_path = source_dir / folder_name
                    if folder_path.exists():
                        folders_to_export.append((folder_path, folder_name))
                
                for file_name in ['当前配置名称.json']:
                    file_path = source_dir / file_name
                    if file_path.exists():
                        files_to_export.append((file_path, file_name))
                        
            else:
                # 导出当前配置
                config_display_name = ConfigSwitcher.get_current_config()
                
                folders_to_export = []
                files_to_export = []
                
                # 检查根目录中的文件夹和文件
                for folder_name in ['角色', '玩家', '数据书', '全局世界书', '聊天记录']:
                    folder_path = PathManager.get_named_data_dir(folder_name)
                    if folder_path.exists():
                        folders_to_export.append((folder_path, folder_name))
                
                for file_name in ['当前配置名称.json']:
                    file_path = PathManager.get_named_data_file(file_name)
                    if file_path.exists():
                        files_to_export.append((file_path, file_name))
            
            # 创建临时ZIP文件
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            safe_config_name = "".join(c for c in config_display_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
            zip_filename = f"配置导出_{safe_config_name}_{timestamp}.zip"
            
            temp_dir = Path(tempfile.gettempdir())
            zip_file_path = temp_dir / zip_filename
            
            with zipfile.ZipFile(zip_file_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # 添加文件夹
                for folder_path, folder_name in folders_to_export:
                    for file_path in folder_path.rglob('*'):
                        if file_path.is_file():
                            # 计算相对路径
                            relative_path = folder_name / file_path.relative_to(folder_path)
                            zipf.write(file_path, relative_path)
                
                # 添加文件
                for file_path, file_name in files_to_export:
                    zipf.write(file_path, file_name)
                
                # 添加导出信息文件
                export_info = {
                    "配置名称": config_display_name,
                    "导出时间": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    "导出版本": "1.0",
                    "包含文件夹": [name for _, name in folders_to_export],
                    "包含文件": [name for _, name in files_to_export]
                }
                
                info_content = json.dumps(export_info, ensure_ascii=False, indent=2)
                zipf.writestr('导出信息.json', info_content.encode('utf-8'))
            
            return True, str(zip_file_path), config_display_name
            
        except Exception as e:
            print(f"导出配置失败: {e}")
            return False, None, f"导出配置失败: {str(e)}"
    
    @staticmethod
    def delete_config(config_folder_name):
        """
        删除指定配置
        
        Args:
            config_folder_name: 要删除的配置文件夹名称
            
        Returns:
            tuple: (success, message)
        """
        try:
            # 安全检查：防止删除当前配置
            current_config = ConfigSwitcher.get_current_config()
            
            # 获取要删除配置的显示名称
            config_dir = PathManager.get_game_configs_dir() / config_folder_name
            if not config_dir.exists():
                return False, f"配置目录不存在: {config_folder_name}"
            
            config_name_file = config_dir / '当前配置名称.json'
            config_display_name = config_folder_name
            
            if config_name_file.exists():
                try:
                    with open(config_name_file, 'r', encoding='utf-8') as f:
                        config_data = json.load(f)
                        config_display_name = config_data.get('当前配置名称', config_folder_name)
                except:
                    pass
            
            # 检查是否为当前配置
            if config_display_name == current_config:
                return False, "不能删除当前正在使用的配置！请先切换到其他配置。"
            
            # 删除配置目录
            shutil.rmtree(config_dir)
            
            print(f"成功删除配置: {config_display_name} (文件夹: {config_folder_name})")
            return True, f"配置 '{config_display_name}' 已成功删除"
            
        except Exception as e:
            print(f"删除配置失败: {e}")
            return False, f"删除配置失败: {str(e)}"
    
    @staticmethod
    def import_config(zip_file_path, config_name=None):
        """
        从ZIP文件导入配置
        
        Args:
            zip_file_path: ZIP文件路径
            config_name: 新配置名称，如果为None则使用导出信息中的名称
            
        Returns:
            tuple: (success, message)
        """
        try:
            zip_path = Path(zip_file_path)
            if not zip_path.exists():
                return False, "ZIP文件不存在"
            
            # 创建临时目录解压文件
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                # 解压ZIP文件
                with zipfile.ZipFile(zip_path, 'r') as zipf:
                    zipf.extractall(temp_path)
                
                # 读取导出信息
                export_info_file = temp_path / '导出信息.json'
                original_config_name = "导入的配置"
                
                if export_info_file.exists():
                    try:
                        with open(export_info_file, 'r', encoding='utf-8') as f:
                            export_info = json.load(f)
                            original_config_name = export_info.get('配置名称', '导入的配置')
                    except:
                        pass
                
                # 确定最终配置名称
                final_config_name = config_name if config_name else original_config_name
                
                # 生成唯一的文件夹名称
                game_config_dir = PathManager.get_game_configs_dir()
                game_config_dir.mkdir(exist_ok=True)
                
                base_folder_name = "".join(c for c in final_config_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
                if not base_folder_name:
                    base_folder_name = "导入的配置"
                
                folder_name = base_folder_name
                counter = 1
                while (game_config_dir / folder_name).exists():
                    folder_name = f"{base_folder_name}_{counter}"
                    counter += 1
                
                # 创建目标配置目录
                target_config_dir = game_config_dir / folder_name
                target_config_dir.mkdir(exist_ok=True)
                
                # 复制文件夹和文件
                folders_imported = []
                files_imported = []
                
                for folder_name_to_copy in ['角色', '玩家', '数据书', '全局世界书', '聊天记录']:
                    source_folder = temp_path / folder_name_to_copy
                    if source_folder.exists():
                        target_folder = target_config_dir / folder_name_to_copy
                        shutil.copytree(source_folder, target_folder)
                        folders_imported.append(folder_name_to_copy)
                
                for file_name_to_copy in ['当前配置名称.json']:
                    source_file = temp_path / file_name_to_copy
                    if source_file.exists():
                        target_file = target_config_dir / file_name_to_copy
                        shutil.copy2(source_file, target_file)
                        files_imported.append(file_name_to_copy)
                
                # 创建或更新配置名称文件
                config_name_file = target_config_dir / '当前配置名称.json'
                config_data = {'当前配置名称': final_config_name}
                
                with open(config_name_file, 'w', encoding='utf-8') as f:
                    json.dump(config_data, f, ensure_ascii=False, indent=2)
                
                success_message = f"成功导入配置: {final_config_name}\n"
                success_message += f"配置文件夹: {folder_name}\n"
                success_message += f"导入的文件夹: {', '.join(folders_imported)}\n"
                success_message += f"导入的文件: {', '.join(files_imported)}"
                
                return True, success_message
                
        except Exception as e:
            print(f"导入配置失败: {e}")
            return False, f"导入配置失败: {str(e)}"

@config_switch_bp.route('/api/config_switch/list', methods=['GET'])
def get_config_list():
    """获取配置列表"""
    try:
        configs = ConfigSwitcher.get_available_configs()
        return jsonify({
            'success': True,
            'configs': configs,
            'current_config': ConfigSwitcher.get_current_config()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'获取配置列表失败: {str(e)}'
        }), 500

@config_switch_bp.route('/api/config_switch/switch', methods=['POST'])
def switch_config():
    """切换配置"""
    try:
        data = request.get_json()
        if not data or 'config_folder' not in data:
            return jsonify({
                'success': False,
                'error': '缺少配置文件夹名称'
            }), 400
        
        config_folder = data['config_folder']
        success, message = ConfigSwitcher.switch_to_config(config_folder)
        
        if success:
            return jsonify({
                'success': True,
                'message': message
            })
        else:
            return jsonify({
                'success': False,
                'error': message
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'切换配置失败: {str(e)}'
        }), 500

@config_switch_bp.route('/api/config_switch/create', methods=['POST'])
def create_new_config():
    """创建新配置"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': '请求数据不能为空'
            }), 400
        
        # 验证必需字段
        config_name = data.get('config_name', '').strip()
        config_folder = data.get('config_folder', '').strip()
        
        if not config_name:
            return jsonify({
                'success': False,
                'error': '配置名称不能为空'
            }), 400
            
        if not config_folder:
            return jsonify({
                'success': False,
                'error': '文件夹名称不能为空'
            }), 400
        
        # 验证文件夹名称格式
        import re
        if not re.match(r'^[a-zA-Z0-9\u4e00-\u9fa5_-]+$', config_folder):
            return jsonify({
                'success': False,
                'error': '文件夹名称只能包含字母、数字、中文、下划线和短横线'
            }), 400
        
        # 获取可选参数
        config_description = data.get('config_description', '').strip()
        copy_from_current = data.get('copy_from_current', False)
        
        success, message = ConfigSwitcher.create_new_config(
            config_name, config_folder, config_description, copy_from_current
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': message,
                'config_folder': config_folder
            })
        else:
            return jsonify({
                'success': False,
                'error': message
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'创建配置失败: {str(e)}'
        }), 500

@config_switch_bp.route('/api/config_switch/current', methods=['GET'])
def get_current_config_info():
    """获取当前配置信息"""
    try:
        current_config = ConfigSwitcher.get_current_config()
        return jsonify({
            'success': True,
            'current_config': current_config
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'获取当前配置失败: {str(e)}'
        }), 500

@config_switch_bp.route('/api/config_switch/export', methods=['POST'])
def export_config():
    """导出配置"""
    try:
        data = request.get_json() or {}
        config_folder = data.get('config_folder')  # 如果为None则导出当前配置
        
        success, zip_file_path, config_name = ConfigSwitcher.export_config(config_folder)
        
        if success:
            # 返回文件下载
            return send_file(
                zip_file_path,
                as_attachment=True,
                download_name=Path(zip_file_path).name,
                mimetype='application/zip'
            )
        else:
            return jsonify({
                'success': False,
                'error': config_name  # 这里是错误信息
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'导出配置失败: {str(e)}'
        }), 500

@config_switch_bp.route('/api/config_switch/delete', methods=['POST'])
def delete_config():
    """删除配置"""
    try:
        data = request.get_json()
        if not data or 'config_folder' not in data:
            return jsonify({
                'success': False,
                'error': '缺少配置文件夹名称'
            }), 400
        
        config_folder = data['config_folder']
        success, message = ConfigSwitcher.delete_config(config_folder)
        
        if success:
            return jsonify({
                'success': True,
                'message': message
            })
        else:
            return jsonify({
                'success': False,
                'error': message
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'删除配置失败: {str(e)}'
        }), 500

@config_switch_bp.route('/api/config_switch/import', methods=['POST'])
def import_config():
    """导入配置"""
    try:
        # 检查文件上传
        if 'config_file' not in request.files:
            return jsonify({
                'success': False,
                'error': '没有上传配置文件'
            }), 400
        
        file = request.files['config_file']
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': '没有选择文件'
            }), 400
        
        # 检查文件扩展名
        if not file.filename.lower().endswith('.zip'):
            return jsonify({
                'success': False,
                'error': '只支持ZIP格式的配置文件'
            }), 400
        
        # 获取自定义配置名称（可选）
        config_name = request.form.get('config_name')
        
        # 保存上传的文件到临时位置
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_file:
            file.save(temp_file.name)
            temp_file_path = temp_file.name
        
        try:
            # 导入配置
            success, message = ConfigSwitcher.import_config(temp_file_path, config_name)
            
            if success:
                return jsonify({
                    'success': True,
                    'message': message
                })
            else:
                return jsonify({
                    'success': False,
                    'error': message
                }), 500
                
        finally:
            # 清理临时文件
            try:
                os.unlink(temp_file_path)
            except:
                pass
                
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'导入配置失败: {str(e)}'
        }), 500
