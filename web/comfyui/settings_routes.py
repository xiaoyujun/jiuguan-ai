#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图片生成设置路由
处理设置页面的路由和API
"""

import os
import sys
import json
from flask import Blueprint, request, jsonify, render_template, send_from_directory
from web.utils import PathManager

# 添加当前目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

try:
    from settings_manager import get_settings_manager
except ImportError:
    from .settings_manager import get_settings_manager

# 创建蓝图
settings_bp = Blueprint('image_settings', __name__)


@settings_bp.route('/image-settings')
def image_settings_page():
    """图片生成设置页面"""
    return render_template('image_settings.html')


@settings_bp.route('/api/image-settings', methods=['GET'])
def get_image_settings():
    """获取图片生成设置"""
    try:
        settings_manager = get_settings_manager()
        settings = settings_manager.get_all_settings()
        
        return jsonify({
            'success': True,
            'settings': settings
        })
        
    except Exception as e:
        print(f"获取图片设置失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/api/image-settings', methods=['POST'])
def update_image_settings():
    """更新图片生成设置"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': '没有接收到设置数据'
            }), 400
        
        settings_manager = get_settings_manager()
        
        # 验证设置
        validation_result = settings_manager.validate_settings(data)
        if not validation_result['valid']:
            return jsonify({
                'success': False,
                'error': '设置验证失败',
                'errors': validation_result['errors'],
                'warnings': validation_result['warnings']
            }), 400
        
        # 分别更新各个设置类别
        success = True
        updated_categories = []
        
        if 'generation_params' in data:
            if settings_manager.update_generation_params(data['generation_params']):
                updated_categories.append('generation_params')
            else:
                success = False
        
        if 'prompt_settings' in data:
            if settings_manager.update_prompt_settings(data['prompt_settings']):
                updated_categories.append('prompt_settings')
            else:
                success = False
        
        if 'comfyui_settings' in data:
            if settings_manager.update_comfyui_settings(data['comfyui_settings']):
                updated_categories.append('comfyui_settings')
                
                # 如果更新了ComfyUI设置，通知图片生成服务重新加载工作流配置
                try:
                    from image_generation_routes import image_service
                    if image_service is not None:
                        image_service.reload_workflow_config()
                        print("已通知图片生成服务重新加载工作流配置")
                except Exception as e:
                    print(f"重新加载工作流配置失败: {e}")
                    # 不影响主要的设置更新流程
            else:
                success = False
        
        if 'ui_settings' in data:
            if settings_manager.update_ui_settings(data['ui_settings']):
                updated_categories.append('ui_settings')
            else:
                success = False
        
        if success:
            return jsonify({
                'success': True,
                'message': '设置更新成功',
                'updated_categories': updated_categories,
                'warnings': validation_result['warnings']
            })
        else:
            return jsonify({
                'success': False,
                'error': '部分设置更新失败'
            }), 500
            
    except Exception as e:
        print(f"更新图片设置失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/api/image-settings/reset', methods=['POST'])
def reset_image_settings():
    """重置图片生成设置为默认值"""
    try:
        settings_manager = get_settings_manager()
        
        if settings_manager.reset_to_defaults():
            return jsonify({
                'success': True,
                'message': '设置已重置为默认值',
                'settings': settings_manager.get_all_settings()
            })
        else:
            return jsonify({
                'success': False,
                'error': '重置设置失败'
            }), 500
            
    except Exception as e:
        print(f"重置图片设置失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/api/image-settings/validate', methods=['POST'])
def validate_image_settings():
    """验证图片生成设置"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': '没有接收到设置数据'
            }), 400
        
        settings_manager = get_settings_manager()
        validation_result = settings_manager.validate_settings(data)
        
        return jsonify({
            'success': True,
            'validation': validation_result
        })
        
    except Exception as e:
        print(f"验证图片设置失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/api/image-settings/test-connection', methods=['GET'])
def test_comfyui_connection():
    """测试ComfyUI连接"""
    try:
        settings_manager = get_settings_manager()
        comfyui_settings = settings_manager.get_comfyui_settings()
        
        # 使用设置中的服务器地址进行连接测试
        from image_generator import ImageGenerationService
        
        service = ImageGenerationService(
            server_address=comfyui_settings.get('server_address', '127.0.0.1:8188')
        )
        
        connection_result = service.test_connection()
        
        return jsonify({
            'success': True,
            'connection': connection_result
        })
        
    except Exception as e:
        print(f"测试ComfyUI连接失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/api/history-images', methods=['GET'])
def get_history_images():
    """获取历史图像列表"""
    try:
        import glob
        from datetime import datetime
        
        # 获取生成图像目录 - 修正为实际的图片保存路径
        images_dir = os.fspath(PathManager.get_chat_records_dir() / "生成图片")
        
        if not os.path.exists(images_dir):
            return jsonify({
                'success': True,
                'images': [],
                'total_size': 0
            })
        
        # 获取所有PNG图像文件
        image_files = glob.glob(os.path.join(images_dir, '*.png'))
        images = []
        total_size = 0
        
        for image_path in image_files:
            try:
                filename = os.path.basename(image_path)
                stat = os.stat(image_path)
                size = stat.st_size
                total_size += size
                
                # 从文件名解析角色名称 (格式: 角色名_随机ID__00001_.png)
                role_name = filename.split('_')[0] if '_' in filename else '未知角色'
                
                # 格式化文件大小
                if size < 1024:
                    size_text = f"{size} B"
                elif size < 1024 * 1024:
                    size_text = f"{size / 1024:.1f} KB"
                else:
                    size_text = f"{size / (1024 * 1024):.1f} MB"
                
                # 格式化修改时间
                mod_time = datetime.fromtimestamp(stat.st_mtime)
                date_text = mod_time.strftime("%m-%d %H:%M")
                
                images.append({
                    'filename': filename,
                    'role_name': role_name,
                    'size': size,
                    'size_text': size_text,
                    'date_text': date_text,
                    'timestamp': stat.st_mtime
                })
                
            except Exception as e:
                print(f"处理图像文件 {image_path} 时出错: {e}")
                continue
        
        # 按时间倒序排列（最新的在前）
        images.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return jsonify({
            'success': True,
            'images': images,
            'total_size': total_size
        })
        
    except Exception as e:
        print(f"获取历史图像失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/api/history-images/delete', methods=['POST'])
def delete_history_image():
    """删除单个历史图像"""
    try:
        data = request.get_json()
        if not data or 'filename' not in data:
            return jsonify({
                'success': False,
                'error': '缺少文件名参数'
            }), 400
        
        filename = data['filename']
        
        # 安全检查：确保文件名不包含路径分隔符
        if '/' in filename or '\\' in filename or '..' in filename:
            return jsonify({
                'success': False,
                'error': '无效的文件名'
            }), 400
        
        # 构建文件路径
        images_dir = os.path.join(current_dir, 'generated_images')
        file_path = os.path.join(images_dir, filename)
        
        if not os.path.exists(file_path):
            return jsonify({
                'success': False,
                'error': '文件不存在'
            }), 404
        
        # 删除文件
        os.remove(file_path)
        
        return jsonify({
            'success': True,
            'message': f'图像 {filename} 删除成功'
        })
        
    except Exception as e:
        print(f"删除历史图像失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/api/history-images/clear', methods=['POST'])
def clear_history_images():
    """清空所有历史图像"""
    try:
        import glob
        
        # 获取生成图像目录
        images_dir = os.path.join(current_dir, 'generated_images')
        
        if not os.path.exists(images_dir):
            return jsonify({
                'success': True,
                'deleted_count': 0,
                'message': '图像目录不存在'
            })
        
        # 获取所有PNG图像文件
        image_files = glob.glob(os.path.join(images_dir, '*.png'))
        deleted_count = 0
        
        for image_path in image_files:
            try:
                os.remove(image_path)
                deleted_count += 1
            except Exception as e:
                print(f"删除文件 {image_path} 时出错: {e}")
                continue
        
        return jsonify({
            'success': True,
            'deleted_count': deleted_count,
            'message': f'成功删除 {deleted_count} 张图像'
        })
        
    except Exception as e:
        print(f"清空历史图像失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/api/workflow-files', methods=['GET'])
def get_workflow_files():
    """获取可用的工作流文件列表"""
    try:
        import glob
        
        # 获取参考目录下的工作流文件
        reference_dir = os.path.join(current_dir, '参考')
        workflows = []
        
        if os.path.exists(reference_dir):
            # 查找所有JSON文件
            json_files = glob.glob(os.path.join(reference_dir, '*.json'))
            
            for json_file in json_files:
                try:
                    filename = os.path.basename(json_file)
                    file_size = os.path.getsize(json_file)
                    
                    # 简单验证是否为有效的ComfyUI工作流文件
                    with open(json_file, 'r', encoding='utf-8') as f:
                        content = f.read(100)  # 只读取前100字符检查格式
                        is_valid = content.strip().startswith('{') and '"inputs"' in content
                    
                    workflows.append({
                        'filename': filename,
                        'name': filename.replace('.json', ''),
                        'size': file_size,
                        'size_text': f"{file_size / 1024:.1f} KB" if file_size < 1024*1024 else f"{file_size / (1024*1024):.1f} MB",
                        'is_valid': is_valid,
                        'path': os.path.relpath(json_file, current_dir).replace('\\', '/')
                    })
                    
                except Exception as e:
                    print(f"处理工作流文件 {json_file} 时出错: {e}")
                    continue
        
        # 按名称排序
        workflows.sort(key=lambda x: x['name'])
        
        return jsonify({
            'success': True,
            'workflows': workflows,
            'total_count': len(workflows)
        })
        
    except Exception as e:
        print(f"获取工作流文件失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/api/workflow-files/<path:filename>', methods=['GET'])
def get_workflow_content(filename):
    """获取指定工作流文件的内容"""
    try:
        # Flask会自动URL解码，但我们可以确保正确处理
        from urllib.parse import unquote
        # 如果文件名已经被解码了，unquote不会改变它
        decoded_filename = unquote(filename)
        
        # 使用解码后的文件名
        filename = decoded_filename
        
        # 安全检查：确保文件名不包含路径分隔符
        if '/' in filename or '\\' in filename or '..' in filename:
            return jsonify({
                'success': False,
                'error': '无效的文件名'
            }), 400
        
        # 构建文件路径
        reference_dir = os.path.join(current_dir, '参考')
        file_path = os.path.join(reference_dir, filename)
        
        if not os.path.exists(file_path):
            return jsonify({
                'success': False,
                'error': f'工作流文件不存在: {filename}'
            }), 404
        
        # 读取文件内容
        with open(file_path, 'r', encoding='utf-8') as f:
            workflow_content = json.load(f)
        
        # 提取工作流信息
        node_count = len(workflow_content)
        
        # 尝试找到关键节点信息
        info = {
            'has_sampler': False,
            'has_model_loader': False,
            'has_prompt': False,
            'has_save_image': False,
            'resolution': None
        }
        
        for node_id, node in workflow_content.items():
            if isinstance(node, dict) and 'class_type' in node:
                class_type = node.get('class_type', '').lower()
                
                if 'sampler' in class_type or 'ksampler' in class_type:
                    info['has_sampler'] = True
                elif 'checkpointloader' in class_type or 'modelloader' in class_type:
                    info['has_model_loader'] = True
                elif 'prompt' in class_type or 'clip' in class_type:
                    info['has_prompt'] = True
                elif 'saveimage' in class_type or 'image' in class_type:
                    info['has_save_image'] = True
                
                # 尝试提取分辨率信息
                if 'inputs' in node:
                    inputs = node['inputs']
                    if 'width' in inputs and 'height' in inputs:
                        try:
                            width = int(inputs['width'])
                            height = int(inputs['height'])
                            info['resolution'] = f"{width}x{height}"
                        except:
                            pass
        
        return jsonify({
            'success': True,
            'workflow': {
                'filename': filename,
                'name': filename.replace('.json', ''),
                'node_count': node_count,
                'info': info,
                'content': workflow_content
            }
        })
        
    except json.JSONDecodeError as e:
        return jsonify({
            'success': False,
            'error': '工作流文件格式无效: ' + str(e)
        }), 400
    except Exception as e:
        print(f"读取工作流文件失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/api/workflow-files/upload', methods=['POST'])
def upload_workflow_file():
    """上传新的工作流文件"""
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': '没有选择文件'
            }), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': '没有选择文件'
            }), 400
        
        # 检查文件扩展名
        if not file.filename.lower().endswith('.json'):
            return jsonify({
                'success': False,
                'error': '只支持JSON文件'
            }), 400
        
        # 读取并验证文件内容
        try:
            content = file.read().decode('utf-8')
            workflow_data = json.loads(content)
            
            # 简单验证是否为有效的ComfyUI工作流
            if not isinstance(workflow_data, dict):
                raise ValueError("工作流文件格式无效")
            
            # 检查是否包含必要的节点结构
            has_valid_nodes = any(
                isinstance(node, dict) and 'inputs' in node 
                for node in workflow_data.values()
            )
            
            if not has_valid_nodes:
                raise ValueError("不是有效的ComfyUI工作流文件")
            
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as e:
            return jsonify({
                'success': False,
                'error': f'文件内容无效: {str(e)}'
            }), 400
        
        # 保存文件
        reference_dir = os.path.join(current_dir, '参考')
        os.makedirs(reference_dir, exist_ok=True)
        
        # 生成安全的文件名
        import re
        safe_filename = re.sub(r'[^\w\-_.]', '_', file.filename)
        file_path = os.path.join(reference_dir, safe_filename)
        
        # 如果文件已存在，添加序号
        counter = 1
        original_path = file_path
        while os.path.exists(file_path):
            name, ext = os.path.splitext(original_path)
            file_path = f"{name}_{counter}{ext}"
            counter += 1
        
        # 写入文件
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(workflow_data, f, ensure_ascii=False, indent=2)
        
        final_filename = os.path.basename(file_path)
        
        return jsonify({
            'success': True,
            'message': f'工作流文件上传成功: {final_filename}',
            'filename': final_filename
        })
        
    except Exception as e:
        print(f"上传工作流文件失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/comfyui/generated_images/<filename>')
def serve_generated_image(filename):
    """提供生成的图像文件访问"""
    try:
        # 安全检查：确保文件名不包含路径分隔符
        if '/' in filename or '\\' in filename or '..' in filename:
            return "Invalid filename", 400
        
        images_dir = os.path.join(current_dir, 'generated_images')
        return send_from_directory(images_dir, filename)
        
    except Exception as e:
        print(f"提供图像文件失败: {e}")
        return "File not found", 404