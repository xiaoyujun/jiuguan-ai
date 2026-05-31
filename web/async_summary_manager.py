"""
异步多数据书总结管理器
支持并发处理多个数据书，独立状态跟踪和失败处理
"""

import threading
import time
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Callable, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
import traceback
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))
from web.core import StoryBookManager
from web.utils import PathManager

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class StoryBookTask:
    """单个数据书处理任务"""
    
    def __init__(self, story_name: str, story_path: Path, keywords: List[str], priority: int = 1):
        self.story_name = story_name
        self.story_path = story_path
        self.keywords = keywords
        self.priority = priority
        self.status = 'pending'  # pending, processing, completed, failed, no_changes
        self.progress = 0
        self.start_time = None
        self.end_time = None
        self.error_message = None
        self.result_data = None
        self.retry_count = 0
        self.max_retries = 2
        self.logs = []
        
    def add_log(self, message: str, log_type: str = 'info'):
        """添加日志记录"""
        self.logs.append({
            'time': time.time(),
            'message': message,
            'type': log_type
        })
        logger.info(f"[{self.story_name}] {message}")
    
    def start_processing(self):
        """开始处理"""
        self.status = 'processing'
        self.start_time = time.time()
        self.progress = 0
        self.add_log(f"开始处理数据书: {self.story_name}")
    
    def mark_completed(self, result_data: Any = None):
        """标记完成"""
        self.status = 'completed'
        self.progress = 100
        self.end_time = time.time()
        self.result_data = result_data
        duration = self.end_time - self.start_time if self.start_time else 0
        self.add_log(f"处理完成，耗时 {duration:.2f}秒", 'success')
    
    def mark_no_changes(self, reason: str = None):
        """标记无需更改"""
        self.status = 'no_changes'
        self.progress = 100
        self.end_time = time.time()
        self.error_message = reason or "AI判断无需更新"
        duration = self.end_time - self.start_time if self.start_time else 0
        self.add_log(f"无需更新: {self.error_message}", 'info')
    
    def mark_failed(self, error_message: str):
        """标记失败"""
        self.status = 'failed'
        self.end_time = time.time()
        self.error_message = error_message
        duration = self.end_time - self.start_time if self.start_time else 0
        self.add_log(f"处理失败: {error_message}", 'error')
    
    def can_retry(self) -> bool:
        """是否可以重试"""
        return self.retry_count < self.max_retries and self.status == 'failed'
    
    def retry(self):
        """重试处理"""
        if not self.can_retry():
            return False
        self.retry_count += 1
        self.status = 'pending'
        self.progress = 0
        self.error_message = None
        self.add_log(f"开始第 {self.retry_count} 次重试")
        return True
    
    def to_dict(self) -> Dict:
        """转换为字典格式"""
        result = {
            'story_name': self.story_name,
            'keywords': self.keywords,
            'priority': self.priority,
            'status': self.status,
            'progress': self.progress,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'error_message': self.error_message,
            'retry_count': self.retry_count,
            'max_retries': self.max_retries,
            'can_retry': self.can_retry(),
            'logs': self.logs[-10:]  # 只返回最后10条日志
        }
        
        # 添加保存状态信息
        if self.result_data:
            result['saved'] = self.result_data.get('saved', False)
            if 'save_error' in self.result_data:
                result['save_error'] = self.result_data['save_error']
        
        return result

class AsyncSummaryManager:
    """异步总结管理器"""
    
    def __init__(self, max_workers: int = 3):
        self.max_workers = max_workers
        self.story_manager = StoryBookManager()
        self.active_sessions: Dict[str, 'SummarySession'] = {}
        self.session_lock = threading.Lock()
    
    def create_session(self, role_name: str, sentence: str, selected_stories: List[str] = None) -> str:
        """创建新的总结会话"""
        session_id = f"summary_{int(time.time())}_{role_name}"
        
        with self.session_lock:
            session = SummarySession(
                session_id=session_id,
                role_name=role_name,
                sentence=sentence,
                story_manager=self.story_manager,
                max_workers=self.max_workers,
                selected_stories=selected_stories
            )
            self.active_sessions[session_id] = session
        
        return session_id
    
    def get_session(self, session_id: str) -> Optional['SummarySession']:
        """获取会话"""
        with self.session_lock:
            return self.active_sessions.get(session_id)
    
    def start_session(self, session_id: str) -> bool:
        """启动会话处理"""
        session = self.get_session(session_id)
        if not session:
            return False
        
        # 在后台线程中启动处理
        thread = threading.Thread(target=session.start_processing, daemon=True)
        thread.start()
        return True
    
    def get_session_status(self, session_id: str) -> Optional[Dict]:
        """获取会话状态"""
        session = self.get_session(session_id)
        if not session:
            return None
        return session.get_status()
    
    def retry_failed_tasks(self, session_id: str) -> bool:
        """重试失败的任务"""
        session = self.get_session(session_id)
        if not session:
            return False
        return session.retry_failed_tasks()
    
    def cleanup_session(self, session_id: str):
        """清理会话"""
        with self.session_lock:
            if session_id in self.active_sessions:
                session = self.active_sessions[session_id]
                session.stop_processing()
                del self.active_sessions[session_id]

class SummarySession:
    """单个总结会话"""
    
    def __init__(self, session_id: str, role_name: str, sentence: str, 
                 story_manager: StoryBookManager, max_workers: int = 3, 
                 selected_stories: List[str] = None):
        self.session_id = session_id
        self.role_name = role_name
        self.sentence = sentence
        self.story_manager = story_manager
        self.max_workers = max_workers
        self.selected_stories = selected_stories or []
        
        self.status = 'initializing'  # initializing, running, completed, stopped, error
        self.overall_progress = 0
        self.start_time = None
        self.end_time = None
        self.error_message = None
        
        self.tasks: Dict[str, StoryBookTask] = {}
        self.task_lock = threading.Lock()
        self.executor: Optional[ThreadPoolExecutor] = None
        self.stop_flag = threading.Event()
        
        self.global_logs = []
        
        # 初始化任务
        self._initialize_tasks()
    
    def _add_global_log(self, message: str, log_type: str = 'info'):
        """添加全局日志"""
        self.global_logs.append({
            'time': time.time(),
            'message': message,
            'type': log_type
        })
        logger.info(f"[Session {self.session_id}] {message}")
    
    def _initialize_tasks(self):
        """初始化任务列表"""
        try:
            self._add_global_log("开始初始化任务列表")
            
            # 获取当前角色和玩家绑定的数据书
            bound_stories = set()
            try:
                from web.core import StoryReferenceManager
                story_ref_manager = StoryReferenceManager()
                
                # 获取当前玩家信息
                import json
                from pathlib import Path
                current_player_path = PathManager.get_players_dir() / "当前挑选玩家.json"
                current_player = "未知玩家"
                if current_player_path.exists():
                    with open(current_player_path, 'r', encoding='utf-8') as f:
                        player_data = json.load(f)
                        current_player = player_data.get('selected_player', '未知玩家')
                
                # 获取角色绑定的数据书
                role_bound_data = story_ref_manager.get_bound_story_data_with_references(self.role_name)
                bound_stories.update(role_bound_data.keys())
                
                # 获取玩家绑定的数据书
                player_bound_data = story_ref_manager.get_player_bound_story_data(current_player)
                bound_stories.update(player_bound_data.keys())
                
                self._add_global_log(f"找到绑定的数据书: {list(bound_stories)}")
                
            except Exception as e:
                self._add_global_log(f"获取绑定数据书失败: {e}")
            
            # 获取所有数据书信息
            story_dir = self.story_manager.story_dir
            priority_counter = 1
            
            for json_file in story_dir.glob("*.json"):
                story_name = json_file.stem
                
                # 如果指定了选择的数据书，只处理选中的
                if self.selected_stories and story_name not in self.selected_stories:
                    continue
                
                data = self.story_manager._load_story_file(json_file)
                if not data:
                    continue
                
                keywords = data.get('总结词', []) + data.get('捆绑角色', [])
                
                # 检查是否匹配总结词或是否绑定
                is_matched = self.story_manager._check_keyword_match(data, self.sentence, json_file.stem)
                is_bound = story_name in bound_stories
                
                if is_matched or is_bound:
                    task = StoryBookTask(
                        story_name=story_name,
                        story_path=json_file,
                        keywords=keywords,
                        priority=priority_counter
                    )
                    self.tasks[story_name] = task
                    priority_counter += 1
                    self._add_global_log(f"添加任务: {story_name} (匹配: {is_matched}, 绑定: {is_bound})")
                else:
                    # 创建一个标记为不需要处理的任务
                    task = StoryBookTask(
                        story_name=story_name,
                        story_path=json_file,
                        keywords=keywords,
                        priority=priority_counter
                    )
                    task.status = 'no_changes'
                    task.progress = 100
                    task.error_message = "未匹配到总结词且未绑定"
                    self.tasks[story_name] = task
                    priority_counter += 1
            
            processing_count = sum(1 for task in self.tasks.values() if task.status == 'pending')
            self._add_global_log(f"初始化完成，共 {len(self.tasks)} 个数据书，{processing_count} 个需要处理")
            
        except Exception as e:
            self._add_global_log(f"初始化任务失败: {str(e)}", 'error')
            self.status = 'error'
            self.error_message = f"初始化失败: {str(e)}"
    
    def start_processing(self):
        """开始处理任务"""
        try:
            self.status = 'running'
            self.start_time = time.time()
            self._add_global_log("开始并发处理任务")
            
            # 获取需要处理的任务
            pending_tasks = [task for task in self.tasks.values() if task.status == 'pending']
            
            if not pending_tasks:
                self._add_global_log("没有需要处理的任务")
                self._complete_session()
                return
            
            # 创建线程池执行器
            with ThreadPoolExecutor(max_workers=min(self.max_workers, len(pending_tasks))) as executor:
                self.executor = executor
                
                # 提交所有任务
                future_to_task = {}
                for task in pending_tasks:
                    future = executor.submit(self._process_single_task, task)
                    future_to_task[future] = task
                
                # 等待任务完成
                completed_count = 0
                total_count = len(pending_tasks)
                
                for future in as_completed(future_to_task):
                    if self.stop_flag.is_set():
                        self._add_global_log("收到停止信号，终止处理", 'warning')
                        break
                    
                    task = future_to_task[future]
                    completed_count += 1
                    
                    try:
                        future.result()  # 获取结果，如果有异常会在这里抛出
                    except Exception as e:
                        self._add_global_log(f"处理任务 {task.story_name} 时发生异常: {str(e)}", 'error')
                        task.mark_failed(f"处理异常: {str(e)}")
                    
                    # 更新总体进度
                    self.overall_progress = int((completed_count / total_count) * 100)
                    self._add_global_log(f"进度: {completed_count}/{total_count} ({self.overall_progress}%)")
            
            self._complete_session()
            
        except Exception as e:
            self._add_global_log(f"处理过程中发生错误: {str(e)}", 'error')
            self.status = 'error'
            self.error_message = str(e)
            self.end_time = time.time()
    
    def _process_single_task(self, task: StoryBookTask):
        """处理单个任务"""
        try:
            task.start_processing()
            
            # 检查停止标志
            if self.stop_flag.is_set():
                task.mark_failed("处理被停止")
                return
            
            # 加载数据书数据
            data = self.story_manager._load_story_file(task.story_path)
            if not data:
                task.mark_failed("无法加载数据书文件")
                return
            
            # 合并临时数据
            temp_story_data = self.story_manager._load_temp_data(self.role_name)
            if task.story_name in temp_story_data:
                data = self.story_manager._merge_temp_data(data, temp_story_data[task.story_name])
            
            task.progress = 30
            task.add_log("数据加载完成，开始AI分析")
            
            # 检查停止标志
            if self.stop_flag.is_set():
                task.mark_failed("处理被停止")
                return
            
            # 创建进度回调函数
            def progress_callback(current, total, story_name, status, detail_info=None):
                if status == 'completed':
                    task.progress = 90
                elif status == 'ai_analyzing':
                    task.progress = 60
                elif status == 'processing_response':
                    task.progress = 80
                    
                if detail_info and 'reason' in detail_info:
                    task.add_log(f"状态更新: {status} - {detail_info['reason']}")
                else:
                    task.add_log(f"状态更新: {status}")
            
            # 调用AI分析
            modification_result = self.story_manager._analyze_story_with_ai(
                data, self.sentence, progress_callback, task.story_name
            )
            
            task.progress = 95
            
            if not modification_result:
                task.mark_failed("AI分析返回空结果")
            elif modification_result.get("no_changes"):
                task.mark_no_changes("AI判断无需更新")
            else:
                # 处理修改结果
                modifications = modification_result.get('modifications', [])
                if modifications:
                    # 立即保存修改到文件
                    try:
                        task.add_log(f"开始保存修改到文件: {task.story_path.name}", 'info')
                        task.add_log(f"修改要求数量: {len(modifications)}", 'info')
                        
                        # 记录详细的修改信息
                        for i, mod in enumerate(modifications):
                            task.add_log(f"修改 {i+1}: {mod.get('operation', 'unknown')} -> {mod.get('path', 'unknown')}", 'info')
                        
                        result = self.story_manager.apply_modifications(task.story_path, modifications)
                        
                        task.add_log(f"保存结果: {result}", 'info')
                        
                        if result['success']:
                            task.add_log(f"✅ 已自动保存修改到文件: {task.story_path.name}", 'success')
                            task.add_log(f"成功应用 {result.get('applied_count', 0)}/{result.get('total_count', 0)} 个修改", 'success')
                            task.result_data = {
                                'path': task.story_path,
                                'modifications': modifications,
                                'modification_result': modification_result,
                                'saved': True,
                                'save_result': result
                            }
                        else:
                            task.add_log(f"❌ 保存失败: {result['message']}", 'error')
                            task.add_log(f"失败详情: 应用了 {result.get('applied_count', 0)}/{result.get('total_count', 0)} 个修改", 'error')
                            task.result_data = {
                                'path': task.story_path,
                                'modifications': modifications,
                                'modification_result': modification_result,
                                'saved': False,
                                'save_error': result['message']
                            }
                    except Exception as e:
                        import traceback
                        error_trace = traceback.format_exc()
                        task.add_log(f"❌ 保存时发生异常: {str(e)}", 'error')
                        task.add_log(f"异常详情: {error_trace}", 'error')
                        task.result_data = {
                            'path': task.story_path,
                            'modifications': modifications,
                            'modification_result': modification_result,
                            'saved': False,
                            'save_error': f"{str(e)}\n{error_trace}"
                        }
                    
                    task.mark_completed(task.result_data)
                else:
                    task.mark_no_changes("无修改要求")
                    
        except Exception as e:
            error_msg = f"处理异常: {str(e)}\n{traceback.format_exc()}"
            task.mark_failed(error_msg)
    
    def _complete_session(self):
        """完成会话"""
        self.status = 'completed'
        self.end_time = time.time()
        self.overall_progress = 100
        
        # 统计结果
        completed_tasks = [t for t in self.tasks.values() if t.status == 'completed']
        failed_tasks = [t for t in self.tasks.values() if t.status == 'failed']
        no_change_tasks = [t for t in self.tasks.values() if t.status == 'no_changes']
        saved_tasks = [t for t in completed_tasks if t.result_data and t.result_data.get('saved', False)]
        save_failed_tasks = [t for t in completed_tasks if t.result_data and not t.result_data.get('saved', True)]
        
        duration = self.end_time - self.start_time if self.start_time else 0
        
        # 清理临时数据（因为已经自动保存了）
        if saved_tasks:
            try:
                from web.history_manager import clear_story_temp_data
                clear_story_temp_data(self.role_name)
                self._add_global_log("已清理临时数据", 'info')
            except Exception as e:
                self._add_global_log(f"清理临时数据失败: {str(e)}", 'warning')
        
        self._add_global_log(
            f"会话完成 - 总耗时: {duration:.2f}秒, "
            f"成功: {len(completed_tasks)}, "
            f"已保存: {len(saved_tasks)}, "
            f"保存失败: {len(save_failed_tasks)}, "
            f"失败: {len(failed_tasks)}, "
            f"无需更新: {len(no_change_tasks)}",
            'success' if not failed_tasks and not save_failed_tasks else 'warning'
        )
    
    def retry_failed_tasks(self) -> bool:
        """重试失败的任务"""
        failed_tasks = [task for task in self.tasks.values() if task.status == 'failed' and task.can_retry()]
        
        if not failed_tasks:
            return False
        
        self._add_global_log(f"开始重试 {len(failed_tasks)} 个失败的任务")
        
        # 重置任务状态
        for task in failed_tasks:
            task.retry()
        
        # 重新启动处理
        if self.status == 'completed':
            self.status = 'running'
            self.overall_progress = 0
            
            # 在新线程中处理重试任务
            retry_thread = threading.Thread(target=self._process_retry_tasks, args=(failed_tasks,), daemon=True)
            retry_thread.start()
        
        return True
    
    def _process_retry_tasks(self, retry_tasks: List[StoryBookTask]):
        """处理重试任务"""
        try:
            with ThreadPoolExecutor(max_workers=min(self.max_workers, len(retry_tasks))) as executor:
                future_to_task = {}
                for task in retry_tasks:
                    future = executor.submit(self._process_single_task, task)
                    future_to_task[future] = task
                
                completed_count = 0
                total_count = len(retry_tasks)
                
                for future in as_completed(future_to_task):
                    if self.stop_flag.is_set():
                        break
                    
                    task = future_to_task[future]
                    completed_count += 1
                    
                    try:
                        future.result()
                    except Exception as e:
                        self._add_global_log(f"重试任务 {task.story_name} 失败: {str(e)}", 'error')
                        task.mark_failed(f"重试失败: {str(e)}")
                    
                    self.overall_progress = int((completed_count / total_count) * 100)
            
            self._complete_session()
            
        except Exception as e:
            self._add_global_log(f"重试过程中发生错误: {str(e)}", 'error')
    
    def stop_processing(self):
        """停止处理"""
        self._add_global_log("收到停止处理指令")
        self.stop_flag.set()
        
        if self.executor:
            self.executor.shutdown(wait=False)
        
        self.status = 'stopped'
        self.end_time = time.time()
    
    def get_status(self) -> Dict:
        """获取会话状态"""
        with self.task_lock:
            tasks_status = {name: task.to_dict() for name, task in self.tasks.items()}
        
        # 统计信息
        total_tasks = len(self.tasks)
        completed_tasks = sum(1 for t in self.tasks.values() if t.status == 'completed')
        failed_tasks = sum(1 for t in self.tasks.values() if t.status == 'failed')
        processing_tasks = sum(1 for t in self.tasks.values() if t.status == 'processing')
        no_change_tasks = sum(1 for t in self.tasks.values() if t.status == 'no_changes')
        
        # 保存状态统计
        saved_tasks = sum(1 for t in self.tasks.values() 
                         if t.status == 'completed' and t.result_data and t.result_data.get('saved', False))
        save_failed_tasks = sum(1 for t in self.tasks.values() 
                               if t.status == 'completed' and t.result_data and not t.result_data.get('saved', True))
        
        return {
            'session_id': self.session_id,
            'role_name': self.role_name,
            'status': self.status,
            'overall_progress': self.overall_progress,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'error_message': self.error_message,
            'tasks': tasks_status,
            'statistics': {
                'total_tasks': total_tasks,
                'completed_tasks': completed_tasks,
                'failed_tasks': failed_tasks,
                'processing_tasks': processing_tasks,
                'no_change_tasks': no_change_tasks,
                'can_retry_tasks': sum(1 for t in self.tasks.values() if t.can_retry()),
                'saved_tasks': saved_tasks,
                'save_failed_tasks': save_failed_tasks
            },
            'global_logs': self.global_logs[-20:],  # 返回最后20条全局日志
            'has_results': completed_tasks > 0,
            'needs_update': completed_tasks > 0
        }
    
    def get_results_for_save(self) -> List[tuple]:
        """获取可保存的结果"""
        results = []
        for task in self.tasks.values():
            if task.status == 'completed' and task.result_data:
                path = task.result_data['path']
                modification_result = task.result_data['modification_result']
                results.append((path, modification_result))
        return results

# 全局管理器实例
async_summary_manager = AsyncSummaryManager()
