"""
语音生成API
提供语音合成相关的功能接口
"""

import importlib.util
import json
import sys
import time
from pathlib import Path

from web.utils import PathManager

# 动态导入web目录下的audio_generator模块
current_dir = Path(__file__).parent.parent  # 现在在web/core目录下
audio_generator_path = current_dir / 'audio_generator.py'

spec = importlib.util.spec_from_file_location("audio_generator", audio_generator_path)
audio_generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio_generator)

# 从动态导入的模块中获取函数
generate_audio = audio_generator.generate_audio
generate_single_sentence_audio = audio_generator.generate_single_sentence_audio
get_role_voice_id = audio_generator.get_role_voice_id
cleanup_old_audio_files = audio_generator.cleanup_old_audio_files


def generate_voice_for_text(text, role_name=None, voice_id=None):
    """
    为文本生成语音

    Args:
        text: 要转换的文本
        role_name: 角色名（可选）
        voice_id: 语音ID（可选，如果不提供会根据角色名获取）

    Returns:
        list: 生成的音频文件路径列表
    """
    if voice_id is None and role_name:
        voice_id = get_role_voice_id(role_name)

    return generate_audio(text, voice_id)


def generate_voice_for_sentence(sentence, role_name=None, voice_id=None, timestamp=None, index=0):
    """
    为单个句子生成语音

    Args:
        sentence: 要转换的句子
        role_name: 角色名（可选）
        voice_id: 语音ID（可选，如果不提供会根据角色名获取）
        timestamp: 时间戳（可选）
        index: 句子索引（可选）

    Returns:
        Path: 生成的音频文件路径，失败返回None
    """
    if voice_id is None and role_name:
        voice_id = get_role_voice_id(role_name)

    return generate_single_sentence_audio(sentence, voice_id, timestamp, index)


def clean_audio_files():
    """清理旧的音频文件"""
    cleanup_old_audio_files()


def save_voice_settings(role_name, voice_id):
    """
    保存角色的语音设置

    Args:
        role_name: 角色名
        voice_id: 语音ID

    Returns:
        bool: 保存是否成功
    """
    try:
        json_path = PathManager.get_roles_dir() / f"{role_name}.json"

        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                role_data = json.load(f)
        except FileNotFoundError:
            role_data = {}

        role_data['voice_id'] = voice_id

        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(role_data, f, ensure_ascii=False, indent=2)

        return True
    except Exception as e:
        print(f"保存语音设置失败: {e}")
        return False


def get_voice_settings(role_name):
    """
    获取角色的语音设置

    Args:
        role_name: 角色名

    Returns:
        dict: 包含语音设置的字典
    """
    try:
        json_path = PathManager.get_roles_dir() / f"{role_name}.json"
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data
    except FileNotFoundError:
        return {'voice_id': 'speech:lumabang:d2ejc5h719ns73evoen0:slscuunyvsbcaohwwxix'}
    except Exception as e:
        print(f"获取语音设置失败: {e}")
        return {'voice_id': 'speech:lumabang:d2ejc5h719ns73evoen0:slscuunyvsbcaohwwxix'}