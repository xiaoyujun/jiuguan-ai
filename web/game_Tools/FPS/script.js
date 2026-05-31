// FPS定位微调游戏逻辑
class FPSTrainingGame {
    constructor() {
        // 游戏状态
        this.isGameActive = false;
        this.gameStartTime = 0;
        this.gameEndTime = 0;
        this.gameDuration = 5000; // 5秒
        this.score = 0;
        this.hits = 0;
        this.totalTargets = 0;
        this.reactionTimes = [];
        this.history = this.loadHistory();
        
        // 目标管理
        this.targets = [];
        this.targetSpawnRate = 800; // 目标生成间隔(毫秒)
        this.targetLifespan = 2000; // 目标存活时间(毫秒)
        this.minTargetSize = 40;
        this.maxTargetSize = 70;
        
        // DOM元素
        this.initializeElements();
        
        // 定时器
        this.gameTimer = null;
        this.targetSpawner = null;
        this.countdownTimer = null;
        
        // 事件绑定
        this.bindEvents();
        
        // 初始化显示
        this.renderHistory();
        this.setupAudio();
        
        console.log('FPS训练游戏已初始化');
    }

    initializeElements() {
        // 游戏控制元素
        this.gameOverlay = document.getElementById('game-overlay');
        this.startBtn = document.getElementById('start-btn');
        this.shootingArea = document.getElementById('shooting-area');
        this.crosshair = document.getElementById('crosshair');
        
        // HUD元素
        this.timerDisplay = document.getElementById('timer');
        this.scoreDisplay = document.getElementById('score');
        this.hitsDisplay = document.getElementById('hits');
        this.accuracyDisplay = document.getElementById('accuracy');
        
        // 结果面板元素
        this.resultsPanel = document.getElementById('results-panel');
        this.finalScoreDisplay = document.getElementById('final-score');
        this.finalAccuracyDisplay = document.getElementById('final-accuracy');
        this.avgReactionDisplay = document.getElementById('avg-reaction');
        this.d100ResultDisplay = document.getElementById('d100-result');
        this.sendToChatBtn = document.getElementById('send-to-chat-btn');
        
        // 历史记录元素
        this.historyList = document.getElementById('history-list');
        
        // 覆盖层元素
        this.overlayTitle = document.getElementById('overlay-title');
        this.overlayDesc = document.getElementById('overlay-desc');
    }

    bindEvents() {
        // 开始按钮
        this.startBtn.addEventListener('click', () => this.startGame());
        
        // 射击区域点击
        this.shootingArea.addEventListener('click', (e) => this.handleShoot(e));
        
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.isGameActive) {
                e.preventDefault();
                this.startGame();
            }
            if (e.key === 'Escape' && this.isGameActive) {
                this.endGame();
            }
        });
        
        // 鼠标移动事件（更新准星位置）
        this.shootingArea.addEventListener('mousemove', (e) => this.updateCrosshair(e));
        
        // 防止右键菜单
        this.shootingArea.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // 触摸事件支持
        this.shootingArea.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.isGameActive) {
                const touch = e.touches[0];
                const rect = this.shootingArea.getBoundingClientRect();
                const fakeEvent = {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    target: e.target
                };
                this.handleShoot(fakeEvent);
            }
        });
    }

    setupAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('音频上下文初始化失败');
            this.audioContext = null;
        }
    }

    startGame() {
        if (this.isGameActive) return;
        
        console.log('开始FPS训练游戏');
        
        // 重置游戏状态
        this.resetGameState();
        
        // 隐藏开始界面
        this.gameOverlay.style.display = 'none';
        this.resultsPanel.style.display = 'none';
        
        // 启动游戏
        this.isGameActive = true;
        this.gameStartTime = Date.now();
        
        // 开始计时器
        this.startTimer();
        
        // 开始生成目标
        this.startTargetSpawning();
        
        // 播放开始音效
        this.playStartSound();
        
        // 更新界面
        this.updateHUD();
    }

    resetGameState() {
        this.score = 0;
        this.hits = 0;
        this.totalTargets = 0;
        this.reactionTimes = [];
        this.targets = [];
        
        // 清除所有现有目标
        this.clearAllTargets();
        
        // 清除定时器
        if (this.gameTimer) clearInterval(this.gameTimer);
        if (this.targetSpawner) clearInterval(this.targetSpawner);
        if (this.countdownTimer) clearInterval(this.countdownTimer);
    }

    startTimer() {
        this.countdownTimer = setInterval(() => {
            const elapsed = Date.now() - this.gameStartTime;
            const remaining = Math.max(0, this.gameDuration - elapsed);
            
            this.timerDisplay.textContent = (remaining / 1000).toFixed(2);
            
            if (remaining <= 0) {
                this.endGame();
            }
        }, 10);
    }

    startTargetSpawning() {
        // 立即生成第一个目标
        this.spawnTarget();
        
        // 设置定期生成目标
        this.targetSpawner = setInterval(() => {
            if (this.isGameActive) {
                this.spawnTarget();
            }
        }, this.targetSpawnRate);
    }

    spawnTarget() {
        if (!this.isGameActive) return;
        
        const target = this.createTarget();
        this.targets.push(target);
        this.shootingArea.appendChild(target.element);
        this.totalTargets++;
        
        // 设置目标消失定时器
        setTimeout(() => {
            if (target.element.parentNode && !target.hit) {
                target.element.classList.add('miss');
                setTimeout(() => {
                    this.removeTarget(target);
                }, 500);
            }
        }, this.targetLifespan);
        
        this.updateHUD();
    }

    createTarget() {
        const element = document.createElement('div');
        element.className = 'target';
        
        // 随机位置（避免边缘和准星附近）
        const rect = this.shootingArea.getBoundingClientRect();
        const margin = 50; // 边缘边距
        const centerExclusion = 80; // 中心排除区域半径
        
        let x, y;
        do {
            x = margin + Math.random() * (rect.width - 2 * margin);
            y = margin + Math.random() * (rect.height - 2 * margin);
        } while (
            Math.sqrt(Math.pow(x - rect.width/2, 2) + Math.pow(y - rect.height/2, 2)) < centerExclusion
        );
        
        element.style.left = x + 'px';
        element.style.top = y + 'px';
        
        // 随机大小
        const size = this.minTargetSize + Math.random() * (this.maxTargetSize - this.minTargetSize);
        element.style.width = size + 'px';
        element.style.height = size + 'px';
        
        const target = {
            element: element,
            spawnTime: Date.now(),
            hit: false,
            size: size,
            x: x,
            y: y
        };
        
        // 绑定点击事件
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hitTarget(target);
        });
        
        return target;
    }

    handleShoot(event) {
        if (!this.isGameActive) return;
        
        // 创建射击效果
        this.createMuzzleFlash(event.clientX, event.clientY);
        
        // 播放射击音效
        this.playShootSound();
        
        // 检查是否命中目标
        const hitTarget = this.checkTargetHit(event);
        if (!hitTarget) {
            // 未命中任何目标
            this.playMissSound();
        }
    }

    checkTargetHit(event) {
        const rect = this.shootingArea.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        // 检查所有活动目标
        for (const target of this.targets) {
            if (target.hit) continue;
            
            const targetRect = target.element.getBoundingClientRect();
            const shootingRect = this.shootingArea.getBoundingClientRect();
            
            const targetX = targetRect.left - shootingRect.left + targetRect.width / 2;
            const targetY = targetRect.top - shootingRect.top + targetRect.height / 2;
            
            const distance = Math.sqrt(
                Math.pow(clickX - targetX, 2) + Math.pow(clickY - targetY, 2)
            );
            
            const targetRadius = Math.min(targetRect.width, targetRect.height) / 2;
            
            if (distance <= targetRadius) {
                this.hitTarget(target);
                return target;
            }
        }
        
        return null;
    }

    hitTarget(target) {
        if (target.hit || !this.isGameActive) return;
        
        target.hit = true;
        this.hits++;
        
        // 计算反应时间
        const reactionTime = Date.now() - target.spawnTime;
        this.reactionTimes.push(reactionTime);
        
        // 计算分数（基于目标大小和反应时间）
        const sizeBonus = Math.max(0, (this.maxTargetSize - target.size) / this.maxTargetSize) * 50;
        const speedBonus = Math.max(0, (this.targetLifespan - reactionTime) / this.targetLifespan) * 100;
        const targetScore = Math.round(100 + sizeBonus + speedBonus);
        
        this.score += targetScore;
        
        // 视觉效果
        target.element.classList.add('hit');
        this.createHitEffect(target);
        
        // 播放命中音效
        this.playHitSound();
        
        // 移除目标
        setTimeout(() => {
            this.removeTarget(target);
        }, 300);
        
        // 更新HUD
        this.updateHUD();
        
        console.log(`命中目标! 分数: ${targetScore}, 反应时间: ${reactionTime}ms`);
    }

    removeTarget(target) {
        const index = this.targets.indexOf(target);
        if (index > -1) {
            this.targets.splice(index, 1);
        }
        
        if (target.element.parentNode) {
            target.element.parentNode.removeChild(target.element);
        }
    }

    clearAllTargets() {
        this.targets.forEach(target => {
            if (target.element.parentNode) {
                target.element.parentNode.removeChild(target.element);
            }
        });
        this.targets = [];
    }

    updateHUD() {
        this.scoreDisplay.textContent = this.score;
        this.hitsDisplay.textContent = this.hits;
        
        const accuracy = this.totalTargets > 0 ? Math.round((this.hits / this.totalTargets) * 100) : 0;
        this.accuracyDisplay.textContent = accuracy + '%';
    }

    updateCrosshair(event) {
        if (!this.isGameActive) return;
        
        const rect = this.shootingArea.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.crosshair.style.left = x + 'px';
        this.crosshair.style.top = y + 'px';
    }

    endGame() {
        if (!this.isGameActive) return;
        
        console.log('游戏结束');
        
        this.isGameActive = false;
        this.gameEndTime = Date.now();
        
        // 清除定时器
        if (this.gameTimer) clearInterval(this.gameTimer);
        if (this.targetSpawner) clearInterval(this.targetSpawner);
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        
        // 清除剩余目标
        this.clearAllTargets();
        
        // 播放结束音效
        this.playEndSound();
        
        // 显示结果
        this.showResults();
    }

    showResults() {
        // 计算最终统计数据
        const accuracy = this.totalTargets > 0 ? Math.round((this.hits / this.totalTargets) * 100) : 0;
        const avgReaction = this.reactionTimes.length > 0 ? 
            Math.round(this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length) : 0;
        
        // 计算D100结果（使用与后端相同的算法）
        const d100Result = this.calculateD100Result(this.score, accuracy);
        
        // 更新结果显示
        this.finalScoreDisplay.textContent = this.score;
        this.finalAccuracyDisplay.textContent = accuracy + '%';
        this.avgReactionDisplay.textContent = avgReaction + 'ms';
        this.d100ResultDisplay.textContent = 'd' + d100Result;
        
        // 根据结果设置颜色
        this.setResultColors(d100Result);
        
        // 显示结果面板
        this.resultsPanel.style.display = 'block';
        
        // 保存到历史记录
        this.addToHistory({
            score: this.score,
            accuracy: accuracy,
            avgReaction: avgReaction,
            d100Result: d100Result,
            hits: this.hits,
            totalTargets: this.totalTargets
        });
        
        // 存储当前结果供发送使用
        this.currentResult = {
            score: this.score,
            accuracy: accuracy,
            d100_result: d100Result
        };
    }

    calculateD100Result(score, accuracy) {
        // 与后端game_score_processor.py相同的转换算法
        const maxExpectedScore = 2000;
        
        // 分数部分 (0-60分)
        const scorePart = Math.min(60, (score / maxExpectedScore) * 60);
        
        // 准确率部分 (0-40分)
        const accuracyPart = (accuracy / 100) * 40;
        
        // 合计并确保在1-100范围内
        const total = scorePart + accuracyPart;
        return Math.max(1, Math.min(100, Math.round(total)));
    }

    setResultColors(d100Result) {
        let colorClass = '';
        if (d100Result >= 80) {
            colorClass = 'success';
        } else if (d100Result >= 60) {
            colorClass = 'good';
        } else if (d100Result >= 40) {
            colorClass = 'average';
        } else {
            colorClass = 'poor';
        }
        
        this.d100ResultDisplay.className = `result-value ${colorClass}`;
    }

    resetGame() {
        // 隐藏结果面板
        this.resultsPanel.style.display = 'none';
        
        // 显示开始界面
        this.gameOverlay.style.display = 'flex';
        this.overlayTitle.textContent = 'FPS定位微调训练';
        this.overlayDesc.innerHTML = '在5秒内尽可能快速准确地点击出现的目标<br>提升你的鼠标定位精度和反应速度';
        
        // 重置显示
        this.timerDisplay.textContent = '5.00';
        this.scoreDisplay.textContent = '0';
        this.hitsDisplay.textContent = '0';
        this.accuracyDisplay.textContent = '0%';
        
        // 重置准星位置
        this.crosshair.style.left = '50%';
        this.crosshair.style.top = '50%';
        
        console.log('游戏已重置');
    }

    createMuzzleFlash(clientX, clientY) {
        const flash = document.createElement('div');
        flash.className = 'muzzle-flash';
        
        const rect = this.shootingArea.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        flash.style.left = x + 'px';
        flash.style.top = y + 'px';
        
        this.shootingArea.appendChild(flash);
        
        setTimeout(() => {
            if (flash.parentNode) {
                flash.parentNode.removeChild(flash);
            }
        }, 100);
    }

    createHitEffect(target) {
        const effect = document.createElement('div');
        effect.className = 'hit-effect';
        
        const rect = target.element.getBoundingClientRect();
        const shootingRect = this.shootingArea.getBoundingClientRect();
        
        const x = rect.left - shootingRect.left + rect.width / 2;
        const y = rect.top - shootingRect.top + rect.height / 2;
        
        effect.style.left = x + 'px';
        effect.style.top = y + 'px';
        
        this.shootingArea.appendChild(effect);
        
        setTimeout(() => {
            if (effect.parentNode) {
                effect.parentNode.removeChild(effect);
            }
        }, 500);
    }

    // 音效方法
    playStartSound() {
        this.playBeepSound(800, 0.2, 0.1);
    }

    playShootSound() {
        if (!this.audioContext) return;
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();

            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.05);
            
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(200, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.05);
        } catch (e) {
            // 静默处理音效错误
        }
    }

    playHitSound() {
        this.playBeepSound(1200, 0.15, 0.08);
    }

    playMissSound() {
        this.playBeepSound(200, 0.3, 0.05);
    }

    playEndSound() {
        // 播放三声蜂鸣表示游戏结束
        setTimeout(() => this.playBeepSound(600, 0.2, 0.1), 0);
        setTimeout(() => this.playBeepSound(500, 0.2, 0.1), 200);
        setTimeout(() => this.playBeepSound(400, 0.3, 0.1), 400);
    }

    playBeepSound(frequency, duration, volume) {
        if (!this.audioContext) return;
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        } catch (e) {
            // 静默处理音效错误
        }
    }

    // 历史记录管理
    addToHistory(result) {
        const historyItem = {
            ...result,
            timestamp: new Date().toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            })
        };

        this.history.unshift(historyItem);
        
        // 限制历史记录数量
        if (this.history.length > 10) {
            this.history = this.history.slice(0, 10);
        }
        
        this.saveHistory();
        this.renderHistory();
    }

    renderHistory() {
        if (this.history.length === 0) {
            this.historyList.innerHTML = '<div class="history-empty">~ 开始你的第一次训练 ~</div>';
            return;
        }

        const historyHTML = this.history.map(item => `
            <div class="history-item">
                <div class="history-scores">
                    <span class="history-score">分数: ${item.score}</span>
                    <span class="history-accuracy">精度: ${item.accuracy}%</span>
                    <span class="history-d100">d${item.d100Result}</span>
                </div>
                <span class="history-time">${item.timestamp}</span>
            </div>
        `).join('');

        this.historyList.innerHTML = historyHTML;
    }

    clearHistory() {
        if (confirm('确定要清空历史记录吗？')) {
            this.history = [];
            this.saveHistory();
            this.renderHistory();
        }
    }

    saveHistory() {
        try {
            localStorage.setItem('fps_training_history', JSON.stringify(this.history));
        } catch (e) {
            console.warn('无法保存历史记录到本地存储');
        }
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem('fps_training_history');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.warn('无法加载历史记录');
            return [];
        }
    }

    // 发送结果到聊天
    async sendToChat() {
        if (!this.currentResult) {
            this.showNotification('请先完成一次训练', 'error');
            return;
        }

        try {
            this.sendToChatBtn.disabled = true;
            this.sendToChatBtn.textContent = '发送中...';

            // 获取当前选中的角色
            let currentRole = 'default';
            try {
                if (window.parent && window.parent.document) {
                    const roleSelect = window.parent.document.getElementById('role');
                    if (roleSelect && roleSelect.value) {
                        currentRole = roleSelect.value;
                        console.log('🎯 获取到当前角色:', currentRole);
                    }
                }
            } catch (e) {
                console.log('⚠️ 无法获取当前角色，使用默认:', e);
            }

            // 发送到聊天API
            const response = await fetch('/api/send_game_result', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    game_type: 'fps',
                    score_data: {
                        score: this.currentResult.score,
                        accuracy: this.currentResult.accuracy
                    },
                    role: currentRole
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // 根据是否触发自动回复显示不同消息
                    if (result.auto_reply_triggered) {
                        this.showNotification('训练结果已传达，角色正在回应...', 'success');
                    } else {
                        this.showNotification('训练结果已传达至聊天', 'success');
                    }
                    
                    // 通知父窗口更新聊天界面
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage({
                            type: 'updateChatHistory',
                            source: 'game',
                            gameType: 'fps',
                            message: result.chat_message,
                            autoReply: result.auto_reply_triggered
                        }, '*');
                        
                        // 尝试直接调用父窗口的loadHistory函数
                        try {
                            if (window.parent.loadHistory) {
                                window.parent.loadHistory();
                            }
                        } catch (e) {
                            console.log('无法直接调用父窗口函数:', e);
                        }
                    }
                    
                    // 延迟关闭游戏窗口
                    const delay = result.auto_reply_triggered ? 3000 : 2000;
                    
                    setTimeout(() => {
                        closeGame();
                    }, delay);
                } else {
                    throw new Error(result.error || '发送失败');
                }
            } else {
                throw new Error('网络请求失败');
            }
        } catch (error) {
            console.error('发送训练结果失败:', error);
            this.showNotification('发送失败: ' + error.message, 'error');
        } finally {
            this.sendToChatBtn.disabled = false;
            this.sendToChatBtn.textContent = '发送结果';
        }
    }

    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);

        // 显示动画
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // 自动隐藏
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// 全局函数
let fpsGame;

function startGame() {
    if (fpsGame) {
        fpsGame.startGame();
    }
}

function resetGame() {
    if (fpsGame) {
        fpsGame.resetGame();
    }
}

function sendToChat() {
    if (fpsGame) {
        fpsGame.sendToChat();
    }
}

function clearHistory() {
    if (fpsGame) {
        fpsGame.clearHistory();
    }
}

function closeGame() {
    // 通知父窗口关闭游戏
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'closeGame',
            game: 'fps'
        }, '*');
    } else {
        // 如果是独立窗口，直接关闭
        window.close();
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    fpsGame = new FPSTrainingGame();
    
    // 监听来自父窗口的消息
    window.addEventListener('message', (event) => {
        if (event.data.type === 'gameCommand') {
            switch (event.data.command) {
                case 'start':
                    startGame();
                    break;
                case 'reset':
                    resetGame();
                    break;
            }
        }
    });
    
    console.log('FPS定位微调游戏已完全初始化');
});

// 防止页面刷新时丢失状态
window.addEventListener('beforeunload', (e) => {
    if (fpsGame && fpsGame.isGameActive) {
        e.preventDefault();
        e.returnValue = '游戏正在进行中，确定要离开吗？';
    }
});
