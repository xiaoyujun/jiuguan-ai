"""
语义修正路由
提供消息-数据书关联修正功能的API接口
"""

from flask import Blueprint, request, jsonify, render_template
import json
import os
import logging
from pathlib import Path
from web.utils import PathManager
from web.utils import ConfigManager

logger = logging.getLogger(__name__)

# 创建蓝图
semantic_correction_bp = Blueprint('semantic_correction', __name__)

USER_SEMANTIC_CONFIG_FILE = PathManager.get_user_semantic_config_path()

def get_user_semantic_config():
    """获取用户语义配置"""
    config_path = USER_SEMANTIC_CONFIG_FILE
    
    if config_path.exists():
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"读取用户语义配置失败: {e}")
    
    # 返回默认配置结构
    return {
        "version": "1.0",
        "created_at": "",
        "last_updated": "",
        "user_feature_maps": {
            "gender": {
                "female_keywords": {},
                "male_keywords": {}
            },
            "sports": {
                "running_keywords": {},
                "athletics_keywords": {},
                "general_sports_keywords": {}
            },
            "personality": {
                "positive_traits": {},
                "negative_traits": {}
            },
            "occupation": {
                "student_keywords": {},
                "artist_keywords": {},
                "adventurer_keywords": {}
            },
            "race": {
                "human_keywords": {},
                "elf_keywords": {},
                "dark_elf_keywords": {}
            },
            "custom_categories": {}
        },
        "user_corrections": [],
        "statistics": {
            "total_corrections": 0,
            "approved_keywords": 0,
            "rejected_keywords": 0
        }
    }

def save_user_semantic_config(config):
    """保存用户语义配置"""
    try:
        import datetime
        config["last_updated"] = datetime.datetime.now().isoformat()
        
        with open(USER_SEMANTIC_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.error(f"保存用户语义配置失败: {e}")
        return False

def get_ai_config():
    """获取AI配置"""
    try:
        return ConfigManager.load_config()
    except Exception as e:
        logger.error(f"获取AI配置失败: {e}")
        return {}

@semantic_correction_bp.route('/semantic-correction')
def semantic_correction_page():
    """语义修正页面"""
    return render_template('semantic_correction.html')

@semantic_correction_bp.route('/api/semantic-correction/extract-keywords', methods=['POST'])
def extract_keywords():
    """
    提取关键词API
    
    POST /api/semantic-correction/extract-keywords
    {
        "message": "消息内容",
        "storybook_name": "数据书名称",
        "expected_categories": ["gender", "sports"]  // 用户期望的分类
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '请求数据为空'}), 400
        
        message = data.get('message', '').strip()
        storybook_name = data.get('storybook_name', '').strip()
        expected_categories = data.get('expected_categories', [])
        
        if not message:
            return jsonify({'success': False, 'error': '消息内容不能为空'}), 400
        
        if not storybook_name:
            return jsonify({'success': False, 'error': '数据书名称不能为空'}), 400
        
        # 使用AI模型提取关键词
        extracted_keywords = extract_keywords_with_ai(message, storybook_name, expected_categories)
        
        return jsonify({
            'success': True,
            'message': message,
            'storybook_name': storybook_name,
            'expected_categories': expected_categories,
            'extracted_keywords': extracted_keywords
        })
        
    except Exception as e:
        logger.error(f"提取关键词失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@semantic_correction_bp.route('/api/semantic-correction/approve-keywords', methods=['POST'])
def approve_keywords():
    """
    审批关键词API
    
    POST /api/semantic-correction/approve-keywords
    {
        "storybook_name": "数据书名称",
        "approved_keywords": {
            "gender.female_keywords": {"女生": 2.0},
            "sports.running_keywords": {"跑步": 3.0}
        },
        "rejected_keywords": ["其他", "不相关"]
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '请求数据为空'}), 400
        
        storybook_name = data.get('storybook_name', '').strip()
        approved_keywords = data.get('approved_keywords', {})
        rejected_keywords = data.get('rejected_keywords', [])
        
        if not storybook_name:
            return jsonify({'success': False, 'error': '数据书名称不能为空'}), 400
        
        if not approved_keywords:
            return jsonify({'success': False, 'error': '没有要保存的关键词'}), 400
        
        # 获取用户配置
        user_config = get_user_semantic_config()
        
        # 增量更新用户配置
        updated_count = update_user_config_with_keywords(user_config, approved_keywords)
        
        # 记录修正历史
        correction_record = {
            "timestamp": "",
            "storybook_name": storybook_name,
            "approved_keywords": approved_keywords,
            "rejected_keywords": rejected_keywords,
            "updated_count": updated_count
        }
        
        import datetime
        correction_record["timestamp"] = datetime.datetime.now().isoformat()
        user_config["user_corrections"].append(correction_record)
        
        # 更新统计信息
        user_config["statistics"]["total_corrections"] += 1
        user_config["statistics"]["approved_keywords"] += len(approved_keywords)
        user_config["statistics"]["rejected_keywords"] += len(rejected_keywords)
        
        # 保存配置
        if save_user_semantic_config(user_config):
            return jsonify({
                'success': True,
                'message': f'成功保存 {updated_count} 个关键词',
                'updated_count': updated_count,
                'statistics': user_config["statistics"]
            })
        else:
            return jsonify({'success': False, 'error': '保存配置失败'}), 500
        
    except Exception as e:
        logger.error(f"审批关键词失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@semantic_correction_bp.route('/api/semantic-correction/storybooks', methods=['GET'])
def get_storybooks():
    """获取所有数据书列表"""
    try:
        storybook_dir = PathManager.get_storybook_dir()
        storybooks = []
        
        if storybook_dir.exists():
            for file_path in storybook_dir.glob('*.json'):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        storybooks.append({
                            'name': file_path.stem,
                            'display_name': data.get('总结词', [file_path.stem])[0] if data.get('总结词') else file_path.stem,
                            'summary': data.get('总结词', []),
                            'keywords': data.get('关键词', [])
                        })
                except Exception as e:
                    logger.warning(f"读取数据书 {file_path} 失败: {e}")
                    continue
        
        return jsonify({
            'success': True,
            'storybooks': storybooks
        })
        
    except Exception as e:
        logger.error(f"获取数据书列表失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@semantic_correction_bp.route('/api/semantic-correction/user-config', methods=['GET'])
def get_user_config():
    """获取用户语义配置"""
    try:
        config = get_user_semantic_config()
        return jsonify({
            'success': True,
            'config': config
        })
    except Exception as e:
        logger.error(f"获取用户配置失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def update_user_config_with_keywords(user_config, approved_keywords):
    """增量更新用户配置中的关键词"""
    updated_count = 0
    
    for path, keywords in approved_keywords.items():
        try:
            # 解析路径，如 "gender.female_keywords"
            path_parts = path.split('.')
            if len(path_parts) != 2:
                logger.warning(f"无效的路径格式: {path}")
                continue
            
            category, subcategory = path_parts
            
            # 确保路径存在
            if category not in user_config["user_feature_maps"]:
                user_config["user_feature_maps"][category] = {}
            
            if subcategory not in user_config["user_feature_maps"][category]:
                user_config["user_feature_maps"][category][subcategory] = {}
            
            # 增量更新关键词
            target_dict = user_config["user_feature_maps"][category][subcategory]
            for keyword, weight in keywords.items():
                if keyword not in target_dict or target_dict[keyword] != weight:
                    target_dict[keyword] = weight
                    updated_count += 1
                    logger.info(f"更新关键词: {path}.{keyword} = {weight}")
        
        except Exception as e:
            logger.error(f"更新关键词路径 {path} 失败: {e}")
            continue
    
    return updated_count

def extract_keywords_with_ai(message, storybook_name, expected_categories):
    """使用AI模型提取关键词"""
    try:
        from API import stream_chat_response_with_config
        
        # 构建提示词
        prompt = f"""
请分析以下消息内容，并为数据书"{storybook_name}"提取相关的语义关键词。

消息内容：
{message}

期望的分类：{', '.join(expected_categories) if expected_categories else '所有相关分类'}

请提取出与该数据书相关的关键词，并按以下JSON格式返回：

{{
    "gender": {{
        "female_keywords": {{"关键词1": 2.0, "关键词2": 1.5}},
        "male_keywords": {{"关键词3": -1.5}}
    }},
    "sports": {{
        "running_keywords": {{"关键词4": 3.0}},
        "athletics_keywords": {{"关键词5": 2.5}}
    }},
    "personality": {{
        "positive_traits": {{"关键词6": 1.5}},
        "negative_traits": {{"关键词7": -1.0}}
    }},
    "occupation": {{
        "student_keywords": {{"关键词8": 2.5}},
        "artist_keywords": {{"关键词9": 3.0}},
        "adventurer_keywords": {{"关键词10": 3.0}}
    }},
    "race": {{
        "human_keywords": {{"关键词11": 2.0}},
        "elf_keywords": {{"关键词12": 3.0}},
        "dark_elf_keywords": {{"关键词13": 3.5}}
    }}
}}

权重说明：
- 正值表示正相关（1.0-3.5）
- 负值表示负相关（-0.5到-2.0）
- 数值越大影响越强
- 只返回确实相关的关键词，不相关的分类可以为空

只返回JSON，不要其他解释。
"""
        
        # 获取AI配置
        ai_config = get_ai_config()
        medium_model_config = None
        
        # 查找medium_performance模型
        chat_models = ai_config.get('chat_models', {})
        models = chat_models.get('models', {}) if isinstance(chat_models, dict) else {}
        
        # 查找合适的模型
        for model_name, model_config in models.items():
            if isinstance(model_config, dict):
                if 'medium' in model_name.lower() or model_config.get('tier') == 'medium_performance':
                    medium_model_config = model_config
                    break
        
        if not medium_model_config and models:
            # 备用：使用第一个可用模型
            medium_model_config = list(models.values())[0]
        
        if not medium_model_config:
            raise Exception("没有可用的AI模型配置")
        
        # 调用AI
        response = stream_chat_response_with_config(prompt, "", medium_model_config)
        
        # 解析响应
        try:
            # 提取JSON部分
            response_text = response.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            
            extracted_data = json.loads(response_text.strip())
            return extracted_data
            
        except json.JSONDecodeError as e:
            logger.error(f"AI响应JSON解析失败: {e}, 响应内容: {response}")
            # 返回空结构
            return {
                "gender": {"female_keywords": {}, "male_keywords": {}},
                "sports": {"running_keywords": {}, "athletics_keywords": {}, "general_sports_keywords": {}},
                "personality": {"positive_traits": {}, "negative_traits": {}},
                "occupation": {"student_keywords": {}, "artist_keywords": {}, "adventurer_keywords": {}},
                "race": {"human_keywords": {}, "elf_keywords": {}, "dark_elf_keywords": {}}
            }
        
    except Exception as e:
        logger.error(f"AI关键词提取失败: {e}")
        raise

# 错误处理
@semantic_correction_bp.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': '接口不存在'}), 404

@semantic_correction_bp.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': '服务器内部错误'}), 500
