// 命运之骰 - D100检定游戏逻辑
class D100Game {
    constructor() {
        this.currentResult = null;
        this.isRolling = false;
        this.history = this.loadHistory();
        this.initializeElements();
        this.renderHistory();
        this.setupAccessibility();
        this.initializeEpicEffects();
    }

    initializeElements() {
        this.dice = document.getElementById('dice');
        this.diceNumber = document.getElementById('dice-number');
        this.resultText = document.getElementById('result-text');
        this.resultValue = document.getElementById('result-value');
        this.resultInterpretation = document.getElementById('result-interpretation');
        this.rollBtn = document.getElementById('roll-btn');
        this.sendToChatBtn = document.getElementById('send-to-chat-btn');
        this.historyList = document.getElementById('history-list');

        // 添加骰子点击事件
        this.dice.addEventListener('click', () => this.rollDice());
        
        // 添加键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.isRolling) {
                e.preventDefault();
                this.rollDice();
            }
            if (e.key === 'Enter' && e.target === this.dice && !this.isRolling) {
                e.preventDefault();
                this.rollDice();
            }
        });

        // 触摸设备支持
        this.dice.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.isRolling) {
                this.rollDice();
            }
        });
    }

    setupAccessibility() {
        // 为骰子添加键盘导航支持
        this.dice.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!this.isRolling) {
                    this.rollDice();
                }
            }
        });
    }

    initializeEpicEffects() {
        // 创建粒子效果容器
        this.createParticleSystem();
        
        // 初始化音效上下文
        this.initAudioContext();
        
        // 添加鼠标悬停效果
        this.setupHoverEffects();
    }

    createParticleSystem() {
        // 这里可以添加更复杂的粒子效果
        // 当前保持简洁，依赖CSS动画
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('音频上下文初始化失败');
            this.audioContext = null;
        }
    }

    setupHoverEffects() {
        this.dice.addEventListener('mouseenter', () => {
            if (!this.isRolling) {
                this.playHoverSound();
            }
        });
    }

    rollDice() {
        if (this.isRolling) return;

        this.isRolling = true;
        this.rollBtn.disabled = true;
        this.sendToChatBtn.disabled = true;

        // 播放投掷音效
        this.playRollSound();

        // 更新ARIA状态
        this.resultText.setAttribute('aria-live', 'polite');

        // 直接生成并显示结果
        this.finishRoll();
    }


    finishRoll() {
        // 生成最终结果
        this.currentResult = Math.floor(Math.random() * 100) + 1;
        
        // 更新显示
        this.diceNumber.textContent = this.currentResult;
        this.resultText.textContent = '命运已定：';
        this.resultValue.textContent = this.currentResult;
        
        // 根据结果设置颜色和解释
        const interpretation = this.getResultInterpretation(this.currentResult);
        this.resultInterpretation.textContent = interpretation.text;
        
        if (this.currentResult <= 20) {
            this.resultValue.className = 'result-value failure';
        } else if (this.currentResult >= 80) {
            this.resultValue.className = 'result-value success';
        } else {
            this.resultValue.className = 'result-value';
        }
        
        // 重新启用按钮
        this.isRolling = false;
        this.rollBtn.disabled = false;
        this.sendToChatBtn.disabled = false;

        // 添加到历史记录
        this.addToHistory(this.currentResult);
        
        // 播放完成音效
        this.playCompletionSound(interpretation.type);
        
        // 创建结果特效
        this.createResultEffect(interpretation.type);
    }

    getResultInterpretation(result) {
        if (result === 100) {
            return { type: 'legendary', text: '传奇！命运之神的眷顾！' };
        } else if (result >= 95) {
            return { type: 'critical', text: '完美！史诗般的成就！' };
        } else if (result >= 80) {
            return { type: 'success', text: '出色！命运女神的微笑' };
        } else if (result >= 60) {
            return { type: 'good', text: '良好，稳健的表现' };
        } else if (result >= 40) {
            return { type: 'average', text: '平凡，命运的平衡' };
        } else if (result >= 20) {
            return { type: 'poor', text: '不佳，需要更多努力' };
        } else if (result <= 5) {
            return { type: 'fumble', text: '大失败！命运的捉弄' };
        } else {
            return { type: 'failure', text: '失败，但仍有希望' };
        }
    }

    createResultEffect(type) {
        const effects = {
            legendary: () => this.createGoldenBurst(),
            critical: () => this.createSilverBurst(),
            success: () => this.createGreenGlow(),
            failure: () => this.createRedPulse(),
            fumble: () => this.createDarkSmoke()
        };
        
        const effect = effects[type];
        if (effect) {
            setTimeout(effect, 200);
        }
    }

    createGoldenBurst() {
        // 创建金色爆发效果
        for (let i = 0; i < 12; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: absolute;
                width: 8px;
                height: 8px;
                background: radial-gradient(circle, #d4af37, #b8941f);
                border-radius: 50%;
                pointer-events: none;
                z-index: 1000;
            `;
            
            const rect = this.dice.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            particle.style.left = centerX + 'px';
            particle.style.top = centerY + 'px';
            
            document.body.appendChild(particle);
            
            const angle = (i / 12) * Math.PI * 2;
            const distance = 100;
            
            particle.animate([
                { 
                    opacity: 1, 
                    transform: 'scale(1) translate(0, 0)' 
                },
                { 
                    opacity: 0, 
                    transform: `scale(0.2) translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)` 
                }
            ], {
                duration: 1000,
                easing: 'ease-out'
            }).onfinish = () => particle.remove();
        }
    }

    createSilverBurst() {
        // 银色爆发效果（简化版）
        this.createColorBurst('#c0c0c0', '#a0a0a0', 8);
    }

    createGreenGlow() {
        // 绿色光晕效果
        this.createColorBurst('#228b22', '#32cd32', 6);
    }

    createRedPulse() {
        // 红色脉冲效果
        this.createColorBurst('#8b0000', '#ff4444', 4);
    }

    createDarkSmoke() {
        // 黑烟效果
        this.createColorBurst('#333333', '#666666', 10);
    }

    createColorBurst(color1, color2, count) {
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: absolute;
                width: 6px;
                height: 6px;
                background: radial-gradient(circle, ${color1}, ${color2});
                border-radius: 50%;
                pointer-events: none;
                z-index: 1000;
            `;
            
            const rect = this.dice.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            particle.style.left = centerX + 'px';
            particle.style.top = centerY + 'px';
            
            document.body.appendChild(particle);
            
            const angle = (i / count) * Math.PI * 2;
            const distance = 60 + Math.random() * 40;
            
            particle.animate([
                { opacity: 1, transform: 'scale(1) translate(0, 0)' },
                { opacity: 0, transform: `scale(0.3) translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)` }
            ], {
                duration: 800,
                easing: 'ease-out'
            }).onfinish = () => particle.remove();
        }
    }

    addToHistory(result) {
        const historyItem = {
            result: result,
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
            this.historyList.innerHTML = '<div class="history-empty">暂无记录</div>';
            return;
        }

        const historyHTML = this.history.map(item => `
            <div class="history-item">
                <span class="history-result">${item.result}</span>
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
            localStorage.setItem('d100_history', JSON.stringify(this.history));
        } catch (e) {
            console.warn('无法保存历史记录到本地存储');
        }
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem('d100_history');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.warn('无法加载历史记录');
            return [];
        }
    }

    playHoverSound() {
        if (!this.audioContext) return;
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.02, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.1);
        } catch (e) {
            // 静默处理音效错误
        }
    }

    playRollSound() {
        if (!this.audioContext) return;
        try {
            // 创建滚动音效
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();

            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.3);
            
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1000, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.3);
        } catch (e) {
            // 静默处理音效错误
        }
    }

    playCompletionSound(resultType) {
        if (!this.audioContext) return;
        try {
            const soundMap = {
                legendary: { freq: 1200, duration: 0.8, volume: 0.15 },
                critical: { freq: 1000, duration: 0.6, volume: 0.12 },
                success: { freq: 800, duration: 0.4, volume: 0.1 },
                good: { freq: 600, duration: 0.3, volume: 0.08 },
                average: { freq: 400, duration: 0.2, volume: 0.06 },
                poor: { freq: 300, duration: 0.2, volume: 0.06 },
                failure: { freq: 200, duration: 0.3, volume: 0.08 },
                fumble: { freq: 150, duration: 0.5, volume: 0.1 }
            };

            const sound = soundMap[resultType] || soundMap.average;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(sound.freq, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(sound.freq * 0.5, this.audioContext.currentTime + sound.duration);
            
            gainNode.gain.setValueAtTime(sound.volume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + sound.duration);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + sound.duration);
        } catch (e) {
            // 静默处理音效错误
        }
    }

    async sendToChat() {
        if (!this.currentResult) {
            alert('请先进行一次检定');
            return;
        }

        try {
            this.sendToChatBtn.disabled = true;
            this.sendToChatBtn.textContent = '发送中...';

            // 获取当前玩家信息
            const playerInfo = await this.getCurrentPlayer();
            const playerName = playerInfo ? playerInfo.name : '玩家';

            // 获取结果解释
            const interpretation = this.getResultInterpretation(this.currentResult);
            
            // 获取当前选中的角色
            let currentRole = 'default';
            try {
                if (window.parent && window.parent.document) {
                    const roleSelect = window.parent.document.getElementById('role');
                    if (roleSelect && roleSelect.value) {
                        currentRole = roleSelect.value;
                        console.log('🎭 获取到当前角色:', currentRole);
                    }
                }
            } catch (e) {
                console.log('⚠️ 无法获取当前角色，使用默认:', e);
            }

            // 发送到聊天API (使用新的统一格式)
            const response = await fetch('/api/send_game_result', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    game_type: 'd100',
                    score_data: {
                        result: this.currentResult
                    },
                    role: currentRole  // 包含当前选中的角色
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // 根据是否触发自动回复显示不同消息
                    if (result.auto_reply_triggered) {
                        this.showNotification('命运已传达，角色正在回应...', 'success');
                    } else {
                        this.showNotification('命运已传达至聊天', 'success');
                    }
                    
                    // 通知父窗口更新聊天界面
                    if (window.parent && window.parent !== window) {
                        // 如果在iframe中，通知父窗口刷新聊天记录
                        window.parent.postMessage({
                            type: 'updateChatHistory',
                            source: 'game',
                            gameType: 'd100',
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
                    
                    // 延迟关闭游戏窗口，给AI时间回复
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
            console.error('发送检定结果失败:', error);
            this.showNotification('发送失败: ' + error.message, 'error');
        } finally {
            this.sendToChatBtn.disabled = false;
            this.sendToChatBtn.textContent = '发送到聊天';
        }
    }

    async getCurrentPlayer() {
        try {
            const response = await fetch('/api/get_current_player');
            if (response.ok) {
                const data = await response.json();
                return data.success ? data.player : null;
            }
        } catch (error) {
            console.error('获取玩家信息失败:', error);
        }
        return null;
    }

    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // 样式
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '600',
            zIndex: '10000',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease',
            maxWidth: '300px',
            wordWrap: 'break-word'
        });

        // 根据类型设置背景色
        switch (type) {
            case 'success':
                notification.style.background = '#27ae60';
                break;
            case 'error':
                notification.style.background = '#e74c3c';
                break;
            default:
                notification.style.background = '#3498db';
        }

        document.body.appendChild(notification);

        // 显示动画
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // 自动隐藏
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// 全局函数
let game;

function rollDice() {
    if (game) {
        game.rollDice();
    }
}

function sendToChat() {
    if (game) {
        game.sendToChat();
    }
}

function clearHistory() {
    if (game) {
        game.clearHistory();
    }
}

function closeGame() {
    // 通知父窗口关闭游戏
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'closeGame',
            game: 'd100'
        }, '*');
    } else {
        // 如果是独立窗口，直接关闭
        window.close();
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    game = new D100Game();
    
    // 监听来自父窗口的消息
    window.addEventListener('message', (event) => {
        if (event.data.type === 'gameCommand' && event.data.command === 'roll') {
            rollDice();
        }
    });
    
    console.log('D100骰子游戏已初始化');
});

// 防止页面刷新时丢失状态
window.addEventListener('beforeunload', (e) => {
    if (game && game.isRolling) {
        e.preventDefault();
        e.returnValue = '骰子正在滚动中，确定要离开吗？';
    }
});
