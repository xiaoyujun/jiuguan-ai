/**
 * 旁白角色处理器
 * 处理旁白角色的特殊功能，包括自动@功能和角色类别切换
 */
class NarratorRoleHandler {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 角色类别切换事件
        const categorySelect = document.getElementById('character-category');
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                this.handleCategoryChange(e.target.value);
            });
        }

        // 旁白自动@功能开关
        const autoMentionCheckbox = document.getElementById('narrator-auto-mention');
        if (autoMentionCheckbox) {
            autoMentionCheckbox.addEventListener('change', (e) => {
                this.handleAutoMentionToggle(e.target.checked);
            });
        }
    }

    /**
     * 处理角色类别变化
     * @param {string} category - 选择的角色类别
     */
    handleCategoryChange(category) {
        const narratorConfig = document.getElementById('narrator-config');
        const roleBindingTab = document.querySelector('.tab-btn[data-tab="role-binding"]');
        
        if (category === 'narrator') {
            // 显示旁白配置
            if (narratorConfig) {
                narratorConfig.style.display = 'block';
                narratorConfig.classList.add('fade-in');
            }
            
            // 高亮角色捆绑标签页，提示用户必须配置
            if (roleBindingTab) {
                roleBindingTab.classList.add('highlight-required');
                roleBindingTab.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 角色捆绑';
            }
            
            // 显示提示信息
            this.showNarratorSetupGuide();
        } else {
            // 隐藏旁白配置
            if (narratorConfig) {
                narratorConfig.style.display = 'none';
                narratorConfig.classList.remove('fade-in');
            }
            
            // 恢复角色捆绑标签页样式
            if (roleBindingTab) {
                roleBindingTab.classList.remove('highlight-required');
                roleBindingTab.innerHTML = '<i class="fas fa-users"></i> 角色捆绑';
            }
        }
    }

    /**
     * 处理自动@功能开关
     * @param {boolean} enabled - 是否启用
     */
    handleAutoMentionToggle(enabled) {
        console.log(`旁白自动@功能: ${enabled ? '启用' : '禁用'}`);
        
        if (enabled) {
            this.showToast('✨ 自动@功能已启用，玩家消息将自动选择捆绑角色回复', 'success');
        } else {
            this.showToast('⚠️ 自动@功能已禁用，需要手动@角色才能触发回复', 'warning');
        }
    }

    /**
     * 显示旁白角色设置指南
     */
    showNarratorSetupGuide() {
        const guide = document.createElement('div');
        guide.className = 'narrator-setup-guide';
        guide.innerHTML = `
            <div class="guide-content">
                <i class="fas fa-lightbulb"></i>
                <strong>设置提示：</strong>
                <p>旁白角色需要捆绑其他角色才能正常工作，请切换到"角色捆绑"标签页进行配置。</p>
                <button type="button" class="btn btn-small btn-primary" onclick="this.parentElement.parentElement.remove(); document.querySelector('.tab-btn[data-tab=\\"role-binding\\"]').click();">
                    <i class="fas fa-arrow-right"></i> 立即配置
                </button>
                <button type="button" class="btn btn-small btn-secondary" onclick="this.parentElement.parentElement.remove();">
                    <i class="fas fa-times"></i> 稍后配置
                </button>
            </div>
        `;
        
        const narratorConfig = document.getElementById('narrator-config');
        if (narratorConfig && !narratorConfig.querySelector('.narrator-setup-guide')) {
            narratorConfig.appendChild(guide);
            
            // 3秒后自动隐藏指南
            setTimeout(() => {
                if (guide.parentElement) {
                    guide.style.opacity = '0';
                    setTimeout(() => {
                        if (guide.parentElement) {
                            guide.remove();
                        }
                    }, 300);
                }
            }, 8000);
        }
    }

    /**
     * 验证旁白角色配置
     * @param {Object} formData - 角色表单数据
     * @returns {Object} 验证结果
     */
    validateNarratorConfig(formData) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // 检查是否为旁白角色
        if (formData.角色类别 === 'narrator') {
            // 必须有捆绑角色
            const boundRoles = formData.角色捆绑配置?.boundRoles || [];
            if (boundRoles.length === 0) {
                result.isValid = false;
                result.errors.push('旁白角色必须至少捆绑一个其他角色');
            }

            // 检查是否启用了角色捆绑功能
            if (!formData.角色捆绑配置?.enabled) {
                result.isValid = false;
                result.errors.push('旁白角色必须启用角色捆绑功能');
            }

            // 警告：建议启用自动@功能
            if (!formData.旁白自动提及) {
                result.warnings.push('建议启用自动@功能以获得最佳体验');
            }
        }

        return result;
    }

    /**
     * 处理旁白角色的消息自动@逻辑
     * @param {string} message - 原始消息
     * @param {string} currentRole - 当前角色名
     * @returns {Object} 处理结果
     */
    processNarratorMessage(message, currentRole) {
        return new Promise(async (resolve) => {
            try {
                // 检查当前角色是否为旁白角色
                const roleData = await this.getRoleData(currentRole);
                if (!roleData || roleData.角色类别 !== 'narrator') {
                    resolve({ processed: false, originalMessage: message });
                    return;
                }

                // 检查是否启用了自动@功能
                if (!roleData.旁白自动提及) {
                    resolve({ processed: false, originalMessage: message });
                    return;
                }

                // 获取捆绑的角色列表
                const boundRoles = roleData.角色捆绑配置?.boundRoles || [];
                if (boundRoles.length === 0) {
                    console.warn('旁白角色没有捆绑任何角色，无法自动@');
                    resolve({ processed: false, originalMessage: message });
                    return;
                }

                // 检查消息是否已经包含@提及
                if (message.includes('@')) {
                    resolve({ processed: false, originalMessage: message });
                    return;
                }

                // 使用智能选择算法选择最相关的角色
                this.smartSelectRole(message, boundRoles, currentRole).then(selectionResult => {
                    const selectedRole = selectionResult.selectedRole;
                    const processedMessage = `@${selectedRole} ${message}`;

                    console.log(`🎭 旁白角色自动@: ${currentRole} -> ${selectedRole}`);
                    console.log(`📝 原始消息: "${message}"`);
                    console.log(`📝 处理后消息: "${processedMessage}"`);
                    console.log(`🧠 选择方法: ${selectionResult.selectionMethod} (得分: ${selectionResult.finalScore})`);
                    
                    // 显示概率信息
                    if (selectionResult.selectionProbability) {
                        console.log(`🎲 选择概率: ${(selectionResult.selectionProbability * 100).toFixed(1)}%`);
                    }
                    
                    if (selectionResult.roleProbabilities) {
                        console.log(`📊 各角色概率:`, Object.entries(selectionResult.roleProbabilities)
                            .map(([role, prob]) => `${role}: ${(prob * 100).toFixed(1)}%`)
                            .join(', '));
                    }
                    
                    if (selectionResult.debug) {
                        console.log(`🔍 调试信息:`, selectionResult.debug);
                        
                        // 显示性能信息
                        if (selectionResult.debug.total_processing_time) {
                            console.log(`⏱️ 处理耗时: 总计${selectionResult.debug.total_processing_time}s (搜索:${selectionResult.debug.search_time}s, 历史:${selectionResult.debug.history_time}s)`);
                        }
                    }

                    resolve({
                        processed: true,
                        originalMessage: message,
                        processedMessage: processedMessage,
                        selectedRole: selectedRole,
                        boundRoles: boundRoles,
                        selectionResult: selectionResult
                    });
                }).catch(error => {
                    console.error('智能角色选择失败，降级到随机选择:', error);
                    
                    // 降级到随机选择
                    const selectedRole = boundRoles[Math.floor(Math.random() * boundRoles.length)];
                    const processedMessage = `@${selectedRole} ${message}`;

                    console.log(`🎲 旁白角色随机@: ${currentRole} -> ${selectedRole} (降级)`);

                    resolve({
                        processed: true,
                        originalMessage: message,
                        processedMessage: processedMessage,
                        selectedRole: selectedRole,
                        boundRoles: boundRoles,
                        selectionMethod: 'fallback_random',
                        error: error.message
                    });
                });

            } catch (error) {
                console.error('处理旁白角色消息失败:', error);
                resolve({ processed: false, originalMessage: message, error: error.message });
            }
        });
    }

    /**
     * 智能选择角色 - 基于消息内容和聊天历史的语义分析
     * @param {string} message - 玩家消息
     * @param {Array} boundRoles - 捆绑角色列表
     * @param {string} currentRole - 当前旁白角色
     * @returns {Promise<Object>} 选择结果
     */
    async smartSelectRole(message, boundRoles, currentRole) {
        try {
            console.log(`🧠 开始智能角色选择: 消息="${message}", 捆绑角色=[${boundRoles.join(', ')}]`);
            
            // 获取聊天历史
            const chatHistory = this.getChatHistoryForAnalysis();
            console.log(`📚 获取到 ${chatHistory.length} 条聊天历史`);
            
            // 调用后端智能选择API
            const response = await fetch('/api/semantic/smart-role-selection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    bound_roles: boundRoles,
                    chat_history: chatHistory,
                    max_results: 1
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '智能选择API返回失败');
            }
            
            const selectionResult = result.selection_result;
            console.log(`✅ 智能选择完成:`, selectionResult);
            
            return {
                selectedRole: selectionResult.selected_role,
                selectionMethod: selectionResult.selection_method,
                finalScore: selectionResult.final_score,
                selectionProbability: selectionResult.selection_probability,
                roleProbabilities: selectionResult.role_probabilities,
                debug: selectionResult.debug_info,
                roleScores: selectionResult.role_scores,
                contentScores: selectionResult.content_scores,
                historyRelevance: selectionResult.history_relevance
            };
            
        } catch (error) {
            console.error('智能角色选择API调用失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取聊天历史用于分析
     * @returns {Array} 聊天历史消息数组
     */
    getChatHistoryForAnalysis() {
        try {
            const chatMessages = document.getElementById('chat-messages');
            if (!chatMessages) {
                console.warn('未找到聊天消息容器');
                return [];
            }
            
            const messages = chatMessages.querySelectorAll('.message');
            const history = [];
            
            // 获取最近的10条消息用于分析
            const recentMessages = Array.from(messages).slice(-10);
            
            recentMessages.forEach(messageElement => {
                const isUserMessage = messageElement.classList.contains('user-message');
                let content = '';
                
                if (isUserMessage) {
                    // 用户消息直接获取文本内容
                    content = messageElement.textContent || messageElement.innerText || '';
                } else {
                    // AI消息从message-bubble中获取内容
                    const bubble = messageElement.querySelector('.message-bubble');
                    if (bubble) {
                        content = bubble.textContent || bubble.innerText || '';
                    } else {
                        content = messageElement.textContent || messageElement.innerText || '';
                    }
                }
                
                if (content.trim()) {
                    history.push(content.trim());
                }
            });
            
            console.log(`📖 提取聊天历史: ${history.length} 条消息`, history.slice(-3)); // 只显示最近3条用于调试
            return history;
            
        } catch (error) {
            console.error('获取聊天历史失败:', error);
            return [];
        }
    }

    /**
     * 获取角色数据
     * @param {string} roleName - 角色名称
     * @returns {Promise<Object>} 角色数据
     */
    async getRoleData(roleName) {
        try {
            const response = await fetch(`/api/roles/${encodeURIComponent(roleName)}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`获取角色数据失败 (${roleName}):`, error);
            return null;
        }
    }

    /**
     * 显示提示消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 ('success', 'warning', 'error', 'info')
     */
    showToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * 在角色切换器中显示旁白角色的特殊标识
     * @param {string} roleName - 角色名称
     * @param {Object} roleData - 角色数据
     * @returns {string} 角色显示HTML
     */
    renderNarratorRoleIndicator(roleName, roleData) {
        if (roleData.角色类别 === 'narrator') {
            const boundRoles = roleData.角色捆绑配置?.boundRoles || [];
            const autoMention = roleData.旁白自动提及 ? '启用' : '禁用';
            
            return `
                <div class="role-item narrator-role" data-role="${roleName}">
                    <div class="role-avatar">
                        <img src="/角色/${roleName}.png" alt="${roleName}" onerror="this.src='/static/images/default-avatar.svg'">
                        <div class="narrator-badge">
                            <i class="fas fa-theater-masks"></i>
                        </div>
                    </div>
                    <div class="role-info">
                        <h4 class="role-name">${roleName}</h4>
                        <p class="role-type">旁白角色</p>
                        <div class="narrator-details">
                            <span class="bound-count">捆绑角色: ${boundRoles.length}</span>
                            <span class="auto-mention-status ${autoMention === '启用' ? 'enabled' : 'disabled'}">
                                自动@: ${autoMention}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }
        return null;
    }
}

// 创建全局实例
window.narratorRoleHandler = new NarratorRoleHandler();

// 添加相关CSS样式到页面
function addNarratorStyles() {
    if (document.querySelector('#narrator-role-styles')) {
        return; // 样式已存在
    }
    
    const style = document.createElement('style');
    style.id = 'narrator-role-styles';
    style.textContent = `
        .fade-in {
            animation: fadeIn 0.3s ease-in;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .tab-btn.highlight-required {
            background: linear-gradient(135deg, #ff9800, #f57c00) !important;
            color: white !important;
            animation: pulse 2s infinite;
            font-weight: bold;
        }

        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }

        .narrator-setup-guide {
            background: linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(3, 169, 244, 0.05));
            border: 2px solid rgba(33, 150, 243, 0.3);
            border-radius: 8px;
            padding: 1rem;
            margin-top: 1rem;
            animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
        }

        .guide-content {
            display: flex;
            align-items: flex-start;
            gap: 1rem;
        }

        .guide-content i {
            color: #2196f3;
            font-size: 1.2rem;
            margin-top: 0.2rem;
        }

        .guide-content strong {
            color: #2196f3;
            display: block;
            margin-bottom: 0.5rem;
        }

        .guide-content p {
            margin: 0 0 1rem 0;
            color: var(--text-light);
            line-height: 1.5;
            flex: 1;
        }

        .guide-content .btn {
            margin-right: 0.5rem;
        }

        .narrator-role {
            position: relative;
        }

        .narrator-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            background: linear-gradient(135deg, #ffc107, #ff9800);
            color: white;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .narrator-details {
            display: flex;
            gap: 0.5rem;
            margin-top: 0.25rem;
            font-size: 0.75rem;
        }

        .bound-count {
            color: var(--text-secondary);
        }

        .auto-mention-status.enabled {
            color: #4caf50;
        }

        .auto-mention-status.disabled {
            color: #ff9800;
        }

        .role-type {
            color: #ffc107 !important;
            font-weight: 500;
        }
    `;
    
    document.head.appendChild(style);
}

// 页面加载完成后添加样式
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addNarratorStyles);
} else {
    addNarratorStyles();
}

