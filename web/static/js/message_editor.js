/**
 * 消息编辑器模块
 * 包含消息编辑、重新生成、语音重播等功能
 */

// 全局变量声明
let clickTimer = null;
let clickDelay = 200; // 200毫秒延迟区分单击和双击
let lastTouchTime = 0;

/**
 * 带重试机制的网络请求函数
 */
async function fetchWithRetry(url, options, maxRetries = 2) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 尝试请求 (第${attempt + 1}次/${maxRetries + 1}次): ${url}`);
            const response = await fetch(url, options);
            
            if (response.ok) {
                return response;
            } else if (response.status >= 500 && attempt < maxRetries) {
                // 服务器错误，可以重试
                console.warn(`⚠️ 服务器错误 ${response.status}，将在2秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1))); // 递增延迟
                continue;
            } else {
                // 客户端错误或最后一次尝试失败
                return response;
            }
        } catch (error) {
            lastError = error;
            
            if (attempt < maxRetries && 
                (error.message.includes('Failed to fetch') || 
                 error.message.includes('ERR_CONNECTION_RESET') ||
                 error.message.includes('ERR_NETWORK'))) {
                console.warn(`⚠️ 网络错误，将在2秒后重试: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1))); // 递增延迟
                continue;
            } else {
                // 不可重试的错误或已达到最大重试次数
                throw error;
            }
        }
    }
    
    throw lastError;
}

/**
 * 初始化消息气泡交互功能
 */
function setupMessageBubbleInteraction() {
    // 使用事件委托来处理动态添加的消息
    const chatMessages = document.getElementById('chat-messages');
    
    // 处理单击事件
    chatMessages.addEventListener('click', function(e) {
        // 如果点击的是消息气泡（但不是按钮）
        if (e.target.classList.contains('message-bubble') || e.target.closest('.message-bubble')) {
            const bubble = e.target.classList.contains('message-bubble') ? e.target : e.target.closest('.message-bubble');
            
            // 如果点击的不是按钮本身
            if (!e.target.classList.contains('edit-message-btn') && 
                !e.target.classList.contains('refresh-message-btn') &&
                !e.target.classList.contains('edited-mark')) {
                
                // 清除之前的定时器
                if (clickTimer) {
                    clearTimeout(clickTimer);
                }
                
                // 设置单击处理延迟
                clickTimer = setTimeout(() => {
                    toggleMessageButtons(bubble);
                    clickTimer = null;
                }, clickDelay);
            }
        }
    });

    // 处理双击事件
    chatMessages.addEventListener('dblclick', function(e) {
        console.log('🖱️ 双击事件被触发:', e.target);
        
        // 阻止事件冒泡和默认行为
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // 清除单击定时器
        if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
        }
        
        // 如果双击的是消息气泡（但不是按钮）
        if (e.target.classList.contains('message-bubble') || e.target.closest('.message-bubble')) {
            const bubble = e.target.classList.contains('message-bubble') ? e.target : e.target.closest('.message-bubble');
            
            // 如果双击的不是按钮本身
            if (!e.target.classList.contains('edit-message-btn') && 
                !e.target.classList.contains('refresh-message-btn') &&
                !e.target.classList.contains('edited-mark')) {
                
                console.log('✅ 执行双击处理逻辑');
                handleMessageDoubleClick(bubble);
            } else {
                console.log('❌ 双击的是按钮，跳过处理');
            }
        } else {
            console.log('❌ 双击的不是消息气泡');
        }
    }, true); // 使用捕获阶段，确保优先级

    // 触屏设备的双击支持
    chatMessages.addEventListener('touchend', function(e) {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTouchTime;
        
        // 如果两次触摸间隔小于500毫秒，认为是双击
        if (tapLength < 500 && tapLength > 0) {
            // 清除单击定时器
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            
            // 获取触摸的元素
            const touch = e.changedTouches[0];
            const element = document.elementFromPoint(touch.clientX, touch.clientY);
            
            if (element && (element.classList.contains('message-bubble') || element.closest('.message-bubble'))) {
                const bubble = element.classList.contains('message-bubble') ? element : element.closest('.message-bubble');
                
                // 如果触摸的不是按钮
                if (!element.classList.contains('edit-message-btn') && 
                    !element.classList.contains('refresh-message-btn') &&
                    !element.classList.contains('edited-mark')) {
                    
                    e.preventDefault(); // 防止默认行为
                    handleMessageDoubleClick(bubble);
                }
            }
        }
        
        lastTouchTime = currentTime;
    });

    // 点击页面其他地方时隐藏所有按钮
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.message-bubble')) {
            document.querySelectorAll('.message-bubble').forEach(bubble => {
                hideMessageButtons(bubble);
            });
        }
    });
}

/**
 * 处理消息双击事件
 */
function handleMessageDoubleClick(bubble) {
    console.log('🔍 消息双击事件触发:', bubble);
    console.log('🔍 气泡内容:', bubble.innerHTML);
    console.log('🔍 气泡文本:', bubble.textContent);
    
    // 获取消息相关信息
    const messageDiv = bubble.closest('.message');
    if (!messageDiv) {
        console.error('❌ 无法找到消息容器');
        showToast('无法找到消息容器', 'error');
        return;
    }
    
    const messageIndex = messageDiv.getAttribute('data-index');
    
    console.log('📍 消息元素:', messageDiv, '索引:', messageIndex);
    console.log('📍 消息类名:', Array.from(messageDiv.classList));
    
    if (messageIndex === null) {
        console.error('❌ 无法获取消息索引');
        showToast('无法获取消息索引', 'error');
        return;
    }
    
    // 从消息内容中解析角色名和消息文本
    let roleName = '';
    let messageText = '';
    
    // 首先尝试从HTML结构中解析（处理@角色回复的格式）
    const strongElement = bubble.querySelector('strong');
    if (strongElement) {
        // 如果有<strong>标签，说明是HTML格式
        const strongText = strongElement.textContent || strongElement.innerText;
        if (strongText.endsWith(':')) {
            roleName = strongText.slice(0, -1); // 移除末尾的冒号
            
            // 获取strong标签后的文本内容
            const bubbleClone = bubble.cloneNode(true);
            const strongClone = bubbleClone.querySelector('strong');
            if (strongClone) {
                strongClone.remove();
                messageText = (bubbleClone.textContent || bubbleClone.innerText).trim();
            }
        }
    }
    
    // 如果HTML解析失败，回退到纯文本解析
    if (!roleName || !messageText) {
        const bubbleText = bubble.textContent || bubble.innerText;
        const colonIndex = bubbleText.indexOf(': ');
        
        if (colonIndex === -1) {
            console.warn('⚠️ 消息没有标准格式（角色名: 内容），尝试从消息容器获取角色信息');
            console.log('消息内容:', bubbleText);
            
            // 尝试从消息容器的其他部分获取角色信息
            // （messageDiv 已经在上面定义过了）
            
            // 检查是否有头像元素可以获取角色名
            const avatarImg = messageDiv.querySelector('img.avatar');
            if (avatarImg) {
                const altText = avatarImg.alt || '';
                const avatarMatch = altText.match(/(.+)头像/);
                if (avatarMatch) {
                    roleName = avatarMatch[1];
                    messageText = bubbleText;
                    console.log('✅ 从头像获取角色名:', roleName);
                }
            }
            
            // 如果还没有角色名，尝试从头像fallback获取
            if (!roleName) {
                const avatarFallback = messageDiv.querySelector('.avatar-fallback');
                if (avatarFallback && avatarFallback.textContent) {
                    // 假设fallback是角色名的首字母
                    const fallbackText = avatarFallback.textContent.trim();
                    console.log('🔍 尝试从头像fallback推断角色:', fallbackText);
                    
                    // 这里可以根据首字母推断角色名，但现在先使用通用处理
                    roleName = '未知角色';
                    messageText = bubbleText;
                }
            }
            
            // 如果仍然没有角色名，检查消息类型
            if (!roleName) {
                if (messageDiv.classList.contains('user-message')) {
                    roleName = window.currentPlayerData?.名字 || '当前玩家';
                } else if (messageDiv.classList.contains('ai-message')) {
                    roleName = 'AI';
                } else {
                    roleName = '未知';
                }
                messageText = bubbleText;
                console.log('✅ 根据消息类型设置角色名:', roleName);
            }
        } else {
            roleName = bubbleText.substring(0, colonIndex);
            messageText = bubbleText.substring(colonIndex + 2);
        }
    }
    
    console.log('📝 解析出的消息信息:', { roleName, messageText: messageText.substring(0, 50) + '...' });
    
    // 判断是用户消息还是AI消息
    const isUserMessage = messageDiv.classList.contains('user-message');
    const isAIMessage = messageDiv.classList.contains('ai-message');
    
    console.log('🎭 消息类型判断:', {
        isUserMessage,
        isAIMessage,
        classList: Array.from(messageDiv.classList),
        roleName,
        messageText: messageText.substring(0, 50) + '...'
    });
    
    if (isUserMessage) {
        // 检查是否为隐藏的玩家消息
        if (messageDiv.classList.contains('hidden-player-message')) {
            console.log('⚠️ 隐藏的玩家消息不允许编辑');
            showToast('玩家消息已隐藏，无法编辑', 'warning');
            return;
        }
        // 用户消息：直接编辑
        console.log('✏️ 执行用户消息编辑');
        editMessage(messageDiv, roleName, messageText, parseInt(messageIndex));
        showToast('双击编辑用户消息', 'info');
    } else if (isAIMessage) {
        // AI消息：显示选择菜单（编辑或重新生成）
        console.log('🤖 显示AI消息操作菜单');
        showAIMessageActionMenu(messageDiv, bubble, roleName, messageText, parseInt(messageIndex));
    }
}

/**
 * 显示AI消息操作菜单
 */
function showAIMessageActionMenu(messageDiv, bubble, roleName, messageText, messageIndex) {
    console.log('🎯 开始显示AI消息操作菜单:', {
        messageIndex,
        roleName,
        messageText: messageText.substring(0, 30) + '...'
    });
    
    // 移除现有的菜单
    const existingMenu = document.querySelector('.ai-message-action-menu');
    if (existingMenu) {
        console.log('🗑️ 移除现有菜单');
        existingMenu.remove();
    }
    
    // 创建操作菜单
    const menu = document.createElement('div');
    menu.className = 'ai-message-action-menu';
    
    // 创建菜单头部
    const header = document.createElement('div');
    header.className = 'ai-action-header';
    header.innerHTML = `
        <span>选择操作</span>
        <button class="close-btn" onclick="closeAIMessageActionMenu()">×</button>
    `;
    
    // 创建选项容器
    const options = document.createElement('div');
    options.className = 'ai-action-options';
    
    // 创建编辑按钮
    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn edit-action';
    editBtn.innerHTML = `
        <span class="action-icon">✏️</span>
        <span class="action-text">编辑消息</span>
    `;
    editBtn.onclick = () => editMessageFromMenu(messageIndex, roleName, messageText);
    
    // 创建重新生成按钮
    const regenerateBtn = document.createElement('button');
    regenerateBtn.className = 'action-btn regenerate-action';
    regenerateBtn.innerHTML = `
        <span class="action-icon">🔄</span>
        <span class="action-text">重新生成</span>
    `;
    regenerateBtn.onclick = () => regenerateMessageFromMenu(messageIndex, roleName, messageText);
    
    // 创建修正数据引用按钮
    const correctionBtn = document.createElement('button');
    correctionBtn.className = 'action-btn correction-action';
    correctionBtn.innerHTML = `
        <span class="action-icon">🔧</span>
        <span class="action-text">修正数据引用</span>
    `;
    correctionBtn.onclick = () => openSemanticCorrectionFromMessage(messageText, roleName);
    correctionBtn.title = '修正消息的数据书关联，优化语义搜索准确性';
    
    // 创建重播语音按钮
    const replayBtn = document.createElement('button');
    replayBtn.className = 'action-btn replay-voice-action';
    replayBtn.innerHTML = `
        <span class="action-icon">🔊</span>
        <span class="action-text">重新播放语音</span>
    `;
    replayBtn.onclick = () => replayVoiceFromMenu(messageIndex, roleName, messageText);
    
    // 组装菜单
    options.appendChild(editBtn);
    options.appendChild(regenerateBtn);
    options.appendChild(correctionBtn);
    options.appendChild(replayBtn);
    
    menu.appendChild(header);
    menu.appendChild(options);
    
    // 获取气泡位置
    const rect = bubble.getBoundingClientRect();
    const menuWidth = 200;
    const menuHeight = 200; // 菜单高度
    
    // 计算菜单位置（尽量在气泡附近但不超出视窗）
    let left = rect.left + rect.width / 2 - menuWidth / 2;
    let top = rect.top - menuHeight - 10;
    
    // 边界检查
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;
    if (top < 10) top = rect.bottom + 10;
    if (top + menuHeight > window.innerHeight - 10) top = rect.top - menuHeight - 10;
    
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    
    // 添加到页面
    document.body.appendChild(menu);
    console.log('✅ AI消息操作菜单已添加到页面:', menu);
    
    // 添加点击外部关闭功能
    setTimeout(() => {
        document.addEventListener('click', closeAIMessageActionMenuOnOutsideClick);
    }, 100);
    
    showToast('双击AI消息：请选择操作', 'info');
}

/**
 * 关闭AI消息操作菜单
 */
function closeAIMessageActionMenu() {
    const menu = document.querySelector('.ai-message-action-menu');
    if (menu) {
        menu.remove();
    }
    document.removeEventListener('click', closeAIMessageActionMenuOnOutsideClick);
}

/**
 * 点击外部关闭菜单
 */
function closeAIMessageActionMenuOnOutsideClick(e) {
    const menu = document.querySelector('.ai-message-action-menu');
    if (menu && !menu.contains(e.target)) {
        closeAIMessageActionMenu();
    }
}

/**
 * 从菜单编辑消息
 */
function editMessageFromMenu(messageIndex, roleName, messageText) {
    closeAIMessageActionMenu();
    const messageDiv = document.querySelector(`[data-index="${messageIndex}"]`);
    if (messageDiv) {
        editMessage(messageDiv, roleName, messageText, parseInt(messageIndex));
    }
}

/**
 * 从菜单重新生成消息
 */
function regenerateMessageFromMenu(messageIndex, roleName, messageText) {
    console.log('🔄 从菜单重新生成消息:', {
        messageIndex,
        roleName,
        messageText: messageText.substring(0, 30) + '...'
    });
    
    // 智能验证和匹配消息
    const currentRole = document.getElementById('role').value;
    console.log('🔍 智能验证消息状态...');
    
    // 显示验证提示
    showToast('正在验证消息状态...', 'info');
    
    // 先尝试智能匹配，如果失败再使用重试机制
    const smartCheckHistory = async (retryCount = 0, maxRetries = 3) => {
        try {
            const response = await fetch(`/history/${currentRole}`);
            const history = await response.json();
            
            console.log('📚 服务器历史记录长度:', history.length);
            console.log('📚 服务器历史记录内容:', history);
            console.log('📚 请求重新生成的索引:', messageIndex, '(类型:', typeof messageIndex, ')');
            console.log('📚 解析后的索引:', parseInt(messageIndex));
            console.log('📚 DOM中的消息数量:', document.querySelectorAll('.message').length);
            
            const targetIndex = parseInt(messageIndex);
            
            // 智能匹配：检查消息内容是否匹配
            if (targetIndex < history.length) {
                console.log('✅ 直接索引匹配成功');
                return processRegeneration();
            }
            
            // 如果直接索引不匹配，尝试智能内容匹配
            const messageDiv = document.querySelector(`[data-index="${messageIndex}"]`);
            if (messageDiv) {
                const messageBubble = messageDiv.querySelector('.message-bubble');
                if (messageBubble) {
                    const messageContent = messageBubble.textContent || messageBubble.innerText;
                    console.log('🔍 尝试内容匹配，消息内容:', messageContent);
                    
                    // 在历史记录中查找匹配的内容
                    const matchingIndex = history.findIndex(historyItem => {
                        const cleanHistory = historyItem.replace(/\[AUDIO\][^\s]*/g, '').trim();
                        return cleanHistory.includes(messageContent.trim()) || messageContent.trim().includes(cleanHistory);
                    });
                    
                    if (matchingIndex !== -1) {
                        console.log(`✅ 内容匹配成功，实际索引: ${matchingIndex}`);
                        // 更新消息的索引属性
                        messageDiv.setAttribute('data-index', matchingIndex);
                        return processRegeneration();
                    }
                }
            }
            
            // 如果智能匹配失败，使用重试机制
            if (retryCount < maxRetries) {
                console.log(`⏳ 历史记录尚未同步，等待1秒后重试 (${retryCount + 1}/${maxRetries + 1})`);
                if (retryCount === 0) {
                    showToast('消息正在保存中，请稍候...', 'info');
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                return smartCheckHistory(retryCount + 1, maxRetries);
            } else {
                console.error('❌ 消息尚未保存到历史记录中，无法重新生成');
                console.error(`📚 详细信息: 尝试访问索引${targetIndex}，但历史记录只有${history.length}条`);
                console.error('📚 历史记录内容:', history);
                showToast(`消息尚未完全保存，历史记录长度${history.length}，但尝试访问索引${targetIndex}`, 'warning');
                closeAIMessageActionMenu();
                return;
            }
        } catch (error) {
            console.error('❌ 验证历史记录失败:', error);
            showToast('验证消息状态失败，请稍后重试', 'error');
            closeAIMessageActionMenu();
        }
    };
    
    // 定义重新生成处理函数
    const processRegeneration = () => {
            
        // 消息存在于历史记录中，检查是否完全生成完成
        const messageDiv = document.querySelector(`[data-index="${messageIndex}"]`);
        if (messageDiv) {
            // 检查消息是否完全生成完成
            const isGenerationComplete = messageDiv.getAttribute('data-generation-complete');
            const hasMessageContent = messageDiv.querySelector('.message-bubble');
            
            // 检查消息完成状态
            const messageComplete = (isGenerationComplete === 'true') || 
                                   (hasMessageContent && hasMessageContent.textContent.trim());
            
            if (!messageComplete) {
                console.error('❌ 消息尚未完全生成完成，无法重新生成');
                showToast('消息正在生成中，请等待完成后再尝试重新生成', 'warning');
                return;
            } else if (!isGenerationComplete || isGenerationComplete !== 'true') {
                console.log('⚠️ 消息没有生成完成标记，但有内容，允许重新生成（可能是@角色回复）');
            }
            
            const bubble = messageDiv.querySelector('.message-bubble');
            if (bubble) {
                console.log('🎯 找到消息元素，开始重新生成');
                refreshAIMessage(messageDiv, roleName, parseInt(messageIndex), bubble.innerHTML, messageText);
            } else {
                console.error('❌ 找不到消息气泡元素');
            }
        } else {
            console.error('❌ 找不到消息元素，索引:', messageIndex);
        }
    };
    
    // 开始智能历史记录检查
    smartCheckHistory();
}

/**
 * 从菜单重新播放语音
 */
function replayVoiceFromMenu(messageIndex, roleName, messageText) {
    closeAIMessageActionMenu();
    const messageDiv = document.querySelector(`[data-index="${messageIndex}"]`);
    if (messageDiv) {
        replayMessageAudio(messageText, roleName, messageDiv);
    }
}

/**
 * 从菜单触发AI智能分析到数据书
 */
function triggerAIAnalysisFromMenu(messageIndex, roleName, messageText) {
    console.log('🧠 触发AI智能分析到数据书:', {
        messageIndex,
        roleName,
        messageText: messageText.substring(0, 50) + '...'
    });
    
    closeAIMessageActionMenu();
    
    // 显示加载提示
    showToast('正在启动AI智能分析...', 'info');
    
    // 调用AI智能分析功能
    triggerAIAnalysisToStorybook(roleName, messageText, messageIndex);
}

// 从消息菜单打开语义修正页面
function openSemanticCorrectionFromMessage(messageText, roleName) {
    // 隐藏右键菜单
    closeAIMessageActionMenu();
    
    // 调用全局函数打开修正页面
    if (typeof openSemanticCorrection === 'function') {
        openSemanticCorrection(messageText, roleName);
    } else {
        // 备用方案：直接跳转
        const params = new URLSearchParams({
            message: encodeURIComponent(messageText),
            storybook: encodeURIComponent(roleName)
        });
        
        const url = `/semantic-correction?${params.toString()}`;
        
        // 在新窗口中打开修正页面
        const width = 1200;
        const height = 800;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        window.open(
            url,
            'semantic_correction',
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );
    }
}

/**
 * 编辑消息功能
 */
function editMessage(messageDiv, roleName, originalText, messageIndex) {
    const bubbleDiv = messageDiv.querySelector('.message-bubble');
    if (!bubbleDiv) return;
    
    // 检查是否已经在编辑模式
    if (bubbleDiv.querySelector('.edit-textarea')) {
        return;
    }
    
    // 保存原始内容
    const originalHTML = bubbleDiv.innerHTML;
    
    // 创建编辑界面
    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container';
    
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-textarea';
    textarea.value = originalText;
    textarea.rows = Math.max(3, Math.ceil(originalText.length / 50));
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'edit-buttons';
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'edit-save-btn';
    saveBtn.innerHTML = '✅ 保存';
    saveBtn.onclick = () => saveMessageEdit(messageDiv, roleName, textarea.value, messageIndex, originalHTML);
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'edit-cancel-btn';
    cancelBtn.innerHTML = '❌ 取消';
    cancelBtn.onclick = () => cancelMessageEdit(messageDiv, originalHTML);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'edit-delete-btn';
    deleteBtn.innerHTML = '🗑️ 删除';
    deleteBtn.onclick = () => deleteMessage(messageDiv, messageIndex, roleName);
    
    // 判断消息类型，添加相应的按钮
    const isUserMessage = messageDiv.classList.contains('user-message');
    const isAIMessage = messageDiv.classList.contains('ai-message');
    
    if (isAIMessage) {
        // AI消息：添加刷新按钮
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'edit-refresh-btn';
        refreshBtn.innerHTML = '🔄 重新生成';
        refreshBtn.onclick = () => refreshAIMessage(messageDiv, roleName, messageIndex, originalHTML, originalText);
        buttonContainer.appendChild(refreshBtn);
    }
    
    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(deleteBtn);
    
    editContainer.appendChild(textarea);
    editContainer.appendChild(buttonContainer);
    
    // 替换气泡内容为编辑界面
    bubbleDiv.innerHTML = '';
    bubbleDiv.appendChild(editContainer);
    
    // 聚焦到文本框
    textarea.focus();
    textarea.select();
    
    // 添加键盘快捷键
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cancelMessageEdit(messageDiv, originalHTML);
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            saveMessageEdit(messageDiv, roleName, textarea.value, messageIndex, originalHTML);
        }
    });
}

/**
 * 通用的AI消息重新生成函数
 */
function refreshAIMessage(messageDiv, roleName, messageIndex, originalHTML, originalText) {
    console.log('🔧 refreshAIMessage开始:', {
        roleName,
        messageIndex,
        originalText: originalText.substring(0, 50) + '...'
    });
    
    if (!confirm(`确定要重新生成${roleName}的这段回复吗？原有内容将被替换。`)) {
        console.log('❌ 用户取消重新生成');
        return;
    }
    
    console.log('✅ 用户确认重新生成');
    
    // 恢复原始显示并添加生成中提示
    const bubbleDiv = messageDiv.querySelector('.message-bubble');
    bubbleDiv.innerHTML = `
        <strong>${roleName}:</strong> 
        <span style="color: #999; font-style: italic;">正在重新生成${roleName}的回复...</span>
    `;
    
    let response_text = '';
    
    // 获取当前选中的角色
    const currentRole = document.getElementById('role').value;
    console.log('🎭 当前选中角色:', currentRole);
    
    // 发送请求重新生成内容
    console.log('📡 发送重新生成请求到 /regenerate_message');
    
    // 构建请求数据
    const requestData = {
        role: currentRole,
        ai_role: roleName,
        message_index: messageIndex,
        original_text: originalText
    };
    
    // 记录请求数据
    console.log('📋 重新生成请求数据:');
    console.log('  - role (当前角色):', currentRole);
    console.log('  - ai_role (AI角色):', roleName);
    console.log('  - message_index (消息索引):', messageIndex, typeof messageIndex);
    console.log('  - original_text (原始文本长度):', originalText ? originalText.length : 'null');
    
    // 设置连接超时定时器，如果30秒内没有开始接收数据则超时
    let connectionTimeout = setTimeout(() => {
        console.warn('⚠️ 重新生成连接超时（30秒内无响应），但不中断处理');
        // 不还原内容，只记录日志
        showToast('连接较慢，请耐心等待...', 'warning');
    }, 30000); // 30秒连接超时，但不中断
    
    // 设置总体超时定时器，超时时保存已生成的内容
    let totalTimeout = setTimeout(() => {
        console.warn('⚠️ 重新生成总体超时（120秒），保存已生成内容');
        // 不还原内容，保存当前已生成的内容
        if (response_text.trim()) {
            console.log('💾 超时时保存已生成内容:', response_text.trim());
            saveMessageEdit(messageDiv, roleName, response_text.trim(), messageIndex, originalHTML);
            showToast('生成完成（已保存当前内容）', 'success');
        } else {
            // 只有在完全没有内容时才还原
            bubbleDiv.innerHTML = originalHTML;
            showToast('重新生成未产生内容', 'warning');
        }
    }, 120000); // 120秒总体超时
    
    // 增强的fetch配置，添加超时和重试机制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
        console.log('⏰ 请求超时，中止连接');
    }, 60000); // 60秒网络请求超时
    
    fetchWithRetry('/regenerate_message', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        signal: controller.signal,
        // 添加keepalive保持连接
        keepalive: true
    }, 1)
    .then(response => {
        clearTimeout(timeoutId);
        console.log('📩 收到响应:', response.status, response.statusText);
        if (!response.ok) {
            // 尝试读取错误响应体
            return response.text().then(errorText => {
                console.error('❌ 服务器错误响应:', errorText);
                let errorMessage = `HTTP错误: ${response.status} ${response.statusText}`;
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.error) {
                        errorMessage += ` - ${errorData.error}`;
                    }
                } catch (e) {
                    // 如果不是JSON格式，使用原始文本
                    if (errorText) {
                        errorMessage += ` - ${errorText}`;
                    }
                }
                throw new Error(errorMessage);
            });
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        function readStream() {
            reader.read().then(({ done, value }) => {
                if (done) {
                    // 清除所有超时定时器
                    clearTimeout(connectionTimeout);
                    clearTimeout(totalTimeout);
                    console.log('✅ 流式响应完成');
                    
                    // 流完成后，保存新内容到历史记录
                    if (response_text.trim()) {
                        saveMessageEdit(messageDiv, roleName, response_text.trim(), messageIndex, originalHTML);
                    } else {
                        // 如果没有生成内容，恢复原始内容
                        bubbleDiv.innerHTML = originalHTML;
                        showToast('重新生成没有产生内容', 'warning');
                    }
                    return;
                }
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        // 在收到第一个有效数据时清除连接超时
                        if (connectionTimeout && data && data !== '[DONE]' && !data.startsWith('[ERROR]')) {
                            clearTimeout(connectionTimeout);
                            connectionTimeout = null;
                            console.log('✅ 开始接收数据，连接超时已清除');
                            
                            // 显示正在生成的状态
                            bubbleDiv.innerHTML = `<strong>${roleName}:</strong> <span style="color: #999; font-style: italic;">正在生成回复...</span>`;
                        }
                        
                        if (data === '[DONE]') {
                            return;
                        } else if (data.startsWith('[ERROR]')) {
                            // 清除所有超时定时器
                            clearTimeout(connectionTimeout);
                            clearTimeout(totalTimeout);
                            
                            // 如果已有生成内容，保存它；否则还原
                            if (response_text.trim()) {
                                console.log('💾 错误时保存已生成内容:', response_text.trim());
                                saveMessageEdit(messageDiv, roleName, response_text.trim(), messageIndex, originalHTML);
                                showToast('部分内容已生成并保存', 'warning');
                            } else {
                                bubbleDiv.innerHTML = originalHTML;
                                showToast('重新生成失败: ' + data.slice(7), 'error');
                            }
                            return;
                        } else if (data.startsWith('[AUDIO]')) {
                            // 处理音频文件
                            const audioFileName = data.slice(7);
                            addAudioToQueue(audioFileName);
                            continue;
                        } else if (data.startsWith('[TEMP_DATA]') || data.startsWith('[TEMP_DATA_ERROR]') || data.startsWith('[TEMP_DATA_EXTRACTED]')) {
                            // 处理临时数据标记
                            console.log('📊 重新生成中收到临时数据:', data);
                            
                            // 如果是提取的临时数据，进行特殊处理
                            if (data.startsWith('[TEMP_DATA_EXTRACTED]')) {
                                try {
                                    const extractedDataJson = data.slice(20); // 移除 '[TEMP_DATA_EXTRACTED]' 前缀
                                    const extractedData = JSON.parse(extractedDataJson);
                                    console.log('🔍 重新生成中提取到的临时数据:', extractedData);
                                    
                                    // 触发临时数据更新事件
                                    if (typeof window.tempDataHandler !== 'undefined') {
                                        window.tempDataHandler.addTempData(extractedData, 'extracted_from_ai_regenerate');
                                    }
                                    
                                    // 显示提取通知（可选）
                                    if (Object.keys(extractedData).length > 0) {
                                        console.log(`✅ 从重新生成的AI响应中提取并录入了${Object.keys(extractedData).length}个对象的临时数据`);
                                    }
                                } catch (e) {
                                    console.error('解析重新生成中提取的临时数据失败:', e);
                                }
                            }
                            continue;
                        } else {
                            // 更新显示的文本内容
                            response_text += data;
                            // 使用统一的消息管理器更新内容
                            if (window.unifiedMessageBubble) {
                                window.unifiedMessageBubble.updateBubbleContent(bubbleDiv, roleName, response_text, false);
                            } else {
                                // 备用方案
                                const cleanText = response_text.trim();
                                const processedResponseText = window.messageDataCollapseManager ? 
                                    window.messageDataCollapseManager.processMessageContent(cleanText) : cleanText;
                                bubbleDiv.innerHTML = `<strong>${roleName}:</strong> ${processedResponseText}`;
                            }
                        }
                    }
                }
                readStream();
            }).catch(streamError => {
                // 添加流读取错误处理，防止未处理的Promise拒绝
                console.error('流读取错误:', streamError);
                clearTimeout(connectionTimeout);
                clearTimeout(totalTimeout);
                
                // 检查是否是消息通道关闭错误
                if (streamError.message && streamError.message.includes('message channel closed')) {
                    console.warn('🔧 检测到消息通道关闭，正常结束流处理');
                    // 尝试保存当前已接收的内容
                    if (response_text.trim()) {
                        saveMessageEdit(messageDiv, roleName, response_text.trim(), messageIndex, originalHTML);
                        showToast('连接中断，已保存部分内容', 'success');
                    } else {
                        bubbleDiv.innerHTML = originalHTML;
                        showToast('连接中断，内容已恢复', 'warning');
                    }
                } else {
                    // 其他错误，优先保存已生成的内容
                    if (response_text.trim()) {
                        console.log('💾 流错误时保存已生成内容:', response_text.trim());
                        saveMessageEdit(messageDiv, roleName, response_text.trim(), messageIndex, originalHTML);
                        showToast('出现错误，但已保存部分内容', 'warning');
                    } else {
                        bubbleDiv.innerHTML = originalHTML;
                        showToast(`流处理错误: ${streamError.message}`, 'error');
                    }
                }
            });
        }
        readStream();
    })
    .catch(error => {
        // 清除所有超时定时器
        clearTimeout(connectionTimeout);
        clearTimeout(totalTimeout);
        clearTimeout(timeoutId);
        
        console.error(`❌ 重新生成${roleName}回复失败:`, error);
        console.error('❌ 错误详情:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        // 优先保存已生成的内容，而不是恢复原始内容
        if (response_text.trim()) {
            console.log('💾 请求失败时保存已生成内容:', response_text.trim());
            saveMessageEdit(messageDiv, roleName, response_text.trim(), messageIndex, originalHTML);
            
            if (error.name === 'AbortError') {
                showToast('请求超时，但已保存部分内容', 'warning');
            } else {
                showToast('出现错误，但已保存部分内容', 'warning');
            }
        } else {
            // 只有在完全没有内容时才恢复原始内容
            bubbleDiv.innerHTML = originalHTML;
            
            // 详细的错误分析和处理
            let errorMessage = '重新生成失败';
            if (error.name === 'AbortError') {
                errorMessage = '请求超时，请稍后重试';
                console.error('❌ 请求被中止（超时）');
            } else if (error.message.includes('Failed to fetch') || 
                       error.message.includes('ERR_CONNECTION_RESET') ||
                       error.message.includes('CONNECTION_RESET') ||
                       error.message.includes('net::ERR_CONNECTION_RESET')) {
                errorMessage = '网络连接中断，AI服务器可能繁忙，请稍后重试';
                console.error('❌ 网络连接问题: 连接被重置或中断');
            } else if (error.message.includes('ERR_NETWORK') || 
                       error.message.includes('NetworkError')) {
                errorMessage = '网络错误，请检查网络连接';
                console.error('❌ 网络连接错误');
            } else {
                errorMessage = `重新生成失败: ${error.message}`;
            }
            
            showToast(errorMessage, 'error');
        }
    });
}

/**
 * 保存消息编辑
 */
function saveMessageEdit(messageDiv, roleName, newText, messageIndex, originalHTML) {
    if (!newText.trim()) {
        alert('消息内容不能为空');
        return;
    }
    
    // 显示保存中状态
    const bubbleDiv = messageDiv.querySelector('.message-bubble');
    bubbleDiv.innerHTML = '<div class="saving-indicator">正在保存...</div>';
    
    // 构建新的消息内容
    const newContent = `${roleName}: ${newText.trim()}`;
    
    // 发送到服务器保存
    fetch('/edit_message', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            role: document.getElementById('role').value,
            message_index: messageIndex,
            new_content: newContent
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 使用统一的消息管理器更新显示
            if (window.unifiedMessageBubble) {
                window.unifiedMessageBubble.updateBubbleContent(bubbleDiv, roleName, newText.trim(), false);
            } else {
                // 备用方案
                const processedText = window.messageDataCollapseManager ? 
                    window.messageDataCollapseManager.processMessageContent(newText.trim()) : newText.trim();
                bubbleDiv.innerHTML = `<strong>${roleName}:</strong> ${processedText}`;
            }
            
            showToast('消息已保存', 'success');
            
            // 添加编辑标记
            if (!bubbleDiv.querySelector('.edited-mark')) {
                const editedMark = document.createElement('span');
                editedMark.className = 'edited-mark';
                editedMark.innerHTML = ' (已编辑)';
                editedMark.title = '此消息已被编辑';
                bubbleDiv.appendChild(editedMark);
            }
        } else {
            showToast('保存失败: ' + (data.error || '未知错误'), 'error');
            // 恢复原始内容
            bubbleDiv.innerHTML = originalHTML;
        }
    })
    .catch(error => {
        console.error('保存失败:', error);
        showToast('保存失败: ' + error.message, 'error');
        // 恢复原始内容
        bubbleDiv.innerHTML = originalHTML;
    });
}

/**
 * 取消消息编辑
 */
function cancelMessageEdit(messageDiv, originalHTML) {
    const bubbleDiv = messageDiv.querySelector('.message-bubble');
    bubbleDiv.innerHTML = originalHTML;
}

/**
 * 重新播放消息语音
 */
function replayMessageAudio(text, role, messageDiv = null) {
    // 获取完整的消息文本
    const fullText = messageDiv ? messageDiv.getAttribute('data-full-text') || text : text;
    
    // 检查是否存在对应的音频文件（通过消息的data-audio-files属性）
    const existingAudioFiles = messageDiv ? messageDiv.getAttribute('data-audio-files') : null;
    
    if (existingAudioFiles) {
        // 如果存在音频文件，直接播放
        try {
            const audioUrls = JSON.parse(existingAudioFiles);
            if (audioUrls.length > 0) {
                playAudioSequentially(audioUrls);
                showToast('播放已有语音', 'success');
                return;
            }
        } catch (e) {
            console.warn('解析已有音频文件失败:', e);
        }
    }
    
    // 如果没有已有音频或解析失败，生成新的语音
    showToast('正在生成语音...', 'info');

    fetch('/generate_voice', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: fullText,
            role: role
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.audio_urls && data.audio_urls.length > 0) {
            // 依次播放所有音频文件
            playAudioSequentially(data.audio_urls);
            
            // 将音频文件信息保存到消息元素中，供下次使用
            if (messageDiv) {
                messageDiv.setAttribute('data-audio-files', JSON.stringify(data.audio_urls));
            }
            
            showToast('语音播放开始', 'success');
        } else {
            console.error('语音重新生成失败:', data.message);
            showToast('语音生成失败: ' + (data.message || '未知错误'), 'error');
        }
    })
    .catch(error => {
        console.error('语音重新生成失败:', error);
        showToast('语音生成失败: ' + error.message, 'error');
    });
}

/**
 * 切换消息按钮的显示状态
 */
function toggleMessageButtons(bubble) {
    const editBtn = bubble.querySelector('.edit-message-btn');
    const refreshBtn = bubble.querySelector('.refresh-message-btn');
    
    if (editBtn || refreshBtn) {
        // 检查当前按钮状态
        const isVisible = editBtn && editBtn.style.opacity !== '0' && editBtn.style.opacity !== '';
        
        // 先隐藏所有其他消息的按钮
        document.querySelectorAll('.message-bubble').forEach(otherBubble => {
            if (otherBubble !== bubble) {
                hideMessageButtons(otherBubble);
            }
        });
        
        // 切换当前消息的按钮状态
        if (isVisible) {
            hideMessageButtons(bubble);
        } else {
            showMessageButtons(bubble);
        }
    }
}

/**
 * 显示消息按钮
 */
function showMessageButtons(bubble) {
    const editBtn = bubble.querySelector('.edit-message-btn');
    const refreshBtn = bubble.querySelector('.refresh-message-btn');
    
    if (editBtn) {
        editBtn.style.opacity = '0.8';
        editBtn.style.transform = 'scale(1)';
        editBtn.style.pointerEvents = 'auto';
    }
    
    if (refreshBtn) {
        refreshBtn.style.opacity = '0.8';
        refreshBtn.style.transform = 'scale(1)';
        refreshBtn.style.pointerEvents = 'auto';
    }
}

/**
 * 隐藏消息按钮
 */
function hideMessageButtons(bubble) {
    const editBtn = bubble.querySelector('.edit-message-btn');
    const refreshBtn = bubble.querySelector('.refresh-message-btn');
    
    if (editBtn) {
        editBtn.style.opacity = '0';
        editBtn.style.transform = 'scale(0.8)';
        editBtn.style.pointerEvents = 'none';
    }
    
    if (refreshBtn) {
        refreshBtn.style.opacity = '0';
        refreshBtn.style.transform = 'scale(0.8)';
        refreshBtn.style.pointerEvents = 'none';
    }
}

// 模块导出（如果需要的话）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setupMessageBubbleInteraction,
        editMessage,
        refreshAIMessage,
        replayMessageAudio,
        showAIMessageActionMenu,
        closeAIMessageActionMenu,
        triggerAIAnalysisFromMenu,
        triggerAIAnalysisToStorybook,
        getChatHistoryForAnalysis
    };
}

/**
 * 调试方法：测试消息格式解析
 */
function debugMessageParsing() {
    console.log('=== 消息格式解析调试 ===');
    
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) {
        console.error('未找到聊天消息容器');
        return;
    }
    
    const messageBubbles = chatMessages.querySelectorAll('.message-bubble');
    console.log(`找到 ${messageBubbles.length} 个消息气泡`);
    
    messageBubbles.forEach((bubble, index) => {
        console.log(`\n--- 消息 ${index + 1} ---`);
        console.log('HTML内容:', bubble.innerHTML);
        console.log('文本内容:', bubble.textContent);
        
        const messageDiv = bubble.closest('.message');
        console.log('消息容器类名:', messageDiv ? Array.from(messageDiv.classList) : '无');
        
        // 检查头像信息
        const avatarImg = messageDiv ? messageDiv.querySelector('img.avatar') : null;
        const avatarFallback = messageDiv ? messageDiv.querySelector('.avatar-fallback') : null;
        console.log('头像信息:', {
            img: avatarImg ? avatarImg.alt : '无',
            fallback: avatarFallback ? avatarFallback.textContent : '无'
        });
        
        // 测试解析逻辑
        let roleName = '';
        let messageText = '';
        
        // HTML格式解析
        const strongElement = bubble.querySelector('strong');
        if (strongElement) {
            const strongText = strongElement.textContent || strongElement.innerText;
            if (strongText.endsWith(':')) {
                roleName = strongText.slice(0, -1);
                
                const bubbleClone = bubble.cloneNode(true);
                const strongClone = bubbleClone.querySelector('strong');
                if (strongClone) {
                    strongClone.remove();
                    messageText = (bubbleClone.textContent || bubbleClone.innerText).trim();
                }
                console.log('HTML解析结果:', { roleName, messageText: messageText.substring(0, 30) + '...' });
            }
        }
        
        // 纯文本解析（备用）
        if (!roleName || !messageText) {
            const bubbleText = bubble.textContent || bubble.innerText;
            const colonIndex = bubbleText.indexOf(': ');
            
            if (colonIndex !== -1) {
                roleName = bubbleText.substring(0, colonIndex);
                messageText = bubbleText.substring(colonIndex + 2);
                console.log('文本解析结果:', { roleName, messageText: messageText.substring(0, 30) + '...' });
            } else {
                console.log('解析失败: 无法找到冒号分隔符，尝试备用方案...');
                
                // 尝试从头像获取角色名
                if (avatarImg) {
                    const altText = avatarImg.alt || '';
                    const avatarMatch = altText.match(/(.+)头像/);
                    if (avatarMatch) {
                        roleName = avatarMatch[1];
                        messageText = bubbleText;
                        console.log('从头像解析结果:', { roleName, messageText: messageText.substring(0, 30) + '...' });
                    }
                }
                
                if (!roleName && messageDiv) {
                    if (messageDiv.classList.contains('user-message')) {
                        roleName = window.currentPlayerData?.名字 || '当前玩家';
                    } else if (messageDiv.classList.contains('ai-message')) {
                        roleName = 'AI';
                    } else {
                        roleName = '未知';
                    }
                    messageText = bubbleText;
                    console.log('从消息类型解析结果:', { roleName, messageText: messageText.substring(0, 30) + '...' });
                }
            }
        }
        
        console.log('最终解析结果:', { roleName, messageText: messageText ? messageText.substring(0, 50) + '...' : '无' });
    });
    
    console.log('=== 调试结束 ===');
}

// 将调试方法添加到全局作用域
window.debugMessageParsing = debugMessageParsing;

/**
 * 测试双击功能的方法
 */
function testDoubleClickOnLastMessage() {
    console.log('=== 测试最后一条消息的双击功能 ===');
    
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) {
        console.error('未找到聊天消息容器');
        return;
    }
    
    const messageBubbles = chatMessages.querySelectorAll('.message-bubble');
    if (messageBubbles.length === 0) {
        console.error('没有找到任何消息气泡');
        return;
    }
    
    const lastBubble = messageBubbles[messageBubbles.length - 1];
    console.log('找到最后一条消息:', lastBubble);
    
    // 模拟双击事件
    console.log('模拟双击事件...');
    handleMessageDoubleClick(lastBubble);
}

window.testDoubleClickOnLastMessage = testDoubleClickOnLastMessage;

/**
 * 触发AI智能分析到数据书
 * @param {string} roleName - 角色名称
 * @param {string} messageText - 触发的消息文本
 * @param {number} messageIndex - 消息索引
 */
async function triggerAIAnalysisToStorybook(roleName, messageText, messageIndex) {
    try {
        console.log('🧠 [AI分析] 开始AI智能分析到数据书');
        console.log('🧠 [AI分析] 角色:', roleName);
        console.log('🧠 [AI分析] 消息索引:', messageIndex);
        console.log('🧠 [AI分析] 消息内容:', messageText);
        
        // 获取当前聊天记录
        const chatHistory = await getChatHistoryForAnalysis(roleName);
        
        if (!chatHistory || chatHistory.length === 0) {
            showToast('未找到聊天记录，无法进行分析', 'warning');
            return;
        }
        
        console.log(`🧠 [AI分析] 获取到 ${chatHistory.length} 条聊天记录`);
        
        // 显示分析进度
        showToast(`正在分析 ${chatHistory.length} 条聊天记录...`, 'info');
        
        // 调用AI智能分析API
        const response = await fetch('/api/ai_analyze_chat_history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                role_name: roleName,
                chat_history: chatHistory,
                analyze_all: false,
                trigger_message: messageText,
                trigger_index: messageIndex
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ [AI分析] AI智能分析完成');
            console.log('✅ [AI分析] 分析结果:', result);
            
            // 显示成功消息
            const message = result.message || 'AI智能分析完成';
            const updatedCount = result.data?.executed_count || 0;
            
            if (updatedCount > 0) {
                showToast(`${message} - 更新了 ${updatedCount} 个数据项`, 'success');
            } else {
                showToast(message, 'success');
            }
            
            // 如果有更新的数据，可以选择性地刷新相关界面
            if (result.updated && result.data) {
                console.log('📊 [AI分析] 数据已更新:', result.data);
                // 这里可以添加界面刷新逻辑，比如更新数据书显示等
            }
            
        } else {
            console.error('❌ [AI分析] AI智能分析失败:', result.error);
            showToast(`AI分析失败: ${result.error}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ [AI分析] 触发AI智能分析时出错:', error);
        showToast(`AI分析出错: ${error.message}`, 'error');
    }
}

/**
 * 获取用于AI分析的聊天记录
 * @param {string} roleName - 角色名称
 * @returns {Promise<Array>} 聊天记录数组
 */
async function getChatHistoryForAnalysis(roleName) {
    try {
        console.log('📚 [AI分析] 获取聊天记录:', roleName);
        
        // 调用获取聊天记录的API
        const response = await fetch(`/history/${encodeURIComponent(roleName)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`获取聊天记录失败: ${response.status}`);
        }
        
        const history = await response.json();
        
        // /history/<role> 路由直接返回历史记录数组
        if (Array.isArray(history)) {
            return history;
        } else {
            console.error('❌ [AI分析] 获取聊天记录失败: 返回数据格式不正确');
            return [];
        }
        
    } catch (error) {
        console.error('❌ [AI分析] 获取聊天记录时出错:', error);
        return [];
    }
}







