"""生图相关 HTTP 路由。

替代旧的 ``web/comfyui/settings_routes.py`` + ``image_generation_routes.py``，
提供：
- ``/image-gen-settings`` 设置页
- ``/api/image-gen/settings`` GET/POST
- ``/api/image-gen/generate`` 直接触发出图（兼容旧前端 API 调用方）
"""

from __future__ import annotations

import traceback
from typing import Any, Dict

from flask import Blueprint, jsonify, render_template, request

from web.history_manager import load_history

from .service import (
    ImageGenerationError,
    generate_for_chat,
)
from .settings import (
    DEFAULT_SETTINGS,
    get_allowed_sizes,
    load_settings,
    save_settings,
)

image_gen_bp = Blueprint("image_gen", __name__)


@image_gen_bp.route("/image-gen-settings")
def image_gen_settings_page():
    return render_template(
        "image_gen_settings.html",
        defaults=DEFAULT_SETTINGS,
        allowed_sizes=get_allowed_sizes(),
    )


@image_gen_bp.route("/api/image-gen/settings", methods=["GET"])
def get_image_gen_settings():
    return jsonify(
        {
            "success": True,
            "settings": load_settings(),
            "allowed_sizes": list(get_allowed_sizes()),
            "defaults": DEFAULT_SETTINGS,
        }
    )


@image_gen_bp.route("/api/image-gen/settings", methods=["POST"])
def update_image_gen_settings():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"success": False, "error": "请求体必须是 JSON 对象"}), 400

    try:
        updated = save_settings(data)
        return jsonify({"success": True, "settings": updated})
    except OSError as exc:
        return jsonify({"success": False, "error": f"写入配置失败: {exc}"}), 500


@image_gen_bp.route("/api/image-gen/generate", methods=["POST"])
def api_generate_image():
    data = request.get_json(silent=True) or {}
    role_name = (data.get("role_name") or "").strip()
    if not role_name:
        return jsonify({"success": False, "error": "角色名称不能为空"}), 400

    first_person = bool(data.get("first_person"))
    extra_user_text = (data.get("extra_user_text") or "").strip()
    chat_history = data.get("chat_history")

    if not isinstance(chat_history, list):
        chat_history = load_history(role_name)

    try:
        result = generate_for_chat(
            role_name=role_name,
            chat_history=chat_history,
            first_person=first_person,
            extra_user_text=extra_user_text,
        )
        return jsonify(result)
    except ImageGenerationError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc()
        return jsonify({"success": False, "error": f"生图失败: {exc}"}), 500


def handle_generate_image_command(role_name: str, chat_history) -> Dict[str, Any]:
    """供 chat_routes 直接调用的便捷封装（兼容旧名）。"""
    try:
        return generate_for_chat(
            role_name=role_name,
            chat_history=chat_history or [],
            first_person=False,
        )
    except ImageGenerationError as exc:
        return {
            "success": False,
            "error": str(exc),
            "message": str(exc),
        }
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc()
        return {
            "success": False,
            "error": f"生图失败: {exc}",
            "message": f"生图失败: {exc}",
        }


def handle_generate_first_person_image_command(role_name: str, chat_history) -> Dict[str, Any]:
    try:
        return generate_for_chat(
            role_name=role_name,
            chat_history=chat_history or [],
            first_person=True,
        )
    except ImageGenerationError as exc:
        return {
            "success": False,
            "error": str(exc),
            "message": str(exc),
        }
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc()
        return {
            "success": False,
            "error": f"第一人称生图失败: {exc}",
            "message": f"第一人称生图失败: {exc}",
        }
