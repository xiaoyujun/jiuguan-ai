/**
 * 自动指令前端逻辑
 * 处理 /自动 指令的用户界面交互
 */

class AutoCommandHandler {
    constructor() {
        this.isProcessing = false;
        this.init();
    }

    init() {
        console.log('🤖 自动指令处理器已初始化');
        this.bindEvents();
    }

    bindEvents() {
        // 监听聊天消息发送，检测自动指令
        document.addEventListener('beforeSendMessage', (event) => {
            this.handleMessageBeforeSend(event);
        });

        // 监听页面加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.onPageReady();
            });
        } else {
            this.onPageReady();
        }
    }

    onPageReady() {
        // 在聊天界面添加自动指令帮助提示
        this.addHelpTooltip();
    }

    addHelpTooltip() {
        try {
            // 查找聊天输入框
            const chatInput = document.querySelector('#message-input, .chat-input, input[type="text"]');
            if (!chatInput) return;

            // 添加自动指令提示
            const helpText = '提示：输入 /自动 可以让角色连续生成对话，格式：/自动 或 /自动 数字';
            
            // 如果输入框没有placeholder或placeholder为空，添加提示
            if (!chatInput.placeholder || chatInput.placeholder.trim() === '') {
                chatInput.placeholder = helpText;
            } else if (!chatInput.placeholder.includes('/自动')) {
                chatInput.placeholder += ' | ' + helpText;
            }

        } catch (error) {
            console.warn('⚠️ 添加自动指令帮助提示失败:', error);
        }
    }

    handleMessageBeforeSend(event) {
        const message = event.detail?.message || '';
        
        // 检查是否是自动指令
        if (this.isAutoCommand(message)) {
            event.preventDefault(); // 阻止默认发送
            this.processAutoCommand(message, event.detail);
        }
    }

    isAutoCommand(message) {
        if (!message || typeof message !== 'string') return false;
        return /^\/自动\s*(\d+)?$/.test(message.trim());
    }

    async processAutoCommand(message, context = {}) {
        if (this.isProcessing) {
            this.showMessage('⚠️ 正在处理自动指令，请稍候...', 'warning');
            return;
        }

        try {
            this.isProcessing = true;
            
            // 解析指令
            const commandInfo = this.parseAutoCommand(message);
            if (!commandInfo) {
                this.showMessage('❌ 无效的自动指令格式', 'error');
                return;
            }

            // 显示处理提示
            this.showMessage(`🤖 开始生成 ${commandInfo.count} 条自动对话...`, 'info');

            // 获取当前角色和聊天历史
            const roleInfo = this.getCurrentRoleInfo();
            const chatHistory = this.getChatHistory();

            // 发送自动指令请求
            const response = await this.sendAutoCommandRequest({
                message: message,
                role: roleInfo.name,
                chat_history: chatHistory
            });

            if (response.success) {
                await this.handleAutoCommandSuccess(response);
            } else {
                this.handleAutoCommandError(response);
            }

        } catch (error) {
            console.error('❌ 自动指令处理失败:', error);
            this.showMessage(`❌ 自动指令处理失败: ${error.message}`, 'error');
        } finally {
            this.isProcessing = false;
        }
    }

    parseAutoCommand(message) {
        const match = message.trim().match(/^\/自动\s*(\d+)?$/);
        if (!match) return null;

        const count = match[1] ? parseInt(match[1]) : 3;
        
        return {
            command: 'auto',
            count: Math.min(count, 20), // 限制最大条数
            original: message
        };
    }

    getCurrentRoleInfo() {
        try {
            // 尝试多种方式获取当前角色信息
            let roleName = '';
            
            // 方法1：从全局变量获取
            if (window.currentRole) {
                roleName = window.currentRole;
            }
            
            // 方法2：从URL参数获取
            if (!roleName) {
                const urlParams = new URLSearchParams(window.location.search);
                roleName = urlParams.get('role') || urlParams.get('character');
            }
            
            // 方法3：从页面元素获取
            if (!roleName) {
                const roleElement = document.querySelector('.current-role, .character-name, [data-role]');
                if (roleElement) {
                    roleName = roleElement.textContent || roleElement.dataset.role;
                }
            }
            
            // 方法4：从标题获取
            if (!roleName && document.title) {
                const titleMatch = document.title.match(/与(.+?)的对话|(.+?)对话/);
                if (titleMatch) {
                    roleName = titleMatch[1] || titleMatch[2];
                }
            }
            
            return {
                name: roleName.trim() || 'default',
                valid: !!roleName.trim()
            };
            
        } catch (error) {
            console.warn('⚠️ 获取角色信息失败:', error);
            return { name: 'default', valid: false };
        }
    }

    getChatHistory() {
        try {
            // 尝试从多个位置获取聊天历史
            
            // 方法1：从全局变量获取
            if (window.chatHistory && Array.isArray(window.chatHistory)) {
                return window.chatHistory;
            }
            
            // 方法2：从DOM元素解析
            const messages = [];
            const messageElements = document.querySelectorAll('.message, .chat-message, .dialogue-item');
            
            messageElements.forEach(element => {
                try {
                    const sender = element.querySelector('.sender, .character-name')?.textContent?.trim();
                    const content = element.querySelector('.content, .message-content')?.textContent?.trim();
                    const timestamp = element.querySelector('.timestamp')?.textContent?.trim();
                    
                    if (content && content.length > 0) {
                        messages.push({
                            sender: sender || 'unknown',
                            content: content,
                            timestamp: timestamp || new Date().toISOString()
                        });
                    }
                } catch (error) {
                    console.warn('⚠️ 解析消息元素失败:', error);
                }
            });
            
            return messages;
            
        } catch (error) {
            console.warn('⚠️ 获取聊天历史失败:', error);
            return [];
        }
    }

    async sendAutoCommandRequest(data) {
        const response = await fetch('/api/auto_command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'include', // 包含session信息
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
            throw new Error(errorData.error || `请求失败: ${response.status}`);
        }

        return await response.json();
    }

    async handleAutoCommandSuccess(response) {
        const { messages, count, role_name } = response;
        
        this.showMessage(`✅ 成功生成 ${count} 条对话`, 'success');
        
        // 逐一显示生成的消息
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            
            // 添加到聊天界面
            await this.addMessageToChat(message, i + 1, messages.length);
            
            // 添加延迟，模拟自然对话
            if (i < messages.length - 1) {
                await this.delay(800);
            }
        }
        
        // 滚动到底部
        this.scrollToBottom();
        
        // 更新聊天历史
        this.updateChatHistory(messages);
    }

    handleAutoCommandError(response) {
        let errorMessage = response.error || '未知错误';
        
        if (response.need_login) {
            errorMessage += ' 请先登录';
            // 可以在这里触发登录流程
            this.promptLogin();
        }
        
        this.showMessage(`❌ ${errorMessage}`, 'error');
    }

    async addMessageToChat(message, index, total) {
        try {
            // 查找聊天容器
            const chatContainer = document.querySelector('.chat-container, .messages, .dialogue-list, #chat-history');
            if (!chatContainer) {
                console.warn('⚠️ 未找到聊天容器');
                return;
            }

            // 创建消息元素
            const messageElement = this.createMessageElement(message, index, total);
            
            // 添加到容器
            chatContainer.appendChild(messageElement);
            
            // 添加动画效果
            messageElement.classList.add('auto-generated', 'fade-in');
            
            // 触发自定义事件，通知其他组件
            const event = new CustomEvent('messageAdded', {
                detail: { message, element: messageElement, autoGenerated: true }
            });
            document.dispatchEvent(event);
            
        } catch (error) {
            console.error('❌ 添加消息到聊天界面失败:', error);
        }
    }

    createMessageElement(message, index, total) {
        const div = document.createElement('div');
        div.className = 'message auto-generated';
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString();
        
        div.innerHTML = `
            <div class="message-header">
                <span class="sender">${this.escapeHtml(message.sender)}</span>
                <span class="timestamp">${timestamp}</span>
                <span class="auto-badge">自动生成 ${index}/${total}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message.content)}</div>
        `;
        
        return div;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showMessage(text, type = 'info') {
        try {
            // 创建消息提示
            const notification = document.createElement('div');
            notification.className = `auto-command-notification ${type}`;
            notification.textContent = text;
            
            // 添加样式
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${this.getNotificationColor(type)};
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                font-size: 14px;
                max-width: 300px;
                word-wrap: break-word;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
            `;
            
            document.body.appendChild(notification);
            
            // 显示动画
            setTimeout(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateX(0)';
            }, 10);
            
            // 自动隐藏
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 4000);
            
        } catch (error) {
            console.error('❌ 显示消息提示失败:', error);
            // 降级到alert
            alert(text);
        }
    }

    getNotificationColor(type) {
        const colors = {
            'info': '#2196F3',
            'success': '#4CAF50',
            'warning': '#FF9800',
            'error': '#F44336'
        };
        return colors[type] || colors.info;
    }

    scrollToBottom() {
        try {
            const chatContainer = document.querySelector('.chat-container, .messages, .dialogue-list, #chat-history');
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            } else {
                window.scrollTo(0, document.body.scrollHeight);
            }
        } catch (error) {
            console.warn('⚠️ 滚动到底部失败:', error);
        }
    }

    updateChatHistory(newMessages) {
        try {
            if (window.chatHistory && Array.isArray(window.chatHistory)) {
                window.chatHistory.push(...newMessages);
            }
            
            // 触发历史更新事件
            const event = new CustomEvent('chatHistoryUpdated', {
                detail: { newMessages, source: 'autoCommand' }
            });
            document.dispatchEvent(event);
            
        } catch (error) {
            console.warn('⚠️ 更新聊天历史失败:', error);
        }
    }

    promptLogin() {
        try {
            // 尝试显示登录提示或跳转到登录页面
            const loginUrl = '/login';
            
            if (confirm('需要登录后才能使用自动指令功能，是否现在登录？')) {
                window.location.href = loginUrl;
            }
            
        } catch (error) {
            console.warn('⚠️ 提示登录失败:', error);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 公共API方法
    async executeAutoCommand(count = 3, roleName = null) {
        const message = count === 3 ? '/自动' : `/自动 ${count}`;
        await this.processAutoCommand(message, { role: roleName });
    }

    getStatus() {
        return {
            isProcessing: this.isProcessing,
            supportedCommands: ['/自动', '/自动 数字'],
            maxCount: 20,
            defaultCount: 3
        };
    }
}

// 创建全局实例
window.autoCommandHandler = new AutoCommandHandler();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutoCommandHandler;
}