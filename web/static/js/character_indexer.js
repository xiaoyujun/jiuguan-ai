/**
 * 角色索引器 - Character Indexer
 * 实现@角色索引功能，支持快速角色搜索和回复
 * 根据聊天记录中最后说话的角色进行优先级排序
 */

class CharacterIndexer {
    constructor() {
        this.isActive = false;
        this.currentSuggestions = [];
        this.selectedIndex = -1;
        this.messageInput = null;
        this.suggestionContainer = null;
        this.availableRoles = [];
        this.chatHistory = [];
        this.lastSpeakers = []; // 按最后说话时间排序的角色列表
        
        this.init();
    }

    /**
     * 初始化索引器
     */
    init() {
        // 等待DOM加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    /**
     * 设置索引器
     */
    setup() {
        this.messageInput = document.getElementById('message-input');
        if (!this.messageInput) {
            console.warn('CharacterIndexer: 未找到消息输入框');
            setTimeout(() => this.setup(), 1000); // 1秒后重试
            return;
        }

        this.createSuggestionContainer();
        this.bindEvents();
        this.loadAvailableRoles();
        
        // 延迟加载聊天历史，确保页面角色选择器已经初始化
        setTimeout(() => {
            this.loadChatHistory();
        }, 1000);
        
        console.log('CharacterIndexer: 初始化完成');
        
        // 添加调试信息
        console.log('CharacterIndexer: 输入框已找到', this.messageInput);
        console.log('CharacterIndexer: 建议容器已创建', this.suggestionContainer);
    }

    /**
     * 创建建议容器
     */
    createSuggestionContainer() {
        this.suggestionContainer = document.createElement('div');
        this.suggestionContainer.id = 'character-suggestions';
        this.suggestionContainer.className = 'character-suggestions hidden';
        this.suggestionContainer.innerHTML = `
            <div class="suggestions-header">
                <span>选择角色</span>
            </div>
            <div class="suggestions-list"></div>
        `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .character-suggestions {
                position: absolute;
                bottom: 60px;
                left: 20px;
                right: 20px;
                max-height: 300px;
                background: var(--card-bg, #1a1a2e);
                border: 2px solid var(--border-gold, #d4af37);
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 1000;
                overflow: hidden;
                backdrop-filter: blur(10px);
            }

            .character-suggestions.hidden {
                display: none;
            }

            .suggestions-header {
                padding: 10px 15px;
                background: linear-gradient(135deg, var(--primary-color, #16213e) 0%, var(--secondary-color, #0f3460) 100%);
                color: var(--text-color, #fff);
                font-weight: bold;
                font-size: 14px;
                border-bottom: 1px solid var(--border-color, #333);
                display: flex;
                justify-content: center;
                align-items: center;
            }


            .suggestions-list {
                max-height: 250px;
                overflow-y: auto;
                scrollbar-width: thin;
                scrollbar-color: var(--border-gold, #d4af37) transparent;
            }

            .suggestion-item {
                padding: 12px 15px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 10px;
                transition: all 0.2s ease;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }

            .suggestion-item:hover,
            .suggestion-item.selected {
                background: rgba(212, 175, 55, 0.2);
                color: var(--accent-color, #d4af37);
            }

            .suggestion-item:last-child {
                border-bottom: none;
            }

            .suggestion-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: var(--secondary-color, #0f3460);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: bold;
                color: var(--text-color, #fff);
                flex-shrink: 0;
            }

            .suggestion-info {
                flex: 1;
                min-width: 0;
            }

            .suggestion-name {
                font-weight: bold;
                color: var(--text-color, #fff);
                margin-bottom: 2px;
            }

            .suggestion-meta {
                font-size: 12px;
                color: var(--muted-color, #888);
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .last-spoke {
                background: rgba(212, 175, 55, 0.3);
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 10px;
            }

            .never-spoke {
                color: var(--muted-color, #666);
            }

            @media (max-width: 768px) {
                .character-suggestions {
                    left: 10px;
                    right: 10px;
                    bottom: 70px;
                }
            }
        `;
        document.head.appendChild(style);

        // 插入到输入区域前
        const inputContainer = this.messageInput.closest('.input-container') || this.messageInput.parentElement;
        console.log('CharacterIndexer: 输入容器', inputContainer);
        
        if (inputContainer) {
            inputContainer.insertBefore(this.suggestionContainer, inputContainer.firstChild);
            console.log('CharacterIndexer: 建议容器已插入到DOM');
        } else {
            // 备用方案：插入到body中
            document.body.appendChild(this.suggestionContainer);
            console.log('CharacterIndexer: 建议容器已插入到body中');
        }
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 监听输入事件
        this.messageInput.addEventListener('input', (e) => this.handleInput(e));
        this.messageInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // 监听点击事件以关闭建议
        document.addEventListener('click', (e) => {
            if (!this.suggestionContainer.contains(e.target) && e.target !== this.messageInput) {
                this.hideSuggestions();
            }
        });

        // 监听角色切换事件
        const roleSelect = document.getElementById('role');
        
        if (roleSelect) {
            roleSelect.addEventListener('change', () => {
                console.log('CharacterIndexer: 角色选择器变化，重新加载历史');
                setTimeout(() => this.loadChatHistory(), 100);
            });
        }
    }

    /**
     * 处理输入事件
     */
    handleInput(e) {
        const value = e.target.value;
        const cursorPos = e.target.selectionStart;
        
        console.log('CharacterIndexer: 输入事件', { value, cursorPos });
        
        // 检查是否输入了@
        const atIndex = value.lastIndexOf('@', cursorPos - 1);
        
        console.log('CharacterIndexer: @ 检查', { atIndex, hasSpaceBefore: atIndex > 0 ? /\s/.test(value[atIndex - 1]) : true });
        
        if (atIndex !== -1 && (atIndex === 0 || /\s/.test(value[atIndex - 1]))) {
            // 提取@后的查询文本
            const query = value.substring(atIndex + 1, cursorPos);
            
            console.log('CharacterIndexer: 查询文本', { query });
            
            // 如果查询文本中包含空格，说明已经完成了角色选择
            if (query.includes(' ')) {
                this.hideSuggestions();
                return;
            }
            
            this.showSuggestions(query, atIndex);
        } else {
            this.hideSuggestions();
        }
    }

    /**
     * 处理键盘事件
     */
    handleKeyDown(e) {
        if (!this.isActive) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentSuggestions.length - 1);
                this.updateSelection();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.updateSelection();
                break;
                
            case 'Enter':
                if (this.selectedIndex >= 0) {
                    e.preventDefault();
                    this.selectSuggestion(this.selectedIndex);
                }
                break;
                
            case 'Escape':
                e.preventDefault();
                this.hideSuggestions();
                break;
        }
    }

    /**
     * 显示建议
     */
    showSuggestions(query, atIndex) {
        console.log('CharacterIndexer: 显示建议', { query, atIndex, availableRoles: this.availableRoles });
        
        this.isActive = true;
        this.selectedIndex = -1;
        
        // 过滤和排序角色
        this.currentSuggestions = this.filterAndSortRoles(query);
        
        console.log('CharacterIndexer: 过滤后的建议', this.currentSuggestions);
        
        // 渲染建议列表
        this.renderSuggestions();
        
        // 显示容器
        this.suggestionContainer.classList.remove('hidden');
        
        console.log('CharacterIndexer: 建议容器已显示', this.suggestionContainer);
        
        // 保存当前@的位置
        this.atPosition = atIndex;
    }

    /**
     * 隐藏建议
     */
    hideSuggestions() {
        this.isActive = false;
        this.selectedIndex = -1;
        this.currentSuggestions = [];
        this.suggestionContainer.classList.add('hidden');
    }

    /**
     * 过滤和排序角色
     */
    filterAndSortRoles(query) {
        const queryLower = query.toLowerCase();
        
        // 过滤匹配的角色
        const filtered = this.availableRoles.filter(role => 
            role.toLowerCase().includes(queryLower)
        );
        
        // 按优先级排序：最后说话的角色优先
        return filtered.sort((a, b) => {
            const aIndex = this.lastSpeakers.indexOf(a);
            const bIndex = this.lastSpeakers.indexOf(b);
            
            // 如果都在lastSpeakers中，按位置排序（越靠前越优先）
            if (aIndex !== -1 && bIndex !== -1) {
                return aIndex - bIndex;
            }
            
            // 如果只有一个在lastSpeakers中，优先显示
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            
            // 都不在lastSpeakers中，按字母排序
            return a.localeCompare(b);
        });
    }

    /**
     * 渲染建议列表
     */
    renderSuggestions() {
        const listContainer = this.suggestionContainer.querySelector('.suggestions-list');
        listContainer.innerHTML = '';
        
        if (this.currentSuggestions.length === 0) {
            listContainer.innerHTML = '<div class="suggestion-item">未找到匹配的角色</div>';
            return;
        }
        
        this.currentSuggestions.forEach((role, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.setAttribute('data-index', index);
            
            // 获取角色信息
            const roleInfo = this.getRoleInfo(role);
            
            item.innerHTML = `
                <div class="suggestion-avatar">${(role && typeof role === 'string') ? role.charAt(0) : '?'}</div>
                <div class="suggestion-info">
                    <div class="suggestion-name">${role || '未知角色'}</div>
                    <div class="suggestion-meta">
                        ${roleInfo.lastSpoke ? 
                            `<span class="last-spoke">最近发言</span>` : 
                            `<span class="never-spoke">未发言</span>`
                        }
                    </div>
                </div>
            `;
            
            // 绑定点击事件
            item.addEventListener('click', () => this.selectSuggestion(index));
            
            listContainer.appendChild(item);
        });
    }

    /**
     * 更新选择状态
     */
    updateSelection() {
        const items = this.suggestionContainer.querySelectorAll('.suggestion-item[data-index]');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });
        
        // 滚动到选中项
        if (this.selectedIndex >= 0) {
            const selectedItem = items[this.selectedIndex];
            if (selectedItem) {
                selectedItem.scrollIntoView({ block: 'nearest' });
            }
        }
    }

    /**
     * 选择建议
     */
    selectSuggestion(index) {
        if (index < 0 || index >= this.currentSuggestions.length) return;
        
        const selectedRole = this.currentSuggestions[index];
        const currentValue = this.messageInput.value;
        const cursorPos = this.messageInput.selectionStart;
        
        // 找到@的位置和查询文本
        const atIndex = currentValue.lastIndexOf('@', cursorPos - 1);
        const beforeAt = currentValue.substring(0, atIndex);
        const afterCursor = currentValue.substring(cursorPos);
        
        // 构建新的文本
        const newValue = `${beforeAt}@${selectedRole} ${afterCursor}`;
        
        // 更新输入框
        this.messageInput.value = newValue;
        
        // 设置光标位置
        const newCursorPos = atIndex + selectedRole.length + 2; // +2 for "@" and " "
        this.messageInput.setSelectionRange(newCursorPos, newCursorPos);
        
        // 隐藏建议
        this.hideSuggestions();
        
        // 触发角色选择事件
        this.triggerCharacterSelected(selectedRole);
        
        // 聚焦回输入框
        this.messageInput.focus();
    }

    /**
     * 触发角色选择事件
     */
    triggerCharacterSelected(roleName) {
        console.log(`CharacterIndexer: 选择了角色 ${roleName}`);
        
        // 发送自定义事件
        const event = new CustomEvent('characterSelected', {
            detail: { roleName, source: 'indexer' }
        });
        document.dispatchEvent(event);
        
        // 可以在这里添加更多的角色选择后的逻辑
        // 比如预设回复模式等
    }

    /**
     * 加载可用角色列表
     */
    async loadAvailableRoles() {
        console.log('CharacterIndexer: 开始加载角色列表...');
        try {
            const response = await fetch('/roles');
            console.log('CharacterIndexer: /roles 响应状态', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('CharacterIndexer: /roles 原始数据', data);
                
                // /roles 端点直接返回角色数组
                this.availableRoles = Array.isArray(data) ? data : (data.roles || []);
                console.log('CharacterIndexer: 已加载角色列表', this.availableRoles);
                
                // 验证角色列表不为空
                if (this.availableRoles.length === 0) {
                    console.warn('CharacterIndexer: 角色列表为空，尝试备用方法');
                    this.loadRolesFromUI();
                }
                
                // 角色列表加载完成后，重新分析聊天历史
                if (this.chatHistory.length > 0) {
                    console.log('CharacterIndexer: 角色列表加载完成，重新分析聊天历史');
                    this.analyzeChatHistory();
                }
            } else {
                console.warn('CharacterIndexer: 无法加载角色列表，状态码:', response.status);
                // 使用备用方法
                this.loadRolesFromUI();
            }
        } catch (error) {
            console.warn('CharacterIndexer: 角色列表加载失败', error);
            this.loadRolesFromUI();
        }
    }

    /**
     * 从UI中加载角色列表（备用方法）
     */
    loadRolesFromUI() {
        console.log('CharacterIndexer: 尝试从UI加载角色列表...');
        
        const roleSelect = document.getElementById('role');
        console.log('CharacterIndexer: roleSelect元素', roleSelect);
        
        if (roleSelect) {
            this.availableRoles = Array.from(roleSelect.options)
                .map(option => option.value)
                .filter(value => value && value.trim());
            console.log('CharacterIndexer: 从select获取的角色', this.availableRoles);
        }
        
        // 也可以从可搜索选择器中获取
        const roleOptions = document.getElementById('role-options');
        console.log('CharacterIndexer: roleOptions元素', roleOptions);
        
        if (roleOptions) {
            const options = roleOptions.querySelectorAll('.select-option');
            console.log('CharacterIndexer: 找到的选项元素', options.length);
            
            const roles = Array.from(options).map(option => option.textContent.trim());
            this.availableRoles = [...new Set([...this.availableRoles, ...roles])];
            console.log('CharacterIndexer: 合并后的角色列表', this.availableRoles);
        }
        
        // 尝试从全局变量获取
        if (window.rolesList && Array.isArray(window.rolesList)) {
            console.log('CharacterIndexer: 从全局变量获取角色列表', window.rolesList);
            this.availableRoles = [...new Set([...this.availableRoles, ...window.rolesList])];
        }
        
        console.log('CharacterIndexer: 从UI加载的最终角色列表', this.availableRoles);
        
        // 角色列表加载完成后，重新分析聊天历史
        if (this.chatHistory.length > 0) {
            console.log('CharacterIndexer: 备用角色列表加载完成，重新分析聊天历史');
            this.analyzeChatHistory();
        }
    }

    /**
     * 加载聊天历史并分析最后说话的角色
     */
    async loadChatHistory() {
        try {
            const currentRole = this.getCurrentRole();
            console.log('CharacterIndexer: 准备加载聊天历史，当前角色:', currentRole);
            
            if (!currentRole) {
                console.warn('CharacterIndexer: 没有选中角色，跳过历史加载');
                return;
            }
            
            const historyUrl = `/history/${encodeURIComponent(currentRole)}`;
            console.log('CharacterIndexer: 请求历史记录URL:', historyUrl);
            
            const response = await fetch(historyUrl);
            console.log('CharacterIndexer: 历史记录响应状态:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('CharacterIndexer: 历史记录原始数据:', data);
                
                // 数据可能是数组或包含 "对话历史" 键的对象
                if (Array.isArray(data)) {
                    this.chatHistory = data;
                } else {
                    this.chatHistory = data["对话历史"] || data.history || [];
                }
                
                console.log('CharacterIndexer: 解析后的聊天历史:', this.chatHistory);
                console.log('CharacterIndexer: 聊天历史长度:', this.chatHistory.length);
                
                this.analyzeChatHistory();
            } else {
                console.warn('CharacterIndexer: 历史记录请求失败，状态码:', response.status);
            }
        } catch (error) {
            console.warn('CharacterIndexer: 聊天历史加载失败', error);
        }
    }

    /**
     * 获取当前选中的角色
     */
    getCurrentRole() {
        const roleSelect = document.getElementById('role');
        
        let currentRole = null;
        
        if (roleSelect && roleSelect.value) {
            currentRole = roleSelect.value;
        }
        
        console.log('CharacterIndexer: 当前选中角色', currentRole);
        console.log('CharacterIndexer: roleSelect值', roleSelect?.value);
        
        return currentRole;
    }

    /**
     * 分析聊天历史，提取最后说话的角色
     */
    analyzeChatHistory() {
        const speakOrder = [];
        const seenRoles = new Set();
        
        // 从最新的消息开始分析
        for (let i = this.chatHistory.length - 1; i >= 0; i--) {
            const message = this.chatHistory[i];
            const match = message.match(/^([^:]+):/);
            
            if (match) {
                const speaker = match[1].trim();
                
                // 跳过玩家消息，只关注角色
                if (speaker === '凯伊姆' || speaker === '用户' || speaker === 'User') {
                    continue;
                }
                
                // 如果是新的角色，加入到列表中
                // 先检查是否在可用角色列表中，如果列表为空，则暂时接受所有角色
                const isValidRole = this.availableRoles.length === 0 || this.availableRoles.includes(speaker);
                
                if (!seenRoles.has(speaker) && isValidRole) {
                    speakOrder.push(speaker);
                    seenRoles.add(speaker);
                    console.log('CharacterIndexer: 发现说话的角色', speaker);
                }
            }
        }
        
        this.lastSpeakers = speakOrder;
                console.log('CharacterIndexer: 最后说话的角色顺序', this.lastSpeakers);
                console.log('CharacterIndexer: 可用角色列表', this.availableRoles);
    }

    /**
     * 获取角色信息
     */
    getRoleInfo(roleName) {
        return {
            lastSpoke: this.lastSpeakers.includes(roleName)
        };
    }

    /**
     * 公共方法：手动刷新角色数据
     */
    refresh() {
        this.loadAvailableRoles();
        this.loadChatHistory();
    }

    /**
     * 公共方法：检查是否激活
     */
    isIndexerActive() {
        return this.isActive;
    }

    /**
     * 调试方法：显示当前状态
     */
    debugStatus() {
        console.log('=== CharacterIndexer 调试信息 ===');
        console.log('初始化状态:', !!this.messageInput);
        console.log('可用角色:', this.availableRoles);
        console.log('聊天历史长度:', this.chatHistory.length);
        console.log('最后说话的角色:', this.lastSpeakers);
        console.log('当前激活状态:', this.isActive);
        console.log('建议容器:', this.suggestionContainer);
        console.log('输入框:', this.messageInput);
        console.log('================================');
        
        return {
            initialized: !!this.messageInput,
            availableRoles: this.availableRoles,
            chatHistoryLength: this.chatHistory.length,
            lastSpeakers: this.lastSpeakers,
            isActive: this.isActive,
            suggestionContainer: this.suggestionContainer,
            messageInput: this.messageInput
        };
    }

    /**
     * 调试方法：测试角色搜索
     */
    testSearch(query = '') {
        console.log('=== 测试角色搜索 ===');
        console.log('查询词:', query);
        
        const filtered = this.filterAndSortRoles(query);
        console.log('过滤结果:', filtered);
        
        return filtered;
    }

    /**
     * 调试方法：分析聊天历史
     */
    debugChatHistory() {
        console.log('=== 聊天历史分析调试 ===');
        console.log('聊天历史:', this.chatHistory);
        console.log('可用角色:', this.availableRoles);
        
        const speakers = new Map();
        
        // 分析每条消息
        for (let i = 0; i < this.chatHistory.length; i++) {
            const message = this.chatHistory[i];
            const match = message.match(/^([^:]+):/);
            
            if (match) {
                const speaker = match[1].trim();
                console.log(`消息 ${i}: 发言者 "${speaker}"`);
                
                if (!speakers.has(speaker)) {
                    speakers.set(speaker, []);
                }
                speakers.get(speaker).push(i);
            }
        }
        
        console.log('所有发言者:', Array.from(speakers.keys()));
        console.log('最后说话的角色:', this.lastSpeakers);
        
        return {
            chatHistory: this.chatHistory,
            availableRoles: this.availableRoles,
            allSpeakers: Array.from(speakers.keys()),
            lastSpeakers: this.lastSpeakers,
            speakerMessages: Object.fromEntries(speakers)
        };
    }

    /**
     * 测试方法：强制重新加载所有数据
     */
    async forceReload() {
        console.log('CharacterIndexer: 强制重新加载所有数据...');
        await this.loadAvailableRoles();
        await this.loadChatHistory();
        console.log('CharacterIndexer: 重新加载完成');
        return this.debugStatus();
    }
}

// 创建全局实例
window.characterIndexer = new CharacterIndexer();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterIndexer;
}
