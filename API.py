import json
import re
from typing import Dict, Generator, Optional

from web.model_config_utils import ensure_chat_model_structure, resolve_model_config
from web.utils import ConfigManager, PathManager

try:
    from openai import OpenAI
except Exception as e:
    OpenAI = None
    _OPENAI_IMPORT_ERROR = e


def _ensure_openai_installed():
    if OpenAI is None:
        raise RuntimeError(
            f"未安装 openai 依赖（{_OPENAI_IMPORT_ERROR}）。"
            "请运行 安装依赖.bat 或执行: python -m pip install -r requirements.txt"
        )


def _load_runtime_config() -> Dict:
    config = ConfigManager.load_config()
    changed = ensure_chat_model_structure(config)
    if changed:
        ConfigManager.save_config(config)
    return config


def _get_fallback_model_config() -> Dict:
    return {
        "key": "",
        "base_url": "https://api.siliconflow.cn/v1",
        "model": "deepseek-ai/DeepSeek-V3",
        "temperature": None,
        "max_tokens": None,
        "context_window": 10240,
        "effective_context_window": 10240,
        "stream": True,
    }


def _build_completion_kwargs(
    model_config: Dict,
    user_prompt: str,
    system_prompt: str,
    *,
    stream_override: Optional[bool] = None,
) -> Dict:
    stream = model_config.get("stream", True) if stream_override is None else stream_override

    kwargs = {
        "model": model_config.get("model"),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": stream,
    }

    # 流式场景下请求服务端附带 usage 统计，便于观察 prompt 缓存命中
    # OpenAI / DeepSeek / SiliconFlow / vLLM 等主流兼容端点都支持该字段，
    # 不支持的端点通常会忽略未知参数；如个别端点报错可由调用方再行关闭。
    if stream:
        kwargs["stream_options"] = {"include_usage": True}

    optional_fields = [
        "temperature",
        "max_tokens",
        "top_p",
        "presence_penalty",
        "frequency_penalty",
    ]
    for field in optional_fields:
        value = model_config.get(field)
        if value is not None:
            kwargs[field] = value

    return kwargs


def _resolve_model_by_key(model_key: str) -> Optional[Dict]:
    config = _load_runtime_config()
    return resolve_model_config(config, model_key)


def _print_prompt_stats(user_prompt: str, system_prompt: str):
    print("\n" + "=" * 80)
    print("🤖 传入给大语言模型的完整内容")
    print("=" * 80)

    print(f"\n📋 系统提示 (System Prompt) - 长度: {len(system_prompt)} 字符")
    print("-" * 60)
    print(system_prompt)
    print("-" * 60)

    print(f"\n💬 用户提示 (User Prompt) - 长度: {len(user_prompt)} 字符")
    print("-" * 60)
    print(user_prompt)
    print("-" * 60)

    chinese_chars = len(re.findall(r"[\u4e00-\u9fff]", system_prompt + user_prompt))
    english_chars = len(re.findall(r"[a-zA-Z]", system_prompt + user_prompt))
    other_chars = len(system_prompt + user_prompt) - chinese_chars - english_chars
    estimated_tokens = int(chinese_chars * 1.5 + english_chars + other_chars * 0.5)

    print("\n📊 内容统计:")
    print(f"   • 总字符数: {len(system_prompt + user_prompt)}")
    print(f"   • 中文字符: {chinese_chars}")
    print(f"   • 英文字符: {english_chars}")
    print(f"   • 其他字符: {other_chars}")
    print(f"   • 预估Token数: {estimated_tokens}")
    print("=" * 80)


def load_chat_model_config():
    """加载当前聊天模型配置。"""
    try:
        config = _load_runtime_config()
        current_model_key = config.get("chat_models", {}).get("current_model")
        current_model_config = resolve_model_config(config, current_model_key)
        if current_model_config:
            return current_model_config

        key_path = PathManager.get_key_path()
        if key_path.exists():
            with open(key_path, "r", encoding="utf-8") as file:
                legacy_config = json.load(file)
            legacy_config.setdefault("context_window", legacy_config.get("max_tokens", 10240))
            legacy_config.setdefault("effective_context_window", legacy_config.get("context_window", 10240))
            legacy_config.setdefault("stream", True)
            legacy_config["key"] = legacy_config.get("key") or legacy_config.get("api_key", "")
            return legacy_config

        return _get_fallback_model_config()
    except Exception as exc:
        print(f"加载配置文件时出错: {exc}")
        return None


def get_model_for_function(function_name: str):
    """根据功能名称获取对应的模型配置，采用三级分类规则。"""
    try:
        config = _load_runtime_config()
        model_tiers = config.get("model_tiers", {})
        chat_models = config.get("chat_models", {})

        model_key = None
        if function_name in ["chat", "narrator", "summary", "story_creation"]:
            model_key = model_tiers.get("high_performance", {}).get("default_model")
        elif function_name in ["data_analysis", "story_organization", "temp_data_analysis", "smart_commands", "ai_analysis"]:
            model_key = model_tiers.get("medium_performance", {}).get("default_model")
        elif function_name in ["simple_analysis", "basic_filter"]:
            model_key = model_tiers.get("low_performance", {}).get("default_model")
        elif function_name == "vision":
            model_key = model_tiers.get("high_performance", {}).get("default_model")
        else:
            model_key = model_tiers.get("high_performance", {}).get("default_model")

        if not model_key:
            model_key = chat_models.get("current_model")

        resolved = resolve_model_config(config, model_key)
        if resolved:
            return resolved
    except Exception as exc:
        print(f"获取功能模型配置时出错: {exc}")
    return None


def _stream_response_content(response, model: str) -> Generator[str, None, None]:
    response_content = ""
    chunk_count = 0
    usage_info = None

    print("\n🔄 开始接收流式响应:")
    print("-" * 60)

    for chunk in response:
        chunk_count += 1

        # 末尾的 usage chunk 通常 choices 为空，需要单独处理而不是直接跳过
        if getattr(chunk, "usage", None):
            usage_info = chunk.usage

        if not hasattr(chunk, "choices") or not chunk.choices:
            continue

        choice = chunk.choices[0]
        if hasattr(choice, "delta") and choice.delta and getattr(choice.delta, "content", None):
            content = choice.delta.content
            response_content += content

            if model.startswith("gemini") and len(content) > 50:
                import time

                words = content.split()
                current_chunk = ""
                for index, word in enumerate(words):
                    current_chunk += word + " "
                    if (index + 1) % 3 == 0 or word.endswith(("。", "！", "？", "!", "?", ".", "，", ",")):
                        print(current_chunk, end="", flush=True)
                        yield current_chunk
                        current_chunk = ""
                        time.sleep(0.05)
                if current_chunk:
                    print(current_chunk, end="", flush=True)
                    yield current_chunk
            else:
                print(content, end="", flush=True)
                yield content

        # 不再在 finish_reason 处提前 break，避免漏掉随后到达的 usage chunk

    print("\n" + "-" * 60)
    print(f"✅ 响应完成 - 总长度: {len(response_content)} 字符，共处理 {chunk_count} 个 chunk")

    if usage_info is not None:
        try:
            prompt_tokens = getattr(usage_info, "prompt_tokens", None)
            completion_tokens = getattr(usage_info, "completion_tokens", None)

            # 兼容多家服务商的缓存字段命名
            cached_tokens = None
            details = getattr(usage_info, "prompt_tokens_details", None)
            if details is not None:
                cached_tokens = getattr(details, "cached_tokens", None)
            if cached_tokens is None:
                # DeepSeek 风格：prompt_cache_hit_tokens / prompt_cache_miss_tokens
                cached_tokens = getattr(usage_info, "prompt_cache_hit_tokens", None)

            print("📈 Token 使用与缓存命中:")
            print(f"   • prompt_tokens     : {prompt_tokens}")
            print(f"   • completion_tokens : {completion_tokens}")
            if cached_tokens is not None and prompt_tokens:
                ratio = (cached_tokens / prompt_tokens * 100) if prompt_tokens else 0
                print(f"   • cached_tokens     : {cached_tokens}  (命中率 {ratio:.1f}%)")
            else:
                print(f"   • cached_tokens     : {cached_tokens}  (上游未返回或无缓存)")
        except Exception as exc:
            print(f"⚠️ 解析 usage 失败: {exc}")
    print("=" * 80)


def stream_chat_response_with_config(user_prompt: str, system_prompt: str, model_config: dict):
    """
    使用提供的模型配置直接进行聊天响应。

    :param user_prompt: 发送给模型的用户提示
    :param system_prompt: 发送给模型的系统提示
    :param model_config: 完整的模型配置字典
    """
    _print_prompt_stats(user_prompt, system_prompt)

    try:
        api_key = model_config.get("key") or model_config.get("api_key")
        base_url = model_config.get("base_url")
        model = model_config.get("model")

        if not base_url:
            print("错误: base_url未找到或为空。")
            return
        if not model:
            print("错误: 模型名称未找到或为空。")
            return

        _ensure_openai_installed()
        client = OpenAI(
            api_key=api_key or "EMPTY",
            base_url=base_url,
            timeout=60.0,
            max_retries=2,
        )

        print("\n⚙️ 模型配置信息:")
        print(f"   • 模型名称: {model}")
        print(f"   • 温度参数: {model_config.get('temperature', '默认')}")
        print(f"   • 最大输出Token: {model_config.get('max_tokens', '自动')}")
        print(f"   • 上下文预算: {model_config.get('effective_context_window', '自动')}")
        print(f"   • 流式模式: {model_config.get('stream', True)}")
        print(f"   • API地址: {base_url}")
        print("=" * 80)

        response = client.chat.completions.create(
            **_build_completion_kwargs(model_config, user_prompt, system_prompt)
        )
        yield from _stream_response_content(response, model)
    except Exception as exc:
        print(f"调用流式API时出错: {exc}")
        error_msg = str(exc)

        if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
            print(f"❌ API请求超时: {exc}")
            yield "[ERROR] API请求超时，请稍后重试"
        elif "connection" in error_msg.lower() or "refused" in error_msg.lower():
            print(f"❌ 连接被拒绝: {exc}")
            yield "[ERROR] 无法连接到AI服务器，请检查网络或API配置"
        elif "unauthorized" in error_msg.lower() or "401" in error_msg:
            print(f"❌ API密钥无效: {exc}")
            yield "[ERROR] API密钥无效，请检查配置"
        elif "rate limit" in error_msg.lower() or "429" in error_msg:
            print(f"❌ API调用频率限制: {exc}")
            yield "[ERROR] API调用过于频繁，请稍后重试"
        else:
            print(f"❌ 未知API错误: {exc}")
            yield f"[ERROR] API调用失败: {error_msg}"
        return


def stream_chat_response(user_prompt: str, system_prompt: str, model_key: str = None):
    """
    加载配置、初始化客户端、发送请求并以流式方式处理聊天响应。

    :param user_prompt: 发送给模型的用户提示。
    :param system_prompt: 发送给模型的系统提示。
    :param model_key: 指定使用的模型键名，如果为None则使用默认当前模型。
    """
    _print_prompt_stats(user_prompt, system_prompt)

    try:
        config = load_chat_model_config()
        if not config:
            print("错误: 无法加载配置文件。")
            return

        if model_key:
            specific_model = _resolve_model_by_key(model_key)
            if specific_model:
                config = specific_model
                print(f"使用指定模型: {model_key} -> {config['model']}")
            else:
                function_model = get_model_for_function(model_key)
                if function_model:
                    config = function_model
                    print(f"使用功能模型: {model_key} -> {config['model']}")
                else:
                    print(f"警告: 未找到模型 {model_key}，使用默认模型")

        api_key = config.get("key") or config.get("api_key")
        base_url = config.get("base_url")
        if not base_url:
            print("错误: base_url未找到或为空。")
            return

        _ensure_openai_installed()
        client = OpenAI(
            api_key=api_key or "EMPTY",
            base_url=base_url,
            timeout=60.0,
            max_retries=2,
        )
    except RuntimeError as exc:
        print(str(exc))
        return
    except Exception as exc:
        print(f"配置加载错误: {exc}")
        return

    try:
        model = config.get("model", "deepseek-ai/DeepSeek-V3")
        print("\n⚙️ 模型配置信息:")
        print(f"   • 模型名称: {model}")
        print(f"   • 温度参数: {config.get('temperature', '默认')}")
        print(f"   • 最大输出Token: {config.get('max_tokens', '自动')}")
        print(f"   • 上下文预算: {config.get('effective_context_window', '自动')}")
        print(f"   • 流式模式: {config.get('stream', True)}")
        print(f"   • API地址: {base_url}")
        print("=" * 80)

        response = client.chat.completions.create(
            **_build_completion_kwargs(config, user_prompt, system_prompt)
        )
        yield from _stream_response_content(response, model)
    except Exception as exc:
        print(f"调用流式API时出错: {exc}")
        error_msg = str(exc)

        if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
            print(f"❌ API请求超时: {exc}")
            yield "[ERROR] API请求超时，请稍后重试"
        elif "connection" in error_msg.lower() or "refused" in error_msg.lower():
            print(f"❌ 连接被拒绝: {exc}")
            yield "[ERROR] 无法连接到AI服务器，请检查网络或API配置"
        elif "unauthorized" in error_msg.lower() or "401" in error_msg:
            print(f"❌ API密钥无效: {exc}")
            yield "[ERROR] API密钥无效，请检查配置"
        elif "rate limit" in error_msg.lower() or "429" in error_msg:
            print(f"❌ API调用频率限制: {exc}")
            yield "[ERROR] API调用过于频繁，请稍后重试"
        else:
            print(f"❌ 未知API错误: {exc}")
            yield f"[ERROR] API调用失败: {error_msg}"
        return


if __name__ == "__main__":
    system_prompt = "你会输出json格式的信息"
    chat_prompt = "模仿女仆说话"
    stream_chat_response(chat_prompt, system_prompt)
