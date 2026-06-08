"""
直连生图功能的轻量级用户设置。

ComfyUI 时代的 `image_settings.json` 涉及工作流文件、采样步数、
CFG 等参数，新方案完全交给上游模型，本地只保留通用参数：
负面提示词、生成尺寸、参考图数量上限以及默认尺寸。
设置仍持久化到 `data/image_gen_settings.json`，使用 `ConfigManager`
风格的轻封装。
"""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict

from web.utils import PathManager


_SETTINGS_FILE_NAME = "image_gen_settings.json"

DEFAULT_SETTINGS: Dict[str, Any] = {
    "default_negative_prompt": (
        "low quality, blurry, deformed, extra fingers, text, watermark"
    ),
    "default_size": "1024x1024",
    "max_reference_images": 4,
    "include_player_reference": True,
    "include_chat_context": True,
    "chat_context_messages": 6,
}

_ALLOWED_SIZES = (
    "512x512",
    "768x768",
    "1024x1024",
    "1024x1536",
    "1536x1024",
    "1024x1792",
    "1792x1024",
)


def _settings_path() -> Path:
    return PathManager.get_data_root() / _SETTINGS_FILE_NAME


def load_settings() -> Dict[str, Any]:
    """读取生图设置；不存在时返回默认值的副本。"""
    path = _settings_path()
    if not path.exists():
        return deepcopy(DEFAULT_SETTINGS)

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"⚠️ 读取生图设置失败，回退默认: {exc}")
        return deepcopy(DEFAULT_SETTINGS)

    merged = deepcopy(DEFAULT_SETTINGS)
    if isinstance(data, dict):
        for key in DEFAULT_SETTINGS:
            if key in data and data[key] is not None:
                merged[key] = data[key]
    return _normalize(merged)


def save_settings(updates: Dict[str, Any]) -> Dict[str, Any]:
    """写入生图设置，仅保留白名单字段。"""
    current = load_settings()
    if not isinstance(updates, dict):
        return current

    for key in DEFAULT_SETTINGS:
        if key in updates and updates[key] is not None:
            current[key] = updates[key]

    current = _normalize(current)

    path = _settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(current, f, ensure_ascii=False, indent=4)
    return current


def get_allowed_sizes() -> tuple:
    return _ALLOWED_SIZES


def _normalize(settings: Dict[str, Any]) -> Dict[str, Any]:
    size = str(settings.get("default_size") or DEFAULT_SETTINGS["default_size"])
    if size not in _ALLOWED_SIZES:
        size = DEFAULT_SETTINGS["default_size"]
    settings["default_size"] = size

    try:
        max_refs = int(settings.get("max_reference_images") or DEFAULT_SETTINGS["max_reference_images"])
    except (TypeError, ValueError):
        max_refs = DEFAULT_SETTINGS["max_reference_images"]
    settings["max_reference_images"] = max(1, min(max_refs, 6))

    try:
        ctx_messages = int(settings.get("chat_context_messages") or DEFAULT_SETTINGS["chat_context_messages"])
    except (TypeError, ValueError):
        ctx_messages = DEFAULT_SETTINGS["chat_context_messages"]
    settings["chat_context_messages"] = max(0, min(ctx_messages, 30))

    settings["include_player_reference"] = bool(
        settings.get("include_player_reference", DEFAULT_SETTINGS["include_player_reference"])
    )
    settings["include_chat_context"] = bool(
        settings.get("include_chat_context", DEFAULT_SETTINGS["include_chat_context"])
    )

    negative = settings.get("default_negative_prompt")
    if not isinstance(negative, str):
        negative = DEFAULT_SETTINGS["default_negative_prompt"]
    settings["default_negative_prompt"] = negative.strip()

    return settings
