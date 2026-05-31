/**
 * 酒馆角色卡 AI 导入功能模块
 * 负责处理酒馆角色卡图片的 AI 提取、翻译和导入功能
 */

class TavernCardImporter {
    constructor(characterManagement) {
        this.characterManagement = characterManagement;
        this.tavernAIFile = null;
        this.importedCharacterData = null;
        this.init();
    }

    init() {
        this.setupTavernAIEvents();
        this.setupAIProcessModalEvents();
    }

    setupTavernAIEvents() {
        // AI导入酒馆角色卡相关元素
        const selectTavernAIBtn = document.getElementById('select-tavern-ai-btn');
        const tavernAIInput = document.getElementById('tavern-ai-input');
        const tavernAIImportBtn = document.getElementById('tavern-ai-import-btn');

        // 选择文件按钮事件
        if (selectTavernAIBtn && tavernAIInput) {
            selectTavernAIBtn.addEventListener('click', () => {
                tavernAIInput.click();
            });

            tavernAIInput.addEventListener('change', (e) => {
                this.handleTavernAIUpload(e.target.files[0]);
            });
        }

        // AI导入按钮事件
        if (tavernAIImportBtn) {
            tavernAIImportBtn.addEventListener('click', () => {
                this.processTavernAIImport();
            });
        }
    }

    setupAIProcessModalEvents() {
        const aiProcessModal = document.getElementById('ai-post-process-modal');
        const closeAIProcessBtn = document.getElementById('close-ai-process-modal-btn');
        const skipAIProcessBtn = document.getElementById('skip-ai-process-btn');
        const startAIProcessBtn = document.getElementById('start-ai-process-btn');
        const aiInstructionTextarea = document.getElementById('ai-instruction');
        
        // 关闭模态框
        [closeAIProcessBtn, skipAIProcessBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    this.closeAIProcessModal();
                });
            }
        });

        // 点击模态框外部关闭
        if (aiProcessModal) {
            aiProcessModal.addEventListener('click', (e) => {
                if (e.target === aiProcessModal) {
                    this.closeAIProcessModal();
                }
            });
        }

        // 快速指令按钮
        document.querySelectorAll('.quick-instruction-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const instruction = btn.dataset.instruction;
                if (aiInstructionTextarea) {
                    // 如果输入框为空，直接设置；否则追加
                    if (aiInstructionTextarea.value.trim() === '') {
                        aiInstructionTextarea.value = instruction;
                    } else {
                        aiInstructionTextarea.value += '，' + instruction;
                    }
                    aiInstructionTextarea.focus();
                }
            });
        });

        // 开始AI处理
        if (startAIProcessBtn) {
            startAIProcessBtn.addEventListener('click', () => {
                this.startAIPostProcess();
            });
        }
    }

    handleTavernAIUpload(file) {
        if (!file) return;

        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            this.characterManagement.showNotification('请选择图片文件', 'error');
            return;
        }

        // 验证文件格式
        const validFormats = ['image/png', 'image/jpeg', 'image/jpg'];
        if (!validFormats.includes(file.type)) {
            this.characterManagement.showNotification('只支持PNG、JPG、JPEG格式的图片文件', 'error');
            return;
        }

        // 验证文件大小（50MB限制）
        if (file.size > 50 * 1024 * 1024) {
            this.characterManagement.showNotification('图片文件太大，请上传小于50MB的文件', 'error');
            return;
        }

        // 显示预览和文件信息
        this.showTavernAIPreview(file);
        
        // 启用导入按钮
        const tavernAIImportBtn = document.getElementById('tavern-ai-import-btn');
        if (tavernAIImportBtn) {
            tavernAIImportBtn.disabled = false;
        }

        // 保存文件引用
        this.tavernAIFile = file;
    }

    showTavernAIPreview(file) {
        const uploadArea = document.getElementById('tavern-ai-upload-area');
        const preview = document.getElementById('tavern-ai-preview');
        const info = document.getElementById('tavern-ai-info');

        if (!uploadArea || !preview || !info) return;

        // 显示上传区域
        uploadArea.style.display = 'block';

        // 创建图片预览
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `
                <img src="${e.target.result}" alt="角色卡预览" style="max-width: 200px; max-height: 200px; border-radius: 8px; box-shadow: var(--shadow-glow);">
            `;
        };
        reader.readAsDataURL(file);

        // 显示文件信息
        info.innerHTML = `
            <div class="tavern-ai-info">
                <h5><i class="fas fa-info-circle"></i> 文件信息</h5>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">文件名:</span>
                        <span class="info-value">${file.name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">文件大小:</span>
                        <span class="info-value">${this.formatFileSize(file.size)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">文件类型:</span>
                        <span class="info-value">${file.type}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">状态:</span>
                        <span class="info-value ready-status"><i class="fas fa-check-circle"></i> 就绪，可以开始AI导入</span>
                    </div>
                </div>
                <div class="tavern-ai-features">
                    <h6><i class="fas fa-magic"></i> AI导入功能</h6>
                    <ul class="feature-list">
                        <li><i class="fas fa-robot"></i> 智能提取角色数据</li>
                        <li><i class="fas fa-language"></i> 可选中文翻译</li>
                        <li><i class="fas fa-image"></i> 保留原始头像</li>
                        <li><i class="fas fa-cogs"></i> 格式自动转换</li>
                    </ul>
                </div>
            </div>
        `;
    }

    clearTavernAIUpload() {
        const uploadArea = document.getElementById('tavern-ai-upload-area');
        const tavernAIImportBtn = document.getElementById('tavern-ai-import-btn');
        const tavernAIInput = document.getElementById('tavern-ai-input');

        if (uploadArea) uploadArea.style.display = 'none';
        if (tavernAIImportBtn) tavernAIImportBtn.disabled = true;
        if (tavernAIInput) tavernAIInput.value = '';

        this.tavernAIFile = null;
    }

    async processTavernAIImport() {
        if (!this.tavernAIFile) {
            this.characterManagement.showNotification('请先选择角色卡图片', 'error');
            return;
        }

        const tavernAIImportBtn = document.getElementById('tavern-ai-import-btn');
        const originalText = tavernAIImportBtn.innerHTML;

        try {
            // 显示处理状态
            tavernAIImportBtn.disabled = true;
            tavernAIImportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI处理中...';
            
            // 更新状态显示
            this.updateImportStatus('processing');
            
            this.characterManagement.showNotification('AI正在提取和翻译角色数据，请稍候...', 'info');

            // 创建FormData对象
            const formData = new FormData();
            formData.append('image', this.tavernAIFile);

            // 发送到后端API
            const response = await fetch('/api/import-tavern-card', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                // 导入成功
                this.updateImportStatus('success');
                this.characterManagement.showNotification(result.message, 'success');
                
                // 保存导入的角色数据
                this.importedCharacterData = result.character_data;
                
                // 重新加载角色列表
                await this.characterManagement.loadCharacters();
                this.characterManagement.filterAndRenderCharacters();
                
                // 延迟关闭导入模态框，然后显示AI后处理选项
                setTimeout(() => {
                    this.closeImportModal();
                    // 显示AI后处理模态框
                    this.showAIProcessModal();
                    
                    // 导入成功后刷新页面（延迟执行，给用户时间看到结果）
                    setTimeout(() => {
                        this.characterManagement.showNotification('正在刷新页面...', 'info');
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    }, 3000);
                }, 1000);
                
            } else {
                // 导入失败
                this.updateImportStatus('error', result.error);
                this.characterManagement.showNotification(result.error || 'AI导入失败，请重试', 'error');
            }

        } catch (error) {
            console.error('AI导入失败:', error);
            this.updateImportStatus('error', error.message);
            this.characterManagement.showNotification('AI导入过程中发生错误: ' + error.message, 'error');
        } finally {
            // 恢复按钮状态
            tavernAIImportBtn.disabled = false;
            tavernAIImportBtn.innerHTML = originalText;
        }
    }

    updateImportStatus(status, message = '') {
        const info = document.getElementById('tavern-ai-info');
        if (!info) return;

        const statusElement = info.querySelector('.ready-status');
        if (!statusElement) return;

        switch (status) {
            case 'processing':
                statusElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI正在处理...';
                statusElement.className = 'info-value processing-status';
                break;
            case 'success':
                statusElement.innerHTML = '<i class="fas fa-check-circle"></i> 导入成功！';
                statusElement.className = 'info-value success-status';
                break;
            case 'error':
                statusElement.innerHTML = `<i class="fas fa-exclamation-circle"></i> 导入失败: ${message}`;
                statusElement.className = 'info-value error-status';
                break;
            default:
                statusElement.innerHTML = '<i class="fas fa-check-circle"></i> 就绪，可以开始AI导入';
                statusElement.className = 'info-value ready-status';
        }
    }

    closeImportModal() {
        // 调用主导入器的关闭方法
        if (this.characterManagement && this.characterManagement.importer) {
            this.characterManagement.importer.closeImportModal();
        } else {
            // 备用方法：直接关闭模态框
            const importModal = document.getElementById('import-modal');
            if (importModal) {
                importModal.style.display = 'none';
            }
        }
    }

    showAIProcessModal() {
        const modal = document.getElementById('ai-post-process-modal');
        const characterNameElement = document.getElementById('imported-character-name');
        const aiInstructionTextarea = document.getElementById('ai-instruction');
        
        if (!modal) return;

        // 设置角色名称
        if (this.importedCharacterData && characterNameElement) {
            const characterName = this.importedCharacterData['名字'] || this.importedCharacterData.role_name || '新角色';
            characterNameElement.textContent = `角色 "${characterName}" 已成功导入`;
        }

        // 清空之前的AI指令
        if (aiInstructionTextarea) {
            aiInstructionTextarea.value = '';
        }

        // 显示模态框
        modal.style.display = 'block';
        
        // 移动端优化：确保按钮区域可见
        this.ensureMobileButtonsVisible();
        
        // 聚焦到输入框
        setTimeout(() => {
            if (aiInstructionTextarea) {
                aiInstructionTextarea.focus();
            }
        }, 100);
    }
    
    // 确保移动端按钮区域可见
    ensureMobileButtonsVisible() {
        if (window.innerWidth <= 768) {
            const modal = document.getElementById('ai-post-process-modal');
            const modalContent = modal?.querySelector('.ai-process-modal-content');
            const modalActions = modal?.querySelector('.modal-actions');
            
            if (modalContent && modalActions) {
                // 添加移动端特定的样式
                modalContent.style.display = 'flex';
                modalContent.style.flexDirection = 'column';
                modalContent.style.maxHeight = '85vh';
                
                // 确保按钮区域始终可见
                modalActions.style.position = 'sticky';
                modalActions.style.bottom = '0';
                modalActions.style.zIndex = '1000';
                modalActions.style.marginTop = 'auto';
                
                // 监听屏幕旋转
                this.addOrientationChangeListener();
            }
        }
    }
    
    // 添加屏幕旋转监听器
    addOrientationChangeListener() {
        const handleOrientationChange = () => {
            setTimeout(() => {
                this.ensureMobileButtonsVisible();
            }, 100);
        };
        
        if (screen.orientation) {
            screen.orientation.addEventListener('change', handleOrientationChange);
        } else {
            window.addEventListener('orientationchange', handleOrientationChange);
        }
    }

    closeAIProcessModal() {
        const modal = document.getElementById('ai-post-process-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        // 清理数据
        this.importedCharacterData = null;
    }

    async startAIPostProcess() {
        const aiInstructionTextarea = document.getElementById('ai-instruction');
        const startBtn = document.getElementById('start-ai-process-btn');
        
        if (!aiInstructionTextarea || !this.importedCharacterData) return;
        
        const instruction = aiInstructionTextarea.value.trim();
        if (!instruction) {
            this.characterManagement.showNotification('请输入AI处理指令', 'warning');
            aiInstructionTextarea.focus();
            return;
        }

        const originalText = startBtn.innerHTML;
        
        try {
            // 显示处理状态
            startBtn.disabled = true;
            startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI处理中...';
            
            this.characterManagement.showNotification('AI正在处理角色数据...', 'info');

            const characterName = this.importedCharacterData['名字'] || this.importedCharacterData.role_name;
            
            // 发送AI后处理请求
            const response = await fetch('/api/ai-post-process-character', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    character_name: characterName,
                    instruction: instruction,
                    character_data: this.importedCharacterData
                })
            });

            const result = await response.json();

            if (result.success) {
                // AI处理成功
                this.characterManagement.showNotification('AI处理完成！角色数据已优化', 'success');
                
                // 重新加载角色列表以显示更新后的数据
                await this.characterManagement.loadCharacters();
                this.characterManagement.filterAndRenderCharacters();
                
                // 关闭模态框
                this.closeAIProcessModal();
                
                // 显示处理结果详情
                setTimeout(() => {
                    this.characterManagement.showNotification(
                        `✨ 角色 "${characterName}" 已通过AI优化完成！`, 
                        'success'
                    );
                    
                    // AI处理完成后刷新页面
                    setTimeout(() => {
                        this.characterManagement.showNotification('正在刷新页面...', 'info');
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    }, 2000);
                }, 500);
            } else {
                // AI处理失败
                this.characterManagement.showNotification(result.error || 'AI处理失败，请重试', 'error');
            }

        } catch (error) {
            console.error('AI后处理失败:', error);
            this.characterManagement.showNotification('AI处理过程中发生错误: ' + error.message, 'error');
        } finally {
            // 恢复按钮状态
            startBtn.disabled = false;
            startBtn.innerHTML = originalText;
        }
    }

    // 工具方法
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 从图片中提取角色数据的本地方法（备用）
    async extractCharacterFromImage(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // 将字节数组转换为字符串以便搜索base64模式
            const dataStr = Array.from(uint8Array).map(byte => String.fromCharCode(byte)).join('');
            
            // 搜索base64编码的内容
            const base64Pattern = /[A-Za-z0-9+/]{100,}={0,2}/g;
            const matches = dataStr.match(base64Pattern) || [];

            for (const match of matches) {
                try {
                    // 尝试解码base64
                    const decoded = atob(match);
                    
                    // 尝试解析为JSON，使用正确的UTF-8编码处理
                    let jsonData;
                    
                    try {
                        // 使用TextDecoder正确处理UTF-8编码
                        const uint8Array = new Uint8Array(decoded.length);
                        for (let i = 0; i < decoded.length; i++) {
                            uint8Array[i] = decoded.charCodeAt(i) & 0xFF;
                        }
                        const utf8Decoded = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
                        jsonData = JSON.parse(utf8Decoded);
                    } catch (utf8Error) {
                        try {
                            // 备用方法：直接解析
                            jsonData = JSON.parse(decoded);
                        } catch (directError) {
                            // 兼容性方法
                            const utf8Decoded = decodeURIComponent(escape(decoded));
                            jsonData = JSON.parse(utf8Decoded);
                        }
                    }
                    
                    // 验证是否是角色数据
                    if (jsonData && jsonData.data && (jsonData.data.name || jsonData.data.character_name)) {
                        console.log('本地提取到角色数据:', jsonData.data.name || jsonData.data.character_name);
                        return this.convertTavernCharacterData(jsonData);
                    }
                } catch (e) {
                    // 继续尝试下一个匹配
                    continue;
                }
            }
            
            throw new Error('未在图片中找到有效的角色数据');
        } catch (error) {
            console.error('本地提取角色数据失败:', error);
            throw error;
        }
    }

    // 转换酒馆角色卡数据格式
    convertTavernCharacterData(tavernData) {
        const data = tavernData.data || {};
        
        // 清理函数：确保文本正确处理中文字符
        const cleanText = (text) => {
            if (!text) return '';
            
            let cleanedText = String(text);
            
            // 移除控制字符，但保留中文字符
            cleanedText = cleanedText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
            
            // 修复可能的编码问题
            try {
                if (cleanedText.includes('ã') || cleanedText.includes('â') || cleanedText.includes('è')) {
                    const bytes = Array.from(cleanedText).map(char => char.charCodeAt(0));
                    const uint8Array = new Uint8Array(bytes);
                    const decoder = new TextDecoder('utf-8', { fatal: false });
                    const corrected = decoder.decode(uint8Array);
                    
                    if (corrected.length <= cleanedText.length * 1.5) {
                        cleanedText = corrected;
                    }
                }
            } catch (e) {
                console.warn('文本编码修复失败，使用原始文本:', e);
            }
            
            return cleanedText.trim();
        };
        
        // 构建角色介绍
        let intro = '';
        if (data.description) intro += `角色描述：${cleanText(data.description)}\n\n`;
        if (data.personality) intro += `性格特点：${cleanText(data.personality)}\n\n`;
        if (data.scenario) intro += `背景设定：${cleanText(data.scenario)}\n\n`;
        if (data.first_mes) intro += `开场白：${cleanText(data.first_mes)}\n\n`;
        if (data.mes_example) intro += `对话示例：${cleanText(data.mes_example)}\n\n`;

        const characterName = cleanText(data.name || data.character_name || '未知角色');
        
        // 处理标签数组
        const cleanTags = (data.tags || []).map(tag => cleanText(tag)).filter(tag => tag.length > 0);

        const result = {
            名字: characterName,
            介绍: intro.trim(),
            voice_id: cleanText(data.voice_id || ''),
            tags: cleanTags,
            role_name: characterName
        };
        
        console.log('转换后的角色数据:', {
            原始名字: data.name || data.character_name,
            转换后名字: result.名字,
            标签数量: result.tags.length,
            介绍长度: result.介绍.length
        });
        
        return result;
    }
}

// 导出类以供其他模块使用
window.TavernCardImporter = TavernCardImporter;

// 添加专用样式
const tavernCardImporterStyles = `
.tavern-ai-info {
    background: var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    margin-top: 1rem;
}

.tavern-ai-info h5 {
    color: var(--text-gold);
    margin: 0 0 1rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.info-grid {
    display: grid;
    gap: 0.75rem;
    margin-bottom: 1rem;
}

.info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
}

.info-label {
    font-weight: bold;
    color: var(--text-silver);
}

.info-value {
    color: var(--text-color);
}

.ready-status {
    color: var(--text-gold) !important;
}

.processing-status {
    color: #2196F3 !important;
}

.success-status {
    color: #4CAF50 !important;
}

.error-status {
    color: #f44336 !important;
}

.tavern-ai-features {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 1rem;
    margin-top: 1rem;
}

.tavern-ai-features h6 {
    color: var(--text-gold);
    margin: 0 0 0.75rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
}

.feature-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
}

.feature-list li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-silver);
    padding: 0.25rem;
}

.feature-list li i {
    color: var(--text-gold);
    width: 16px;
    text-align: center;
}

#tavern-ai-preview img {
    border: 2px solid var(--border-color);
    transition: border-color 0.3s ease;
}

#tavern-ai-preview img:hover {
    border-color: var(--text-gold);
}

@media (max-width: 768px) {
    .feature-list {
        grid-template-columns: 1fr;
    }
    
    .info-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.25rem;
    }
}

/* AI后处理模态框样式 */
.ai-process-modal-content {
    max-width: 600px;
    width: 90%;
    position: relative;
}

.ai-process-body {
    padding: 1rem 2rem 2rem;
}

.import-success-info {
    text-align: center;
    padding: 2rem 1rem;
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.05) 100%);
    border-radius: 8px;
    margin-bottom: 2rem;
    border: 1px solid rgba(76, 175, 80, 0.3);
}

.success-icon {
    font-size: 3rem;
    color: #4CAF50;
    margin-bottom: 1rem;
}

.import-success-info h4 {
    color: var(--text-gold);
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
}

.import-success-info p {
    color: var(--text-silver);
    margin: 0;
    font-size: 0.95rem;
}

.ai-process-options h5 {
    color: var(--text-gold);
    margin: 0 0 1rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.1rem;
}

.ai-process-description {
    color: var(--text-silver);
    margin-bottom: 1.5rem;
    line-height: 1.6;
}

.ai-instruction-input {
    margin-bottom: 1.5rem;
}

.ai-instruction-input .form-label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-gold);
    font-weight: bold;
}

.ai-instruction-input .form-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--card-bg);
    color: var(--text-color);
    font-family: inherit;
    font-size: 0.9rem;
    line-height: 1.5;
    resize: vertical;
    min-height: 80px;
}

.ai-instruction-input .form-textarea:focus {
    outline: none;
    border-color: var(--text-gold);
    box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.2);
}

.quick-instructions {
    margin-bottom: 2rem;
}

.quick-instructions .form-label {
    display: block;
    margin-bottom: 0.75rem;
    color: var(--text-gold);
    font-weight: bold;
}

.quick-instruction-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
}

.quick-instruction-btn {
    padding: 0.6rem 1rem;
    border: 1px solid var(--border-color);
    background: var(--card-bg);
    color: var(--text-color);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    text-align: left;
    justify-content: flex-start;
}

.quick-instruction-btn:hover {
    border-color: var(--text-gold);
    background: rgba(255, 215, 0, 0.1);
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.quick-instruction-btn i {
    color: var(--text-gold);
    width: 16px;
    text-align: center;
}

@media (max-width: 768px) {
    .ai-process-modal-content {
        width: 95%;
        margin: 1rem;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
    }
    
    .ai-process-body {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
    }
    
    .modal-actions {
        flex-shrink: 0;
        position: sticky;
        bottom: 0;
        background: linear-gradient(135deg, var(--card-bg) 0%, rgba(15, 15, 31, 0.95) 100%);
        border-top: 2px solid var(--border-color);
        margin: 0;
        padding: 1rem;
        gap: 0.75rem;
        box-shadow: 0 -4px 8px rgba(0, 0, 0, 0.3);
    }
    
    .modal-actions .btn {
        flex: 1;
        min-height: 44px;
        font-size: 0.9rem;
        padding: 0.75rem 1rem;
        touch-action: manipulation;
    }
    
    .quick-instruction-buttons {
        grid-template-columns: 1fr;
    }
    
    .import-success-info {
        padding: 1.5rem 1rem;
    }
    
    .success-icon {
        font-size: 2.5rem;
    }
    
    /* 确保按钮区域总是可见 */
    .ai-process-modal-content .modal-header {
        flex-shrink: 0;
    }
    
    /* 添加小屏幕优化 */
    .ai-instruction-input .form-textarea {
        min-height: 60px;
        max-height: 120px;
    }
    
    .quick-instruction-btn {
        padding: 0.6rem 0.8rem;
        font-size: 0.8rem;
        min-height: 40px;
    }
}

@media (max-width: 480px) {
    .ai-process-modal-content {
        width: 98%;
        margin: 0.5rem;
        max-height: 90vh;
    }
    
    .modal-actions {
        padding: 0.75rem;
        gap: 0.5rem;
    }
    
    .modal-actions .btn {
        min-height: 48px;
        font-size: 0.85rem;
    }
    
    .ai-instruction-input .form-textarea {
        min-height: 50px;
        font-size: 0.85rem;
    }
    
    .quick-instruction-btn {
        padding: 0.5rem 0.6rem;
        font-size: 0.75rem;
        min-height: 36px;
    }
    
    .import-success-info {
        padding: 1rem 0.75rem;
    }
    
    .success-icon {
        font-size: 2rem;
    }
}
`;

// 注入样式
const tavernCardImporterStyleElement = document.createElement('style');
tavernCardImporterStyleElement.textContent = tavernCardImporterStyles;
document.head.appendChild(tavernCardImporterStyleElement);
