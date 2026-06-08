// 命令索引管理器
// 处理聊天页面的斜杠(/)指令功能，提供快捷命令索引

class CommandIndex {
    constructor() {
        this.isVisible = false;
        this.selectedIndex = 0;
        this.filteredCommands = [];
        this.inputElement = null;
        this.containerElement = null;
        this.pluginCommands = []; // 插件命令
        
        // 定义所有可用命令
        this.commands = [
            {
                id: 'ai-modify',
                name: 'AI事件模拟',
                description: '模拟各种事件对角色的影响',
                icon: '🧹',
                category: 'ai',
                action: () => this.executeAIModify()
            },
            {
                id: 'summary-save',
                name: '总结保存',
                description: '准确可修改，使用原始总结功能',
                icon: '📊',
                category: 'data',
                action: () => this.executeSummarySave()
            },
            {
                id: 'clear-temp',
                name: '清理临时数据',
                description: '清除当前角色的临时数据',
                icon: '🗑️',
                category: 'data',
                action: () => this.executeClearTempData()
            },
            {
                id: 'role-switch',
                name: '切换角色',
                description: '快速切换到其他角色',
                icon: '🎭',
                category: 'system',
                action: () => this.executeRoleSwitch()
            },
            {
                id: 'semantic-search',
                name: '智能搜索',
                description: '基于语义的角色智能搜索系统',
                icon: '🔍',
                category: 'system',
                action: () => this.executeSemanticSearch()
            },
            {
                id: 'voice-toggle',
                name: '语音开关',
                description: '切换自动播放语音功能',
                icon: '🔊',
                category: 'system',
                action: () => this.executeVoiceToggle()
            },
            {
                id: 'analysis-toggle',
                name: '自动分析开关',
                description: '切换按条数自动分析功能',
                icon: '📈',
                category: 'system',
                action: () => this.executeAnalysisToggle()
            },
            {
                id: 'hidden-settings',
                name: '底层设定管理',
                description: '开发者专用：管理AI底层行为设定',
                icon: '🔧',
                category: 'dev',
                action: () => this.executeHiddenSettings()
            },
            {
                id: 'generate-image',
                name: '生图',
                description: '基于角色和聊天内容生成AI绘画',
                icon: '🎨',
                category: 'ai',
                action: () => this.executeGenerateImage()
            },
            {
                id: 'generate-first-person-image',
                name: '生成图片第一人称',
                description: '生成第一人称视角的AI绘画（不读取玩家数据书）',
                icon: '👁️',
                category: 'ai',
                action: () => this.executeGenerateFirstPersonImage()
            },
            {
                id: 'image-settings',
                name: '生图设置',
                description: '调整AI绘画生成参数和设置',
                icon: '⚙️',
                category: 'ai',
                action: () => this.executeImageSettings()
            },
            {
                id: 'help',
                name: '帮助',
                description: '查看所有可用命令',
                icon: '❓',
                category: 'system',
                action: () => this.executeHelp()
            },
            {
                id: 'history-reduction',
                name: '聊天记录减负',
                description: '对当前角色的整个聊天记录进行完整压缩（保留最近3条）',
                icon: '🔄',
                category: 'data',
                action: () => this.executeHistoryReduction()
            },
            {
                id: 'auto-dialogue',
                name: '自动对话',
                description: '让当前角色连续生成多条对话（/自动 或 /自动 数字）',
                icon: '🤖',
                category: 'ai',
                action: () => this.executeAutoDialogue()
            },
            {
                id: 'create-memory',
                name: '纪念',
                description: '创建纪念时刻，保存重要的聊天记录片段（/纪念 或 /纪念 数字）',
                icon: '📸',
                category: 'data',
                action: () => this.executeCreateMemory()
            },
            {
                id: 'free-event',
                name: '自由事件',
                description: '多角色自由对话，支持智能数据书检索和总结功能',
                icon: '🎭',
                category: 'ai',
                action: () => this.executeFreeEvent()
            },
        ];
    }


    // 初始化命令索引
    init(inputElementId) {
        this.inputElement = document.getElementById(inputElementId);
        if (!this.inputElement) {
            console.error('找不到输入框元素:', inputElementId);
            return;
        }

        this.createContainer();
        this.attachEventListeners();
        this.loadPluginCommands(); // 加载插件命令
    }

    // 加载插件命令
    async loadPluginCommands() {
        try {
            const response = await fetch('/api/plugins/commands');
            const data = await response.json();
            
            if (data.success && data.commands) {
                this.pluginCommands = data.commands.map(cmd => {
                    // 保存原始的 action 函数名
                    const originalAction = cmd.action;
                    return {
                        ...cmd,
                        actionName: originalAction, // 保存原始函数名
                        action: () => this.executePluginCommand(originalAction)
                    };
                });
                
                console.log(`✅ 加载了 ${this.pluginCommands.length} 个插件命令`);
            }
        } catch (error) {
            console.error('加载插件命令失败:', error);
        }
    }

    // 执行插件命令
    executePluginCommand(actionName) {
        // 调用插件注册的前端函数
        if (actionName && typeof window[actionName] === 'function') {
            window[actionName]();
        } else {
            console.error(`插件命令的处理函数 ${actionName} 不存在`);
            this.showToast(`命令处理函数未找到: ${actionName}`, 'error');
        }
    }

    // 获取所有命令（包括插件命令）
    getAllCommands() {
        return [...this.commands, ...this.pluginCommands];
    }

    // 创建命令索引容器
    createContainer() {
        this.containerElement = document.createElement('div');
        this.containerElement.id = 'command-index-container';
        this.containerElement.className = 'command-index-container';
        this.containerElement.style.display = 'none';
        
        // 插入到输入框的父容器中
        const inputContainer = this.inputElement.parentElement;
        inputContainer.insertBefore(this.containerElement, this.inputElement);
    }

    // 添加事件监听器
    attachEventListeners() {
        // 监听输入框的输入事件
        this.inputElement.addEventListener('input', (e) => {
            this.handleInput(e);
        });

        // 监听键盘事件
        this.inputElement.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });

        // 监听点击事件，点击外部时隐藏命令索引
        document.addEventListener('click', (e) => {
            if (!this.containerElement.contains(e.target) && e.target !== this.inputElement) {
                this.hide();
            }
        });
    }

    // 处理输入事件
    handleInput(e) {
        const value = e.target.value;
        
        if (value.startsWith('/')) {
            const query = value.slice(1).toLowerCase();
            this.filterCommands(query);
            this.show();
        } else {
            this.hide();
        }
    }

    // 处理键盘事件
    handleKeyDown(e) {
        if (!this.isVisible) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredCommands.length - 1);
                this.updateSelection();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
                this.updateSelection();
                break;
            case 'Enter':
                e.preventDefault();
                if (this.filteredCommands.length > 0) {
                    this.executeCommand(this.filteredCommands[this.selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                this.hide();
                break;
        }
    }

    // 过滤命令
    filterCommands(query) {
        const allCommands = this.getAllCommands();
        if (!query) {
            this.filteredCommands = allCommands;
        } else {
            this.filteredCommands = allCommands.filter(cmd => 
                cmd.name.toLowerCase().includes(query) ||
                cmd.description.toLowerCase().includes(query) ||
                cmd.id.toLowerCase().includes(query)
            );
        }
        this.selectedIndex = 0;
        this.renderCommands();
    }

    // 渲染命令列表
    renderCommands() {
        const html = `
            <div class="command-index-header">
                <span class="command-index-title">📋 快捷命令</span>
                <span class="command-index-count">${this.filteredCommands.length} 个命令</span>
            </div>
            <div class="command-list">
                ${this.filteredCommands.map((cmd, index) => `
                    <div class="command-item ${index === this.selectedIndex ? 'selected' : ''}" 
                         data-index="${index}" 
                         onclick="commandIndex.executeCommand(commandIndex.filteredCommands[${index}])">
                        <div class="command-icon">${cmd.icon}</div>
                        <div class="command-content">
                            <div class="command-name">${cmd.name}</div>
                            <div class="command-description">${cmd.description}</div>
                        </div>
                        <div class="command-category">${this.getCategoryLabel(cmd.category)}</div>
                    </div>
                `).join('')}
            </div>
            <div class="command-index-footer">
                <small>↑↓ 选择 • Enter 执行 • Esc 关闭</small>
            </div>
        `;
        
        this.containerElement.innerHTML = html;
    }

    // 获取分类标签
    getCategoryLabel(category) {
        const labels = {
            'ai': 'AI',
            'data': '数据',
            'system': '系统',
            'dev': '开发',
            'plugin': '插件'
        };
        return labels[category] || category;
    }

    // 更新选择状态
    updateSelection() {
        const items = this.containerElement.querySelectorAll('.command-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });
    }

    // 显示命令索引
    show() {
        this.isVisible = true;
        this.containerElement.style.display = 'block';
        this.containerElement.classList.add('show');
    }

    // 隐藏命令索引
    hide() {
        this.isVisible = false;
        this.containerElement.style.display = 'none';
        this.containerElement.classList.remove('show');
        this.selectedIndex = 0;
    }

    // 执行命令
    executeCommand(command) {
        if (!command) return;
        
        // 清空输入框
        this.inputElement.value = '';
        this.hide();
        
        // 显示执行提示
        this.showToast(`正在执行: ${command.name}`, 'info');
        
        // 执行命令
        try {
            command.action();
        } catch (error) {
            console.error('执行命令失败:', error);
            this.showToast(`执行命令失败: ${error.message}`, 'error');
        }
    }

    // ========== 命令实现 ==========

    // AI智能修改
    executeAIModify() {
        if (typeof dataSaveManager !== 'undefined') {
            // 检查是否选择了角色
            const roleSelect = document.getElementById('role');
            if (!roleSelect || !roleSelect.value) {
                this.showToast('请先选择一个角色', 'warning');
                return;
            }
            dataSaveManager.currentRole = roleSelect.value;
            dataSaveManager.openAIModifyMode();
        } else {
            this.showToast('数据保存管理器未加载', 'error');
        }
    }


    // 总结保存
    executeSummarySave() {
        if (typeof dataSaveManager !== 'undefined') {
            const roleSelect = document.getElementById('role');
            if (!roleSelect || !roleSelect.value) {
                this.showToast('请先选择一个角色', 'warning');
                return;
            }
            dataSaveManager.currentRole = roleSelect.value;
            dataSaveManager.openSummaryMode();
        } else {
            this.showToast('数据保存管理器未加载', 'error');
        }
    }

    // 清理临时数据
    executeClearTempData() {
        const roleSelect = document.getElementById('role');
        if (!roleSelect || !roleSelect.value) {
            this.showToast('请先选择一个角色', 'warning');
            return;
        }

        if (confirm('确定要清理当前角色的临时数据吗？此操作不可撤销。')) {
            fetch('/api/clear_temp_data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    role_name: roleSelect.value
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.showToast('临时数据已清理', 'success');
                } else {
                    this.showToast('清理失败: ' + data.error, 'error');
                }
            })
            .catch(error => {
                console.error('清理临时数据失败:', error);
                this.showToast('清理失败: ' + error.message, 'error');
            });
        }
    }

    // 切换角色
    executeRoleSwitch() {
        // 角色切换功能现在通过角色管理页面实现
        if (typeof openCharacterManagement === 'function') {
            openCharacterManagement();
            this.showToast('角色管理页面已打开', 'info');
        } else {
            this.showToast('角色切换功能不可用', 'error');
        }
    }

    // 打开智能搜索
    executeSemanticSearch() {
        window.open('/semantic-search', '_blank');
        this.showToast('智能搜索页面已打开', 'success');
    }

    // 切换语音功能
    executeVoiceToggle() {
        // 使用全局函数切换语音设置
        if (typeof toggleQuickVoiceSettings === 'function') {
            toggleQuickVoiceSettings();
        } else {
            this.showToast('语音设置功能不可用', 'error');
        }
    }

    // 切换自动分析功能
    executeAnalysisToggle() {
        // 使用全局函数切换自动分析设置
        if (typeof toggleAutoAnalysis === 'function') {
            toggleAutoAnalysis();
        } else {
            this.showToast('自动分析功能不可用', 'error');
        }
    }

    // 打开底层设定管理页面
    executeHiddenSettings() {
        // 在新窗口中打开底层设定管理页面
        window.open('/dev/hidden_settings', '_blank');
        this.showToast('已打开底层设定管理页面', 'success');
    }

    // 执行生图命令
    executeGenerateImage() {
        const messageInput = document.getElementById('message-input');
        if (!messageInput) {
            this.showToast('找不到消息输入框', 'error');
            return;
        }

        // 检查是否选择了角色
        const roleSelect = document.getElementById('role');
        if (!roleSelect || !roleSelect.value) {
            this.showToast('请先选择一个角色', 'warning');
            return;
        }

        // 在输入框中输入/生图命令
        messageInput.value = '/生图';
        
        // 触发发送消息
        if (typeof sendMessage === 'function') {
            sendMessage();
            this.showToast('正在生成图片，请稍候...', 'info');
        } else {
            this.showToast('发送消息功能不可用', 'error');
        }
    }

    // 执行第一人称生图命令
    executeGenerateFirstPersonImage() {
        const messageInput = document.getElementById('message-input');
        if (!messageInput) {
            this.showToast('找不到消息输入框', 'error');
            return;
        }

        // 检查是否选择了角色
        const roleSelect = document.getElementById('role');
        if (!roleSelect || !roleSelect.value) {
            this.showToast('请先选择一个角色', 'warning');
            return;
        }

        // 在输入框中输入/生成图片第一人称命令
        messageInput.value = '/生成图片第一人称';
        
        // 触发发送消息
        if (typeof sendMessage === 'function') {
            sendMessage();
            this.showToast('正在生成第一人称视角图片，请稍候...', 'info');
        } else {
            this.showToast('发送消息功能不可用', 'error');
        }
    }

    // 执行生图设置命令
    executeImageSettings() {
        // 打开生图设置页面
        window.open('/image-gen-settings', '_blank');
        this.showToast('已打开生图设置页面', 'success');
    }



    // 执行聊天记录减负
    executeHistoryReduction() {
        const roleSelect = document.getElementById('role');
        if (!roleSelect || !roleSelect.value) {
            // 使用旁白显示警告消息
            if (typeof window.addMessage === 'function') {
                window.addMessage('[旁白] 请先选择一个角色', false);
            }
            return;
        }

        const roleName = roleSelect.value;
        
        // 显示确认对话框
        if (!confirm(`确定要对角色 "${roleName}" 的整个聊天记录进行减负吗？\n\n⚠️ 指令减负与普通减负不同：\n• 会处理所有聊天记录（除最近3条）\n• 将早期对话全部压缩为简洁旁白\n• 大幅节省API费用但信息会被精简\n\n此操作不可撤销！`)) {
            return;
        }

        // 使用旁白显示开始执行的消息
        if (typeof window.addMessage === 'function') {
            window.addMessage('[旁白] 正在执行完整聊天记录减负...', false);
        }

        // 调用完整聊天记录减负API
        fetch('/api/full_chat_history_reduction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                role_name: roleName
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 使用旁白显示成功消息
                if (typeof window.addMessage === 'function') {
                    let message = `[旁白] ${data.message || '聊天记录减负完成'}`;
                    
                    // 如果有显示记录数变化的信息，添加到消息中
                    if (data.original_count && data.new_count) {
                        message += `\n记录数：${data.original_count} → ${data.new_count}`;
                    }
                    
                    window.addMessage(message, false);
                }
                
                // 刷新聊天界面以显示更新后的记录
                if (typeof loadChatHistory === 'function') {
                    setTimeout(() => {
                        loadChatHistory();
                    }, 1500);
                }
            } else {
                // 使用旁白显示错误消息
                if (typeof window.addMessage === 'function') {
                    window.addMessage(`[旁白] 减负失败: ${data.error || '未知错误'}`, false);
                }
            }
        })
        .catch(error => {
            console.error('聊天记录减负失败:', error);
            // 使用旁白显示错误消息
            if (typeof window.addMessage === 'function') {
                window.addMessage(`[旁白] 减负失败: ${error.message}`, false);
            }
        });
    }

    // 执行自动对话生成
    executeAutoDialogue() {
        const messageInput = document.getElementById('message-input');
        if (!messageInput) {
            this.showToast('找不到消息输入框', 'error');
            return;
        }

        // 检查是否选择了角色
        const roleSelect = document.getElementById('role');
        if (!roleSelect || !roleSelect.value) {
            this.showToast('请先选择一个角色', 'warning');
            return;
        }

        // 弹出对话框询问生成条数
        const count = prompt('请输入要生成的对话条数（1-20，默认3条）:', '3');
        if (count === null) {
            return; // 用户取消
        }

        const countNum = parseInt(count) || 3;
        if (countNum < 1 || countNum > 20) {
            this.showToast('条数必须在1-20之间', 'warning');
            return;
        }

        // 在输入框中输入自动指令
        const autoCommand = countNum === 3 ? '/自动' : `/自动 ${countNum}`;
        messageInput.value = autoCommand;
        
        // 触发发送消息
        if (typeof sendMessage === 'function') {
            sendMessage();
            this.showToast(`正在生成${countNum}条自动对话，请稍候...`, 'info');
        } else {
            this.showToast('发送消息功能不可用', 'error');
        }
    }

    // 执行创建纪念
    executeCreateMemory() {
        const messageInput = document.getElementById('message-input');
        if (!messageInput) {
            this.showToast('找不到消息输入框', 'error');
            return;
        }

        // 检查是否选择了角色
        const roleSelect = document.getElementById('role');
        if (!roleSelect || !roleSelect.value) {
            this.showToast('请先选择一个角色', 'warning');
            return;
        }

        // 弹出对话框询问保存消息数量
        const count = prompt('请输入要保存的消息数量（1-50，默认5条）:', '5');
        if (count === null) {
            return; // 用户取消
        }

        const countNum = parseInt(count) || 5;
        if (countNum < 1 || countNum > 50) {
            this.showToast('数量必须在1-50之间', 'warning');
            return;
        }

        // 在输入框中输入纪念指令
        const memoryCommand = countNum === 5 ? '/纪念' : `/纪念 ${countNum}`;
        messageInput.value = memoryCommand;
        
        // 触发发送消息
        if (typeof sendMessage === 'function') {
            sendMessage();
            this.showToast(`准备创建纪念，保存最近${countNum}条消息...`, 'info');
        } else {
            this.showToast('发送消息功能不可用', 'error');
        }
    }

    // 执行自由事件
    executeFreeEvent() {
        // 在新窗口中打开自由事件页面
        window.open('/free-event', '_blank');
        this.showToast('已打开自由事件页面', 'success');
    }

    // 显示帮助
    executeHelp() {
        const helpContent = `
            <div class="help-dialog">
                <h3>📋 快捷命令帮助</h3>
                <div class="help-content">
                    <h4>🤖 AI功能</h4>
                    <ul>
                        <li><strong>/ai-modify</strong> - AI事件模拟</li>
                        <li><strong>/auto-dialogue</strong> 或 <strong>/自动</strong> - 让当前角色连续生成多条对话</li>
                        <li><strong>/free-event</strong> 或 <strong>/自由事件</strong> - 多角色自由对话，支持智能数据书检索</li>
                        <li><strong>/generate-image</strong> 或 <strong>/生图</strong> - 直连 OpenAI/Gemini 生图 API，并自动注入角色头像作为参考</li>
                        <li><strong>/生成图片第一人称</strong> - 第一人称视角生图（不读取玩家数据书）</li>
                        <li><strong>/image-settings</strong> 或 <strong>/生图设置</strong> - 调整生图通用参数（负面词、尺寸、参考图数量等）</li>
                    </ul>
                    
                    <h4>💾 数据管理</h4>
                    <ul>
                        <li><strong>/summary-save</strong> - 总结保存模式</li>
                        <li><strong>/clear-temp</strong> - 清理临时数据</li>
                        <li><strong>/聊天记录减负</strong> - 对当前角色的整个聊天记录进行完整压缩（保留最近3条）</li>
                        <li><strong>/纪念</strong> - 创建纪念时刻，保存重要的聊天记录片段（可指定保存条数）</li>
                    </ul>
                    
                    <h4>⚙️ 系统功能</h4>
                    <ul>
                        <li><strong>/role-switch</strong> - 切换角色</li>
                        <li><strong>/semantic-search</strong> - 智能搜索</li>
                        <li><strong>/voice-toggle</strong> - 切换语音播放</li>
                        <li><strong>/analysis-toggle</strong> - 切换自动分析</li>
                        <li><strong>/help</strong> - 显示此帮助信息</li>
                    </ul>
                    
                    <h4>🔧 开发者功能</h4>
                    <ul>
                        <li><strong>/hidden-settings</strong> - 底层设定管理（开发者专用）</li>
                    </ul>
                    
                    <h4>💡 使用技巧</h4>
                    <ul>
                        <li>在聊天输入框中输入 <code>/</code> 开始使用命令</li>
                        <li>可以输入命令名称的部分内容进行搜索</li>
                        <li>使用 ↑↓ 箭头键选择，Enter 执行，Esc 关闭</li>
                        <li>点击命令项也可以直接执行</li>
                    </ul>
                </div>
            </div>
        `;
        
        this.showDialog('帮助', helpContent);
    }


    // ========== 工具方法 ==========

    // 显示提示消息
    showToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // 显示对话框
    showDialog(title, content) {
        const dialogHTML = `
            <div class="dialog-overlay" id="command-help-dialog">
                <div class="dialog-content" style="max-width: 600px;">
                    <div class="dialog-header">
                        <h3>${title}</h3>
                        <button class="dialog-close" onclick="commandIndex.closeDialog('command-help-dialog')">&times;</button>
                    </div>
                    <div class="dialog-body">
                        ${content}
                    </div>
                    <div class="dialog-footer">
                        <button class="dialog-btn confirm-btn" onclick="commandIndex.closeDialog('command-help-dialog')">确定</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', dialogHTML);
    }

    // 关闭对话框
    closeDialog(dialogId) {
        const dialog = document.getElementById(dialogId);
        if (dialog) {
            dialog.remove();
        }
    }
}

// 创建全局实例
window.commandIndex = new CommandIndex();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CommandIndex;
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 延迟初始化，确保其他脚本已加载
    setTimeout(() => {
        commandIndex.init('message-input');
    }, 100);
});
