"""
直连生图模块

通过统一的 OpenAI / Gemini 风格 API 直接生成图片，并把
角色头像作为强参考图传入。所有生图模型的供应商、密钥、
基础 URL 与聊天模型共用 chat_models 配置体系，仅通过
``kind`` 字段区分用途。
"""

from .routes import image_gen_bp

__all__ = ["image_gen_bp"]
