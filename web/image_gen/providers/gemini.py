"""Google Gemini 风格的生图 provider。

调用 ``models/{model}:generateContent``，把文字提示词与角色头像
（``inline_data``）一起塞进 ``contents`` 数组，让模型把参考图作为
强约束直接出图。``base_url`` 应指向 ``v1beta/`` 或 ``v1/`` 根路径，
``api_key`` 走 ``?key=`` 查询参数。
"""

from __future__ import annotations

import base64
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlencode

import requests

from .base import ImageProvider, ImageProviderError, ImageResult


class GeminiImageProvider(ImageProvider):
    name = "gemini"

    def generate(self) -> ImageResult:
        req = self.request
        self._ensure(bool(req.base_url), "供应商基础 URL 不能为空")
        self._ensure(bool(req.model), "模型 ID 不能为空")
        self._ensure(bool(req.api_key), "Gemini 生图必须提供 API Key")

        endpoint = self._build_endpoint()
        payload = self._build_payload()
        headers = self._build_headers()

        response = requests.post(
            endpoint,
            json=payload,
            headers=headers,
            timeout=req.timeout,
        )

        if response.status_code >= 400:
            raise ImageProviderError(
                f"Gemini 生图接口返回 HTTP {response.status_code}: {response.text[:500]}"
            )

        try:
            body = response.json()
        except ValueError as exc:
            raise ImageProviderError(f"Gemini 生图返回非 JSON: {exc}: {response.text[:200]}") from exc

        images, text = self._parse_images(body)
        if not images:
            raise ImageProviderError(f"Gemini 生图未返回任何图像: {body!r}")

        return ImageResult(images=images, response_text=text, raw_payload=body)

    # ---------------------------------------------------------------
    def _build_endpoint(self) -> str:
        base = self.request.base_url.rstrip("/")
        # 去掉 OpenAI 兼容层后缀，避免误把 `.../v1` 拼成 `.../v1/models`
        # 同时支持 `.../v1beta` 与裸根
        params = urlencode({"key": self.request.api_key})
        return f"{base}/models/{self.request.model}:generateContent?{params}"

    def _build_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.request.extra_headers:
            headers.update(self.request.extra_headers)
        return headers

    def _build_payload(self) -> Dict[str, Any]:
        req = self.request
        parts: List[Dict[str, Any]] = []

        prompt = req.prompt
        if req.negative_prompt:
            prompt = f"{prompt}\n\n[negative prompt] {req.negative_prompt}"
        parts.append({"text": prompt})

        for image in req.references:
            parts.append(
                {
                    "inline_data": {
                        "mime_type": image.mime_type,
                        "data": image.data_base64,
                    }
                }
            )

        payload: Dict[str, Any] = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseModalities": ["IMAGE", "TEXT"],
                "candidateCount": max(1, req.n),
            },
        }

        if req.extra_body:
            extra_generation = req.extra_body.get("generationConfig")
            if isinstance(extra_generation, dict):
                payload["generationConfig"].update(extra_generation)

            safety = req.extra_body.get("safetySettings") or req.extra_body.get("safety_settings")
            if isinstance(safety, list):
                payload["safetySettings"] = safety

            system_instruction = req.extra_body.get("systemInstruction") or req.extra_body.get("system_instruction")
            if isinstance(system_instruction, (str, dict)):
                payload["systemInstruction"] = (
                    {"parts": [{"text": system_instruction}]}
                    if isinstance(system_instruction, str)
                    else system_instruction
                )

        return payload

    def _parse_images(self, body: Dict[str, Any]) -> Tuple[List[Tuple[str, bytes]], str]:
        candidates = body.get("candidates") or []
        images: List[Tuple[str, bytes]] = []
        text_chunks: List[str] = []

        for candidate in candidates:
            content = (candidate or {}).get("content") or {}
            for part in content.get("parts") or []:
                inline = part.get("inline_data") or part.get("inlineData")
                if inline and isinstance(inline, dict):
                    data_b64 = inline.get("data")
                    mime = inline.get("mime_type") or inline.get("mimeType") or "image/png"
                    if data_b64:
                        try:
                            images.append((mime, base64.b64decode(data_b64)))
                        except (TypeError, ValueError) as exc:
                            raise ImageProviderError(f"解析 Gemini inline_data 失败: {exc}") from exc
                text = part.get("text")
                if isinstance(text, str) and text.strip():
                    text_chunks.append(text.strip())

        return images, "\n".join(text_chunks).strip()
