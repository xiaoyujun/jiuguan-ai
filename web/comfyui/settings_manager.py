#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图片生成设置管理器
管理AI绘画的生成参数和配置
"""

import json
import os
import sys
from typing import Dict, Any, Optional

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

from web.utils import PathManager


class ImageGenerationSettings:
    """图片生成设置管理器"""
    
    def __init__(self):
        """初始化设置管理器"""
        self.settings_file = os.path.join(os.path.dirname(__file__), "image_settings.json")
        self.default_settings = {
            "generation_params": {
                "width": 768,
                "height": 768,
                "steps": 25,
                "cfg": 7.5,
                "negative_prompt": "low quality, blurry, bad anatomy, worst quality",
                "batch_size": 1
            },
            "prompt_settings": {
                "style_prefix": "",
                "style_suffix": "high quality, masterpiece, anime style illustration",
                "enable_auto_negative": True,
                "quality_keywords": ["detailed face", "expressive eyes", "soft lighting"]
            },
            "comfyui_settings": {
                "server_address": "127.0.0.1:8188",
                "workflow_file": "LL杰出.json",
                "timeout": 300
            },
            "ui_settings": {
                "show_prompt": False,
                "show_generation_info": False,
                "auto_open_image": False
            }
        }
        
        # 加载设置
        self.settings = self.load_settings()
    
    def load_settings(self) -> Dict[str, Any]:
        """
        加载设置文件
        
        Returns:
            设置字典
        """
        try:
            if os.path.exists(self.settings_file):
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    loaded_settings = json.load(f)
                
                # 合并默认设置和加载的设置
                settings = self.default_settings.copy()
                for category, values in loaded_settings.items():
                    if category in settings:
                        settings[category].update(values)
                    else:
                        settings[category] = values
                
                return settings
            else:
                # 如果文件不存在，创建默认设置文件
                self.save_settings(self.default_settings)
                return self.default_settings.copy()
                
        except Exception as e:
            print(f"加载设置文件失败: {e}")
            return self.default_settings.copy()
    
    def save_settings(self, settings: Dict[str, Any] = None) -> bool:
        """
        保存设置到文件
        
        Args:
            settings: 要保存的设置字典，如果为None则保存当前设置
            
        Returns:
            是否保存成功
        """
        try:
            settings_to_save = settings or self.settings
            
            with open(self.settings_file, 'w', encoding='utf-8') as f:
                json.dump(settings_to_save, f, ensure_ascii=False, indent=2)
            
            if settings:
                self.settings = settings
            
            print(f"设置已保存到: {self.settings_file}")
            return True
            
        except Exception as e:
            print(f"保存设置文件失败: {e}")
            return False
    
    def get_generation_params(self) -> Dict[str, Any]:
        """
        获取图片生成参数
        
        Returns:
            生成参数字典
        """
        return self.settings.get('generation_params', {})
    
    def update_generation_params(self, params: Dict[str, Any]) -> bool:
        """
        更新图片生成参数
        
        Args:
            params: 要更新的参数字典
            
        Returns:
            是否更新成功
        """
        try:
            self.settings['generation_params'].update(params)
            return self.save_settings()
        except Exception as e:
            print(f"更新生成参数失败: {e}")
            return False
    
    def get_prompt_settings(self) -> Dict[str, Any]:
        """
        获取提示词设置
        
        Returns:
            提示词设置字典
        """
        return self.settings.get('prompt_settings', {})
    
    def update_prompt_settings(self, settings: Dict[str, Any]) -> bool:
        """
        更新提示词设置
        
        Args:
            settings: 要更新的设置字典
            
        Returns:
            是否更新成功
        """
        try:
            self.settings['prompt_settings'].update(settings)
            return self.save_settings()
        except Exception as e:
            print(f"更新提示词设置失败: {e}")
            return False
    
    def get_comfyui_settings(self) -> Dict[str, Any]:
        """
        获取ComfyUI设置
        
        Returns:
            ComfyUI设置字典
        """
        return self.settings.get('comfyui_settings', {})
    
    def update_comfyui_settings(self, settings: Dict[str, Any]) -> bool:
        """
        更新ComfyUI设置
        
        Args:
            settings: 要更新的设置字典
            
        Returns:
            是否更新成功
        """
        try:
            self.settings['comfyui_settings'].update(settings)
            return self.save_settings()
        except Exception as e:
            print(f"更新ComfyUI设置失败: {e}")
            return False
    
    def get_ui_settings(self) -> Dict[str, Any]:
        """
        获取UI设置
        
        Returns:
            UI设置字典
        """
        return self.settings.get('ui_settings', {})
    
    def update_ui_settings(self, settings: Dict[str, Any]) -> bool:
        """
        更新UI设置
        
        Args:
            settings: 要更新的设置字典
            
        Returns:
            是否更新成功
        """
        try:
            self.settings['ui_settings'].update(settings)
            return self.save_settings()
        except Exception as e:
            print(f"更新UI设置失败: {e}")
            return False
    
    def get_all_settings(self) -> Dict[str, Any]:
        """
        获取所有设置
        
        Returns:
            完整设置字典
        """
        return self.settings.copy()
    
    def reset_to_defaults(self) -> bool:
        """
        重置为默认设置
        
        Returns:
            是否重置成功
        """
        try:
            self.settings = self.default_settings.copy()
            return self.save_settings()
        except Exception as e:
            print(f"重置设置失败: {e}")
            return False
    
    def validate_settings(self, settings: Dict[str, Any]) -> Dict[str, Any]:
        """
        验证设置的有效性
        
        Args:
            settings: 要验证的设置
            
        Returns:
            验证结果字典，包含errors和warnings
        """
        errors = []
        warnings = []
        
        # 验证生成参数
        if 'generation_params' in settings:
            gen_params = settings['generation_params']
            
            # 检查数值范围
            if 'width' in gen_params:
                width = gen_params['width']
                if not isinstance(width, int) or width < 64 or width > 2048:
                    errors.append("图片宽度必须在64-2048之间")
            
            if 'height' in gen_params:
                height = gen_params['height']
                if not isinstance(height, int) or height < 64 or height > 2048:
                    errors.append("图片高度必须在64-2048之间")
            
            if 'steps' in gen_params:
                steps = gen_params['steps']
                if not isinstance(steps, int) or steps < 1 or steps > 100:
                    errors.append("采样步数必须在1-100之间")
            
            if 'cfg' in gen_params:
                cfg = gen_params['cfg']
                if not isinstance(cfg, (int, float)) or cfg < 1 or cfg > 20:
                    errors.append("CFG值必须在1-20之间")
            
            if 'batch_size' in gen_params:
                batch_size = gen_params['batch_size']
                if not isinstance(batch_size, int) or batch_size < 1 or batch_size > 8:
                    warnings.append("批次大小建议在1-8之间")
        
        # 验证ComfyUI设置
        if 'comfyui_settings' in settings:
            comfyui = settings['comfyui_settings']
            
            if 'timeout' in comfyui:
                timeout = comfyui['timeout']
                if not isinstance(timeout, int) or timeout < 30:
                    warnings.append("超时时间建议不少于30秒")
        
        return {
            'errors': errors,
            'warnings': warnings,
            'valid': len(errors) == 0
        }


# 全局设置实例
_settings_instance = None

def get_settings_manager() -> ImageGenerationSettings:
    """
    获取设置管理器单例
    
    Returns:
        设置管理器实例
    """
    global _settings_instance
    if _settings_instance is None:
        _settings_instance = ImageGenerationSettings()
    return _settings_instance


def test_settings_manager():
    """测试设置管理器"""
    print("测试图片生成设置管理器...")
    
    # 获取设置管理器
    settings = get_settings_manager()
    
    print(f"当前生成参数: {settings.get_generation_params()}")
    print(f"当前提示词设置: {settings.get_prompt_settings()}")
    print(f"当前ComfyUI设置: {settings.get_comfyui_settings()}")
    
    # 测试更新设置
    new_params = {
        "width": 1024,
        "height": 1024,
        "steps": 30
    }
    
    if settings.update_generation_params(new_params):
        print("✅ 设置更新成功")
    else:
        print("❌ 设置更新失败")
    
    print(f"更新后的生成参数: {settings.get_generation_params()}")


if __name__ == "__main__":
    test_settings_manager()
