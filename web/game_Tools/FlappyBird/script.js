/**
 * FlappyBird 游戏逻辑
 * 支持移动端和桌面端操作
 * 集成分数处理系统，支持发送到聊天
 */

class FlappyBirdGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 游戏状态
        this.gameState = 'menu'; // menu, playing, paused, gameOver
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('flappyBird_bestScore') || '0');
        this.pipesCount = 0;
        
        // 游戏对象
        this.bird = null;
        this.pipes = [];
        this.background = null;
        
        // 游戏设置 - 基础难度参数
        this.baseGravity = 0.4;        // 基础重力(降低)
        this.baseJumpPower = -7.5;     // 基础跳跃力(微调)
        this.basePipeSpeed = 1.5;      // 基础管道速度(降低)
        this.basePipeGap = 140;        // 基础管道间隙(增大)
        this.pipeWidth = 50;
        
        // 当前游戏难度参数
        this.gravity = this.baseGravity;
        this.jumpPower = this.baseJumpPower;
        this.pipeSpeed = this.basePipeSpeed;
        this.pipeGap = this.basePipeGap;
        
        // 难度递增设置
        this.difficultySettings = {
            gravityIncrease: 0.015,     // 每分重力增加量
            speedIncrease: 0.08,        // 每分速度增加量
            gapDecrease: 1.2,           // 每分间隙减少量
            maxGravity: 0.7,            // 最大重力
            maxSpeed: 3.5,              // 最大速度
            minGap: 100                 // 最小间隙
        };
        
        // 成就系统
        this.achievements = {
            'first-flight': { unlocked: false, score: 0, name: '初次飞行' },
            'bronze-flyer': { unlocked: false, score: 10, name: '铜牌飞手' },
            'silver-flyer': { unlocked: false, score: 25, name: '银牌飞手' },
            'gold-flyer': { unlocked: false, score: 50, name: '金牌飞手' },
            'master-flyer': { unlocked: false, score: 100, name: '飞行大师' }
        };
        this.loadAchievements();
        
        // 音效设置
        this.soundEnabled = true;
        
        // 初始化游戏
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupBird();
        this.setupBackground();
        this.setupEventListeners();
        this.updateUI();
        this.updateAchievementsDisplay();
        this.gameLoop();
    }
    
    setupCanvas() {
        // 设置Canvas分辨率
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = 400 * dpr;
        this.canvas.height = 600 * dpr;
        this.canvas.style.width = '400px';
        this.canvas.style.height = '600px';
        
        this.ctx.scale(dpr, dpr);
        this.ctx.imageSmoothingEnabled = false;
        
        // 游戏尺寸
        this.gameWidth = 400;
        this.gameHeight = 600;
    }
    
    setupBird() {
        this.bird = {
            x: 100,
            y: this.gameHeight / 2,
            width: 30,
            height: 25,
            velocity: 0,
            rotation: 0,
            color: '#FFD700'
        };
    }
    
    setupBackground() {
        this.background = {
            color1: '#87CEEB',
            color2: '#98FB98',
            groundY: this.gameHeight - 80,
            groundColor: '#8B4513'
        };
    }
    
    setupEventListeners() {
        // 按钮事件
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('resumeBtn').addEventListener('click', () => this.resumeGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pauseGame());
        document.getElementById('mutBtn').addEventListener('click', () => this.toggleSound());
        document.getElementById('sendScoreBtn').addEventListener('click', () => this.sendToChat());
        
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.handleJump();
            } else if (e.code === 'KeyP') {
                e.preventDefault();
                this.togglePause();
            }
        });
        
        // 触摸和鼠标事件
        this.canvas.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleJump();
        });
        
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleJump();
        });
    }
    
    handleJump() {
        if (this.gameState === 'playing') {
            this.bird.velocity = this.jumpPower;
            this.playSound('jump');
        } else if (this.gameState === 'menu') {
            this.startGame();
        }
    }
    
    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.pipesCount = 0;
        this.pipes = [];
        this.setupBird();
        
        // 重置难度到初始值
        this.resetDifficulty();
        
        // 隐藏开始界面
        document.getElementById('startScreen').style.display = 'none';
        
        // 启用暂停按钮
        document.getElementById('pauseBtn').disabled = false;
        
        // 解锁初次飞行成就
        this.unlockAchievement('first-flight');
        
        this.updateUI();
        this.playSound('start');
    }
    
    restartGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.pipesCount = 0;
        this.pipes = [];
        this.setupBird();
        
        // 重置难度到初始值
        this.resetDifficulty();
        
        // 隐藏游戏结束界面
        document.getElementById('gameOverScreen').style.display = 'none';
        
        // 启用暂停按钮
        document.getElementById('pauseBtn').disabled = false;
        
        this.updateUI();
        this.playSound('start');
    }
    
    pauseGame() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            document.getElementById('pauseScreen').style.display = 'block';
            document.getElementById('pauseBtn').disabled = true;
        }
    }
    
    resumeGame() {
        if (this.gameState === 'paused') {
            this.gameState = 'playing';
            document.getElementById('pauseScreen').style.display = 'none';
            document.getElementById('pauseBtn').disabled = false;
        }
    }
    
    togglePause() {
        if (this.gameState === 'playing') {
            this.pauseGame();
        } else if (this.gameState === 'paused') {
            this.resumeGame();
        }
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        const muteIcon = document.getElementById('muteIcon');
        muteIcon.textContent = this.soundEnabled ? '🔊' : '🔇';
    }
    
    resetDifficulty() {
        // 重置所有难度参数到初始值
        this.gravity = this.baseGravity;
        this.jumpPower = this.baseJumpPower;
        this.pipeSpeed = this.basePipeSpeed;
        this.pipeGap = this.basePipeGap;
    }
    
    updateDifficulty() {
        // 根据当前分数动态调整难度
        const score = this.score;
        
        // 每5分增加一次难度
        const difficultyLevel = Math.floor(score / 5);
        
        // 更新重力 (逐渐增加，但不超过最大值)
        this.gravity = Math.min(
            this.baseGravity + (difficultyLevel * this.difficultySettings.gravityIncrease),
            this.difficultySettings.maxGravity
        );
        
        // 更新管道速度 (逐渐增加，但不超过最大值)
        this.pipeSpeed = Math.min(
            this.basePipeSpeed + (difficultyLevel * this.difficultySettings.speedIncrease),
            this.difficultySettings.maxSpeed
        );
        
        // 更新管道间隙 (逐渐减少，但不小于最小值)
        this.pipeGap = Math.max(
            this.basePipeGap - (difficultyLevel * this.difficultySettings.gapDecrease),
            this.difficultySettings.minGap
        );
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        
        // 更新最佳分数
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('flappyBird_bestScore', this.bestScore.toString());
        }
        
        // 显示游戏结束界面
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('bestScore').textContent = this.bestScore;
        document.getElementById('gameOverScreen').style.display = 'block';
        
        // 禁用暂停按钮
        document.getElementById('pauseBtn').disabled = true;
        
        this.updateUI();
        this.playSound('gameOver');
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        // 更新鸟的物理
        this.updateBird();
        
        // 更新管道
        this.updatePipes();
        
        // 检查碰撞
        this.checkCollisions();
        
        // 生成新管道
        this.generatePipes();
        
        // 检查分数
        this.checkScore();
    }
    
    updateBird() {
        // 应用重力
        this.bird.velocity += this.gravity;
        this.bird.y += this.bird.velocity;
        
        // 计算旋转角度
        this.bird.rotation = Math.min(Math.max(this.bird.velocity * 3, -30), 90);
        
        // 检查边界
        if (this.bird.y < 0) {
            this.bird.y = 0;
            this.bird.velocity = 0;
        }
        
        if (this.bird.y + this.bird.height > this.background.groundY) {
            this.gameOver();
        }
    }
    
    updatePipes() {
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const pipe = this.pipes[i];
            pipe.x -= this.pipeSpeed;
            
            // 移除超出屏幕的管道
            if (pipe.x + this.pipeWidth < 0) {
                this.pipes.splice(i, 1);
            }
        }
    }
    
    generatePipes() {
        // 动态调整管道生成间距（基础间距200，根据分数适当调整）
        const baseDistance = 200;
        const adjustedDistance = Math.max(150, baseDistance - (Math.floor(this.score / 10) * 10));
        
        if (this.pipes.length === 0 || this.pipes[this.pipes.length - 1].x < this.gameWidth - adjustedDistance) {
            // 计算安全的管道间隙位置范围
            const minGapY = 60;  // 距离顶部最小距离
            const maxGapY = this.background.groundY - this.pipeGap - 60;  // 距离地面最小距离
            const safeRange = maxGapY - minGapY;
            
            // 使用当前的动态管道间隙
            const gapY = Math.random() * safeRange + minGapY;
            
            // 上管道
            this.pipes.push({
                x: this.gameWidth,
                y: 0,
                width: this.pipeWidth,
                height: gapY,
                passed: false,
                type: 'top'
            });
            
            // 下管道
            this.pipes.push({
                x: this.gameWidth,
                y: gapY + this.pipeGap,
                width: this.pipeWidth,
                height: this.background.groundY - (gapY + this.pipeGap),
                passed: false,
                type: 'bottom'
            });
        }
    }
    
    checkCollisions() {
        // 检查与管道的碰撞
        for (const pipe of this.pipes) {
            if (this.bird.x < pipe.x + pipe.width &&
                this.bird.x + this.bird.width > pipe.x &&
                this.bird.y < pipe.y + pipe.height &&
                this.bird.y + this.bird.height > pipe.y) {
                this.gameOver();
                return;
            }
        }
    }
    
    checkScore() {
        // 检查是否穿过管道
        for (const pipe of this.pipes) {
            if (pipe.type === 'top' && !pipe.passed && this.bird.x > pipe.x + pipe.width) {
                pipe.passed = true;
                this.score++;
                this.pipesCount++;
                this.playSound('score');
                this.checkAchievements();
                
                // 根据新分数更新难度
                this.updateDifficulty();
                
                this.updateUI();
            }
        }
    }
    
    checkAchievements() {
        for (const [key, achievement] of Object.entries(this.achievements)) {
            if (!achievement.unlocked && this.score >= achievement.score) {
                this.unlockAchievement(key);
            }
        }
    }
    
    unlockAchievement(achievementId) {
        if (!this.achievements[achievementId].unlocked) {
            this.achievements[achievementId].unlocked = true;
            this.saveAchievements();
            this.updateAchievementsDisplay();
            this.showAchievementNotification(this.achievements[achievementId].name);
            this.playSound('achievement');
        }
    }
    
    showAchievementNotification(name) {
        // 简单的成就通知（可以扩展为更丰富的UI）
        console.log(`🏆 成就解锁: ${name}`);
    }
    
    saveAchievements() {
        localStorage.setItem('flappyBird_achievements', JSON.stringify(this.achievements));
    }
    
    loadAchievements() {
        const saved = localStorage.getItem('flappyBird_achievements');
        if (saved) {
            const savedAchievements = JSON.parse(saved);
            for (const key in savedAchievements) {
                if (this.achievements[key]) {
                    this.achievements[key].unlocked = savedAchievements[key].unlocked;
                }
            }
        }
    }
    
    updateAchievementsDisplay() {
        for (const [key, achievement] of Object.entries(this.achievements)) {
            const element = document.querySelector(`[data-achievement="${key}"]`);
            if (element) {
                if (achievement.unlocked) {
                    element.classList.add('unlocked');
                } else {
                    element.classList.remove('unlocked');
                }
            }
        }
    }
    
    render() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.gameWidth, this.gameHeight);
        
        // 绘制背景
        this.renderBackground();
        
        // 绘制管道
        this.renderPipes();
        
        // 绘制鸟
        this.renderBird();
        
        // 绘制地面
        this.renderGround();
    }
    
    renderBackground() {
        // 天空渐变
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.background.groundY);
        gradient.addColorStop(0, this.background.color1);
        gradient.addColorStop(1, this.background.color2);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.gameWidth, this.background.groundY);
    }
    
    renderPipes() {
        this.ctx.fillStyle = '#228B22';
        this.ctx.strokeStyle = '#006400';
        this.ctx.lineWidth = 2;
        
        for (const pipe of this.pipes) {
            // 管道主体
            this.ctx.fillRect(pipe.x, pipe.y, pipe.width, pipe.height);
            this.ctx.strokeRect(pipe.x, pipe.y, pipe.width, pipe.height);
            
            // 管道帽子
            const capHeight = 20;
            const capWidth = pipe.width + 6;
            const capX = pipe.x - 3;
            
            if (pipe.type === 'top') {
                this.ctx.fillRect(capX, pipe.y + pipe.height - capHeight, capWidth, capHeight);
                this.ctx.strokeRect(capX, pipe.y + pipe.height - capHeight, capWidth, capHeight);
            } else {
                this.ctx.fillRect(capX, pipe.y, capWidth, capHeight);
                this.ctx.strokeRect(capX, pipe.y, capWidth, capHeight);
            }
        }
    }
    
    renderBird() {
        this.ctx.save();
        
        // 移动到鸟的中心
        this.ctx.translate(this.bird.x + this.bird.width / 2, this.bird.y + this.bird.height / 2);
        
        // 应用旋转
        this.ctx.rotate(this.bird.rotation * Math.PI / 180);
        
        // 绘制鸟身
        this.ctx.fillStyle = this.bird.color;
        this.ctx.strokeStyle = '#FF8C00';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, this.bird.width / 2, this.bird.height / 2, 0, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.stroke();
        
        // 绘制眼睛
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(5, -3, 3, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // 绘制喙
        this.ctx.fillStyle = '#FF4500';
        this.ctx.beginPath();
        this.ctx.moveTo(this.bird.width / 2 - 5, 0);
        this.ctx.lineTo(this.bird.width / 2 + 5, 0);
        this.ctx.lineTo(this.bird.width / 2 - 2, 3);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    renderGround() {
        // 地面
        this.ctx.fillStyle = this.background.groundColor;
        this.ctx.fillRect(0, this.background.groundY, this.gameWidth, this.gameHeight - this.background.groundY);
        
        // 地面装饰
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.background.groundY);
        this.ctx.lineTo(this.gameWidth, this.background.groundY);
        this.ctx.stroke();
    }
    
    updateUI() {
        document.getElementById('currentScore').textContent = this.score;
        document.getElementById('highScore').textContent = this.bestScore;
        document.getElementById('pipesCount').textContent = this.pipesCount;
        
        // 更新难度显示
        const difficultyLevel = Math.floor(this.score / 5);
        const difficultyElement = document.getElementById('difficultyLevel');
        if (difficultyElement) {
            difficultyElement.textContent = difficultyLevel;
        }
    }
    
    playSound(type) {
        if (!this.soundEnabled) return;
        
        // 简单的音效模拟（可以替换为真实音频）
        switch (type) {
            case 'jump':
                console.log('🎵 Jump sound');
                break;
            case 'score':
                console.log('🎵 Score sound');
                break;
            case 'gameOver':
                console.log('🎵 Game over sound');
                break;
            case 'achievement':
                console.log('🎵 Achievement sound');
                break;
            case 'start':
                console.log('🎵 Start sound');
                break;
        }
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
    
    // 发送分数到聊天系统
    async sendToChat() {
        try {
            const button = document.getElementById('sendScoreBtn');
            button.disabled = true;
            button.textContent = '发送中...';
            
            // 计算游戏时长（估算）
            const estimatedPlayTime = Math.max(1, Math.floor(this.score / 2)); // 假设每2分能玩1分钟
            
            // 计算成就数量
            const unlockedAchievements = Object.values(this.achievements).filter(a => a.unlocked).length;
            const totalAchievements = Object.keys(this.achievements).length;
            
            const scoreData = {
                score: this.score,
                best_score: this.bestScore,
                pipes_passed: this.pipesCount,
                play_time_minutes: estimatedPlayTime,
                achievements_count: unlockedAchievements,
                total_achievements: totalAchievements
            };
            
            const response = await fetch('/api/send_game_result', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    game_type: 'flappy_bird',
                    score_data: scoreData
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                button.textContent = '已发送';
                setTimeout(() => {
                    button.textContent = '发送分数';
                    button.disabled = false;
                }, 2000);
            } else {
                throw new Error(result.error || '发送失败');
            }
            
        } catch (error) {
            console.error('发送分数失败:', error);
            const button = document.getElementById('sendScoreBtn');
            button.textContent = '发送失败';
            button.disabled = false;
            setTimeout(() => {
                button.textContent = '发送分数';
            }, 2000);
        }
    }
}

// 关闭游戏窗口函数
function closeGame() {
    if (window.parent && window.parent.closeGameWindow) {
        window.parent.closeGameWindow();
    } else {
        window.close();
    }
}

// 全局发送到聊天函数
function sendToChat() {
    if (game) {
        game.sendToChat();
    }
}

// 初始化游戏
let game;

window.addEventListener('load', () => {
    game = new FlappyBirdGame();
});

// 防止页面滚动
document.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

// 防止双击缩放
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);
