"""
模型配置工具。

用于将旧的“每个模型单独填写 base_url/api_key”结构，兼容迁移到
“供应商 + 模型”结构，同时为前后端提供统一的解析结果。
"""

from __future__ import annotations

import re
from typing import Any, Dict, Tuple
from urllib.parse import urlparse

DEFAULT_CHAT_MODEL_KEY = "deepseek-v3"
DEFAULT_PROVIDER_KEY = "siliconflow"
DEFAULT_PROVIDER_NAME = "SiliconFlow"
DEFAULT_BASE_URL = "https://api.siliconflow.cn/v1"
DEFAULT_MODEL_ID = "deepseek-ai/DeepSeek-V3"
DEFAULT_MODEL_NAME = "DeepSeek V3"
DEFAULT_CONTEXT_WINDOW = 10240


def slugify_key(value: str | None, default: str = "item") -> str:
    """将任意文本转换为稳定的 ASCII 键名。"""
    text = (value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or default


def infer_provider_name(base_url: str | None) -> str:
    """根据 base_url 推断一个较友好的供应商名称。"""
    if not base_url:
        return "OpenAI Compatible"

    try:
        hostname = urlparse(base_url).hostname or ""
    except Exception:
        hostname = ""

    hostname = hostname.lower().replace("www.", "")
    if not hostname:
        return "OpenAI Compatible"

    core = hostname.split(".")[0].replace("-", " ").replace("_", " ").strip()
    if not core:
        return hostname
    return " ".join(part.capitalize() for part in core.split())


def parse_optional_number(value: Any, *, as_int: bool = False) -> int | float | None:
    """将可选数字字段转换为数字；空值返回 None。"""
    if value in (None, ""):
        return None

    try:
        return int(value) if as_int else float(value)
    except (TypeError, ValueError):
        return None


def _build_provider_fingerprint(base_url: str, api_key: str) -> Tuple[str, str]:
    return (base_url.strip(), api_key.strip())


def _generate_unique_key(base_key: str, existing_keys: Dict[str, Any]) -> str:
    if base_key not in existing_keys:
        return base_key

    index = 2
    while f"{base_key}-{index}" in existing_keys:
        index += 1
    return f"{base_key}-{index}"


def auto_generate_model_key(
    provider_key: str,
    model_name: str,
    existing_models: Dict[str, Any],
) -> str:
    """根据供应商和模型 ID 自动生成模型键。"""
    base_key = slugify_key(f"{provider_key}-{model_name}", default="model")
    return _generate_unique_key(base_key, existing_models)


def ensure_chat_model_structure(config: Dict[str, Any]) -> bool:
    """
    规范化 chat_models 结构。

    返回:
        bool: 是否对配置做了改动
    """
    changed = False

    chat_models = config.setdefault("chat_models", {})
    if not isinstance(chat_models, dict):
        config["chat_models"] = {}
        chat_models = config["chat_models"]
        changed = True

    models = chat_models.setdefault("models", {})
    if not isinstance(models, dict):
        chat_models["models"] = {}
        models = chat_models["models"]
        changed = True

    providers = chat_models.setdefault("providers", {})
    if not isinstance(providers, dict):
        chat_models["providers"] = {}
        providers = chat_models["providers"]
        changed = True

    provider_index: Dict[Tuple[str, str], str] = {}
    for provider_key, provider in list(providers.items()):
        if not isinstance(provider, dict):
            providers[provider_key] = {}
            provider = providers[provider_key]
            changed = True

        provider.setdefault("name", infer_provider_name(provider.get("base_url")))
        provider.setdefault("base_url", "")
        provider.setdefault("api_key", "")
        provider.setdefault("api_format", "openai")
        provider_index[_build_provider_fingerprint(provider["base_url"], provider["api_key"])] = provider_key

    for model_key, model_config in list(models.items()):
        if not isinstance(model_config, dict):
            models[model_key] = {}
            model_config = models[model_key]
            changed = True

        provider_key = model_config.get("provider_key")
        if provider_key and provider_key in providers:
            continue

        legacy_base_url = (model_config.get("base_url") or "").strip()
        legacy_api_key = (model_config.get("api_key") or "").strip()
        fingerprint = _build_provider_fingerprint(legacy_base_url, legacy_api_key)
        provider_key = provider_index.get(fingerprint)

        if not provider_key:
            provider_name = model_config.get("provider_name") or infer_provider_name(legacy_base_url)
            base_provider_key = slugify_key(provider_name, default="provider")
            provider_key = _generate_unique_key(base_provider_key, providers)
            providers[provider_key] = {
                "name": provider_name,
                "base_url": legacy_base_url,
                "api_key": legacy_api_key,
                "api_format": "openai",
            }
            provider_index[fingerprint] = provider_key
            changed = True

        model_config["provider_key"] = provider_key
        changed = True

    if not models:
        providers.setdefault(
            DEFAULT_PROVIDER_KEY,
            {
                "name": DEFAULT_PROVIDER_NAME,
                "base_url": DEFAULT_BASE_URL,
                "api_key": "",
                "api_format": "openai",
            },
        )
        models[DEFAULT_CHAT_MODEL_KEY] = {
            "name": DEFAULT_MODEL_NAME,
            "provider_key": DEFAULT_PROVIDER_KEY,
            "model": DEFAULT_MODEL_ID,
            "stream": True,
        }
        chat_models["current_model"] = DEFAULT_CHAT_MODEL_KEY
        changed = True

    current_model = chat_models.get("current_model")
    if current_model not in models:
        high_performance = config.get("model_tiers", {}).get("high_performance", {})
        candidate = high_performance.get("default_model")
        if candidate not in models:
            candidate = next(iter(models.keys()), DEFAULT_CHAT_MODEL_KEY)
        chat_models["current_model"] = candidate
        changed = True

    return changed


def resolve_model_config(config: Dict[str, Any], model_key: str | None) -> Dict[str, Any] | None:
    """解析模型配置，将供应商信息合并到模型配置中。"""
    ensure_chat_model_structure(config)

    chat_models = config.get("chat_models", {})
    models = chat_models.get("models", {})
    providers = chat_models.get("providers", {})

    if not model_key or model_key not in models:
        return None

    model_config = models[model_key]
    provider_key = model_config.get("provider_key")
    provider = providers.get(provider_key, {})

    temperature = parse_optional_number(model_config.get("temperature"))
    max_tokens = parse_optional_number(model_config.get("max_tokens"), as_int=True)
    context_window = parse_optional_number(model_config.get("context_window"), as_int=True)
    top_p = parse_optional_number(model_config.get("top_p"))
    presence_penalty = parse_optional_number(model_config.get("presence_penalty"))
    frequency_penalty = parse_optional_number(model_config.get("frequency_penalty"))

    stream_value = model_config.get("stream")
    if stream_value is None:
        stream_value = True

    resolved = {
        "model_key": model_key,
        "name": model_config.get("name") or model_config.get("model") or model_key,
        "provider_key": provider_key,
        "provider_name": provider.get("name") or infer_provider_name(provider.get("base_url")),
        "base_url": provider.get("base_url") or model_config.get("base_url") or "",
        "api_key": provider.get("api_key") or model_config.get("api_key") or "",
        "key": provider.get("api_key") or model_config.get("api_key") or "",
        "model": model_config.get("model") or "",
        "temperature": temperature,
        "max_tokens": max_tokens,
        "context_window": context_window,
        "top_p": top_p,
        "presence_penalty": presence_penalty,
        "frequency_penalty": frequency_penalty,
        "stream": bool(stream_value),
        "effective_context_window": context_window or max_tokens or DEFAULT_CONTEXT_WINDOW,
        "uses_advanced_settings": any(
            value is not None
            for value in (
                temperature,
                max_tokens,
                context_window,
                top_p,
                presence_penalty,
                frequency_penalty,
            )
        ),
    }
    return resolved


def resolve_all_models(config: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """获取所有已解析的模型配置。"""
    ensure_chat_model_structure(config)
    models = config.get("chat_models", {}).get("models", {})
    resolved_models: Dict[str, Dict[str, Any]] = {}

    for model_key in models.keys():
        resolved = resolve_model_config(config, model_key)
        if resolved:
            resolved_models[model_key] = resolved

    return resolved_models
