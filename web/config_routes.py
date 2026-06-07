"""
配置管理模块。

包含模型配置、供应商管理、语音设置等功能。
"""

import time
from typing import Any, Dict

import requests
from flask import Blueprint, jsonify, render_template, request

from web.model_config_utils import (
    REASONING_EFFORT_CHOICES,
    VERBOSITY_CHOICES,
    auto_generate_model_key,
    ensure_chat_model_structure,
    infer_provider_name,
    parse_optional_choice,
    parse_optional_extra_body,
    parse_optional_number,
    resolve_all_models,
    resolve_model_config,
    slugify_key,
)
from web.utils import ConfigManager

config_bp = Blueprint("config", __name__)

HIGH_PERFORMANCE_DEFAULT = {
    "name": "高性能模型",
    "description": "用于聊天、总结、旁白等核心功能",
    "functions": ["chat", "narrator", "summary", "story_creation"],
}

MEDIUM_PERFORMANCE_DEFAULT = {
    "name": "中级模型",
    "description": "用于AI智能指令、修改指令、数据分析等",
    "functions": ["data_analysis", "story_organization", "temp_data_analysis", "smart_commands"],
}

LOW_PERFORMANCE_DEFAULT = {
    "name": "低级模型",
    "description": "用于简单的数据分析等基础任务",
    "functions": ["simple_analysis", "basic_filter"],
}


def _load_config() -> Dict[str, Any]:
    config = ConfigManager.load_config()
    changed = ensure_chat_model_structure(config)
    if changed:
        ConfigManager.save_config(config)
    return config


def _ensure_model_tiers(config: Dict[str, Any]) -> Dict[str, Any]:
    model_tiers = config.setdefault("model_tiers", {})
    if "high_performance" not in model_tiers:
        model_tiers["high_performance"] = HIGH_PERFORMANCE_DEFAULT.copy()
    if "medium_performance" not in model_tiers:
        model_tiers["medium_performance"] = MEDIUM_PERFORMANCE_DEFAULT.copy()
    if "low_performance" not in model_tiers:
        model_tiers["low_performance"] = LOW_PERFORMANCE_DEFAULT.copy()
    return model_tiers


def _cleanup_dangling_model_references(config: Dict[str, Any], removed_keys) -> None:
    """删除模型后，把 current_model 和 model_tiers 里指向被删模型的引用清空。"""
    removed = set(removed_keys or [])
    if not removed:
        return

    chat_models = config.setdefault("chat_models", {})
    if chat_models.get("current_model") in removed:
        chat_models["current_model"] = None

    model_tiers = config.get("model_tiers") or {}
    for tier_config in model_tiers.values():
        if isinstance(tier_config, dict) and tier_config.get("default_model") in removed:
            tier_config["default_model"] = None


def _save_config(config: Dict[str, Any]) -> bool:
    return ConfigManager.save_config(config)


def _get_model_payload(data: Dict[str, Any], models: Dict[str, Any], model_key: str | None = None) -> tuple[str, Dict[str, Any]]:
    provider_key = (data.get("provider_key") or "").strip()
    model_name = (data.get("model") or "").strip()

    if not provider_key:
        raise ValueError("请选择供应商")
    if not model_name:
        raise ValueError("模型 ID 不能为空")

    payload: Dict[str, Any] = {
        "name": (data.get("name") or model_name).strip(),
        "provider_key": provider_key,
        "model": model_name,
        "stream": bool(data.get("stream", True)),
    }

    optional_fields = {
        "temperature": parse_optional_number(data.get("temperature")),
        "max_tokens": parse_optional_number(data.get("max_tokens"), as_int=True),
        "context_window": parse_optional_number(data.get("context_window"), as_int=True),
        "top_p": parse_optional_number(data.get("top_p")),
        "presence_penalty": parse_optional_number(data.get("presence_penalty")),
        "frequency_penalty": parse_optional_number(data.get("frequency_penalty")),
        "reasoning_effort": parse_optional_choice(
            data.get("reasoning_effort"), REASONING_EFFORT_CHOICES
        ),
        "verbosity": parse_optional_choice(data.get("verbosity"), VERBOSITY_CHOICES),
        "thinking_budget": parse_optional_number(
            data.get("thinking_budget"), as_int=True
        ),
        "extra_body": parse_optional_extra_body(data.get("extra_body")),
    }

    # extra_body 字段允许接收原始字符串；如果用户填了非 JSON，提示而不是静默丢弃
    raw_extra = data.get("extra_body")
    if (
        raw_extra not in (None, "")
        and not isinstance(raw_extra, dict)
        and optional_fields["extra_body"] is None
    ):
        raise ValueError("额外参数（extra_body）必须是合法的 JSON 对象")

    for field, value in optional_fields.items():
        if value is not None:
            payload[field] = value

    final_model_key = (model_key or data.get("model_key") or "").strip()
    if not final_model_key:
        final_model_key = auto_generate_model_key(provider_key, model_name, models)

    return final_model_key, payload


def _get_provider_payload(data: Dict[str, Any], providers: Dict[str, Any], provider_key: str | None = None) -> tuple[str, Dict[str, Any]]:
    name = (data.get("name") or "").strip()
    base_url = (data.get("base_url") or "").strip()
    api_key = (data.get("api_key") or "").strip()

    if not name:
        raise ValueError("供应商名称不能为空")
    if not base_url:
        raise ValueError("供应商地址不能为空")

    final_provider_key = (provider_key or data.get("provider_key") or "").strip()
    if not final_provider_key:
        final_provider_key = slugify_key(name, default="provider")
        suffix = 2
        base_key = final_provider_key
        while final_provider_key in providers:
            final_provider_key = f"{base_key}-{suffix}"
            suffix += 1

    payload = {
        "name": name,
        "base_url": base_url.rstrip("/"),
        "api_key": api_key,
        "api_format": "openai",
    }

    return final_provider_key, payload


def _build_config_response(config: Dict[str, Any]) -> Dict[str, Any]:
    ensure_chat_model_structure(config)
    model_tiers = _ensure_model_tiers(config)
    chat_models = config.get("chat_models", {})

    return {
        "success": True,
        "current_model": chat_models.get("current_model"),
        "providers": chat_models.get("providers", {}),
        "models": resolve_all_models(config),
        "model_tiers": model_tiers,
    }


def _build_completion_kwargs(model_data: Dict[str, Any], *, stream: bool = False) -> Dict[str, Any]:
    request_kwargs: Dict[str, Any] = {
        "model": model_data.get("model"),
        "messages": [{"role": "user", "content": "请回复'测试成功'"}],
        "stream": stream,
    }

    temperature = model_data.get("temperature")
    max_tokens = model_data.get("max_tokens")
    top_p = model_data.get("top_p")
    presence_penalty = model_data.get("presence_penalty")
    frequency_penalty = model_data.get("frequency_penalty")
    reasoning_effort = model_data.get("reasoning_effort")
    verbosity = model_data.get("verbosity")
    thinking_budget = model_data.get("thinking_budget")
    extra_body_user = model_data.get("extra_body")

    if temperature is not None:
        request_kwargs["temperature"] = temperature
    if max_tokens is not None:
        request_kwargs["max_tokens"] = min(max_tokens, 50)
    else:
        request_kwargs["max_tokens"] = 50
    if top_p is not None:
        request_kwargs["top_p"] = top_p
    if presence_penalty is not None:
        request_kwargs["presence_penalty"] = presence_penalty
    if frequency_penalty is not None:
        request_kwargs["frequency_penalty"] = frequency_penalty
    if reasoning_effort:
        request_kwargs["reasoning_effort"] = reasoning_effort
    if verbosity:
        request_kwargs["verbosity"] = verbosity

    extra_body: Dict[str, Any] = {}
    if isinstance(extra_body_user, dict) and extra_body_user:
        extra_body.update(extra_body_user)
    if thinking_budget is not None and "thinking_budget" not in extra_body:
        extra_body["thinking_budget"] = thinking_budget
    if extra_body:
        request_kwargs["extra_body"] = extra_body

    return request_kwargs


def _test_model_connection(model_data: Dict[str, Any]) -> Dict[str, Any]:
    api_key = model_data.get("api_key") or model_data.get("key")
    base_url = model_data.get("base_url")
    model_name = model_data.get("model")

    if not base_url or not model_name:
        raise ValueError("模型配置不完整，请检查供应商地址和模型 ID")

    try:
        from openai import OpenAI
    except Exception as exc:
        raise RuntimeError(f"未安装 openai 依赖: {exc}") from exc

    client = OpenAI(api_key=api_key or "EMPTY", base_url=base_url)

    start_time = time.time()
    response = client.chat.completions.create(**_build_completion_kwargs(model_data))
    response_time = int((time.time() - start_time) * 1000)
    content = response.choices[0].message.content if response.choices else "无响应内容"
    tokens_used = response.usage.total_tokens if getattr(response, "usage", None) else 0

    return {
        "success": True,
        "message": f"模型连接测试成功！响应: {content}",
        "response": content,
        "response_time": response_time,
        "tokens_used": tokens_used,
        "model": model_name,
        "base_url": base_url,
    }


# 聊天模型相关 API
@config_bp.route("/api/chat_models")
def get_chat_models():
    """获取所有聊天模型配置。"""
    try:
        config = _load_config()
        return jsonify(
            {
                "current_model": config.get("chat_models", {}).get("current_model"),
                "providers": config.get("chat_models", {}).get("providers", {}),
                "models": resolve_all_models(config),
            }
        )
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@config_bp.route("/api/chat_models/current", methods=["GET"])
def get_current_chat_model():
    """获取当前使用的聊天模型。"""
    try:
        config = _load_config()
        current_model = config.get("chat_models", {}).get("current_model")
        current_config = resolve_model_config(config, current_model)

        return jsonify(
            {
                "success": True,
                "current_model": current_model,
                "config": current_config,
            }
        )
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@config_bp.route("/api/chat_models/current", methods=["POST"])
def set_current_chat_model():
    """设置当前使用的聊天模型，并同步到高性能模型配置。"""
    try:
        data = request.json or {}
        model_key = (data.get("model_key") or "").strip()
        if not model_key:
            return jsonify({"success": False, "error": "模型键不能为空"}), 400

        config = _load_config()
        models = config.get("chat_models", {}).get("models", {})
        if model_key not in models:
            return jsonify({"success": False, "error": "模型不存在"}), 404

        config["chat_models"]["current_model"] = model_key
        model_tiers = _ensure_model_tiers(config)
        model_tiers["high_performance"]["default_model"] = model_key

        if not _save_config(config):
            return jsonify({"success": False, "error": "保存配置失败"}), 500

        return jsonify({"success": True, "current_model": model_key})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@config_bp.route("/api/model_providers", methods=["GET"])
def get_model_providers():
    """获取所有供应商配置。"""
    try:
        config = _load_config()
        return jsonify(
            {
                "success": True,
                "providers": config.get("chat_models", {}).get("providers", {}),
            }
        )
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@config_bp.route("/api/model_providers", methods=["POST"])
def create_model_provider():
    """创建供应商。"""
    try:
        config = _load_config()
        providers = config.get("chat_models", {}).get("providers", {})
        provider_key, payload = _get_provider_payload(request.json or {}, providers)

        if provider_key in providers:
            return jsonify({"success": False, "error": "供应商已存在"}), 400

        providers[provider_key] = payload
        if not _save_config(config):
            return jsonify({"success": False, "error": "保存配置失败"}), 500

        return jsonify({"success": True, "provider_key": provider_key})
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@config_bp.route("/api/model_providers/<path:provider_key>", methods=["PUT"])
def update_model_provider(provider_key: str):
    """更新供应商。"""
    try:
        config = _load_config()
        providers = config.get("chat_models", {}).get("providers", {})
        if provider_key not in providers:
            return jsonify({"success": False, "error": "供应商不存在"}), 404

        _, payload = _get_provider_payload(request.json or {}, providers, provider_key=provider_key)
        providers[provider_key] = payload

        if not _save_config(config):
            return jsonify({"success": False, "error": "保存配置失败"}), 500

        return jsonify({"success": True})
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@config_bp.route("/api/model_providers/<path:provider_key>", methods=["DELETE"])
def delete_model_provider(provider_key: str):
    """删除供应商（强制删除，会同时移除绑定该供应商的模型）。"""
    try:
        config = _load_config()
        chat_models = config.get("chat_models", {})
        providers = chat_models.get("providers", {})
        models = chat_models.get("models", {})

        if provider_key not in providers:
            return jsonify({"success": False, "error": "供应商不存在"}), 404

        # 强制删除：先把绑定该供应商的模型一并删掉
        removed_models = [
            key for key, model in list(models.items())
            if model.get("provider_key") == provider_key
        ]
        for key in removed_models:
            models.pop(key, None)

        del providers[provider_key]

        # 清理分层引用 + 当前模型，由 ensure_chat_model_structure 自动挑选候选
        _cleanup_dangling_model_references(config, removed_models)
        ensure_chat_model_structure(config)

        if not _save_config(config):
            return jsonify({"success": False, "error": "保存配置失败"}), 500

        return jsonify({
            "success": True,
            "removed_models": removed_models,
            "current_model": config.get("chat_models", {}).get("current_model"),
        })
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@config_bp.route("/api/model_providers/<path:provider_key>/fetch_models", methods=["POST"])
def fetch_provider_models(provider_key: str):
    """从供应商读取可用模型列表。"""
    try:
        config = _load_config()
        providers = config.get("chat_models", {}).get("providers", {})
        provider = providers.get(provider_key)
        if not provider:
            return jsonify({"success": False, "error": "供应商不存在"}), 404

        base_url = (provider.get("base_url") or "").rstrip("/")
        api_key = provider.get("api_key") or ""
        if not base_url:
            return jsonify({"success": False, "error": "供应商地址不能为空"}), 400

        headers = {"Accept": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        response = requests.get(
            f"{base_url}/models",
            headers=headers,
            timeout=20,
        )

        if response.status_code >= 400:
            return jsonify(
                {
                    "success": False,
                    "error": f"读取模型列表失败: HTTP {response.status_code} - {response.text}",
                }
            ), 400

        payload = response.json()
        raw_models = payload.get("data", [])
        models = []
        for item in raw_models:
            if not isinstance(item, dict):
                continue
            model_id = item.get("id")
            if not model_id:
                continue
            models.append(
                {
                    "id": model_id,
                    "owned_by": item.get("owned_by", ""),
                    "object": item.get("object", ""),
                }
            )

        models.sort(key=lambda item: item["id"].lower())

        return jsonify(
            {
                "success": True,
                "provider_key": provider_key,
                "provider_name": provider.get("name") or infer_provider_name(base_url),
                "models": models,
            }
        )
    except requests.RequestException as exc:
        return jsonify({"success": False, "error": f"请求供应商失败: {exc}"}), 500
    except ValueError as exc:
        return jsonify({"success": False, "error": f"供应商返回了无效 JSON: {exc}"}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@config_bp.route("/api/chat_models", methods=["POST"])
def create_chat_model():
    """创建聊天模型。"""
    try:
        config = _load_config()
        chat_models = config.get("chat_models", {})
        models = chat_models.get("models", {})
        providers = chat_models.get("providers", {})

        model_key, payload = _get_model_payload(request.json or {}, models)
        if payload["provider_key"] not in providers:
            return jsonify({"success": False, "error": "所选供应商不存在"}), 400

        if model_key in models:
            return jsonify({"success": False, "error": "模型配置已存在"}), 400

        models[model_key] = payload

        if not chat_models.get("current_model"):
            chat_models["current_model"] = model_key
            _ensure_model_tiers(config)["high_performance"]["default_model"] = model_key

        if not _save_config(config):
            return jsonify({"success": False, "error": "保存配置失败"}), 500

        return jsonify({"success": True, "model_key": model_key})
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@config_bp.route("/api/chat_models/<path:model_key>", methods=["PUT"])
def update_chat_model(model_key: str):
    """更新聊天模型。"""
    try:
        config = _load_config()
        chat_models = config.get("chat_models", {})
        models = chat_models.get("models", {})
        providers = chat_models.get("providers", {})

        if model_key not in models:
            return jsonify({"success": False, "error": "模型配置不存在"}), 404

        _, payload = _get_model_payload(request.json or {}, models, model_key=model_key)
        if payload["provider_key"] not in providers:
            return jsonify({"success": False, "error": "所选供应商不存在"}), 400

        models[model_key] = payload
        if not _save_config(config):
            return jsonify({"success": False, "error": "保存配置失败"}), 500

        return jsonify({"success": True})
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@config_bp.route("/api/chat_models/<path:model_key>", methods=["DELETE"])
def delete_chat_model(model_key: str):
    """删除聊天模型（强制删除，会自动切换当前模型与分层引用）。"""
    try:
        config = _load_config()
        chat_models = config.get("chat_models", {})
        models = chat_models.get("models", {})

        if model_key not in models:
            return jsonify({"success": False, "error": "要删除的模型配置不存在"}), 404

        del models[model_key]

        # 清理 current_model / 分层引用，再让结构化工具补一个候选
        _cleanup_dangling_model_references(config, [model_key])
        ensure_chat_model_structure(config)

        if not _save_config(config):
            return jsonify({"success": False, "error": "保存配置失败"}), 500

        return jsonify({
            "success": True,
            "current_model": config.get("chat_models", {}).get("current_model"),
        })
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@config_bp.route("/api/chat_models/<path:model_key>/test", methods=["POST"])
def test_chat_model(model_key: str):
    """测试已保存的聊天模型。"""
    try:
        config = _load_config()
        model_data = resolve_model_config(config, model_key)
        if not model_data:
            return jsonify({"success": False, "error": "模型配置不存在"}), 404

        result = _test_model_connection(model_data)
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": f"测试失败: {exc}"}), 500


# 模型配置页面
@config_bp.route("/model_config")
def model_config_page():
    """供应商与模型配置页面。"""
    return render_template("model_config.html")


@config_bp.route("/api/model_config", methods=["GET"])
def api_model_config():
    """返回模型配置页面所需的完整数据。"""
    try:
        config = _load_config()
        return jsonify(_build_config_response(config))
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@config_bp.route("/api/model_tiers", methods=["POST"])
def save_model_tiers():
    """保存三级模型配置。"""
    try:
        data = request.json or {}
        config = _load_config()
        model_tiers = _ensure_model_tiers(config)
        model_keys = set(config.get("chat_models", {}).get("models", {}).keys())

        tier_mapping = {
            "high_performance": HIGH_PERFORMANCE_DEFAULT,
            "medium_performance": MEDIUM_PERFORMANCE_DEFAULT,
            "low_performance": LOW_PERFORMANCE_DEFAULT,
        }

        for tier_key, default_value in tier_mapping.items():
            selected_model = data.get(tier_key)
            if not selected_model:
                continue
            if selected_model not in model_keys:
                return jsonify({"success": False, "error": f"{tier_key} 选择了不存在的模型"}), 400
            model_tiers.setdefault(tier_key, default_value.copy())
            model_tiers[tier_key]["default_model"] = selected_model

        high_performance_model = model_tiers.get("high_performance", {}).get("default_model")
        if high_performance_model in model_keys:
            config["chat_models"]["current_model"] = high_performance_model

        if not _save_config(config):
            return jsonify({"success": False, "error": "保存配置失败"}), 500

        return jsonify(
            {
                "success": True,
                "message": "三级模型配置保存成功",
                "current_model": config.get("chat_models", {}).get("current_model"),
            }
        )
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@config_bp.route("/api/test_model", methods=["POST"])
def test_model():
    """测试临时输入或前端传入的模型配置。"""
    try:
        data = request.json or {}
        if not data:
            return jsonify({"success": False, "error": "缺少测试数据"}), 400

        model_data = {
            "api_key": (data.get("api_key") or data.get("key") or "").strip(),
            "base_url": (data.get("base_url") or "").strip(),
            "model": (data.get("model") or "").strip(),
            "temperature": parse_optional_number(data.get("temperature")),
            "max_tokens": parse_optional_number(data.get("max_tokens"), as_int=True),
            "top_p": parse_optional_number(data.get("top_p")),
            "presence_penalty": parse_optional_number(data.get("presence_penalty")),
            "frequency_penalty": parse_optional_number(data.get("frequency_penalty")),
            "reasoning_effort": parse_optional_choice(
                data.get("reasoning_effort"), REASONING_EFFORT_CHOICES
            ),
            "verbosity": parse_optional_choice(data.get("verbosity"), VERBOSITY_CHOICES),
            "thinking_budget": parse_optional_number(
                data.get("thinking_budget"), as_int=True
            ),
            "extra_body": parse_optional_extra_body(data.get("extra_body")),
            "stream": bool(data.get("stream", True)),
        }

        result = _test_model_connection(model_data)
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": f"测试失败: {exc}"}), 500


# 自动分析设置 API 已移除 - 对应功能已被删除


# 获取动态关键词 API
@config_bp.route("/api/get_dynamic_keywords", methods=["GET"])
def get_dynamic_keywords():
    """获取从数据书中动态收集的关键词。"""
    try:
        import sys
        from pathlib import Path

        parent_dir = str(Path(__file__).parent)
        if parent_dir not in sys.path:
            sys.path.insert(0, parent_dir)

        from chat_routes import get_all_summary_keywords_from_storybooks

        keywords = get_all_summary_keywords_from_storybooks()

        return jsonify(
            {
                "success": True,
                "keywords": keywords,
                "count": len(keywords),
                "message": f"成功获取 {len(keywords)} 个关键词",
            }
        )
    except Exception as exc:
        return jsonify(
            {
                "success": False,
                "error": str(exc),
                "keywords": [],
            }
        ), 500


# 语音设置 API
@config_bp.route("/api/voice_settings", methods=["GET", "POST"])
def api_voice_settings():
    """语音设置 API。"""
    if request.method == "GET":
        try:
            config = ConfigManager.load_config()
            voice_settings = config.get("voice_settings", {})
            return jsonify({"success": True, "settings": voice_settings})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 500

    try:
        data = request.json or {}
        config = ConfigManager.load_config()

        if "voice_settings" not in config:
            config["voice_settings"] = {}

        voice_settings = config["voice_settings"]
        if "auto_play" in data:
            voice_settings["auto_play"] = bool(data["auto_play"])

        ConfigManager.save_config(config)
        return jsonify({"success": True, "message": "语音设置保存成功"})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
