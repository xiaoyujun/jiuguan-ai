/**
 * 统一消息气泡管理器
 * 负责创建和管理所有类型的消息气泡
 * 只保留两种类型：角色气泡和玩家气泡
 */
class UnifiedMessageBubbleManager {
    constructor() {
        this.init();
    }

    init() {
        // 初始化配置
        this.chatMessagesContainer = null;
        this.currentHistoryLength = 0;
    }

    /**
     * 设置聊天消息容器
     * @param {HTMLElement} container - 聊天消息容器
     */
    setChatContainer(container) {
        this.chatMessagesContainer = container;
    }

    /**
     * 设置当前历史长度
     * @param {number} length - 历史长度
     */
    setHistoryLength(length) {
        this.currentHistoryLength = length;
    }

    /**
     * 创建角色消息气泡
     * @param {string} roleName - 角色名称
     * @param {string} content - 消息内容
     * @param {number} index - 消息索引（可选）
     * @returns {HTMLElement} 消息元素
     */
    createRoleMessage(roleName, content, index = null) {
        // 创建消息容器
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        
        if (index !== null) {
            messageDiv.setAttribute('data-index', index);
        }

        // 创建头像
        const { img: avatarImg, fallback } = this.createAvatarElement(roleName, 'avatar');
        
        // 为角色头像添加点击事件
        if (typeof window.UserAttributes !== 'undefined') {
            window.UserAttributes.addRoleAvatarClickHandler(avatarImg, roleName);
        }

        // 创建内容容器
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // 创建气泡
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';

        // 处理内容（换行符 + 折叠功能）
        const formattedContent = content.replace(/\n/g, '<br>');
        const processedContent = window.messageDataCollapseManager ? 
            window.messageDataCollapseManager.processMessageContent(formattedContent) : formattedContent;
        
        bubbleDiv.innerHTML = `<strong>${roleName}:</strong> ${processedContent}`;

        // 组装结构
        contentDiv.appendChild(bubbleDiv);
        messageDiv.appendChild(avatarImg);
        messageDiv.appendChild(fallback);
        messageDiv.appendChild(contentDiv);

        // 存储完整文本
        messageDiv.setAttribute('data-full-text', content);

        return messageDiv;
    }

    /**
     * 创建玩家消息气泡
     * @param {string} playerName - 玩家名称
     * @param {string} content - 消息内容
     * @param {number} index - 消息索引（可选）
     * @returns {HTMLElement} 消息元素
     */
    createPlayerMessage(playerName, content, index = null) {
        // 创建消息容器
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        
        if (index !== null) {
            messageDiv.setAttribute('data-index', index);
        }

        // 创建玩家头像
        const { img: avatarImg, fallback } = this.createAvatarElement(playerName, 'avatar player-avatar');
        
        // 为玩家头像添加点击事件（如果需要）
        if (typeof window.UserAttributes !== 'undefined') {
            window.UserAttributes.addPlayerAvatarClickHandler(avatarImg, playerName);
        }

        // 创建内容容器
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // 创建气泡
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble player-bubble';

        // 处理内容（换行符）
        const formattedContent = content.replace(/\n/g, '<br>');
        
        // 玩家消息显示格式：玩家名: 内容
        bubbleDiv.innerHTML = `<strong>${playerName}:</strong> ${formattedContent}`;

        // 组装结构
        contentDiv.appendChild(bubbleDiv);
        messageDiv.appendChild(avatarImg);
        messageDiv.appendChild(fallback);
        messageDiv.appendChild(contentDiv);

        // 存储完整文本
        messageDiv.setAttribute('data-full-text', content);

        return messageDiv;
    }

    /**
     * 添加角色消息到聊天容器
     * @param {string} roleName - 角色名称
     * @param {string} content - 消息内容
     * @param {boolean} autoScroll - 是否自动滚动
     * @returns {HTMLElement} 创建的消息元素
     */
    addRoleMessage(roleName, content, autoScroll = true) {
        const messageElement = this.createRoleMessage(roleName, content, this.currentHistoryLength);
        
        if (this.chatMessagesContainer) {
            this.chatMessagesContainer.appendChild(messageElement);
            this.currentHistoryLength++;
            
            if (autoScroll) {
                this.smartScrollToBottom();
            }
        }
        
        return messageElement;
    }

    /**
     * 添加玩家消息到聊天容器
     * @param {string} playerName - 玩家名称
     * @param {string} content - 消息内容
     * @param {boolean} autoScroll - 是否自动滚动
     * @returns {HTMLElement} 创建的消息元素
     */
    addPlayerMessage(playerName, content, autoScroll = true) {
        const messageElement = this.createPlayerMessage(playerName, content, this.currentHistoryLength);
        
        if (this.chatMessagesContainer) {
            this.chatMessagesContainer.appendChild(messageElement);
            this.currentHistoryLength++;
            
            if (autoScroll) {
                this.smartScrollToBottom();
            }
        }
        
        return messageElement;
    }

    /**
     * 更新消息气泡内容（用于流式更新）
     * @param {HTMLElement} bubbleDiv - 气泡元素
     * @param {string} roleName - 角色名称
     * @param {string} text - 文本内容
     * @param {boolean} isPlayer - 是否为玩家消息
     */
    updateBubbleContent(bubbleDiv, roleName, text, isPlayer = false) {
        if (!bubbleDiv) return;

        // 清理文本末尾空格并处理换行符 - 修复流式生成时末尾空格问题
        const cleanText = text.trim();
        const formattedText = cleanText.replace(/\n/g, '<br>');

        if (isPlayer) {
            // 玩家消息格式：玩家名: 内容
            bubbleDiv.innerHTML = `<strong>${roleName}:</strong> ${formattedText}`;
        } else {
            // 角色消息处理折叠内容和隐藏内容（$）
            const processedText = window.messageDataCollapseManager ? 
                window.messageDataCollapseManager.processMessageContent(formattedText) : formattedText;
            bubbleDiv.innerHTML = `<strong>${roleName}:</strong> ${processedText}`;
        }
    }

    /**
     * 创建头像元素
     * @param {string} name - 角色或玩家名称
     * @param {string} className - CSS类名
     * @returns {Object} 包含img和fallback元素的对象
     */
    createAvatarElement(name, className = 'avatar') {
        // 使用全局的createAvatarElement函数
        if (typeof window.createAvatarElement === 'function') {
            return window.createAvatarElement(name, className);
        }
        
        // 备用方案：创建简单头像
        // 确保name不为空
        const safeName = (name && typeof name === 'string') ? name : '未知';
        
        const img = document.createElement('img');
        img.className = className;
        img.src = `/avatar/${encodeURIComponent(safeName)}`;
        img.alt = safeName;
        img.style.display = 'none'; // 默认隐藏，等待加载
        
        const fallback = document.createElement('div');
        fallback.className = 'avatar-fallback';
        fallback.textContent = (name && typeof name === 'string') ? name.charAt(0) : '?';
        
        // 图片加载处理 - 带重试机制
        let loadAttempts = 0;
        const maxAttempts = 2;
        const originalSrc = img.src;
        
        const tryLoad = () => {
            loadAttempts++;
            
            img.onerror = () => {
                console.log(`[备用方案] 头像加载失败 (尝试 ${loadAttempts}/${maxAttempts}): ${img.src}`);
                
                if (loadAttempts < maxAttempts) {
                    setTimeout(() => {
                        const retryUrl = `${originalSrc}?retry=${loadAttempts}&t=${Date.now()}`;
                        console.log(`[备用方案] 重试加载头像: ${retryUrl}`);
                        img.src = retryUrl;
                    }, 300);
                } else {
                    img.style.display = 'none';
                    fallback.style.display = 'block';
                    console.log(`[备用方案] 头像最终加载失败，显示fallback: ${name}`);
                }
            };
            
            img.onload = () => {
                console.log(`[备用方案] 头像加载成功: ${img.src}`);
                img.style.display = 'block';
                fallback.style.display = 'none';
            };
        };
        
        tryLoad();
        
        return { img, fallback };
    }

    /**
     * 智能滚动到底部
     */
    smartScrollToBottom() {
        if (typeof window.smartScrollToBottom === 'function') {
            window.smartScrollToBottom();
        } else if (this.chatMessagesContainer) {
            // 备用滚动方案
            setTimeout(() => {
                this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;
            }, 50);
        }
    }

    /**
     * 设置消息完整文本（用于语音重播等）
     * @param {HTMLElement} messageElement - 消息元素
     * @param {string} fullText - 完整文本
     */
    setFullText(messageElement, fullText) {
        if (messageElement) {
            const cleanText = fullText.trim();
            messageElement.setAttribute('data-full-text', cleanText);
        }
    }

    /**
     * 解析消息内容，自动判断是角色还是玩家消息
     * @param {string} content - 消息内容
     * @param {boolean} isUser - 是否为用户消息
     * @param {string} defaultPlayerName - 默认玩家名称
     * @returns {HTMLElement} 创建的消息元素
     */
    parseAndCreateMessage(content, isUser = false, defaultPlayerName = null) {
        if (isUser) {
            // 用户消息：直接使用内容，不解析冒号
            let playerName = '用户';  // 默认使用"用户"
            
            // 尝试获取当前玩家名称
            if (window.currentPlayerData && window.currentPlayerData.名字) {
                playerName = window.currentPlayerData.名字;
                console.log('🎭 使用当前玩家名称:', playerName);
            } else if (defaultPlayerName) {
                playerName = defaultPlayerName;
                console.log('🎭 使用默认玩家名称:', playerName);
            } else {
                console.log('🎭 使用fallback玩家名称:', playerName);
                console.log('🔍 当前玩家数据状态:', window.currentPlayerData);
            }
            
            return this.createPlayerMessage(playerName, content, this.currentHistoryLength);
        } else {
            // AI消息：解析冒号格式
            const colonIndex = content.indexOf(': ');
            
            if (colonIndex !== -1) {
                // 包含冒号，提取名称和内容
                const name = content.substring(0, colonIndex);
                const messageText = content.substring(colonIndex + 2);
                return this.createRoleMessage(name, messageText, this.currentHistoryLength);
            } else {
                // 没有冒号，使用系统作为默认名称
                console.warn('角色消息缺少名称，使用系统作为默认名称');
                return this.createRoleMessage('系统', content, this.currentHistoryLength);
            }
        }
    }
}

// 全局实例
window.UnifiedMessageBubbleManager = UnifiedMessageBubbleManager;

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    window.unifiedMessageBubble = new UnifiedMessageBubbleManager();
    
    // 设置聊天容器
    const chatMessagesContainer = document.getElementById('chat-messages');
    if (chatMessagesContainer) {
        window.unifiedMessageBubble.setChatContainer(chatMessagesContainer);
    }
    
    // 设置全局接口
    setupGlobalInterface();
    
    console.log('UnifiedMessageBubbleManager: 已初始化统一消息气泡管理器');
});

/**
 * 设置全局接口
 * 提供简洁的全局访问方法
 */
function setupGlobalInterface() {
    // 设置全局辅助函数
    window.addRoleMessage = (roleName, content) => {
        if (window.unifiedMessageBubble) {
            return window.unifiedMessageBubble.addRoleMessage(roleName, content);
        }
    };

    window.addPlayerMessage = (playerName, content) => {
        if (window.unifiedMessageBubble) {
            return window.unifiedMessageBubble.addPlayerMessage(playerName, content);
        }
    };

    console.log('UnifiedMessageBubbleManager: 已设置全局接口');
}
