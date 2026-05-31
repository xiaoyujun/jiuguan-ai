/**
 * 插件客户端API
 * 为插件提供常用的前端功能接口
 */

class PluginClient {
    constructor() {
        this.baseUrl = window.location.origin;
    }

    /**
     * 显示Toast提示
     * @param {string} message - 提示消息
     * @param {string} type - 类型 ('info', 'success', 'warning', 'error')
     */
    showToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * 显示对话框
     * @param {string} title - 标题
     * @param {string} content - 内容（HTML）
     * @param {Function} onConfirm - 确认回调
     * @param {Function} onCancel - 取消回调
     */
    showDialog(title, content, onConfirm = null, onCancel = null) {
        const dialogId = `plugin-dialog-${Date.now()}`;
        const dialogHTML = `
            <div class="dialog-overlay" id="${dialogId}">
                <div class="dialog-content">
                    <div class="dialog-header">
                        <h3>${title}</h3>
                        <button class="dialog-close" id="${dialogId}-close">&times;</button>
                    </div>
                    <div class="dialog-body">
                        ${content}
                    </div>
                    <div class="dialog-footer">
                        ${onConfirm ? `<button class="dialog-btn confirm-btn" id="${dialogId}-confirm">确定</button>` : ''}
                        <button class="dialog-btn cancel-btn" id="${dialogId}-cancel">取消</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', dialogHTML);
        
        // 绑定事件处理器
        const confirmBtn = document.getElementById(`${dialogId}-confirm`);
        const cancelBtn = document.getElementById(`${dialogId}-cancel`);
        const closeBtn = document.getElementById(`${dialogId}-close`);
        
        if (confirmBtn && onConfirm) {
            confirmBtn.onclick = () => {
                onConfirm();
                this.closeDialog(dialogId);
            };
        }
        
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                if (onCancel) onCancel();
                this.closeDialog(dialogId);
            };
        }
        
        if (closeBtn) {
            closeBtn.onclick = () => {
                if (onCancel) onCancel();
                this.closeDialog(dialogId);
            };
        }
        
        return dialogId;
    }

    /**
     * 关闭对话框
     * @param {string} dialogId - 对话框ID
     */
    closeDialog(dialogId) {
        const dialog = document.getElementById(dialogId);
        if (dialog) {
            dialog.remove();
        }
    }

    /**
     * 获取当前选中的角色
     * @returns {Object} 角色信息 {name: string, element: HTMLElement}
     */
    getCurrentRole() {
        const roleSelect = document.getElementById('role');
        if (roleSelect && roleSelect.value) {
            return {
                name: roleSelect.value,
                element: roleSelect
            };
        }
        return null;
    }

    /**
     * 获取聊天历史
     * @param {string} roleName - 角色名称
     * @param {number} limit - 限制条数
     * @returns {Promise<Array>} 聊天历史
     */
    async getChatHistory(roleName, limit = null) {
        try {
            let url = `/api/history/${roleName}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                let history = data.history || [];
                if (limit) {
                    history = history.slice(-limit);
                }
                return history;
            } else {
                throw new Error(data.error || '获取历史失败');
            }
        } catch (error) {
            console.error('获取聊天历史失败:', error);
            return [];
        }
    }

    /**
     * 触发角色发送消息
     * @param {string} roleName - 角色名称
     * @param {string} message - 消息内容
     * @param {boolean} saveToHistory - 是否保存到历史
     * @returns {Promise<Object>} 响应结果
     */
    async triggerCharacterMessage(roleName, message, saveToHistory = true) {
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    role: roleName,
                    new_topic: false
                })
            });
            
            const data = await response.json();
            
            // 如果成功且需要显示在界面上
            if (data.content && typeof window.addMessage === 'function') {
                window.addMessage(data.content, false);
            }
            
            return data;
        } catch (error) {
            console.error('触发角色消息失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 模拟AI事件（修改角色状态）
     * @param {string} roleName - 角色名称
     * @param {string} eventDescription - 事件描述
     * @returns {Promise<Object>} 响应结果
     */
    async simulateAIEvent(roleName, eventDescription) {
        try {
            const response = await fetch('/ai_new/organize_stories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    instruction: eventDescription,
                    role_name: roleName,
                    include_temp_data: true
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast('AI事件模拟成功', 'success');
            }
            
            return data;
        } catch (error) {
            console.error('AI事件模拟失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 添加消息到聊天界面
     * @param {string} message - 消息内容
     * @param {boolean} isUser - 是否是用户消息
     */
    addMessage(message, isUser = false) {
        if (typeof window.addMessage === 'function') {
            window.addMessage(message, isUser);
        } else {
            console.warn('addMessage 函数不可用');
        }
    }

    /**
     * 创建浮动窗口（气泡窗口）
     * @param {string} content - 内容HTML
     * @param {Object} options - 选项 {duration: number, position: string}
     * @returns {string} 窗口ID
     */
    createFloatingWindow(content, options = {}) {
        const {
            duration = 5000,
            position = 'bottom-right',
            className = ''
        } = options;
        
        const windowId = `floating-window-${Date.now()}`;
        const windowHTML = `
            <div class="floating-window ${position} ${className}" id="${windowId}">
                <div class="floating-window-content">
                    ${content}
                </div>
                <button class="floating-window-close" onclick="pluginClient.closeFloatingWindow('${windowId}')">&times;</button>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', windowHTML);
        
        // 自动关闭
        if (duration > 0) {
            setTimeout(() => {
                this.closeFloatingWindow(windowId);
            }, duration);
        }
        
        return windowId;
    }

    /**
     * 关闭浮动窗口
     * @param {string} windowId - 窗口ID
     */
    closeFloatingWindow(windowId) {
        const window = document.getElementById(windowId);
        if (window) {
            window.classList.add('fade-out');
            setTimeout(() => {
                window.remove();
            }, 300);
        }
    }

    /**
     * 播放提示音
     * @param {string} soundType - 音效类型 ('success', 'error', 'info', 'warning')
     */
    playSound(soundType = 'info') {
        // 这里可以实现音效播放
        console.log(`播放音效: ${soundType}`);
    }

    /**
     * 发送HTTP请求
     * @param {string} url - URL
     * @param {Object} options - fetch选项
     * @returns {Promise<Object>} 响应数据
     */
    async request(url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            return await response.json();
        } catch (error) {
            console.error('请求失败:', error);
            throw error;
        }
    }
}

// 创建全局实例
window.pluginClient = new PluginClient();
