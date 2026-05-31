/**
 * 角色回复处理器 - Character Reply Handler
 * 处理@角色回复功能，集成到现有的消息发送系统中
 */

class CharacterReplyHandler {
    constructor() {
        this.init();
    }

    /**
     * 初始化处理器
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
     * 设置处理器
     */
    setup() {
        // 监听角色选择事件
        document.addEventListener('characterSelected', (e) => {
            this.handleCharacterSelected(e.detail);
        });

        // 拦截原始的sendMessage函数
        this.interceptSendMessage();
        
        console.log('CharacterReplyHandler: 初始化完成');
    }

    /**
     * 拦截并增强sendMessage函数
     */
    interceptSendMessage() {
        // 保存原始的sendMessage函数
        if (typeof window.originalSendMessage === 'undefined' && typeof window.sendMessage === 'function') {
            window.originalSendMessage = window.sendMessage;
            
            // 替换为增强版本
            window.sendMessage = (newTopic = false) => {
                return this.enhancedSendMessage(newTopic);
            };
            
            console.log('CharacterReplyHandler: 已拦截sendMessage函数');
        }
    }

    /**
     * 增强的sendMessage函数
     */
    async enhancedSendMessage(newTopic = false) {
        const messageInput = document.getElementById('message-input');
        if (!messageInput) {
            console.error('CharacterReplyHandler: 未找到消息输入框');
            return;
        }

        let message = messageInput.value.trim();
        if (!message && !newTopic) return;

        // 检查是否需要处理旁白角色的自动@功能
        const currentRole = this.getCurrentRole();
        if (currentRole && !message.includes('@') && !newTopic) {
            console.log(`🔍 检查旁白角色自动@功能: 角色=${currentRole}, 消息="${message}"`);
            
            const processedResult = await this.processNarratorAutoMention(message, currentRole);
            console.log(`🎭 旁白角色处理结果:`, processedResult);
            
            if (processedResult.processed) {
                message = processedResult.processedMessage;
                console.log(`🎭 旁白角色自动@处理: ${processedResult.originalMessage} -> ${message}`);
                
                // 更新输入框显示处理后的消息
                messageInput.value = message;
                
                // 显示提示信息
                if (typeof showToast === 'function') {
                    showToast(`🎭 自动@${processedResult.selectedRole}`, 'info');
                }
            } else {
                console.log(`⚪ 旁白角色未处理消息，原因: ${processedResult.reason || '未知'}`);
            }
        }

        // 解析消息中的@角色引用
        const mentionInfo = this.parseMentions(message);
        
        // 只有在有有效的@角色提及且没有单独@符号时才处理@角色回复
        if (mentionInfo.hasMentions && !mentionInfo.hasStandaloneAt && !newTopic) {
            // 处理@角色回复
            return this.handleMentionReply(mentionInfo);
        } else {
            // 如果包含单独的@符号或其他情况，作为普通消息处理
            if (mentionInfo.hasStandaloneAt) {
                console.log('CharacterReplyHandler: 检测到单独的@符号，作为普通消息处理');
            }
            return window.originalSendMessage(newTopic);
        }
    }


    /**
     * 获取当前选中的角色
     */
    getCurrentRole() {
        const roleSelect = document.getElementById('role');
        return roleSelect ? roleSelect.value : null;
    }

    /**
     * 处理旁白角色的自动@功能
     * @param {string} message - 原始消息
     * @param {string} roleName - 当前角色名
     * @returns {Promise<Object>} 处理结果
     */
    async processNarratorAutoMention(message, roleName) {
        try {
            // 调用旁白角色处理器的方法
            if (window.narratorRoleHandler && typeof window.narratorRoleHandler.processNarratorMessage === 'function') {
                return await window.narratorRoleHandler.processNarratorMessage(message, roleName);
            } else {
                // 如果旁白角色处理器不可用，返回未处理状态
                return {
                    processed: false,
                    originalMessage: message,
                    processedMessage: message,
                    reason: 'narrator_handler_not_available'
                };
            }
        } catch (error) {
            console.error('处理旁白角色自动@功能失败:', error);
            return {
                processed: false,
                originalMessage: message,
                processedMessage: message,
                error: error.message
            };
        }
    }

    /**
     * 获取聊天历史用于分析
     */
    getChatHistoryForAnalysis() {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return [];
        
        const messages = chatMessages.querySelectorAll('.message');
        const history = [];
        
        // 获取最近的5条消息
        const recentMessages = Array.from(messages).slice(-5);
        
        recentMessages.forEach(messageElement => {
            const isUserMessage = messageElement.classList.contains('user-message');
            const content = messageElement.textContent || messageElement.innerText || '';
            
            if (content.trim()) {
                history.push({
                    speaker: isUserMessage ? '用户' : 'AI',
                    content: content.trim()
                });
            }
        });
        
        return history;
    }

    /**
     * 备用角色选择策略
     */
    selectFallbackRole(message) {
        const roles = [];
        
        if (roles.length === 0) {
            return null;
        }
        
        if (roles.length === 1) {
            return roles[0];
        }
        
        // 尝试使用关键词匹配策略
        const keywordMatch = this.tryKeywordMatching(message, roles);
        if (keywordMatch) {
            return keywordMatch;
        }
        
        // 如果关键词匹配失败，使用真正的随机选择
        const randomRole = this.selectRandomRole(roles);
        console.log(`🎲 随机选择角色: ${randomRole}`);
        
        return randomRole;
    }
    
    /**
     * 尝试关键词匹配
     */
    tryKeywordMatching(message, roles) {
        const messageKey = message.toLowerCase();
        
        // 常见的角色关键词映射
        const roleKeywords = {
            'luna': ['魔法', '法术', '魔力', '咒语', '魔导', '奥秘', '神秘', '月亮', '月光'],
            'jade': ['战斗', '武器', '剑', '盾', '护卫', '保护', '战士', '守护', '刀剑'],
            'elena': ['治疗', '医疗', '药水', '恢复', '照顾', '护理', '医生', '健康'],
            'mel': ['音乐', '歌声', '旋律', '演奏', '乐器', '艺术', '歌曲', '声音'],
            'roxy': ['盗贼', '潜行', '隐蔽', '敏捷', '偷窃', '机敏', '暗影', '隐身'],
            'layla': ['学者', '知识', '研究', '书籍', '学习', '智慧', '学问', '文献'],
            'claudia': ['贵族', '优雅', '高贵', '礼仪', '淑女', '气质'],
            '家务女仆': ['家务', '清洁', '打扫', '整理', '服务', '女仆'],
            '酒馆': ['酒', '饮料', '聚会', '休息', '放松', '酒精']
        };
        
        // 检查消息是否包含特定角色的关键词
        for (const role of roles) {
            const roleKey = role.toLowerCase();
            const keywords = roleKeywords[roleKey] || [];
            
            for (const keyword of keywords) {
                if (messageKey.includes(keyword)) {
                    console.log(`🎯 关键词匹配: "${keyword}" -> ${role}`);
                    return role;
                }
            }
        }
        
        return null;
    }
    
    /**
     * 真正的随机角色选择
     */
    selectRandomRole(roles) {
        // 使用加权随机选择，避免连续选择同一角色
        const weights = roles.map(role => {
            // 如果这个角色是最近选择的，降低其权重
            return role === this.lastSelectedRole ? 0.3 : 1.0;
        });
        
        // 计算权重总和
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        
        // 生成随机数
        let random = Math.random() * totalWeight;
        
        // 选择角色
        for (let i = 0; i < roles.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                this.lastSelectedRole = roles[i];
                return roles[i];
            }
        }
        
        // 后备选择（理论上不应该到达这里）
        const selectedRole = roles[Math.floor(Math.random() * roles.length)];
        this.lastSelectedRole = selectedRole;
        return selectedRole;
    }

    /**
     * 记录调试日志
     */
    async logDebug(type, message, data = null) {
        try {
            await fetch('/api/multi-chat-debug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'log',
                    type: type,
                    message: message,
                    data: data
                })
            });
        } catch (error) {
            console.error('记录调试日志失败:', error);
        }
    }

    /**
     * 解析消息中的@角色引用
     */
    parseMentions(message) {
        const mentionRegex = /@([^\s]+)/g;
        const mentions = [];
        let match;

        while ((match = mentionRegex.exec(message)) !== null) {
            const roleName = match[1];
            mentions.push({
                roleName: roleName,
                startIndex: match.index,
                endIndex: match.index + match[0].length,
                fullMatch: match[0]
            });
        }

        // 简化逻辑：检查是否存在真正单独的 @ 符号
        // 移除所有有效的角色提及后，检查剩余的 @ 符号
        let tempMessage = message;
        
        // 移除所有有效的角色提及
        for (let i = mentions.length - 1; i >= 0; i--) {
            const mention = mentions[i];
            tempMessage = tempMessage.substring(0, mention.startIndex) + 
                         tempMessage.substring(mention.endIndex);
        }
        
        // 在剩余的消息中检查是否还有 @ 符号
        const hasStandaloneAt = tempMessage.includes('@');

        // 移除@提及，获取纯净的消息内容
        let cleanMessage = message;
        for (let i = mentions.length - 1; i >= 0; i--) {
            const mention = mentions[i];
            cleanMessage = cleanMessage.substring(0, mention.startIndex) + 
                          cleanMessage.substring(mention.endIndex);
        }
        cleanMessage = cleanMessage.trim();

        return {
            hasMentions: mentions.length > 0,
            mentions: mentions,
            cleanMessage: cleanMessage,
            originalMessage: message,
            hasStandaloneAt: hasStandaloneAt
        };
    }

    /**
     * 处理@角色回复
     */
    async handleMentionReply(mentionInfo) {
        const isMultiChatMode = mentionInfo.isMultiChatMode || false;
        
        if (isMultiChatMode) {
            console.log('👥 [智能选择] 处理AI选择的角色回复', mentionInfo);
        } else {
            console.log('CharacterReplyHandler: 处理@角色回复', mentionInfo);
        }
        
        console.log('详细解析结果:', {
            原始消息: mentionInfo.originalMessage,
            提及数量: mentionInfo.mentions.length,
            提及列表: mentionInfo.mentions.map(m => m.roleName),
            纯净消息: mentionInfo.cleanMessage,
            有单独At: mentionInfo.hasStandaloneAt,
            提及模式: !isMultiChatMode
        });

        const messageInput = document.getElementById('message-input');
        const chatMessages = document.getElementById('chat-messages');
        const roleSelect = document.getElementById('role');

        if (!chatMessages || !roleSelect) {
            console.error('CharacterReplyHandler: 缺少必要的DOM元素');
            return;
        }

        // 如果有多个@提及，处理第一个
        const primaryMention = mentionInfo.mentions[0];
        const targetRole = primaryMention.roleName;

        // 验证角色是否存在
        if (!await this.validateRole(targetRole)) {
            alert(`角色 "${targetRole}" 不存在，请检查角色名称。`);
            return;
        }

        // 检查是否只有@角色而没有其他内容（自说话模式）
        // 必须满足以下条件：1. 有有效的@角色提及 2. 除了@角色之外没有其他内容 3. 不存在单独的@符号
        const isSelfSpeakMode = mentionInfo.hasMentions && 
                               (!mentionInfo.cleanMessage || mentionInfo.cleanMessage.trim() === '') &&
                               !mentionInfo.hasStandaloneAt;
        
        if (isSelfSpeakMode) {
            console.log(`CharacterReplyHandler: 触发自说话模式，角色: ${targetRole}`);
            return this.handleSelfSpeak(targetRole, messageInput, chatMessages, roleSelect);
        }

        try {
            // 优化：先清空输入框，立即给用户反馈
            messageInput.value = '';
            
            // 立即显示用户@指令消息
            const playerName = window.currentPlayerData ? window.currentPlayerData.名字 : (window.currentPlayerData?.名字 || '当前玩家');
            const userMessage = `${playerName}: ${mentionInfo.originalMessage}`;
            
            console.log('CharacterReplyHandler: 显示用户@指令消息:', userMessage);
            
            // 优化：一次性计算所有需要的索引，减少DOM查询
            const currentMessageCount = chatMessages ? chatMessages.querySelectorAll('.message').length : 0;
            const userMessageIndex = currentMessageCount;
            const aiMessageIndex = currentMessageCount + 1;
            
            // 使用requestAnimationFrame确保DOM操作的流畅性
            requestAnimationFrame(() => {
                // 立即显示用户消息
                if (typeof window.addMessage === 'function') {
                    window.addMessage(userMessage, true, userMessageIndex);
                }
                
                // 创建AI回复消息容器
                const aiMessageDiv = document.createElement('div');
                aiMessageDiv.className = 'message ai-message';
                aiMessageDiv.setAttribute('data-index', aiMessageIndex);
                chatMessages.appendChild(aiMessageDiv);
                
                // 更新全局计数器
                if (typeof window.currentHistoryLength !== 'undefined') {
                    window.currentHistoryLength = aiMessageIndex + 1;
                    console.log('CharacterReplyHandler: 历史记录长度更新为:', window.currentHistoryLength);
                }

                // 平滑滚动到底部
                requestAnimationFrame(() => {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                });
                
                // 构建请求数据 - 根据是否有消息内容决定模式
                const hasMessageContent = mentionInfo.cleanMessage && mentionInfo.cleanMessage.trim() !== '';
                const requestData = {
                    message: hasMessageContent ? mentionInfo.cleanMessage : '', // 有内容时使用清理后的消息，否则为空
                    role: roleSelect.value, // 当前选中的主角色
                    temp_role: targetRole, // 被@的角色作为临时角色
                    manifest: !hasMessageContent, // 只有在没有消息内容时才使用显现模式（自说话）
                    new_topic: false,
                    // 场景上下文支持
                    scene_context: window.currentSceneContext || null
                };
                
                console.log('CharacterReplyHandler: 请求模式', {
                    有消息内容: hasMessageContent,
                    显现模式: !hasMessageContent,
                    消息: mentionInfo.cleanMessage
                });
                
                // 继续处理网络请求
                this.sendChatRequest(requestData, aiMessageDiv, targetRole);
            });

        } catch (error) {
            console.error('CharacterReplyHandler: 发送消息失败', error);
            
            // 显示错误信息
            if (aiMessageDiv) {
                aiMessageDiv.textContent = `❌ 角色回复失败: ${error.message}`;
                aiMessageDiv.classList.add('error-message');
            } else {
                alert(`角色回复失败: ${error.message}`);
            }
        }
    }

    /**
     * 发送聊天请求（从DOM操作中分离出来，优化性能）
     */
    async sendChatRequest(requestData, aiMessageDiv, targetRole) {
        try {
            console.log('CharacterReplyHandler: 发送请求', requestData);

            // 发送聊天请求
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // 处理流式响应
            await this.handleStreamResponse(response, aiMessageDiv, targetRole);

        } catch (error) {
            console.error('CharacterReplyHandler: 网络请求失败', error);
            
            // 显示错误信息
            if (aiMessageDiv) {
                aiMessageDiv.textContent = `❌ 角色回复失败: ${error.message}`;
                aiMessageDiv.classList.add('error-message');
            }
        }
    }

    /**
     * 处理流式响应
     */
    async handleStreamResponse(response, aiMessageDiv, roleName) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let responseText = '';
        let messageStructureCreated = false;

        console.log(`CharacterReplyHandler: 开始接收 ${roleName} 的回复`);

        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // 保留不完整的行

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        if (data === '[DONE]') {
                            console.log(`CharacterReplyHandler: ${roleName} 回复完成`);
                            
                            // 标记消息生成完成
                            aiMessageDiv.setAttribute('data-generation-complete', 'true');
                            
                            // 通知角色索引器更新最后发言者列表
                            this.notifyCharacterIndexer(roleName);
                            
                            // 优化：移除同步操作，避免不必要的网络请求造成卡顿感
                            // 历史记录长度在消息发送时已经正确同步了
                            console.log('✅ CharacterReplyHandler: 角色回复完成，无需额外同步操作');
                            
                            return;
                        } else if (data.startsWith('[ERROR]')) {
                            const errorMsg = data.slice(7);
                            console.error(`CharacterReplyHandler: ${roleName} 回复错误:`, errorMsg);
                            
                            // 如果还没有创建消息结构，创建一个简单的错误显示
                            if (!messageStructureCreated) {
                                aiMessageDiv.textContent = errorMsg;
                                aiMessageDiv.classList.add('error-message');
                            } else {
                                const bubbleDiv = aiMessageDiv.querySelector('.message-bubble');
                                if (bubbleDiv) {
                                    bubbleDiv.textContent += errorMsg;
                                }
                            }
                            return;
                        } else if (data.startsWith('[AUDIO]')) {
                            // 处理音频文件
                            const audioFileName = data.slice(7);
                            console.log(`CharacterReplyHandler: 收到 ${roleName} 的音频:`, audioFileName);
                            
                            if (typeof window.addAudioToQueue === 'function') {
                                window.addAudioToQueue(audioFileName);
                            }
                            
                            // 保存音频信息到消息
                            this.saveAudioToMessage(aiMessageDiv, audioFileName);
                            continue;
                        } else if (data.startsWith('[TEMP_DATA]')) {
                            // 处理临时数据更新
                            const tempDataJson = data.slice(11);
                            console.log(`CharacterReplyHandler: ${roleName} 更新了临时数据`);
                            
                            if (typeof window.handleStreamData === 'function') {
                                window.handleStreamData(data);
                            }
                            continue;
                        } else if (data === '[CLEAN_EXTRACTED_DATA]') {
                            // 这个信号现在不执行任何操作，[]数据应该保持折叠显示
                            console.log(`CharacterReplyHandler: 收到清理 ${roleName} []数据的指令，但[]数据应保持折叠显示，跳过清理`);
                            continue;
                        } else if (data === '[CLEAN_HASH_DATA]') {
                            // 清理消息中已提取的#内容#数据
                            console.log(`CharacterReplyHandler: 清理 ${roleName} 消息中的#内容#数据`);
                            if (typeof window.cleanHashDataFromMessage === 'function') {
                                window.cleanHashDataFromMessage(aiMessageDiv);
                            }
                            continue;
                        } else {
                            // 普通文本内容 - 使用与主聊天界面相同的消息结构
                            responseText += data;
                            
                            // 如果是第一次接收到文本数据，创建完整的消息结构
                            if (!messageStructureCreated && data.trim()) {
                                // 使用统一的消息管理器创建结构
                                this.createStandardMessageStructure(aiMessageDiv, roleName);
                                messageStructureCreated = true;
                            }
                            
                            // 更新消息气泡中的文本 - 使用统一的消息气泡模块
                            const bubbleDiv = aiMessageDiv.querySelector('.message-bubble');
                            if (bubbleDiv) {
                                if (window.unifiedMessageBubble) {
                                    // 使用统一的消息管理器
                                    window.unifiedMessageBubble.updateBubbleContent(bubbleDiv, roleName, responseText, false);
                                    window.unifiedMessageBubble.setFullText(aiMessageDiv, responseText);
                                } else {
                                    // 备用方案
                                    const cleanText = responseText.trim();
                                    const processedText = window.messageDataCollapseManager ? 
                                        window.messageDataCollapseManager.processMessageContent(cleanText) : cleanText;
                                    bubbleDiv.innerHTML = `<strong>${roleName}:</strong> ${processedText}`;
                                    aiMessageDiv.setAttribute('data-full-text', cleanText);
                                }
                            }
                            
                            // 自动滚动
                            const chatMessages = document.getElementById('chat-messages');
                            if (chatMessages) {
                                chatMessages.scrollTop = chatMessages.scrollHeight;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`CharacterReplyHandler: ${roleName} 流式响应处理失败:`, error);
            
            if (!messageStructureCreated) {
                aiMessageDiv.textContent = `❌ 响应处理失败: ${error.message}`;
                aiMessageDiv.classList.add('error-message');
            } else {
                const bubbleDiv = aiMessageDiv.querySelector('.message-bubble');
                if (bubbleDiv) {
                    bubbleDiv.textContent += `\n❌ 响应处理失败: ${error.message}`;
                }
            }
        }
    }

    /**
     * 通知角色索引器更新最后发言者列表
     */
    notifyCharacterIndexer(roleName) {
        console.log(`CharacterReplyHandler: 通知角色索引器，${roleName} 刚刚发言`);
        
        // 检查是否有全局的角色索引器实例
        if (window.characterIndexer && typeof window.characterIndexer.loadChatHistory === 'function') {
            // 延迟一小段时间，确保聊天记录已经保存到服务器
            setTimeout(() => {
                console.log('CharacterReplyHandler: 正在刷新角色索引器的聊天历史...');
                window.characterIndexer.loadChatHistory();
            }, 500); // 延迟500ms，给服务器保存数据的时间
        } else {
            console.warn('CharacterReplyHandler: 角色索引器实例不可用，无法更新最后发言者列表');
        }
    }

    /**
     * 处理自说话模式（只@角色，没有消息内容）
     */
    async handleSelfSpeak(roleName, messageInput, chatMessages, roleSelect) {
        console.log(`CharacterReplyHandler: 开始执行自说话功能，角色: ${roleName}`);

        let aiMessageDiv = null;

        try {
            // 清空输入框
            messageInput.value = '';

            // 创建AI消息容器
            aiMessageDiv = document.createElement('div');
            aiMessageDiv.className = 'message ai-message';
            aiMessageDiv.setAttribute('data-index', window.currentHistoryLength || 0);
            chatMessages.appendChild(aiMessageDiv);
            
            if (typeof window.currentHistoryLength !== 'undefined') {
                window.currentHistoryLength++;
            }

            // 滚动到底部
            setTimeout(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 50);

            // 构建自说话请求数据
            const requestData = {
                message: '',  // 空消息
                role: roleSelect.value,
                temp_role: roleName,  // 使用@的角色
                new_topic: false,
                self_speak: true  // 自说话标识
            };

            console.log('CharacterReplyHandler: 发送自说话请求', requestData);

            // 发送聊天请求
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // 处理流式响应
            await this.handleStreamResponse(response, aiMessageDiv, roleName);

        } catch (error) {
            console.error('CharacterReplyHandler: 自说话功能失败', error);
            
            // 显示错误信息
            if (aiMessageDiv) {
                aiMessageDiv.textContent = `❌ 自说话功能失败: ${error.message}`;
                aiMessageDiv.classList.add('error-message');
            } else {
                alert(`自说话功能失败: ${error.message}`);
            }
        }
    }


    /**
     * 创建标准消息结构 - 使用统一的消息管理器
     */
    createStandardMessageStructure(aiMessageDiv, roleName) {
        if (window.unifiedMessageBubble) {
            // 使用统一的消息管理器创建结构
            const { img: avatarImg, fallback } = window.unifiedMessageBubble.createAvatarElement(roleName, 'avatar');
            
            // 为角色头像添加点击事件
            if (typeof window.UserAttributes !== 'undefined') {
                window.UserAttributes.addRoleAvatarClickHandler(avatarImg, roleName);
            }
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            
            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = 'message-bubble';
            
            // 创建角色名标签
            const roleSpan = document.createElement('strong');
            roleSpan.textContent = `${roleName}: `;
            bubbleDiv.appendChild(roleSpan);
            
            contentDiv.appendChild(bubbleDiv);
            
            aiMessageDiv.appendChild(avatarImg);
            aiMessageDiv.appendChild(fallback);
            aiMessageDiv.appendChild(contentDiv);
            
            console.log(`CharacterReplyHandler: 已使用统一管理器创建消息结构 for ${roleName}`);
        } else {
            // 备用方案：简单的气泡结构
            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = 'message-bubble';
            bubbleDiv.innerHTML = `<strong>${roleName}:</strong> `;
            aiMessageDiv.appendChild(bubbleDiv);
            console.warn('CharacterReplyHandler: 统一消息管理器未加载，使用备用方案');
        }
    }

    /**
     * 保存音频信息到消息元素
     */
    saveAudioToMessage(messageElement, audioFileName) {
        const existingAudioFiles = messageElement.getAttribute('data-audio-files');
        let audioFiles = [];
        
        if (existingAudioFiles) {
            try {
                audioFiles = JSON.parse(existingAudioFiles);
            } catch (e) {
                audioFiles = [];
            }
        }
        
        const audioUrl = audioFileName.startsWith('/audio/') ? audioFileName : `/audio/${audioFileName}`;
        audioFiles.push(audioUrl);
        messageElement.setAttribute('data-audio-files', JSON.stringify(audioFiles));
    }

    /**
     * 验证角色是否存在
     */
    async validateRole(roleName) {
        try {
            // 首先检查本地的角色列表
            if (window.characterIndexer && window.characterIndexer.availableRoles) {
                return window.characterIndexer.availableRoles.includes(roleName);
            }

            // 从服务器验证
            const response = await fetch('/roles');
            if (response.ok) {
                const data = await response.json();
                // /roles 端点直接返回角色数组
                const roles = Array.isArray(data) ? data : (data.roles || []);
                return roles.includes(roleName);
            }

            // 备用验证：检查UI中的角色列表
            const roleSelect = document.getElementById('role');
            if (roleSelect) {
                const options = Array.from(roleSelect.options);
                return options.some(option => option.value === roleName);
            }

            return false;
        } catch (error) {
            console.warn('CharacterReplyHandler: 角色验证失败', error);
            return false;
        }
    }

    /**
     * 同步历史记录长度，确保前后端一致
     */
    async syncHistoryLength() {
        const roleSelect = document.getElementById('role');
        if (!roleSelect || !roleSelect.value) {
            console.warn('CharacterReplyHandler: 无法获取当前角色，跳过历史记录同步');
            return;
        }

        try {
            console.log('🔄 CharacterReplyHandler: 同步历史记录长度...');
            const response = await fetch(`/history/${roleSelect.value}`);
            if (response.ok) {
                const history = await response.json();
                const serverHistoryLength = history.length;
                
                console.log(`📚 服务器历史记录长度: ${serverHistoryLength}`);
                console.log(`📚 前端历史记录长度: ${window.currentHistoryLength}`);
                
                // 更新前端历史记录长度
                if (typeof window.currentHistoryLength !== 'undefined') {
                    const oldLength = window.currentHistoryLength;
                    window.currentHistoryLength = serverHistoryLength;
                    console.log(`✅ 历史记录长度已同步: ${oldLength} → ${serverHistoryLength}`);
                }
                
                // 用户消息已经在发送时立即显示，这里只需要确保同步即可
                // 不需要额外的刷新操作，保持流畅的用户体验
                console.log('✅ CharacterReplyHandler: 历史记录同步完成，无需刷新界面');
            } else {
                console.warn('CharacterReplyHandler: 获取历史记录失败');
            }
        } catch (error) {
            console.error('CharacterReplyHandler: 同步历史记录长度失败', error);
        }
    }

    /**
     * 智能添加缺失的用户消息（避免强制刷新整个聊天界面）
     * 注意：当前版本中用户消息已经立即显示，此方法作为备用方案保留
     */
    async smartAddMissingUserMessage(serverHistoryLength) {
        try {
            const chatMessages = document.getElementById('chat-messages');
            if (!chatMessages) return;

            const currentMessages = chatMessages.querySelectorAll('.message');
            const currentUILength = currentMessages.length;

            console.log(`🔍 CharacterReplyHandler: 检查消息数量 - UI: ${currentUILength}, 服务器: ${serverHistoryLength}`);

            // 如果服务器历史记录比UI显示的多，说明有新消息需要显示
            if (serverHistoryLength > currentUILength) {
                console.log('📝 CharacterReplyHandler: 检测到缺失的消息，智能添加...');
                
                // 获取最新的历史记录
                const roleSelect = document.getElementById('role');
                const response = await fetch(`/history/${roleSelect.value}`);
                if (response.ok) {
                    const history = await response.json();
                    
                    // 只添加缺失的消息（从currentUILength开始）
                    for (let i = currentUILength; i < history.length; i++) {
                        const message = history[i];
                        if (message && typeof message === 'string') {
                            // 判断是否为用户消息
                            const isUserMessage = this.isUserMessage(message);
                            console.log(`➕ CharacterReplyHandler: 添加缺失消息 ${i}: ${message.substring(0, 50)}...`);
                            
                            // 使用全局addMessage函数添加消息
                            if (typeof window.addMessage === 'function') {
                                window.addMessage(message, isUserMessage, i);
                            }
                        }
                    }
                    
                    // 滚动到底部
                    setTimeout(() => {
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }, 100);
                }
            } else {
                console.log('✅ CharacterReplyHandler: UI消息数量与服务器同步，无需添加');
            }
        } catch (error) {
            console.error('CharacterReplyHandler: 智能添加消息失败', error);
            // 如果智能添加失败，回退到完整刷新（但添加延迟以减少影响）
            console.log('⚠️ CharacterReplyHandler: 回退到完整历史记录刷新');
            setTimeout(() => {
                if (typeof window.loadHistory === 'function') {
                    window.loadHistory();
                }
            }, 500);
        }
    }

    /**
     * 判断消息是否为用户消息
     */
    isUserMessage(message) {
        // 检查消息是否以玩家名称开头
        if (window.currentPlayerData && window.currentPlayerData.名字) {
            return message.startsWith(window.currentPlayerData.名字 + ':');
        }
        
        // 备用检查：常见的用户名称模式
        const userPatterns = ['马鲛鱼:', '凯伊姆:', '用户:', 'User:'];
        return userPatterns.some(pattern => message.startsWith(pattern));
    }

    /**
     * 处理角色选择事件（从角色索引器触发）
     */
    handleCharacterSelected(detail) {
        console.log('CharacterReplyHandler: 接收到角色选择事件', detail);
        
        // 可以在这里添加角色选择后的特殊处理逻辑
        // 比如显示提示信息、预设消息模板等
        
        if (detail.source === 'indexer') {
            this.showRoleMentionHint(detail.roleName);
        }
    }

    /**
     * 显示角色提及提示
     */
    showRoleMentionHint(roleName) {
        // 创建提示信息
        const hint = document.createElement('div');
        hint.className = 'role-mention-hint';
        hint.innerHTML = `
            <span class="hint-text">
                已选择角色 <strong>${roleName}</strong>，继续输入消息内容，该角色将会回复您。<br>
                <small>💡 直接发送可让 ${roleName} 自己说话</small>
            </span>
        `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .role-mention-hint {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(212, 175, 55, 0.9);
                color: #1a1a2e;
                padding: 10px 20px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: bold;
                z-index: 10000;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                backdrop-filter: blur(10px);
                animation: slideIn 0.3s ease, slideOut 0.3s ease 2.7s forwards;
            }

            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translate(-50%, -20px);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, 0);
                }
            }

            @keyframes slideOut {
                from {
                    opacity: 1;
                    transform: translate(-50%, 0);
                }
                to {
                    opacity: 0;
                    transform: translate(-50%, -20px);
                }
            }
        `;

        if (!document.querySelector('style[data-role-hint]')) {
            style.setAttribute('data-role-hint', 'true');
            document.head.appendChild(style);
        }

        // 添加到页面
        document.body.appendChild(hint);

        // 3秒后自动移除
        setTimeout(() => {
            if (hint.parentNode) {
                hint.parentNode.removeChild(hint);
            }
        }, 3000);
    }

    /**
     * 公共方法：手动触发@角色回复
     */
    triggerMentionReply(roleName, message) {
        const mentionInfo = {
            hasMentions: true,
            mentions: [{ roleName: roleName, startIndex: 0, endIndex: roleName.length + 1, fullMatch: `@${roleName}` }],
            cleanMessage: message,
            originalMessage: `@${roleName} ${message}`
        };
        
        return this.handleMentionReply(mentionInfo);
    }

    /**
     * 公共方法：获取最近@提及的角色
     */
    getRecentMentions() {
        const messageInput = document.getElementById('message-input');
        if (!messageInput) return [];
        
        const message = messageInput.value;
        const mentionInfo = this.parseMentions(message);
        
        return mentionInfo.mentions.map(m => m.roleName);
    }
}

// 创建全局实例
window.characterReplyHandler = new CharacterReplyHandler();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterReplyHandler;
}
