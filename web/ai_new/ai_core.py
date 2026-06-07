"""
AI核心调用模块
提供统一的AI模型调用接口
"""

import json
import requests
import traceback
from typing import Dict
import sys
import os

# 添加项目根目录到路径中，以便导入API.py
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from API import get_model_for_function


def call_ai_model(prompt: str, function_name: str, temperature: float = None, max_tokens: int = None, image_data: str = None) -> Dict:
    """
    统一的AI模型调用方法
    
    参数:
    prompt: 发送给AI的提示词
    function_name: 功能名称，用于确定使用哪个模型
    temperature: 温度参数，如果不指定则使用模型默认配置
    max_tokens: 最大token数，如果不指定则使用模型默认配置
    image_data: base64编码的图片数据，用于视觉模型调用
    
    返回:
    dict: 包含success, content, error等字段的结果字典
    """
    try:
        # 从API.py获取模型配置
        model_config = get_model_for_function(function_name)
        
        if not model_config:
            return {
                'success': False,
                'error': f'未找到功能 {function_name} 的模型配置'
            }
        
        # 构建消息内容
        if image_data:
            # 视觉模型调用，包含图片和文本
            message_content = [
                {
                    "type": "text",
                    "text": prompt
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_data}"
                    }
                }
            ]
        else:
            # 纯文本调用
            message_content = prompt
        
        # 使用传入的参数覆盖默认配置。对于未填写的高级项，直接交给供应商默认值。
        api_config = {
            "model": model_config["model"],
            "messages": [{"role": "user", "content": message_content}],
        }

        final_temperature = temperature if temperature is not None else model_config.get("temperature")
        final_max_tokens = max_tokens if max_tokens is not None else model_config.get("max_tokens")

        if final_temperature is not None:
            api_config["temperature"] = final_temperature
        if final_max_tokens is not None:
            api_config["max_tokens"] = final_max_tokens

        # 透传新一代模型推理参数（reasoning_effort / verbosity 等）
        for field in ("top_p", "presence_penalty", "frequency_penalty",
                      "reasoning_effort", "verbosity"):
            value = model_config.get(field)
            if value is not None:
                api_config[field] = value

        # thinking_budget + 自定义 extra_body 合并到顶层（HTTP 调用，无 SDK 的 extra_body 参数）
        thinking_budget = model_config.get("thinking_budget")
        user_extra = model_config.get("extra_body")
        if isinstance(user_extra, dict) and user_extra:
            for key, value in user_extra.items():
                if key not in api_config:
                    api_config[key] = value
        if thinking_budget is not None and "thinking_budget" not in api_config:
            api_config["thinking_budget"] = thinking_budget
        
        # 调用AI模型
        api_url = f"{model_config['base_url']}/chat/completions"
        print(f"🌐 正在调用AI API: {api_url}")
        print(f"🔑 使用模型: {model_config['model']}")
        print(f"📝 请求配置: {json.dumps(api_config, ensure_ascii=False, indent=2)}")
        
        headers = {
            "Content-Type": "application/json"
        }
        if model_config.get("key"):
            headers["Authorization"] = f"Bearer {model_config['key']}"

        response = requests.post(
            api_url,
            headers=headers,
            json=api_config,
            timeout=60
        )
        
        if response.status_code == 200:
            ai_response = response.json()
            
            if 'choices' in ai_response and ai_response['choices']:
                content = ai_response['choices'][0]['message']['content'].strip()
                
                # 清理可能的markdown格式
                if content.startswith('```json'):
                    content = content.replace('```json', '').replace('```', '').strip()
                elif content.startswith('```'):
                    content = content.replace('```', '').strip()
                
                return {
                    'success': True,
                    'content': content,
                    'model_info': {
                        'model': model_config['model'],
                        'function': function_name,
                        'temperature': api_config.get('temperature', '默认'),
                        'max_tokens': api_config.get('max_tokens', '自动')
                    }
                }
            else:
                return {
                    'success': False,
                    'error': 'AI响应格式错误：缺少choices字段'
                }
        else:
            return {
                'success': False,
                'error': f'AI模型调用失败: HTTP {response.status_code}, 响应: {response.text}'
            }
            
    except Exception as e:
        print(f"AI调用异常: {str(e)}")
        print(f"异常详情: {traceback.format_exc()}")
        return {
            'success': False,
            'error': f'AI模型调用错误: {str(e)}'
        }
