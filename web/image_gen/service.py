"""
生图编排服务。

把「聊天里的 /生图 命令」串成端到端流程：
1. 解析角色 / 玩家 / 提及的额外角色
2. 拼装直接交给多模态模型的中文提示词（不再做翻译/拆词）
3. 收集角色头像作为参考图
4. 选择 image-kind 模型，调用对应 provider
5. 把生成的图片落盘到 ``data/聊天记录/生成图片/``，
   并复制一份到 ``web/static/generated_images/`` 供前端渲染
"""

from __future__ import annotations

import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from web.utils import ConfigManager, DataManager, PathManager

from .providers import (
    ImageProviderError,
    ImageRequest,
    get_provider,
)
from .reference_images import (
    ReferenceImage,
    collect_reference_images,
    extract_mentioned_names,
)
from .settings import load_settings

DEFAULT_SIZE = "1024x1024"
DEFAULT_N = 1
DEFAULT_TIMEOUT = 180

# Web 目录与 PathManager 中的静态生图复制目录保持一致，
# 避免老代码里写死路径的回归
_WEB_STATIC_GENERATED = (
    Path(__file__).resolve().parent.parent / "static" / "generated_images"
)


class ImageGenerationError(RuntimeError):
    """生图失败的统一异常。"""


def generate_for_chat(
    *,
    role_name: str,
    chat_history: Sequence[str],
    first_person: bool = False,
    extra_user_text: str = "",
) -> Dict[str, Any]:
    """
    主入口：从聊天上下文出发，调用上游模型并落盘出图。

    返回结构与历史 ComfyUI 版本兼容，方便前端不变更：
        {
          'success': True,
          'message': '',
          'image_paths': ['/static/generated_images/xxx.png'],
          'prompt': '...',
          'is_image_generation': True,
          'is_first_person': True/False,
        }
    """

    config = ConfigManager.load_config()
    model_data = _resolve_image_model_config(config)
    settings = load_settings()

    primary_name = role_name
    additional_context = _last_user_message(chat_history, role_name)
    chat_snippet = _build_chat_snippet(
        chat_history,
        max_messages=settings.get("chat_context_messages", 6),
        enabled=settings.get("include_chat_context", True),
    )

    # 显式 @ 提及的角色作为额外参考
    mention_pool = " ".join(filter(None, [additional_context, extra_user_text]))
    extra_names = extract_mentioned_names(mention_pool)

    references = collect_reference_images(
        primary_name=primary_name,
        extra_names=extra_names,
        max_images=int(settings.get("max_reference_images", 4)),
    )

    role_data = DataManager.load_role_data(role_name) or {}
    current_player = config.get("current_player") or ""
    player_data = (
        DataManager.load_player_data(current_player) if current_player else None
    ) or {}

    prompt = _compose_prompt(
        role_name=role_name,
        first_person=first_person,
        role_data=role_data,
        player_name=current_player if not first_person else "",
        player_data=player_data if not first_person else {},
        latest_user_message=additional_context,
        extra_user_text=extra_user_text,
        chat_snippet=chat_snippet,
        mentioned_names=extra_names,
        reference_names=[ref.name for ref in references],
    )

    request = ImageRequest(
        prompt=prompt,
        model=model_data["model"],
        base_url=model_data["base_url"],
        api_key=model_data["api_key"],
        references=references,
        negative_prompt=settings.get("default_negative_prompt", ""),
        size=settings.get("default_size", DEFAULT_SIZE),
        n=DEFAULT_N,
        extra_body=model_data.get("extra_body") or None,
        timeout=DEFAULT_TIMEOUT,
    )

    provider_cls = get_provider(model_data["api_format"])
    provider = provider_cls(request)

    try:
        result = provider.generate()
    except ImageProviderError as exc:
        raise ImageGenerationError(str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise ImageGenerationError(f"生图调用异常: {exc}") from exc

    saved_paths = _persist_results(
        images=result.images,
        role_name=role_name,
        first_person=first_person,
    )

    return {
        "success": True,
        "message": "",
        "image_paths": saved_paths,
        "prompt": prompt,
        "is_image_generation": True,
        "is_first_person": first_person,
        "provider": provider.name,
        "model": model_data["model"],
        "reference_images": [ref.name for ref in references],
        "response_text": result.response_text,
    }


# ---------------------------------------------------------------------
# Model resolution
# ---------------------------------------------------------------------
def _resolve_image_model_config(config: Mapping[str, Any]) -> Dict[str, Any]:
    """挑选用于生图的模型，强制 ``kind == 'image'``。

    优先顺序：
        1. ``model_tiers.image_generation.default_model``
        2. ``chat_models.models`` 中第一个 ``kind == 'image'`` 的模型
    解析失败时抛 ``ImageGenerationError``。
    """
    chat_models = config.get("chat_models") or {}
    models: Dict[str, Any] = chat_models.get("models") or {}
    providers: Dict[str, Any] = chat_models.get("providers") or {}

    tiers = config.get("model_tiers") or {}
    default_key = (tiers.get("image_generation") or {}).get("default_model")

    candidate_key = None
    if default_key and default_key in models and (models[default_key] or {}).get("kind") == "image":
        candidate_key = default_key

    if not candidate_key:
        for key, value in models.items():
            if isinstance(value, dict) and value.get("kind") == "image":
                candidate_key = key
                break

    if not candidate_key:
        raise ImageGenerationError(
            "尚未配置生图模型。请到 模型配置 中新建一个类型为「生图」的模型，"
            "并在分层配置里把它设为生图模型。"
        )

    model_def = models.get(candidate_key) or {}
    provider_key = model_def.get("provider_key")
    provider_def = providers.get(provider_key) or {}

    base_url = (provider_def.get("base_url") or "").rstrip("/")
    api_key = provider_def.get("api_key") or ""
    api_format = (provider_def.get("api_format") or "openai").strip().lower()
    model_id = model_def.get("model") or ""

    if not base_url or not model_id:
        raise ImageGenerationError(
            "生图模型配置不完整：缺少基础 URL 或模型 ID，请检查模型配置页。"
        )

    return {
        "model_key": candidate_key,
        "model": model_id,
        "base_url": base_url,
        "api_key": api_key,
        "api_format": api_format,
        "extra_body": model_def.get("extra_body"),
    }


# ---------------------------------------------------------------------
# Prompt composition
# ---------------------------------------------------------------------
def _compose_prompt(
    *,
    role_name: str,
    first_person: bool,
    role_data: Mapping[str, Any],
    player_name: str,
    player_data: Mapping[str, Any],
    latest_user_message: str,
    extra_user_text: str,
    chat_snippet: str,
    mentioned_names: Sequence[str],
    reference_names: Sequence[str],
) -> str:
    """拼装直接交给多模态模型的中文提示词。

    多模态生图模型接受自然语言描述，因此不再做关键词翻译，把场景
    信息原样拼好即可。
    """
    sections: List[str] = []

    sections.append(
        "请基于参考图中的角色样貌，绘制一幅高质量插画。" if reference_names else "请绘制一幅高质量插画。"
    )

    sections.append(f"主体角色：{role_name}")

    appearance = _format_appearance(role_data)
    if appearance:
        sections.append(f"角色外貌设定：{appearance}")

    if not first_person and player_name:
        sections.append(f"玩家角色：{player_name}")
        player_appearance = _format_appearance(player_data)
        if player_appearance:
            sections.append(f"玩家外貌设定：{player_appearance}")

    if mentioned_names:
        sections.append(f"画面同时包含：{', '.join(mentioned_names)}")

    if first_person:
        sections.append("画面视角：第一人称视角，强化角色当下的状态、动作与环境互动，不读取玩家信息。")
    else:
        sections.append("画面视角：第三人称插画构图，自然展示主体角色与场景。")

    if latest_user_message:
        sections.append(f"最近一条玩家描述：{latest_user_message}")

    if extra_user_text:
        sections.append(f"用户补充：{extra_user_text}")

    if chat_snippet:
        sections.append("聊天上下文（用于参考剧情，不必照搬）：\n" + chat_snippet)

    if reference_names:
        sections.append(
            "参考图说明：以参考图中的人物相貌为强约束，保持一致；服饰与场景可按描述调整。"
        )

    sections.append("整体风格：高质量、明亮自然光、构图稳定、避免文字与水印。")

    return "\n".join(filter(None, sections))


def _format_appearance(role_data: Mapping[str, Any]) -> str:
    """从角色 / 玩家数据里抽外貌相关字段。

    数据书统一遵守 ``属性`` 嵌套结构，但顶层字段也兼容老格式。
    任何缺失都直接跳过，不要往提示词里塞 ``None``。
    """
    if not isinstance(role_data, Mapping):
        return ""

    attributes = role_data.get("属性") if isinstance(role_data.get("属性"), Mapping) else role_data
    appearance = (
        attributes.get("外貌特征")
        or attributes.get("外貌")
        or attributes.get("appearance")
    )

    if isinstance(appearance, Mapping):
        items = []
        for key, value in appearance.items():
            if value in (None, ""):
                continue
            items.append(f"{key}：{value}")
        return "; ".join(items)

    if isinstance(appearance, list):
        return "; ".join(str(v) for v in appearance if v)

    if isinstance(appearance, str):
        return appearance.strip()

    description = attributes.get("描述") if isinstance(attributes, Mapping) else None
    if isinstance(description, str):
        return description.strip()

    return ""


def _last_user_message(history: Iterable[str], role_name: str) -> str:
    if not history:
        return ""
    role_prefix = f"{role_name}:"
    for raw in reversed(list(history)):
        if not isinstance(raw, str):
            continue
        line = raw.strip()
        if not line or line.startswith(role_prefix):
            continue
        if ":" in line:
            return line.split(":", 1)[-1].strip()
        return line
    return ""


def _build_chat_snippet(history: Iterable[str], *, max_messages: int, enabled: bool) -> str:
    if not enabled or max_messages <= 0:
        return ""
    chunks: List[str] = []
    for raw in list(history)[-max_messages:]:
        if isinstance(raw, str):
            chunks.append(raw.strip())
    return "\n".join(c for c in chunks if c)


# ---------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------
def _persist_results(
    *,
    images: Sequence,
    role_name: str,
    first_person: bool,
) -> List[str]:
    output_dir = PathManager.get_chat_records_dir() / "生成图片"
    output_dir.mkdir(parents=True, exist_ok=True)

    web_dir = _WEB_STATIC_GENERATED
    web_dir.mkdir(parents=True, exist_ok=True)

    suffix_tag = "_POV" if first_person else ""
    web_paths: List[str] = []

    for index, payload in enumerate(images):
        mime, blob = payload
        ext = _ext_from_mime(mime)
        token = uuid.uuid4().hex[:8]
        timestamp = int(time.time() * 1000)
        filename = f"{role_name}{suffix_tag}_{timestamp}_{token}_{index}{ext}"

        target_path = output_dir / filename
        target_path.write_bytes(blob)

        web_target = web_dir / filename
        try:
            shutil.copy2(target_path, web_target)
        except Exception as exc:  # noqa: BLE001
            print(f"⚠️ 复制生成图片到 web 目录失败: {exc}")
            continue

        web_paths.append(f"/static/generated_images/{filename}")

    return web_paths


def _ext_from_mime(mime: str) -> str:
    mime = (mime or "").lower()
    if mime in ("image/jpeg", "image/jpg"):
        return ".jpg"
    if mime == "image/webp":
        return ".webp"
    if mime == "image/gif":
        return ".gif"
    return ".png"
