#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ComfyUI API 客户端
用于调用ComfyUI工作流生成图像
"""

import json
import requests
import websocket
import threading
import time
import uuid
import os
from typing import Dict, Any, Optional, List
import argparse


class ComfyUIClient:
    """ComfyUI API客户端类"""
    
    def __init__(self, server_address: str = "127.0.0.1:8188", client_id: str = None):
        """
        初始化ComfyUI客户端
        
        Args:
            server_address: ComfyUI服务器地址，格式为 "ip:port"
            client_id: 客户端ID，如果为None则自动生成
        """
        self.server_address = server_address
        self.client_id = client_id or str(uuid.uuid4())
        self.ws = None
        self.ws_thread = None
        self.is_connected = False
        self.generation_complete = False
        self.generated_images = []
        
    def connect_websocket(self):
        """连接WebSocket"""
        try:
            ws_url = f"ws://{self.server_address}/ws?clientId={self.client_id}"
            self.ws = websocket.WebSocketApp(
                ws_url,
                on_message=self._on_message,
                on_error=self._on_error,
                on_close=self._on_close,
                on_open=self._on_open
            )
            
            # 在新线程中运行WebSocket
            self.ws_thread = threading.Thread(target=self.ws.run_forever)
            self.ws_thread.daemon = True
            self.ws_thread.start()
            
            # 等待连接建立
            timeout = 10
            start_time = time.time()
            while not self.is_connected and (time.time() - start_time) < timeout:
                time.sleep(0.1)
                
            if not self.is_connected:
                raise Exception("WebSocket连接超时")
                
        except Exception as e:
            print(f"WebSocket连接失败: {e}")
            raise
    
    def _on_open(self, ws):
        """WebSocket连接打开回调"""
        print("WebSocket连接已建立")
        self.is_connected = True
    
    def _on_message(self, ws, message):
        """WebSocket消息回调"""
        try:
            data = json.loads(message)
            if data['type'] == 'executing':
                if data['data']['node'] is None:
                    print("工作流执行完成")
                    self.generation_complete = True
                else:
                    print(f"正在执行节点: {data['data']['node']}")
        except Exception as e:
            print(f"处理WebSocket消息时出错: {e}")
    
    def _on_error(self, ws, error):
        """WebSocket错误回调"""
        print(f"WebSocket错误: {error}")
    
    def _on_close(self, ws, close_status_code, close_msg):
        """WebSocket关闭回调"""
        print("WebSocket连接已关闭")
        self.is_connected = False
    
    def load_workflow(self, workflow_path: str) -> Dict[str, Any]:
        """
        加载工作流文件
        
        Args:
            workflow_path: 工作流JSON文件路径
            
        Returns:
            工作流字典
        """
        try:
            with open(workflow_path, 'r', encoding='utf-8') as f:
                workflow = json.load(f)
            print(f"成功加载工作流: {workflow_path}")
            return workflow
        except Exception as e:
            print(f"加载工作流失败: {e}")
            raise
    
    def update_workflow_params(self, workflow: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """
        更新工作流参数
        
        Args:
            workflow: 工作流字典
            **kwargs: 要更新的参数
                - positive_prompt: 正面提示词
                - negative_prompt: 负面提示词
                - width: 图像宽度
                - height: 图像高度
                - steps: 采样步数
                - cfg: CFG值
                - seed: 随机种子
                - sampler_name: 采样器名称
                - scheduler: 调度器
                - denoise: 去噪强度
                - batch_size: 批次大小
                - filename_prefix: 文件名前缀
                - ckpt_name: 模型名称
                
        Returns:
            更新后的工作流字典
        """
        updated_workflow = workflow.copy()
        
        # 更新正面提示词
        if 'positive_prompt' in kwargs:
            if '6' in updated_workflow:
                updated_workflow['6']['inputs']['text'] = kwargs['positive_prompt']
        
        # 更新负面提示词
        if 'negative_prompt' in kwargs:
            if '7' in updated_workflow:
                updated_workflow['7']['inputs']['text'] = kwargs['negative_prompt']
        
        # 更新图像尺寸
        if 'width' in kwargs and '5' in updated_workflow:
            updated_workflow['5']['inputs']['width'] = kwargs['width']
        if 'height' in kwargs and '5' in updated_workflow:
            updated_workflow['5']['inputs']['height'] = kwargs['height']
        
        # 更新采样参数
        if '3' in updated_workflow:
            sampler_params = updated_workflow['3']['inputs']
            if 'steps' in kwargs:
                sampler_params['steps'] = kwargs['steps']
            if 'cfg' in kwargs:
                sampler_params['cfg'] = kwargs['cfg']
            if 'seed' in kwargs:
                sampler_params['seed'] = kwargs['seed']
            if 'sampler_name' in kwargs:
                sampler_params['sampler_name'] = kwargs['sampler_name']
            if 'scheduler' in kwargs:
                sampler_params['scheduler'] = kwargs['scheduler']
            if 'denoise' in kwargs:
                sampler_params['denoise'] = kwargs['denoise']
        
        # 更新批次大小
        if 'batch_size' in kwargs and '5' in updated_workflow:
            updated_workflow['5']['inputs']['batch_size'] = kwargs['batch_size']
        
        # 更新文件名前缀
        if 'filename_prefix' in kwargs and '9' in updated_workflow:
            updated_workflow['9']['inputs']['filename_prefix'] = kwargs['filename_prefix']
        
        # 更新模型名称
        if 'ckpt_name' in kwargs and '16' in updated_workflow:
            updated_workflow['16']['inputs']['ckpt_name'] = kwargs['ckpt_name']
        
        return updated_workflow
    
    def queue_prompt(self, workflow: Dict[str, Any]) -> str:
        """
        将工作流加入队列
        
        Args:
            workflow: 工作流字典
            
        Returns:
            提示ID
        """
        try:
            prompt_data = {
                "prompt": workflow,
                "client_id": self.client_id
            }
            
            response = requests.post(
                f"http://{self.server_address}/prompt",
                json=prompt_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                result = response.json()
                prompt_id = result['prompt_id']
                print(f"工作流已加入队列，提示ID: {prompt_id}")
                return prompt_id
            else:
                raise Exception(f"请求失败: {response.status_code} - {response.text}")
                
        except Exception as e:
            print(f"加入队列失败: {e}")
            raise
    
    def wait_for_completion(self, timeout: int = 300):
        """
        等待生成完成
        
        Args:
            timeout: 超时时间（秒）
        """
        print("等待图像生成完成...")
        start_time = time.time()
        
        while not self.generation_complete:
            if (time.time() - start_time) > timeout:
                raise Exception("生成超时")
            time.sleep(1)
        
        print("图像生成完成！")
    
    def get_history(self, prompt_id: str) -> Dict[str, Any]:
        """
        获取历史记录
        
        Args:
            prompt_id: 提示ID
            
        Returns:
            历史记录字典
        """
        try:
            response = requests.get(f"http://{self.server_address}/history/{prompt_id}")
            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"获取历史记录失败: {response.status_code}")
        except Exception as e:
            print(f"获取历史记录时出错: {e}")
            raise
    
    def download_images(self, prompt_id: str, output_dir: str = "./output") -> List[str]:
        """
        下载生成的图像
        
        Args:
            prompt_id: 提示ID
            output_dir: 输出目录
            
        Returns:
            下载的图像文件路径列表
        """
        try:
            # 创建输出目录
            os.makedirs(output_dir, exist_ok=True)
            
            # 获取历史记录
            history = self.get_history(prompt_id)
            
            downloaded_files = []
            
            if prompt_id in history:
                outputs = history[prompt_id]['outputs']
                
                for node_id, output in outputs.items():
                    if 'images' in output:
                        for image_info in output['images']:
                            filename = image_info['filename']
                            subfolder = image_info.get('subfolder', '')
                            image_type = image_info.get('type', 'output')
                            
                            # 构建下载URL
                            if subfolder:
                                url = f"http://{self.server_address}/view?filename={filename}&subfolder={subfolder}&type={image_type}"
                            else:
                                url = f"http://{self.server_address}/view?filename={filename}&type={image_type}"
                            
                            # 下载图像
                            response = requests.get(url)
                            if response.status_code == 200:
                                file_path = os.path.join(output_dir, filename)
                                with open(file_path, 'wb') as f:
                                    f.write(response.content)
                                downloaded_files.append(file_path)
                                print(f"图像已下载: {file_path}")
                            else:
                                print(f"下载图像失败: {filename}")
            
            return downloaded_files
            
        except Exception as e:
            print(f"下载图像时出错: {e}")
            raise
    
    def generate_image(self, workflow_path: str, output_dir: str = "./output", **kwargs) -> List[str]:
        """
        生成图像的完整流程
        
        Args:
            workflow_path: 工作流文件路径
            output_dir: 输出目录
            **kwargs: 工作流参数
            
        Returns:
            生成的图像文件路径列表
        """
        try:
            # 重置状态
            self.generation_complete = False
            self.generated_images = []
            
            # 连接WebSocket
            if not self.is_connected:
                self.connect_websocket()
            
            # 加载和更新工作流
            workflow = self.load_workflow(workflow_path)
            workflow = self.update_workflow_params(workflow, **kwargs)
            
            # 加入队列
            prompt_id = self.queue_prompt(workflow)
            
            # 等待完成
            self.wait_for_completion()
            
            # 下载图像
            downloaded_files = self.download_images(prompt_id, output_dir)
            
            return downloaded_files
            
        except Exception as e:
            print(f"生成图像时出错: {e}")
            raise
    
    def close(self):
        """关闭连接"""
        if self.ws:
            self.ws.close()
        self.is_connected = False


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='ComfyUI API客户端')
    parser.add_argument('--workflow', '-w', required=True, help='工作流JSON文件路径')
    parser.add_argument('--server', '-s', default='127.0.0.1:8188', help='ComfyUI服务器地址')
    parser.add_argument('--output', '-o', default='./output', help='输出目录')
    parser.add_argument('--positive', '-p', help='正面提示词')
    parser.add_argument('--negative', '-n', help='负面提示词')
    parser.add_argument('--width', type=int, help='图像宽度')
    parser.add_argument('--height', type=int, help='图像高度')
    parser.add_argument('--steps', type=int, help='采样步数')
    parser.add_argument('--cfg', type=float, help='CFG值')
    parser.add_argument('--seed', type=int, help='随机种子')
    parser.add_argument('--batch-size', type=int, help='批次大小')
    parser.add_argument('--filename-prefix', help='文件名前缀')
    
    args = parser.parse_args()
    
    # 创建客户端
    client = ComfyUIClient(server_address=args.server)
    
    try:
        # 准备参数
        params = {}
        if args.positive:
            params['positive_prompt'] = args.positive
        if args.negative:
            params['negative_prompt'] = args.negative
        if args.width:
            params['width'] = args.width
        if args.height:
            params['height'] = args.height
        if args.steps:
            params['steps'] = args.steps
        if args.cfg:
            params['cfg'] = args.cfg
        if args.seed:
            params['seed'] = args.seed
        if args.batch_size:
            params['batch_size'] = args.batch_size
        if args.filename_prefix:
            params['filename_prefix'] = args.filename_prefix
        
        # 生成图像
        print("开始生成图像...")
        generated_files = client.generate_image(
            workflow_path=args.workflow,
            output_dir=args.output,
            **params
        )
        
        print(f"\n生成完成！共生成 {len(generated_files)} 张图像:")
        for file_path in generated_files:
            print(f"  - {file_path}")
            
    except Exception as e:
        print(f"错误: {e}")
    finally:
        client.close()


if __name__ == "__main__":
    main()
