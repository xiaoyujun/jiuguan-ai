/**
 * 炼金时钟插件 - 前端脚本
 * 神秘学主题的番茄钟计时器
 */

class AlchemyTimer {
    constructor() {
        this.duration = 25; // 默认25分钟
        this.breakDuration = 5; // 休息5分钟
        this.remainingTime = this.duration * 60; // 秒
        this.isRunning = false;
        this.isPaused = false;
        this.isBreak = false;
        this.timer = null;
        this.windowId = null;
        this.currentRole = null;
        this.completedCount = 0;
        this.enableCharacterMessage = true;
        this.customMessage = '';
        
        // 从localStorage加载设置
        this.loadSettings();
    }
    
    /**
     * 从localStorage加载设置
     */
    loadSettings() {
        try {
            const settings = localStorage.getItem('pomodoro_settings');
            if (settings) {
                const data = JSON.parse(settings);
                this.duration = data.duration || 25;
                this.breakDuration = data.breakDuration || 5;
                this.enableCharacterMessage = data.enableCharacterMessage !== false;
                this.customMessage = data.customMessage || '';
                this.completedCount = data.completedCount || 0;
            }
        } catch (e) {
            console.error('加载设置失败:', e);
        }
    }
    
    /**
     * 保存设置到localStorage
     */
    saveSettings() {
        try {
            const settings = {
                duration: this.duration,
                breakDuration: this.breakDuration,
                enableCharacterMessage: this.enableCharacterMessage,
                customMessage: this.customMessage,
                completedCount: this.completedCount
            };
            localStorage.setItem('pomodoro_settings', JSON.stringify(settings));
        } catch (e) {
            console.error('保存设置失败:', e);
        }
    }
    
    /**
     * 格式化时间显示
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * 更新显示
     */
    updateDisplay() {
        const timeDisplay = document.getElementById('pomodoro-time-display');
        const statusDisplay = document.getElementById('pomodoro-status');
        const progressRing = document.getElementById('pomodoro-progress-ring');
        
        if (timeDisplay) {
            timeDisplay.textContent = this.formatTime(this.remainingTime);
        }
        
        if (statusDisplay) {
            const phase = this.isBreak ? '休憩冥想' : '专注炼金';
            const state = this.isPaused ? '暂停' : (this.isRunning ? '进行中' : '待机');
            statusDisplay.textContent = `${phase} · ${state}`;
        }
        
        // 更新进度环
        if (progressRing) {
            const totalSeconds = this.isBreak ? this.breakDuration * 60 : this.duration * 60;
            const progress = ((totalSeconds - this.remainingTime) / totalSeconds) * 283; // 283 是环的周长
            progressRing.style.strokeDashoffset = 283 - progress;
        }
        
        // 更新页面标题
        if (this.isRunning && !this.isPaused) {
            document.title = `⏳ ${this.formatTime(this.remainingTime)} - 炼金时钟`;
        } else {
            document.title = document.title.replace(/^⏳.*- /, '');
        }
    }
    
    /**
     * 开始计时
     */
    start() {
        if (this.isRunning && !this.isPaused) return;
        
        const client = window.pluginClient;
        this.currentRole = client.getCurrentRole();
        
        if (!this.isPaused) {
            // 如果不是从暂停恢复，重置时间
            this.remainingTime = this.isBreak ? this.breakDuration * 60 : this.duration * 60;
        }
        
        this.isRunning = true;
        this.isPaused = false;
        
        this.timer = setInterval(() => {
            if (this.remainingTime > 0) {
                this.remainingTime--;
                this.updateDisplay();
            } else {
                this.complete();
            }
        }, 1000);
        
        this.updateDisplay();
        this.updateButtons();
    }
    
    /**
     * 暂停计时
     */
    pause() {
        if (!this.isRunning) return;
        
        this.isPaused = true;
        clearInterval(this.timer);
        this.updateDisplay();
        this.updateButtons();
    }
    
    /**
     * 重置计时
     */
    reset() {
        this.isRunning = false;
        this.isPaused = false;
        clearInterval(this.timer);
        this.remainingTime = this.isBreak ? this.breakDuration * 60 : this.duration * 60;
        this.updateDisplay();
        this.updateButtons();
    }
    
    /**
     * 完成一个番茄钟
     */
    async complete() {
        clearInterval(this.timer);
        this.isRunning = false;
        this.isPaused = false;
        
        const client = window.pluginClient;
        
        // 播放完成提示音（如果有）
        this.playCompletionSound();
        
        if (!this.isBreak) {
            // 完成工作时段
            this.completedCount++;
            this.saveSettings();
            
            // 显示完成提示
            client.showToast('✨ 炼金仪式完成！时光的精华已凝结', 'success');
            
            // 调用后端记录完成
            try {
                await fetch('/plugins/pomodoro/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        role_name: this.currentRole ? this.currentRole.name : null,
                        duration: this.duration,
                        completed_count: this.completedCount
                    })
                });
            } catch (e) {
                console.error('记录完成失败:', e);
            }
            
            // 触发角色消息
            if (this.enableCharacterMessage && this.currentRole) {
                await this.triggerCharacterMessage();
            }
            
            // 切换到休息模式
            this.isBreak = true;
            this.remainingTime = this.breakDuration * 60;
            
            // 询问是否开始休息
            client.showDialog(
                '休憩时刻',
                '<p>专注仪式已完成，是否开始休憩冥想？</p>',
                () => this.start(),
                () => {
                    this.isBreak = false;
                    this.remainingTime = this.duration * 60;
                    this.updateDisplay();
                }
            );
            
        } else {
            // 完成休息时段
            client.showToast('💫 休憩完成！准备好下一次炼金了吗？', 'info');
            this.isBreak = false;
            this.remainingTime = this.duration * 60;
        }
        
        this.updateDisplay();
        this.updateButtons();
        this.updateStats();
    }
    
    /**
     * 触发角色发送鼓励消息
     */
    async triggerCharacterMessage() {
        try {
            const client = window.pluginClient;
            
            const response = await fetch('/plugins/pomodoro/trigger-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role_name: this.currentRole.name,
                    duration: this.duration,
                    completed_count: this.completedCount,
                    custom_message: this.customMessage
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 触发角色发送消息
                await client.triggerCharacterMessage(
                    this.currentRole.name,
                    data.prompt,
                    true
                );
            }
        } catch (e) {
            console.error('触发角色消息失败:', e);
        }
    }
    
    /**
     * 播放完成提示音
     */
    playCompletionSound() {
        try {
            // 使用Web Audio API创建提示音
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 528; // 528Hz - 传说中的"爱的频率"
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.error('播放提示音失败:', e);
        }
    }
    
    /**
     * 更新按钮状态
     */
    updateButtons() {
        const startBtn = document.getElementById('pomodoro-start-btn');
        const pauseBtn = document.getElementById('pomodoro-pause-btn');
        const resetBtn = document.getElementById('pomodoro-reset-btn');
        
        if (startBtn) {
            startBtn.disabled = this.isRunning && !this.isPaused;
            startBtn.textContent = this.isPaused ? '继续' : '开始';
        }
        
        if (pauseBtn) {
            pauseBtn.disabled = !this.isRunning || this.isPaused;
        }
        
        if (resetBtn) {
            resetBtn.disabled = !this.isRunning && !this.isPaused && this.remainingTime === (this.isBreak ? this.breakDuration * 60 : this.duration * 60);
        }
    }
    
    /**
     * 更新统计信息
     */
    updateStats() {
        const statsDisplay = document.getElementById('pomodoro-stats');
        if (statsDisplay) {
            statsDisplay.textContent = `今日完成: ${this.completedCount} 次`;
        }
    }
    
    /**
     * 打开设置面板（改为模态对话框）
     */
    openSettings() {
        const client = window.pluginClient;
        
        const settingsHtml = `
            <div class="pomodoro-settings-modal-content">
                <h3 style="margin: 0 0 20px 0; color: #ffd700; text-align: center; font-size: 18px;">⚙️ 炼金时钟设置</h3>
                
                <div class="pomodoro-setting-item">
                    <label>⏳ 专注时长 (分钟)</label>
                    <input type="number" id="pomodoro-duration-input" value="${this.duration}" min="1" max="120">
                </div>
                
                <div class="pomodoro-setting-item">
                    <label>☕ 休息时长 (分钟)</label>
                    <input type="number" id="pomodoro-break-input" value="${this.breakDuration}" min="1" max="60">
                </div>
                
                <div class="pomodoro-setting-item">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="pomodoro-message-toggle" ${this.enableCharacterMessage ? 'checked' : ''} style="margin-right: 8px;">
                        <span>💬 完成时向角色发送消息</span>
                    </label>
                </div>
                
                <div class="pomodoro-setting-item">
                    <label>✨ 自定义完成消息内容</label>
                    <textarea id="pomodoro-custom-message" placeholder="留空则使用默认消息&#10;例如：我刚完成了一次专注工作，需要你的鼓励和赞美" rows="3">${this.customMessage}</textarea>
                    <small style="color: #999; font-size: 11px; display: block; margin-top: 6px; line-height: 1.4;">💡 这条消息会作为系统提示发送给角色，角色会根据此内容回复你</small>
                </div>
                
                <div class="pomodoro-setting-actions">
                    <button class="pomodoro-modal-btn pomodoro-modal-btn-primary" onclick="alchemyTimer.saveSettingsFromModal()">
                        <span>💾 保存设置</span>
                    </button>
                    <button class="pomodoro-modal-btn pomodoro-modal-btn-warning" onclick="alchemyTimer.resetStats()">
                        <span>🔄 重置统计</span>
                    </button>
                    <button class="pomodoro-modal-btn pomodoro-modal-btn-secondary" onclick="alchemyTimer.closeSettingsModal()">
                        <span>❌ 取消</span>
                    </button>
                </div>
            </div>
        `;
        
        // 创建模态框容器
        const modalHTML = `
            <div class="pomodoro-settings-modal-overlay" id="pomodoro-settings-modal">
                <div class="pomodoro-settings-modal-content">
                    ${settingsHtml}
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 点击外部关闭
        const overlay = document.getElementById('pomodoro-settings-modal');
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeSettingsModal();
            }
        });
    }
    
    /**
     * 关闭设置模态框
     */
    closeSettingsModal() {
        const modal = document.getElementById('pomodoro-settings-modal');
        if (modal) {
            modal.classList.add('fade-out');
            setTimeout(() => modal.remove(), 300);
        }
    }
    
    /**
     * 从设置模态框保存
     */
    saveSettingsFromModal() {
        const durationInput = document.getElementById('pomodoro-duration-input');
        const breakInput = document.getElementById('pomodoro-break-input');
        const messageToggle = document.getElementById('pomodoro-message-toggle');
        const customMessageInput = document.getElementById('pomodoro-custom-message');
        
        if (durationInput) this.duration = parseInt(durationInput.value) || 25;
        if (breakInput) this.breakDuration = parseInt(breakInput.value) || 5;
        if (messageToggle) this.enableCharacterMessage = messageToggle.checked;
        if (customMessageInput) this.customMessage = customMessageInput.value.trim();
        
        this.saveSettings();
        
        // 如果没有运行，更新显示时间
        if (!this.isRunning) {
            this.remainingTime = this.isBreak ? this.breakDuration * 60 : this.duration * 60;
            this.updateDisplay();
        }
        
        window.pluginClient.showToast('✨ 设置已保存', 'success');
        
        // 关闭设置模态框
        this.closeSettingsModal();
    }
    
    /**
     * 从设置面板保存（兼容旧方法）
     */
    saveSettingsFromPanel() {
        this.saveSettingsFromModal();
    }
    
    /**
     * 重置统计
     */
    resetStats() {
        const client = window.pluginClient;
        
        // 使用更友好的对话框
        client.showDialog(
            '🔄 重置统计',
            '<p>确定要重置今日完成次数吗？此操作无法撤销。</p>',
            () => {
                this.completedCount = 0;
                this.saveSettings();
                this.updateStats();
                client.showToast('📊 统计已重置', 'info');
                
                // 如果在设置模态框中，也关闭它
                this.closeSettingsModal();
            },
            () => {
                // 取消时什么都不做
            }
        );
    }
    
    /**
     * 创建UI
     */
    createUI() {
        const content = `
            <div class="pomodoro-window">
                <div class="pomodoro-header">
                    <h2>⏳ 炼金时钟</h2>
                    <button class="pomodoro-close-btn" onclick="alchemyTimer.closeWindow()">×</button>
                </div>
                
                <div class="pomodoro-body">
                    <!-- 圆形进度环 -->
                    <div class="pomodoro-timer-circle">
                        <svg class="pomodoro-progress-svg" viewBox="0 0 100 100">
                            <circle class="pomodoro-progress-bg" cx="50" cy="50" r="45"></circle>
                            <circle class="pomodoro-progress-bar" id="pomodoro-progress-ring" cx="50" cy="50" r="45"></circle>
                        </svg>
                        <div class="pomodoro-timer-content">
                            <div class="pomodoro-time" id="pomodoro-time-display">${this.formatTime(this.remainingTime)}</div>
                            <div class="pomodoro-status" id="pomodoro-status">专注炼金 · 待机</div>
                        </div>
                    </div>
                    
                    <!-- 控制按钮 -->
                    <div class="pomodoro-controls">
                        <button class="pomodoro-btn pomodoro-btn-primary" id="pomodoro-start-btn" onclick="alchemyTimer.start()">
                            <span>开始</span>
                        </button>
                        <button class="pomodoro-btn pomodoro-btn-warning" id="pomodoro-pause-btn" onclick="alchemyTimer.pause()" disabled>
                            <span>暂停</span>
                        </button>
                        <button class="pomodoro-btn pomodoro-btn-secondary" id="pomodoro-reset-btn" onclick="alchemyTimer.reset()" disabled>
                            <span>重置</span>
                        </button>
                    </div>
                    
                    <!-- 统计信息 -->
                    <div class="pomodoro-stats" id="pomodoro-stats">
                        今日完成: ${this.completedCount} 次
                    </div>
                    
                    <!-- 设置按钮 -->
                    <div class="pomodoro-footer">
                        <button class="pomodoro-btn pomodoro-btn-link" onclick="alchemyTimer.openSettings()">
                            ⚙️ 设置
                        </button>
                    </div>
                    
                    <!-- 设置面板 -->
                    <div id="pomodoro-settings-container" style="display: none;"></div>
                </div>
            </div>
        `;
        
        return content;
    }
    
    /**
     * 显示窗口
     */
    show() {
        const client = window.pluginClient;
        
        // 关闭旧窗口
        if (this.windowId) {
            client.closeFloatingWindow(this.windowId);
        }
        
        // 创建新窗口
        this.windowId = client.createFloatingWindow(this.createUI(), {
            duration: 0, // 不自动关闭
            position: 'center',
            className: 'pomodoro-floating-window'
        });
        
        // 更新显示
        setTimeout(() => {
            this.updateDisplay();
            this.updateButtons();
            this.updateStats();
        }, 100);
    }
    
    /**
     * 关闭窗口
     */
    closeWindow() {
        if (this.windowId) {
            window.pluginClient.closeFloatingWindow(this.windowId);
            this.windowId = null;
        }
        
        // 如果正在运行，询问是否停止
        if (this.isRunning && !this.isPaused) {
            const shouldStop = confirm('计时器正在运行，确定要关闭吗？');
            if (shouldStop) {
                this.pause();
            }
        }
    }
}

// 创建全局实例
const alchemyTimer = new AlchemyTimer();

/**
 * 执行番茄钟命令
 */
function executePomodoroCommand() {
    const client = window.pluginClient;
    const role = client.getCurrentRole();
    
    if (!role) {
        client.showToast('建议先选择一个角色，这样完成时可以收到鼓励哦～', 'warning');
    }
    
    alchemyTimer.show();
}

// 导出到全局
window.executePomodoroCommand = executePomodoroCommand;
window.alchemyTimer = alchemyTimer;

console.log('✅ 炼金时钟插件已加载');

