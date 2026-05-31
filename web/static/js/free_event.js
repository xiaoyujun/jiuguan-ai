/**
 * 自由事件 - JavaScript逻辑
 */

// 全局状态
let allRoles = [];
let allPlayers = [];
let selectedRoles = [];
let speakProbabilities = {};
let eventData = {
    event_name: '',
    event_description: '',
    participants: [],
    history: []
};
let isProcessing = false;
let isPaused = false;
let currentParticipantTab = 'roles'; // 'roles' 或 'players'
let topicTemplates = []; // 话题模板
let currentAudioPlayer = null; // 当前音频播放器

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadRoles();
    loadPlayers();
    setupEventListeners();
    loadTopicTemplates();
});

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    // 角色搜索
    const roleSearch = document.getElementById('roleSearch');
    if (roleSearch) {
        roleSearch.addEventListener('input', function(e) {
            filterRoles(e.target.value);
        });
    }
}

/**
 * 加载所有可用角色
 */
async function loadRoles() {
    try {
        const response = await fetch('/api/event/roles');
        const data = await response.json();
        
        if (data.success) {
            allRoles = data.roles.map(role => ({...role, type: 'role'}));
            displayRoles(allRoles);
        } else {
            showStatus('加载角色失败: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('加载角色失败:', error);
        showStatus('加载角色失败: ' + error.message, 'error');
    }
}

/**
 * 加载所有可用玩家
 */
async function loadPlayers() {
    try {
        const response = await fetch('/api/event/players');
        const data = await response.json();
        
        if (data.success) {
            allPlayers = data.players.map(player => ({...player, type: 'player'}));
            displayPlayers(allPlayers);
        } else {
            showStatus('加载玩家失败: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('加载玩家失败:', error);
        showStatus('加载玩家失败: ' + error.message, 'error');
    }
}

/**
 * 切换参与者标签
 */
function switchParticipantTab(tab) {
    currentParticipantTab = tab;
    
    // 更新标签样式
    document.getElementById('rolesTab').classList.toggle('active', tab === 'roles');
    document.getElementById('playersTab').classList.toggle('active', tab === 'players');
    
    // 切换列表显示
    document.getElementById('roleList').style.display = tab === 'roles' ? 'grid' : 'none';
    document.getElementById('playerList').style.display = tab === 'players' ? 'grid' : 'none';
    
    // 清空搜索框
    document.getElementById('roleSearch').value = '';
}

/**
 * 显示角色列表
 */
function displayRoles(roles) {
    const roleList = document.getElementById('roleList');
    if (!roleList) return;
    
    roleList.innerHTML = '';
    
    roles.forEach(role => {
        const roleItem = document.createElement('div');
        roleItem.className = 'role-item';
        roleItem.dataset.roleName = role.name;
        roleItem.dataset.roleType = role.type;
        
        // 检查是否已选择
        if (selectedRoles.some(r => r.name === role.name && r.type === role.type)) {
            roleItem.classList.add('selected');
        }
        
        // 角色头像
        const avatar = document.createElement('img');
        avatar.className = 'role-avatar';
        avatar.src = role.avatar || `/avatar/${role.name}`;
        avatar.alt = role.name;
        avatar.onerror = function() {
            this.src = '/static/images/default-avatar.svg';
            this.style.borderColor = 'var(--copper-color)';
        };
        
        // 角色名称
        const name = document.createElement('span');
        name.className = 'role-name';
        name.textContent = role.name;
        
        roleItem.appendChild(avatar);
        roleItem.appendChild(name);
        
        // 点击事件
        roleItem.addEventListener('click', () => toggleRole(role));
        
        roleList.appendChild(roleItem);
    });
}

/**
 * 显示玩家列表
 */
function displayPlayers(players) {
    const playerList = document.getElementById('playerList');
    if (!playerList) return;
    
    playerList.innerHTML = '';
    
    players.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'role-item';
        playerItem.dataset.roleName = player.name;
        playerItem.dataset.roleType = player.type;
        
        // 检查是否已选择
        if (selectedRoles.some(r => r.name === player.name && r.type === player.type)) {
            playerItem.classList.add('selected');
        }
        
        // 玩家头像
        const avatar = document.createElement('img');
        avatar.className = 'role-avatar';
        avatar.src = player.avatar || `/avatar/${player.name}`;
        avatar.alt = player.name;
        avatar.onerror = function() {
            this.src = '/static/images/default-avatar.svg';
            this.style.borderColor = 'var(--copper-color)';
        };
        
        // 玩家名称
        const name = document.createElement('span');
        name.className = 'role-name';
        name.textContent = player.name;
        
        playerItem.appendChild(avatar);
        playerItem.appendChild(name);
        
        // 点击事件
        playerItem.addEventListener('click', () => toggleRole(player));
        
        playerList.appendChild(playerItem);
    });
}

/**
 * 过滤角色/玩家
 */
function filterRoles(searchText) {
    if (currentParticipantTab === 'roles') {
        const filtered = allRoles.filter(role => 
            role.name.toLowerCase().includes(searchText.toLowerCase())
        );
        displayRoles(filtered);
    } else {
        const filtered = allPlayers.filter(player => 
            player.name.toLowerCase().includes(searchText.toLowerCase())
        );
        displayPlayers(filtered);
    }
}

/**
 * 切换角色/玩家选择状态
 */
function toggleRole(participant) {
    const index = selectedRoles.findIndex(r => r.name === participant.name && r.type === participant.type);
    
    if (index !== -1) {
        // 取消选择
        selectedRoles.splice(index, 1);
        delete speakProbabilities[participant.name];
    } else {
        // 选择
        selectedRoles.push(participant);
        speakProbabilities[participant.name] = 0; // 默认按顺序
    }
    
    updateSelectedRoles();
    
    // 刷新当前显示的列表
    if (currentParticipantTab === 'roles') {
        displayRoles(allRoles.filter(r => 
            r.name.toLowerCase().includes(document.getElementById('roleSearch').value.toLowerCase())
        ));
    } else {
        displayPlayers(allPlayers.filter(p => 
            p.name.toLowerCase().includes(document.getElementById('roleSearch').value.toLowerCase())
        ));
    }
}

/**
 * 更新已选择参与者显示
 */
function updateSelectedRoles() {
    const container = document.getElementById('selectedRolesContainer');
    const count = document.getElementById('selectedCount');
    
    if (!container || !count) return;
    
    count.textContent = selectedRoles.length;
    container.innerHTML = '';
    
    selectedRoles.forEach(participant => {
        const tag = document.createElement('div');
        tag.className = 'selected-role-tag';
        
        // 添加类型标识
        if (participant.type === 'player') {
            tag.style.background = 'linear-gradient(135deg, #2e7d32 0%, #388e3c 100%)';
        }
        
        // 头像
        const avatar = document.createElement('img');
        avatar.className = 'selected-role-avatar';
        avatar.src = participant.avatar || `/avatar/${participant.name}`;
        avatar.alt = participant.name;
        avatar.onerror = function() {
            this.src = '/static/images/default-avatar.svg';
        };
        
        // 名称（玩家添加标识）
        const name = document.createElement('span');
        name.textContent = participant.type === 'player' ? `👤 ${participant.name}` : participant.name;
        
        // 删除按钮
        const removeBtn = document.createElement('span');
        removeBtn.className = 'remove-role';
        removeBtn.textContent = '×';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            toggleRole(participant);
        };
        
        tag.appendChild(avatar);
        tag.appendChild(name);
        tag.appendChild(removeBtn);
        
        container.appendChild(tag);
    });
}

/**
 * 开始事件
 */
async function startEvent() {
    const eventName = document.getElementById('eventName').value.trim();
    const eventDescription = document.getElementById('eventDescription').value.trim();
    
    if (!eventName) {
        showStatus('请输入事件名称', 'error');
        return;
    }
    
    if (selectedRoles.length < 2) {
        showStatus('请至少选择两个角色', 'error');
        return;
    }
    
    // 更新事件数据
    eventData.event_name = eventName;
    eventData.event_description = eventDescription;
    eventData.participants = selectedRoles.map(r => r.name);
    eventData.history = [];
    
    // 切换到对话界面
    document.getElementById('eventConfig').style.display = 'none';
    document.getElementById('eventChat').style.display = 'block';
    document.getElementById('chatEventName').textContent = eventName;
    
    // 初始化概率控制
    initializeProbabilityControls();
    
    showStatus('事件已开始，点击"继续对话"开始角色对话', 'success');
}

/**
 * 返回配置
 */
function backToConfig() {
    document.getElementById('eventChat').style.display = 'none';
    document.getElementById('eventConfig').style.display = 'block';
}

/**
 * 初始化概率控制
 */
function initializeProbabilityControls() {
    const container = document.getElementById('probabilityControls');
    if (!container) return;
    
    container.innerHTML = '';
    
    selectedRoles.forEach(role => {
        const control = document.createElement('div');
        control.className = 'probability-control';
        
        const label = document.createElement('label');
        label.textContent = role.name;
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '10';
        slider.value = speakProbabilities[role.name] || '0';
        slider.addEventListener('input', function() {
            speakProbabilities[role.name] = parseInt(this.value);
            valueSpan.textContent = this.value;
        });
        
        const valueSpan = document.createElement('span');
        valueSpan.className = 'probability-value';
        valueSpan.textContent = slider.value;
        
        control.appendChild(label);
        control.appendChild(slider);
        control.appendChild(valueSpan);
        
        container.appendChild(control);
    });
}

/**
 * 切换概率面板
 */
function toggleProbabilityPanel() {
    const panel = document.getElementById('probabilityPanel');
    if (!panel) return;
    
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
    } else {
        panel.style.display = 'none';
    }
}

/**
 * 显示对话设置模态框
 */
function showDialogSettings() {
    document.getElementById('dialogSettingsModal').style.display = 'flex';
    // 重置为默认值
    document.getElementById('dialogCount').value = 1;
    document.getElementById('dialogTopic').value = '';
}

/**
 * 关闭对话设置模态框
 */
function closeDialogSettings() {
    document.getElementById('dialogSettingsModal').style.display = 'none';
}

/**
 * 暂停/继续对话生成
 */
function togglePause() {
    isPaused = !isPaused;
    const pauseBtn = document.getElementById('pauseBtn');
    
    if (isPaused) {
        pauseBtn.textContent = '▶️ 继续';
        pauseBtn.classList.add('paused');
        showStatus('已暂停，点击继续按钮恢复生成', 'info');
    } else {
        pauseBtn.textContent = '⏸️ 暂停';
        pauseBtn.classList.remove('paused');
        showStatus('继续生成对话...', 'info');
    }
}

/**
 * 开始继续对话（带设置）
 */
async function startContinueDialog() {
    const count = parseInt(document.getElementById('dialogCount').value) || 1;
    const topic = document.getElementById('dialogTopic').value.trim();
    
    // 验证条数
    if (count < 1 || count > 20) {
        showStatus('对话条数必须在1-20之间', 'error');
        return;
    }
    
    // 关闭模态框
    closeDialogSettings();
    
    // 重置暂停状态
    isPaused = false;
    const pauseBtn = document.getElementById('pauseBtn');
    pauseBtn.style.display = count > 1 ? 'inline-block' : 'none';
    pauseBtn.textContent = '⏸️ 暂停';
    pauseBtn.classList.remove('paused');
    
    // 如果有主题，显示提示
    if (topic) {
        showStatus(`开始生成 ${count} 条对话，主题：${topic}`, 'info');
    } else {
        showStatus(`开始生成 ${count} 条对话`, 'info');
    }
    
    // 连续生成多条对话
    for (let i = 0; i < count; i++) {
        // 检查暂停状态
        while (isPaused) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (isProcessing) break; // 如果正在处理，跳出循环
        
        await continueDialog(topic);
        
        // 如果不是最后一条，等待一小段时间
        if (i < count - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    // 隐藏暂停按钮
    pauseBtn.style.display = 'none';
    showStatus(`完成生成 ${count} 条对话`, 'success');
}

/**
 * 继续对话（单条）
 */
async function continueDialog(topic = '') {
    if (isProcessing) return;
    
    isProcessing = true;
    const continueBtn = document.getElementById('continueBtn');
    const originalText = continueBtn.textContent;
    continueBtn.textContent = '生成中...';
    continueBtn.disabled = true;
    
    try {
        // 构建请求数据
        const requestData = {
            event_name: eventData.event_name,
            event_description: eventData.event_description,
            participants: eventData.participants,
            history: eventData.history,
            speak_probabilities: speakProbabilities
        };
        
        // 如果有主题，添加到请求中
        if (topic) {
            requestData.current_topic = topic;
        }
        
        const response = await fetch('/api/event/continue', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 添加到历史记录
            eventData.history.push(data.message);
            
            // 显示消息
            displayMessage(data.message);
            
            showStatus(`已生成 ${data.message.role} 的回复`, 'success');
        } else {
            showStatus('生成失败: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('继续对话失败:', error);
        showStatus('继续对话失败: ' + error.message, 'error');
    } finally {
        isProcessing = false;
        continueBtn.textContent = originalText;
        continueBtn.disabled = false;
    }
}

/**
 * 显示消息
 */
function displayMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'event-message';
    
    // 获取角色信息
    const role = selectedRoles.find(r => r.name === message.role);
    
    // 头像
    const avatar = document.createElement('img');
    avatar.className = 'message-avatar';
    avatar.src = role?.avatar || `/avatar/${message.role}`;
    avatar.alt = message.role;
    avatar.title = message.role;
    avatar.onerror = function() {
        this.src = '/static/images/default-avatar.svg';
        this.style.borderColor = 'var(--copper-color)';
    };
    
    // 内容
    const content = document.createElement('div');
    content.className = 'message-content';
    
    const roleName = document.createElement('div');
    roleName.className = 'message-role';
    roleName.textContent = message.role;
    
    const text = document.createElement('div');
    text.className = 'message-text';
    text.textContent = message.message;
    
    // 添加语音播放按钮
    const voiceBtn = document.createElement('button');
    voiceBtn.className = 'voice-play-btn';
    voiceBtn.innerHTML = '🔊';
    voiceBtn.title = '播放语音';
    voiceBtn.onclick = () => playMessageVoice(message.message, message.role);
    
    content.appendChild(roleName);
    content.appendChild(text);
    content.appendChild(voiceBtn);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    
    chatMessages.appendChild(messageDiv);
    
    // 移除自动滚动 - 让用户自己控制滚动位置
}

/**
 * 保存事件
 */
async function saveEvent() {
    if (!eventData.event_name) {
        showStatus('请先开始事件', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/event/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event_name: eventData.event_name,
                event_data: eventData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showStatus('事件已保存', 'success');
        } else {
            showStatus('保存失败: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('保存事件失败:', error);
        showStatus('保存事件失败: ' + error.message, 'error');
    }
}

/**
 * 打开加载事件模态框
 */
async function loadEventModal() {
    try {
        const response = await fetch('/api/event/list');
        const data = await response.json();
        
        if (data.success) {
            displayEventsList(data.events);
            document.getElementById('loadEventModal').style.display = 'flex';
        } else {
            showStatus('加载事件列表失败: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('加载事件列表失败:', error);
        showStatus('加载事件列表失败: ' + error.message, 'error');
    }
}

/**
 * 显示事件列表
 */
function displayEventsList(events) {
    const eventsList = document.getElementById('eventsList');
    if (!eventsList) return;
    
    eventsList.innerHTML = '';
    
    if (events.length === 0) {
        eventsList.innerHTML = '<p style="text-align: center; color: #999;">暂无保存的事件</p>';
        return;
    }
    
    events.forEach(eventName => {
        const item = document.createElement('div');
        item.className = 'event-list-item';
        item.textContent = eventName;
        item.onclick = () => loadEventByName(eventName);
        eventsList.appendChild(item);
    });
}

/**
 * 加载指定事件
 */
async function loadEventByName(eventName) {
    try {
        const response = await fetch(`/api/event/load?name=${encodeURIComponent(eventName)}`);
        const data = await response.json();
        
        if (data.success) {
            eventData = data.event_data;
            
            // 更新界面
            document.getElementById('eventName').value = eventData.event_name;
            document.getElementById('eventDescription').value = eventData.event_description;
            
            // 更新选中的角色
            selectedRoles = allRoles.filter(r => eventData.participants.includes(r.name));
            updateSelectedRoles();
            displayRoles(allRoles);
            
            // 如果有历史记录，直接进入对话界面
            if (eventData.history && eventData.history.length > 0) {
                document.getElementById('eventConfig').style.display = 'none';
                document.getElementById('eventChat').style.display = 'block';
                document.getElementById('chatEventName').textContent = eventData.event_name;
                
                // 显示历史消息
                document.getElementById('chatMessages').innerHTML = '';
                eventData.history.forEach(msg => displayMessage(msg));
                
                initializeProbabilityControls();
            }
            
            closeLoadEventModal();
            showStatus('事件已加载', 'success');
        } else {
            showStatus('加载事件失败: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('加载事件失败:', error);
        showStatus('加载事件失败: ' + error.message, 'error');
    }
}

/**
 * 关闭加载事件模态框
 */
function closeLoadEventModal() {
    document.getElementById('loadEventModal').style.display = 'none';
}

/**
 * 总结事件到数据书
 */
function summarizeEvent() {
    if (!eventData.history || eventData.history.length === 0) {
        showStatus('暂无对话记录可以总结', 'error');
        return;
    }
    
    // 构建事件数据
    const summaryData = {
        event_name: eventData.event_name,
        event_description: eventData.event_description,
        participants: eventData.participants,
        storybooks: eventData.participants, // 参与者对应的数据书
        history: eventData.history
    };
    
    // 跳转到总结页面
    const eventDataJson = encodeURIComponent(JSON.stringify(summaryData));
    window.open(`/summary?role=${eventData.participants[0]}&event_data=${eventDataJson}`, '_blank');
}

/**
 * 减负事件记录
 */
async function reduceEventLoad() {
    if (!eventData.history || eventData.history.length < 10) {
        showStatus('记录太少，无需减负', 'error');
        return;
    }
    
    if (!confirm('确定要减负事件记录吗？这将保留最近20条记录，其余将被总结。')) {
        return;
    }
    
    try {
        // 保留最近20条
        const recentHistory = eventData.history.slice(-20);
        const removedHistory = eventData.history.slice(0, -20);
        
        eventData.history = recentHistory;
        
        // 刷新显示
        document.getElementById('chatMessages').innerHTML = '';
        recentHistory.forEach(msg => displayMessage(msg));
        
        showStatus(`已减负 ${removedHistory.length} 条记录，保留最近 ${recentHistory.length} 条`, 'success');
    } catch (error) {
        console.error('减负失败:', error);
        showStatus('减负失败: ' + error.message, 'error');
    }
}

/**
 * 显示状态消息
 */
function showStatus(message, type = 'info') {
    const statusText = document.getElementById('statusText');
    if (!statusText) {
        alert(message);
        return;
    }
    
    statusText.textContent = message;
    statusText.style.color = type === 'error' ? '#ff6b6b' : 
                             type === 'success' ? '#51cf66' : '#999';
    
    // 3秒后清空
    setTimeout(() => {
        statusText.textContent = '';
    }, 3000);
}

/**
 * 播放消息语音
 */
async function playMessageVoice(text, role) {
    try {
        showStatus('正在生成语音...', 'info');
        
        const response = await fetch('/generate_voice', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                role: role
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.audio_urls && data.audio_urls.length > 0) {
            // 依次播放所有音频文件
            playAudioSequentially(data.audio_urls);
            showStatus('语音播放开始', 'success');
        } else {
            showStatus('语音生成失败: ' + (data.message || '未知错误'), 'error');
        }
    } catch (error) {
        console.error('语音生成失败:', error);
        showStatus('语音生成失败: ' + error.message, 'error');
    }
}

/**
 * 依次播放音频文件
 */
function playAudioSequentially(audioUrls) {
    if (!audioUrls || audioUrls.length === 0) return;
    
    let currentIndex = 0;
    
    function playNext() {
        if (currentIndex >= audioUrls.length) {
            currentAudioPlayer = null;
            return;
        }
        
        const audio = new Audio(audioUrls[currentIndex]);
        currentAudioPlayer = audio;
        
        audio.onended = () => {
            currentIndex++;
            playNext();
        };
        
        audio.onerror = (e) => {
            console.error(`音频播放失败: ${audioUrls[currentIndex]}`, e);
            currentIndex++;
            playNext();
        };
        
        audio.play().catch(error => {
            console.error('播放音频时出错:', error);
            currentIndex++;
            playNext();
        });
    }
    
    playNext();
}

/**
 * 加载话题模板
 */
function loadTopicTemplates() {
    try {
        const saved = localStorage.getItem('topicTemplates');
        if (saved) {
            topicTemplates = JSON.parse(saved);
        } else {
            // 默认模板
            topicTemplates = [
                { name: '日常对话', content: '轻松的日常聊天，讨论生活中的小事' },
                { name: '冒险探索', content: '在未知的地方探险，寻找宝藏或线索' },
                { name: '战斗场景', content: '紧张刺激的战斗，与敌人对抗' },
                { name: '情感交流', content: '深入的情感对话，分享内心的想法' }
            ];
            saveTopicTemplatesToStorage();
        }
    } catch (error) {
        console.error('加载话题模板失败:', error);
        topicTemplates = [];
    }
}

/**
 * 保存话题模板到本地存储
 */
function saveTopicTemplatesToStorage() {
    try {
        localStorage.setItem('topicTemplates', JSON.stringify(topicTemplates));
    } catch (error) {
        console.error('保存话题模板失败:', error);
    }
}

/**
 * 打开话题模板模态框
 */
function openTopicTemplateModal() {
    document.getElementById('topicTemplateModal').style.display = 'flex';
    displayTopicTemplates();
}

/**
 * 关闭话题模板模态框
 */
function closeTopicTemplateModal() {
    document.getElementById('topicTemplateModal').style.display = 'none';
    // 清空输入框
    document.getElementById('templateName').value = '';
    document.getElementById('templateContent').value = '';
}

/**
 * 显示话题模板列表
 */
function displayTopicTemplates() {
    const templatesList = document.getElementById('templatesList');
    if (!templatesList) return;
    
    templatesList.innerHTML = '';
    
    if (topicTemplates.length === 0) {
        templatesList.innerHTML = '<p style="text-align: center; color: #999;">暂无保存的模板</p>';
        return;
    }
    
    topicTemplates.forEach((template, index) => {
        const item = document.createElement('div');
        item.className = 'template-item';
        
        const info = document.createElement('div');
        info.className = 'template-info';
        
        const name = document.createElement('div');
        name.className = 'template-name';
        name.textContent = template.name;
        
        const content = document.createElement('div');
        content.className = 'template-content';
        content.textContent = template.content;
        
        info.appendChild(name);
        info.appendChild(content);
        
        const actions = document.createElement('div');
        actions.className = 'template-actions';
        
        const useBtn = document.createElement('button');
        useBtn.className = 'btn-secondary btn-sm';
        useBtn.textContent = '使用';
        useBtn.onclick = () => useTopicTemplate(template);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-secondary btn-sm';
        deleteBtn.textContent = '删除';
        deleteBtn.style.background = 'linear-gradient(135deg, #c62828 0%, #b71c1c 100%)';
        deleteBtn.onclick = () => deleteTopicTemplate(index);
        
        actions.appendChild(useBtn);
        actions.appendChild(deleteBtn);
        
        item.appendChild(info);
        item.appendChild(actions);
        
        templatesList.appendChild(item);
    });
}

/**
 * 保存话题模板
 */
function saveTopicTemplate() {
    const name = document.getElementById('templateName').value.trim();
    const content = document.getElementById('templateContent').value.trim();
    
    if (!name) {
        showStatus('请输入模板名称', 'error');
        return;
    }
    
    if (!content) {
        showStatus('请输入话题内容', 'error');
        return;
    }
    
    topicTemplates.push({ name, content });
    saveTopicTemplatesToStorage();
    
    // 清空输入框
    document.getElementById('templateName').value = '';
    document.getElementById('templateContent').value = '';
    
    // 刷新列表
    displayTopicTemplates();
    
    showStatus('模板已保存', 'success');
}

/**
 * 使用话题模板
 */
function useTopicTemplate(template) {
    document.getElementById('dialogTopic').value = template.content;
    closeTopicTemplateModal();
    showDialogSettings();
    showStatus(`已应用模板：${template.name}`, 'success');
}

/**
 * 删除话题模板
 */
function deleteTopicTemplate(index) {
    if (!confirm('确定要删除这个模板吗？')) {
        return;
    }
    
    topicTemplates.splice(index, 1);
    saveTopicTemplatesToStorage();
    displayTopicTemplates();
    showStatus('模板已删除', 'success');
}

