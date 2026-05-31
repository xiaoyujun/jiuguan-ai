#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ComfyUI图片生成模块

提供AI角色扮演聊天系统的图片生成功能
"""

__version__ = "1.0.0"
__author__ = "AI Assistant"

# 导入主要组件
try:
    from .prompt_generator import PromptGenerator
    from .image_generator import ImageGenerationService
    from .image_generation_routes import image_bp, handle_generate_image_command
    
    __all__ = [
        'PromptGenerator',
        'ImageGenerationService', 
        'image_bp',
        'handle_generate_image_command'
    ]
    
except ImportError as e:
    # 如果导入失败，只导出基本信息
    print(f"Warning: Failed to import ComfyUI components: {e}")
    __all__ = []
