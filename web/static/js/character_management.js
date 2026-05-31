/**
 * 角色管理系统 JavaScript - 重构版本
 * 提供完整的角色管理功能，包括创建、编辑、删除、搜索、筛选等
 * 重构后的版本消除了重复逻辑，提高了代码的可维护性
 */

class CharacterManagement {
    constructor() {
        this.characters = [];
        this.filteredCharacters = [];
        this.selectedCharacters = new Set();
        this.currentView = 'grid';
        this.currentSort = 'name';
        this.currentFilter = '';
        this.currentTagFilter = '';
        this.searchTerm = '';
        this.currentCharacter = null;
        
        // 清理AI生成器的当前角色信息
        if (this.aiStorybookGenerator) {
            this.aiStorybookGenerator.currentCharacter = null;
        }
        this.storybooks = [];
        this.rawRolesData = {};
        this.allTags = new Set();
        this.currentTags = [];
        this.currentBoundRoles = [];
        this.selectedRolesForBinding = new Set();
        
        // 初始化导入器
        this.importer = null;
        this.descriptionGenerator = null;
        this.aiStorybookGenerator = null;
        
        // 缓存DOM元素
        this.domCache = new Map();
        
        // 模态框配置
        this.modalConfigs = new Map();
        this.setupModalConfigs();
        
        this.init();
    }

    // ========== 工具类方法 - 消除重复逻辑 ==========

    /**
     * 统一的DOM元素获取和缓存
     */
    getElement(id, useCache = true) {
        // 临时禁用缓存进行调试
        if (id === 'character-name') {
            const element = document.getElementById(id);
            console.log(`🔍 [Debug] 获取元素 ${id}:`, element);
            return element;
        }
        
        if (useCache && this.domCache.has(id)) {
            return this.domCache.get(id);
        }
        
        const element = document.getElementById(id);
        if (useCache && element) {
            this.domCache.set(id, element);
        }
        
        return element;
    }

    /**
     * 统一的多元素获取
     */
    getElements(selector) {
        return document.querySelectorAll(selector);
    }

    /**
     * 统一的API调用方法
     */
    async apiCall(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const finalOptions = { ...defaultOptions, ...options };
        
        try {
            const response = await fetch(url, finalOptions);
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: '请求失败' }));
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API调用失败 [${options.method || 'GET'}] ${url}:`, error);
            throw error;
        }
    }

    /**
     * 统一的加载状态管理
     */
    setLoadingState(button, isLoading, loadingText = '处理中...') {
        if (!button) return;
        
        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || button.innerHTML;
        }
    }

    /**
     * 统一的模态框配置
     */
    setupModalConfigs() {
        this.modalConfigs.set('character-modal', {
            modal: 'character-modal',
            closeButtons: ['close-modal-btn', 'cancel-btn'],
            onClose: () => this.closeCharacterModal()
        });
        
        this.modalConfigs.set('character-detail-modal', {
            modal: 'character-detail-modal',
            closeButtons: ['close-detail-modal-btn'],
            onClose: () => this.closeDetailModal()
        });
        
        this.modalConfigs.set('confirm-modal', {
            modal: 'confirm-modal',
            closeButtons: ['close-confirm-modal-btn', 'confirm-cancel-btn'],
            onClose: () => this.closeConfirmModal(),
            specialButtons: {
                'confirm-ok-btn': () => {
                    if (this.confirmCallback) {
                        this.confirmCallback();
                        this.closeConfirmModal();
                    }
                }
            }
        });
        
        this.modalConfigs.set('ai-create-storybook-modal', {
            modal: 'ai-create-storybook-modal',
            closeButtons: ['close-ai-storybook-modal-btn', 'cancel-ai-storybook-btn'],
            onClose: () => this.closeAIStorybookModal(),
            specialButtons: {
                'create-ai-storybook-btn': () => this.createAIStorybook()
            }
        });
    }

    /**
     * 统一的模态框事件绑定
     */
    setupModalEvents() {
        this.modalConfigs.forEach((config, modalId) => {
            const modal = this.getElement(config.modal);
            if (!modal) return;

            // 绑定关闭按钮
            config.closeButtons.forEach(btnId => {
                const btn = this.getElement(btnId);
                if (btn) {
                    btn.addEventListener('click', config.onClose);
                }
            });

            // 绑定特殊按钮
            if (config.specialButtons) {
                Object.entries(config.specialButtons).forEach(([btnId, handler]) => {
                    const btn = this.getElement(btnId);
                    if (btn) {
                        btn.addEventListener('click', handler);
                    }
                });
            }

            // 点击模态框外部关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    config.onClose();
                }
            });
        });

        // 特殊处理：角色表单提交 - 现在直接保存
        const characterForm = this.getElement('character-form');
        if (characterForm) {
            characterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveCharacter();
            });
        }

        // 特殊处理：保存按钮
        const saveOnlyBtn = this.getElement('save-only-btn');
        if (saveOnlyBtn) {
            saveOnlyBtn.addEventListener('click', () => this.saveCharacter());
        }

        // 标签页切换
        this.getElements('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // 详情标签页切换
        this.getElements('.detail-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchDetailTab(e.target.dataset.tab);
            });
        });

        // 头像相关事件
        this.setupAvatarEvents();
        
        // 标签相关事件
        this.setupTagsInput();
        
        // 角色捆绑功能事件
        this.setupRoleBindingEvents();
        
        // 监听角色名称变化
        this.setupNameChangeListener();
    }

    /**
     * 统一的头像事件处理
     */
    setupAvatarEvents() {
        const uploadBtn = this.getElement('upload-avatar-btn');
        const avatarInput = this.getElement('avatar-input');
        const removeBtn = this.getElement('remove-avatar-btn');

        if (uploadBtn && avatarInput) {
            uploadBtn.addEventListener('click', () => avatarInput.click());
            avatarInput.addEventListener('change', (e) => this.handleAvatarUpload(e.target.files[0]));
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.removeAvatar());
        }
    }


    // 旧的数据书事件监听器已移除，现在使用简化的AI生成功能

    /**
     * 统一的数据收集方法
     */
    collectFormData() {
        // 调试：直接查找元素而不使用缓存
        const nameInput = document.getElementById('character-name');
        console.log('🔍 [Debug] 直接查找角色名称输入框:', nameInput);
        console.log('🔍 [Debug] 输入框值:', nameInput?.value);
        
        const formData = {
            名字: nameInput?.value?.trim() || '',
            介绍: this.getElement('character-introduction')?.value?.trim() || this.getElement('character-intro')?.value?.trim() || '',
            开场白: this.getElement('character-greeting')?.value?.trim() || '',
            voice_id: this.getElement('voice-id')?.value?.trim() || '',
            角色类别: this.getElement('character-category')?.value || 'npc',
            tags: [...this.currentTags],
        };

        // 处理自定义字段
        const customFieldsText = this.getElement('custom-fields')?.value?.trim();
        if (customFieldsText) {
            try {
                formData.自定义字段 = JSON.parse(customFieldsText);
            } catch (error) {
                console.warn('自定义字段JSON格式错误:', error);
                formData.自定义字段 = {};
            }
        } else {
            formData.自定义字段 = {};
        }

        // 处理绑定数据书（一对一约束）
        const selectedStorybookRadio = this.getElement('#storybooks-container input[name="character-storybook"]:checked');
        const selectedStorybook = selectedStorybookRadio ? selectedStorybookRadio.value : '';
        formData.绑定数据书 = selectedStorybook ? [selectedStorybook] : [];

        // 处理角色捆绑配置
        const enableRoleBinding = this.getElement('enable-role-binding');
        formData.角色捆绑配置 = {
            enabled: enableRoleBinding ? enableRoleBinding.checked : false,
            boundRoles: [...this.currentBoundRoles]
        };

        // 处理旁白角色特殊配置
        if (formData.角色类别 === 'narrator') {
            const narratorAutoMention = this.getElement('narrator-auto-mention');
            formData.旁白自动提及 = narratorAutoMention ? narratorAutoMention.checked : true;
        }

        return formData;
    }

    /**
     * 统一的数据验证方法
     */
    validateFormData(formData) {
        const errors = [];

        if (!formData.名字) {
            errors.push('请输入角色名称');
        }

        // 检查名称冲突（编辑时如果名字没变则不检查）
        const isNameChanged = this.currentCharacter && this.currentCharacter.name !== formData.名字;
        if (!this.currentCharacter || isNameChanged) {
            if (this.characters.some(c => c.name === formData.名字)) {
                errors.push('角色名称已存在');
            }
        }

        // 验证头像必填（新建角色时）
        if (!this.currentCharacter) {
            const avatarInput = this.getElement('avatar-input');
            if (!avatarInput || !avatarInput.files || !avatarInput.files[0]) {
                errors.push('请上传角色头像');
            }
        }

        return errors;
    }

    /**
     * 统一的通知显示方法
     */
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const iconMap = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${iconMap[type] || iconMap.info}"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // 显示动画
        setTimeout(() => notification.classList.add('show'), 10);

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

    // ========== 原有功能方法 - 保持接口兼容 ==========

    async init() {
        try {
            // 检查基本DOM结构
            const requiredElements = ['characters-grid', 'character-modal', 'character-form'];
            const missingElements = requiredElements.filter(id => !this.getElement(id));
            
            if (missingElements.length > 0) {
                throw new Error(`关键DOM元素缺失: ${missingElements.join(', ')}`);
            }

            // 初始化事件监听器
            this.setupEventListeners();

            // 加载初始数据
            await this.loadCharacters();
            await this.loadStorybooks();

            // 处理URL参数
            this.handleURLParameters();

            // 初始化角色功能模块
            if (window.initCharacterFeatures) {
                this.characterFeatures = window.initCharacterFeatures(this);
            } else if (window.CharacterImporter) {
                // 向后兼容
                this.importer = new window.CharacterImporter(this);
            }

            // 初始化AI数据书生成器
            if (window.AIStorybookGenerator) {
                this.aiStorybookGenerator = new window.AIStorybookGenerator(this);
            }

            // 渲染界面
            this.filterAndRenderCharacters();

            console.log('角色管理系统初始化完成');

            // 触发自定义事件
            const event = new CustomEvent('CharacterManagementReady', {
                detail: { instance: this }
            });
            document.dispatchEvent(event);

        } catch (error) {
            console.error('初始化失败:', error);
            this.showNotification('系统初始化失败: ' + error.message, 'error');
        }
    }

    setupEventListeners() {
        // 创建角色按钮
        const createBtn = this.getElement('create-character-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.openCharacterModal());
        }

        // 导入角色按钮
        const importBtn = this.getElement('import-character-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                if (this.characterFeatures) {
                    this.characterFeatures.openImportModal();
                } else if (this.importer) {
                    // 向后兼容
                    this.importer.openImportModal();
                } else {
                    this.showNotification('导入功能未初始化', 'error');
                }
            });
        }

        // 导出角色按钮
        const exportBtn = this.getElement('export-character-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                if (this.characterFeatures) {
                    this.characterFeatures.openExportModal();
                } else {
                    this.showNotification('导出功能未初始化', 'error');
                }
            });
        }

        // 搜索功能
        const searchInput = this.getElement('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.filterAndRenderCharacters();
            });
        }

        // 筛选功能
        this.setupFilterEvents();

        // 视图切换
        this.getElements('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.closest('.view-btn').dataset.view;
                this.switchView(view);
            });
        });

        // 批量操作
        this.setupBatchOperationEvents();

        // 模态框事件
        this.setupModalEvents();
        
        // 角色类别选择器
        this.setupCategorySelector();
        
        // 角色介绍编辑器
        this.setupIntroductionEditor();
        
        // 捆绑角色功能
        this.setupBoundRoleEvents();
    }

    /**
     * 设置角色介绍编辑器
     */
    setupIntroductionEditor() {
        // 编辑器工具栏按钮事件
        this.getElements('.editor-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const action = btn.dataset.action;
                this.handleEditorAction(action);
            });
        });

        // 角色介绍输入框事件
        const introTextarea = this.getElement('character-introduction');
        if (introTextarea) {
            // 实时字数统计
            introTextarea.addEventListener('input', () => {
                this.updateWordCount();
                this.updatePreview();
            });

            // 键盘快捷键
            introTextarea.addEventListener('keydown', (e) => {
                this.handleEditorShortcuts(e);
            });
        }

        // 开场白输入框事件
        const greetingTextarea = this.getElement('character-greeting');
        if (greetingTextarea) {
            greetingTextarea.addEventListener('input', () => {
                this.updatePreview();
            });
        }

        // 模板按钮事件
        this.getElements('.template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const template = btn.dataset.template;
                this.applyTemplate(template);
            });
        });

        // 初始化字数统计和预览
        this.updateWordCount();
        this.updatePreview();
    }

    /**
     * 处理编辑器操作
     */
    handleEditorAction(action) {
        const textarea = this.getElement('character-introduction');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        let replacement = '';

        switch (action) {
            case 'bold':
                replacement = selectedText ? `**${selectedText}**` : '**粗体文本**';
                break;
            case 'italic':
                replacement = selectedText ? `*${selectedText}*` : '*斜体文本*';
                break;
            case 'underline':
                replacement = selectedText ? `<u>${selectedText}</u>` : '<u>下划线文本</u>';
                break;
            case 'bullet-list':
                replacement = selectedText ? 
                    selectedText.split('\n').map(line => `• ${line}`).join('\n') :
                    '• 列表项目1\n• 列表项目2\n• 列表项目3';
                break;
            case 'number-list':
                replacement = selectedText ? 
                    selectedText.split('\n').map((line, index) => `${index + 1}. ${line}`).join('\n') :
                    '1. 列表项目1\n2. 列表项目2\n3. 列表项目3';
                break;
            case 'clear':
                replacement = selectedText.replace(/\*\*|__|<\/?u>|^\d+\.\s|^•\s/gm, '');
                break;
        }

        if (replacement !== '') {
            this.insertTextAtCursor(textarea, replacement, start, end);
            this.updateWordCount();
            this.updatePreview();
        }
    }

    /**
     * 处理编辑器键盘快捷键
     */
    handleEditorShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'b':
                    e.preventDefault();
                    this.handleEditorAction('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    this.handleEditorAction('italic');
                    break;
                case 'u':
                    e.preventDefault();
                    this.handleEditorAction('underline');
                    break;
            }
        }
    }

    /**
     * 在光标位置插入文本
     */
    insertTextAtCursor(textarea, text, start, end) {
        const beforeText = textarea.value.substring(0, start);
        const afterText = textarea.value.substring(end);
        textarea.value = beforeText + text + afterText;
        
        // 设置新的光标位置
        const newCursorPos = start + text.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
    }

    /**
     * 更新字数统计
     */
    updateWordCount() {
        const textarea = this.getElement('character-introduction');
        const wordCountElement = this.getElement('intro-word-count');
        
        if (textarea && wordCountElement) {
            const text = textarea.value;
            const charCount = text.length;
            const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
            wordCountElement.textContent = `${charCount} 字符 / ${wordCount} 词`;
        }
    }

    /**
     * 更新实时预览
     */
    updatePreview() {
        const introTextarea = this.getElement('character-introduction');
        const greetingTextarea = this.getElement('character-greeting');
        const previewElement = this.getElement('introduction-preview');
        
        if (!previewElement) return;

        const introText = introTextarea ? introTextarea.value.trim() : '';
        const greetingText = greetingTextarea ? greetingTextarea.value.trim() : '';

        if (!introText && !greetingText) {
            previewElement.innerHTML = '<p class="preview-placeholder">在上方输入角色介绍后，这里会显示预览内容</p>';
            return;
        }

        let previewHtml = '';
        
        if (introText) {
            // 简单的markdown-like渲染
            let formattedText = this.escapeHtml(introText);
            formattedText = formattedText
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
                .replace(/^•\s(.+)$/gm, '<li>$1</li>')
                .replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>')
                .replace(/\n/g, '<br>');
            
            // 处理列表
            formattedText = formattedText.replace(/(<li>.*?<\/li>)/g, '<ul>$1</ul>');
            
            previewHtml += `<div class="preview-introduction">
                <h6><i class="fas fa-user-edit"></i> 角色介绍</h6>
                <div class="preview-text">${formattedText}</div>
            </div>`;
        }

        if (greetingText) {
            previewHtml += `<div class="preview-greeting">
                <h6><i class="fas fa-comments"></i> 开场白</h6>
                <div class="preview-text">${this.escapeHtml(greetingText)}</div>
            </div>`;
        }

        previewElement.innerHTML = previewHtml;
    }

    /**
     * 应用角色介绍模板
     */
    async applyTemplate(template) {
        const introTextarea = this.getElement('character-introduction');
        const greetingTextarea = this.getElement('character-greeting');
        
        if (!introTextarea) return;

        let introTemplate = '';
        let greetingTemplate = '';

        switch (template) {
            case 'basic':
                introTemplate = `**基本信息**
• 姓名：[角色姓名]
• 年龄：[角色年龄]
• 性别：[角色性别]
• 职业：[角色职业]

**外貌特征**
• 身高：[身高描述]
• 体型：[体型描述]
• 发色：[发色描述]
• 眼色：[眼色描述]
• 特殊标记：[纹身、伤疤等]

**性格特点**
• 主要性格：[性格描述]
• 兴趣爱好：[爱好列表]
• 行为习惯：[习惯描述]
• 说话风格：[语言特点]

**背景故事**
• 出生地：[出生地描述]
• 成长经历：[成长背景]
• 重要经历：[关键事件]
• 人际关系：[重要关系]`;
                greetingTemplate = '你好！我是[角色名]，很高兴认识你！';
                break;

            case 'fantasy':
                introTemplate = `**角色档案**
• 真名：[角色真名]
• 称号：[角色称号/绰号]
• 种族：[种族设定]
• 职业：[职业/阶级]
• 年龄：[实际年龄/外表年龄]

**外貌描述**
[详细的外貌描述，包括身高、体型、发色、眼色、服装风格等]

**能力设定**
• 主要能力：[魔法/技能描述]
• 武器装备：[武器和装备]
• 特殊天赋：[种族或个人天赋]
• 弱点限制：[能力限制或弱点]

**性格特征**
[性格描述，包括价值观、行为模式、情感倾向等]

**背景故事**
[角色的成长背景、重要经历、目标动机等]

**人际关系**
• 家族：[家族背景]
• 盟友：[重要伙伴]
• 敌人：[主要对手]
• 导师：[重要导师或引路人]`;
                greetingTemplate = '愿星光指引你的道路，旅行者。我是[角色名]，命运让我们在此相遇。';
                break;

            case 'modern':
                introTemplate = `**个人资料**
• 姓名：[姓名]
• 年龄：[年龄]
• 职业：[工作/学业]
• 居住地：[居住城市/区域]
• 联系方式：[电话/邮箱等]

**外貌风格**
• 身材：[身高体重描述]
• 发型：[发型和发色]
• 穿衣风格：[服装偏好]
• 特殊特征：[眼镜、配饰等]

**性格与生活**
• 性格类型：[MBTI或简单描述]
• 兴趣爱好：[现代生活爱好]
• 生活习惯：[日常作息]
• 社交偏好：[社交方式]

**教育与工作**
• 教育背景：[学历专业]
• 工作经历：[职业发展]
• 技能特长：[专业技能]
• 职业目标：[未来规划]

**人际关系**
• 家庭状况：[家庭成员]
• 朋友圈：[社交圈子]
• 恋爱状况：[感情状态]
• 重要关系：[关键人物]`;
                greetingTemplate = '嗨！我是[角色名]，很高兴遇到你！有什么想聊的吗？';
                break;

            case 'historical':
                introTemplate = `**身份背景**
• 姓名：[全名/字号]
• 身份：[社会地位/出身]
• 年代：[具体朝代/年份]
• 籍贯：[出生地/祖籍]
• 家世：[家族背景]

**外貌仪态**
[符合历史时代的外貌描述，包括服饰、仪态、气质等]

**才能学识**
• 文学造诣：[诗词歌赋等]
• 武艺技能：[武功/技艺]
• 学问专长：[学术专业]
• 特殊技能：[其他才能]

**性情品格**
[性格描述，体现时代特色和文化背景]

**生平经历**
[成长经历、重要事件、历史背景等]

**社会关系**
• 师承：[老师/门第]
• 同窗：[同学/好友]
• 政治关系：[朝廷/官场]
• 江湖关系：[武林/民间]`;
                greetingTemplate = '有朋自远方来，不亦乐乎？在下[角色名]，敢问阁下尊姓大名？';
                break;

            case 'ai-generate':
                await this.generateAITemplate();
                return;
        }

        // 应用模板
        if (introTemplate) {
            introTextarea.value = introTemplate;
        }
        if (greetingTemplate && greetingTextarea) {
            greetingTextarea.value = greetingTemplate;
        }

        // 更新统计和预览
        this.updateWordCount();
        this.updatePreview();

        // 聚焦到编辑器
        introTextarea.focus();
        introTextarea.setSelectionRange(0, 0);
    }

    /**
     * AI生成模板
     */
    async generateAITemplate() {
        const characterName = this.getElement('character-name')?.value?.trim() || '角色';
        const characterCategory = this.getElement('character-category')?.value || 'npc';
        
        try {
            this.showNotification('正在生成AI模板...', 'info');
            
            const prompt = `请为一个名为"${characterName}"的${this.getCategoryName(characterCategory)}角色生成详细的介绍模板。
            
要求：
1. 包含完整的角色设定
2. 符合角色类型特点
3. 内容丰富且有创意
4. 使用中文
5. 格式清晰易读

请生成：
- 详细的角色介绍
- 合适的开场白`;

            // 这里应该调用AI API，暂时使用示例
            const response = await this.apiCall('/api/ai/generate-template', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: prompt,
                    character_name: characterName,
                    character_category: characterCategory
                })
            });

            if (response.success) {
                const introTextarea = this.getElement('character-introduction');
                const greetingTextarea = this.getElement('character-greeting');
                
                if (introTextarea && response.data.introduction) {
                    introTextarea.value = response.data.introduction;
                }
                if (greetingTextarea && response.data.greeting) {
                    greetingTextarea.value = response.data.greeting;
                }
                
                this.updateWordCount();
                this.updatePreview();
                
                this.showNotification('AI模板生成成功！', 'success');
            } else {
                throw new Error(response.error || 'AI生成失败');
            }
        } catch (error) {
            console.error('AI模板生成失败:', error);
            this.showNotification('AI模板生成失败: ' + error.message, 'error');
            
            // 如果AI生成失败，使用基础模板作为后备
            this.applyTemplate('basic');
        }
    }

    /**
     * 获取角色类别中文名称
     */
    getCategoryName(category) {
        const categoryNames = {
            'npc': 'NPC',
            'narrator': '旁白',
            'system': '系统'
        };
        return categoryNames[category] || 'NPC';
    }

    setupFilterEvents() {
        // 分类筛选
        const categoryFilter = this.getElement('category-filter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.currentFilter = e.target.value;
                this.filterAndRenderCharacters();
            });
        }

        // 标签筛选
        const tagFilter = this.getElement('tag-filter');
        if (tagFilter) {
            tagFilter.addEventListener('change', (e) => {
                this.currentTagFilter = e.target.value;
                this.filterAndRenderCharacters();
            });
        }

        // 排序
        const sortSelect = this.getElement('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.filterAndRenderCharacters();
            });
        }
    }

    setupBatchOperationEvents() {
        const batchDeleteBtn = this.getElement('batch-delete-btn');
        if (batchDeleteBtn) {
            batchDeleteBtn.addEventListener('click', () => this.batchDeleteCharacters());
        }

        const batchExportBtn = this.getElement('batch-export-btn');
        if (batchExportBtn) {
            batchExportBtn.addEventListener('click', () => this.batchExportCharacters());
        }

        const clearSelectionBtn = this.getElement('clear-selection-btn');
        if (clearSelectionBtn) {
            clearSelectionBtn.addEventListener('click', () => this.clearSelection());
        }
    }

    async loadCharacters() {
        try {
            console.log('📥 [LoadData] 开始加载角色数据...');
            
            const rolesData = await this.apiCall('/api/roles');
            console.log('📦 [LoadData] 服务器返回的原始角色数据:', rolesData);
            
            this.characters = [];
            
            // 处理角色数据
            let roleNames = [];
            if (rolesData.success === false) {
                throw new Error(rolesData.error || '获取角色数据失败');
            }
            
            if (Array.isArray(rolesData)) {
                roleNames = rolesData;
            } else if (typeof rolesData === 'object' && rolesData !== null) {
                roleNames = Object.keys(rolesData);
                this.rawRolesData = rolesData;
            }
            
            // 构建角色数据
            this.buildCharacterData(rolesData, roleNames);
            
            console.log(`📊 [LoadData] 初始化了 ${this.characters.length} 个角色`);
            
            // 加载详细信息
            await this.loadCharacterDetails();
            
            console.log(`✅ [LoadData] 角色详细信息加载完成，最终角色数量: ${this.characters.length}`);
            
            // 收集所有标签
            this.collectAllTags();
            this.updateTagFilter();
            
        } catch (error) {
            console.error('加载角色失败:', error);
            this.showNotification('加载角色列表失败', 'error');
            this.filteredCharacters = [];
            this.renderCharacters();
        }
    }

    buildCharacterData(rolesData, roleNames) {
        if (typeof rolesData === 'object' && rolesData !== null && !Array.isArray(rolesData)) {
            // 如果是对象格式，包含详细数据
            Object.entries(rolesData).forEach(([name, roleData]) => {
                this.characters.push({
                    name: name,
                    category: this.guessCategory(name),
                    type: 'role',
                    intro: roleData.介绍 || '',
                    voice_id: roleData.voice_id || '',
                    tags: roleData.tags || [],
                    custom_fields: roleData.自定义字段 || {},
                    绑定数据书: roleData.绑定数据书 || [],
                    角色捆绑配置: roleData.角色捆绑配置 || { enabled: false, boundRoles: [] },
                    avatar: null,
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                    ...this.getDefaultCharacterData()
                });
            });
        } else {
            // 如果是数组格式，只有名称
            roleNames.forEach(name => {
                this.characters.push({
                    name: name,
                    category: this.guessCategory(name),
                    type: 'role',
                    intro: '',
                    avatar: null,
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                    绑定数据书: [],
                    角色捆绑配置: { enabled: false, boundRoles: [] },
                    ...this.getDefaultCharacterData()
                });
            });
        }
    }

    async loadCharacterDetails() {
        const promises = this.characters.map(async (character) => {
            try {
                let data = null;
                
                if (this.rawRolesData && this.rawRolesData[character.name]) {
                    data = this.rawRolesData[character.name];
                } else {
                    try {
                        data = await this.apiCall(`/api/roles/${encodeURIComponent(character.name)}`);
                    } catch (error) {
                        // API调用失败时不抛出错误，继续处理其他角色
                        console.warn(`加载角色 ${character.name} 详情失败:`, error);
                        return;
                    }
                }
                
                // 更新角色信息
                if (data) {
                    Object.assign(character, {
                        intro: data.介绍 || '',
                        voice_id: data.voice_id || '',
                        custom_fields: data.自定义字段 || {},
                        角色捆绑配置: data.角色捆绑配置 || { enabled: false, boundRoles: [] },
                        tags: data.tags || [],
                        绑定数据书: data.绑定数据书 || [],
                        category: data.角色类别 || data.category || character.category || 'npc',
                        角色类别: data.角色类别 || data.category || character.角色类别 || 'npc',
                        旁白自动提及: data.旁白自动提及
                    });
                    
                    console.log(`🔄 [LoadDetails] 角色 "${character.name}" 类别更新为: "${character.category}"`);
                }
            } catch (error) {
                console.error(`加载角色 ${character.name} 详情失败:`, error);
            }
        });

        await Promise.all(promises);
    }

    async loadStorybooks() {
        try {
            const data = await this.apiCall('/api/storybooks');
            if (data.success && data.storybooks) {
                this.storybooks = data.storybooks.map(item => item.name);
            } else {
                this.storybooks = [];
            }
        } catch (error) {
            console.error('加载数据书列表失败:', error);
            this.storybooks = [];
        }
    }

    // ========== 保存相关方法 - 重构后的版本 ==========

    async saveCharacter() {
        try {
            const formData = this.collectFormData();
            
            // 添加调试信息
            console.log('🔍 [Debug] 收集到的表单数据:', formData);
            console.log('🔍 [Debug] 角色名称输入框:', this.getElement('character-name'));
            console.log('🔍 [Debug] 角色名称值:', this.getElement('character-name')?.value);
            
            // 验证数据
            const errors = this.validateFormData(formData);
            if (errors.length > 0) {
                this.showNotification(errors[0], 'error');
                return;
            }
            
            const saveBtn = this.getElement('save-only-btn');
            this.setLoadingState(saveBtn, true, '正在保存...');
            
            const isEdit = !!this.currentCharacter;
            const endpoint = isEdit ? 
                `/api/roles/${encodeURIComponent(this.currentCharacter.name)}` : 
                '/api/roles';
            
            const method = isEdit ? 'PUT' : 'POST';
            
            console.log(`🚀 [API] 准备发送${isEdit ? '更新' : '创建'}角色请求`);
            
            await this.apiCall(endpoint, {
                method: method,
                body: JSON.stringify(formData)
            });
            
            console.log(`✅ [API] 角色保存成功`);
            
            // 处理头像上传
            await this.uploadAvatar(formData.名字);
            
            // 重新加载数据
            await this.loadCharacters();
            this.filterAndRenderCharacters();
            
            this.closeCharacterModal();
            this.showNotification(`角色"${formData.名字}"保存成功`, 'success');
            
            // 检查是否需要显示数据书创建建议
            this.checkStorybookSuggestion(formData, isEdit);
            
        } catch (error) {
            console.error('保存角色失败:', error);
            this.showNotification('保存失败: ' + error.message, 'error');
        } finally {
            const saveBtn = this.getElement('save-only-btn');
            this.setLoadingState(saveBtn, false);
        }
    }

    /**
     * 检查是否需要创建数据书
     */
    async checkStorybookSuggestion(formData, isEdit) {
        // 如果是编辑模式，不处理数据书创建
        if (isEdit) {
            return;
        }
        
        // 只有NPC角色才需要创建数据书
        const category = formData.角色类别;
        if (category !== 'npc') {
            console.log(`角色类别为 ${category}，跳过数据书创建`);
            return;
        }
        
        // 如果角色已经绑定了数据书，不创建新的
        const boundStorybooks = formData.绑定数据书 || [];
        if (boundStorybooks.length > 0) {
            console.log('角色已绑定数据书，跳过创建');
            return;
        }
        
        // 检查是否有NPC描述输入
        const npcDescriptionInput = this.getElement('npc-description-input');
        const description = npcDescriptionInput?.value?.trim();
        
        if (description) {
            // 有描述，直接创建数据书
            const enableEvents = this.getElement('enable-events-npc')?.checked || false;
            await this.createStorybookFromDescription(formData.名字, description, enableEvents);
        }
    }

    /**
     * 根据描述创建数据书
     */
    async createStorybookFromDescription(characterName, description, enableEvents) {
        if (this.characterFeatures) {
            return await this.characterFeatures.createStorybookFromDescription(characterName, description, enableEvents);
        } else {
            // 向后兼容的原始实现
            try {
                this.showNotification('正在为角色生成数据书...', 'info');
                
                const response = await this.apiCall('/api/storybook/generate-from-description', {
                    method: 'POST',
                    body: JSON.stringify({
                        character_name: characterName,
                        description: description,
                    enable_events: enableEvents
                })
            });

            if (response.success) {
                this.showNotification(`角色"${characterName}"的数据书已生成完成`, 'success');
                
                // 刷新角色列表以显示新绑定的数据书
                await this.loadCharacters();
                this.filterAndRenderCharacters();
            } else {
                this.showNotification(response.error || 'AI生成数据书失败', 'error');
            }
            } catch (error) {
                console.error('生成数据书失败:', error);
                this.showNotification('生成数据书失败: ' + error.message, 'error');
            }
        }
    }

    /**
     * 显示AI创建数据书的模态框
     */
    showAIStorybookCreationModal(characterName) {
        if (this.characterFeatures) {
            this.characterFeatures.showAICreationOptionsModal(characterName);
        } else {
            // 向后兼容的原始实现
            const modal = this.getElement('ai-creation-options-modal');
            if (!modal) {
                console.error('AI创建选项模态框未找到');
                return;
            }

            // 设置角色名称
            const createdCharacterNameEl = this.getElement('created-character-name');
            if (createdCharacterNameEl) {
                createdCharacterNameEl.textContent = `角色 "${characterName}" 已成功保存`;
            }

            // 显示模态框
            modal.style.display = 'flex';
            
            // 绑定事件（如果还没有绑定）
            this.setupAICreationModalEvents();
        }
    }

    /**
     * 设置AI创建模态框的事件
     */
    setupAICreationModalEvents() {
        // 跳过AI创建按钮
        const skipBtn = this.getElement('skip-ai-creation-btn');
        if (skipBtn && !skipBtn.dataset.eventsBound) {
            skipBtn.addEventListener('click', () => {
                this.closeModal('ai-creation-options-modal');
            });
            skipBtn.dataset.eventsBound = 'true';
        }

        // 开始AI创建按钮
        const proceedBtn = this.getElement('proceed-ai-creation-btn');
        if (proceedBtn && !proceedBtn.dataset.eventsBound) {
            proceedBtn.addEventListener('click', () => {
                this.startAIStorybookCreation();
            });
            proceedBtn.dataset.eventsBound = 'true';
        }

        // 关闭按钮
        const closeBtn = this.getElement('close-ai-options-modal-btn');
        if (closeBtn && !closeBtn.dataset.eventsBound) {
            closeBtn.addEventListener('click', () => {
                this.closeModal('ai-creation-options-modal');
            });
            closeBtn.dataset.eventsBound = 'true';
        }
    }

    /**
     * 开始AI创建数据书
     */
    startAIStorybookCreation() {
        // 获取当前角色名称
        const createdCharacterNameEl = this.getElement('created-character-name');
        const characterName = createdCharacterNameEl?.textContent?.match(/"(.+?)"/)?.[1];
        
        if (!characterName) {
            this.showNotification('无法获取角色名称', 'error');
            return;
        }

        // 获取附加说明
        const additionalInstructions = this.getElement('additional-instructions')?.value || '';
        const enableEvents = this.getElement('enable-events-checkbox')?.checked || false;

        // 关闭当前模态框
        this.closeModal('ai-creation-options-modal');

        // 显示AI创建数据书模态框
        if (this.characterFeatures) {
            this.characterFeatures.showAIStorybookModal(characterName, {
                additionalInstructions,
                enableEvents
            });
        } else {
            this.showAICreateStorybookModal(characterName, {
                additionalInstructions,
                enableEvents
            });
        }
    }

    /**
     * 显示数据书创建建议模态框
     */
    showStorybookSuggestion(characterName) {
        // 创建模态框HTML（如果不存在）
        this.createStorybookSuggestionModal();
        
        // 设置角色名称
        const modal = this.getElement('storybook-suggestion-modal');
        const messageEl = modal?.querySelector('.suggestion-message');
        
        if (messageEl) {
            messageEl.innerHTML = `
                <i class="fas fa-lightbulb text-warning"></i>
                检测到您创建了角色"<strong>${this.escapeHtml(characterName)}</strong>"，建议为此角色创建数据书来丰富角色的背景信息、外观描述、性格特点等内容。
            `;
        }
        
        // 显示模态框
        if (modal) {
            modal.style.display = 'block';
        }
    }

    /**
     * 创建数据书建议模态框（如果不存在）
     */
    createStorybookSuggestionModal() {
        if (this.getElement('storybook-suggestion-modal')) {
            return; // 已存在
        }
        
        const modalHTML = `
            <div id="storybook-suggestion-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-book"></i>
                            创建数据书
                        </h3>
                        <button class="close-btn" id="close-storybook-suggestion-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="suggestion-content">
                            <p class="suggestion-message">
                                <!-- 内容将动态填充 -->
                            </p>
                            <div class="suggestion-benefits">
                                <h4>数据书的好处：</h4>
                                <ul>
                                    <li><i class="fas fa-check" style="color: #28a745; margin-right: 8px;"></i> 提供详细的角色背景和设定</li>
                                    <li><i class="fas fa-check" style="color: #28a745; margin-right: 8px;"></i> 增强对话的一致性和深度</li>
                                    <li><i class="fas fa-check" style="color: #28a745; margin-right: 8px;"></i> 支持动态内容管理</li>
                                    <li><i class="fas fa-check" style="color: #28a745; margin-right: 8px;"></i> 便于后续角色发展</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" id="skip-storybook-btn">
                            <i class="fas fa-times"></i>
                            暂不创建
                        </button>
                        <button type="button" class="btn btn-primary" id="goto-storybook-btn">
                            <i class="fas fa-external-link-alt"></i>
                            前往数据书管理
                        </button>
                    </div>
                </div>
            </div>
            <style>
                .suggestion-content {
                    padding: 1rem 0;
                }
                .suggestion-message {
                    background: #fff3cd;
                    border: 1px solid #ffeaa7;
                    border-radius: 8px;
                    padding: 1rem;
                    margin-bottom: 1.5rem;
                    color: #856404;
                    line-height: 1.5;
                }
                .suggestion-message i.fa-lightbulb {
                    color: #ffc107;
                    margin-right: 8px;
                    font-size: 1.2em;
                }
                .suggestion-benefits h4 {
                    color: var(--text-gold, #d4af37);
                    margin-bottom: 1rem;
                    font-size: 1.1em;
                }
                .suggestion-benefits ul {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                .suggestion-benefits li {
                    padding: 0.5rem 0;
                    display: flex;
                    align-items: center;
                    color: var(--text-color, #fff);
                }
            </style>
        `;
        
        // 添加到页面
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 绑定事件
        this.setupStorybookSuggestionEvents();
    }

    /**
     * 设置数据书建议模态框事件
     */
    setupStorybookSuggestionEvents() {
        const modal = this.getElement('storybook-suggestion-modal');
        const closeBtn = this.getElement('close-storybook-suggestion-btn');
        const skipBtn = this.getElement('skip-storybook-btn');
        const gotoBtn = this.getElement('goto-storybook-btn');
        
        // 关闭按钮
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeStorybookSuggestion();
            });
        }
        
        // 跳过按钮
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                this.closeStorybookSuggestion();
            });
        }
        
        // 前往数据书管理按钮
        if (gotoBtn) {
            gotoBtn.addEventListener('click', () => {
                this.closeStorybookSuggestion();
                // 打开数据书管理页面
                window.open('/storybook', '_blank');
            });
        }
        
        // 点击模态框外部关闭
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeStorybookSuggestion();
                }
            });
        }
    }

    /**
     * 关闭数据书建议模态框
     */
    closeStorybookSuggestion() {
        const modal = this.getElement('storybook-suggestion-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }


    // ========== 工具方法 ==========

    guessCategory(name) {
        const narratorKeywords = ['旁白', '叙述', '系统'];
        const systemKeywords = ['系统', 'system'];
        const npcKeywords = ['NPC', '角色'];

        const lowerName = name.toLowerCase();
        
        if (systemKeywords.some(keyword => lowerName.includes(keyword))) {
            return 'system';
        }
        if (narratorKeywords.some(keyword => lowerName.includes(keyword))) {
            return 'narrator';
        }
        if (npcKeywords.some(keyword => lowerName.includes(keyword))) {
            return 'npc';
        }
        
        return 'npc'; // 默认为NPC
    }

    getDefaultCharacterData() {
        return {
            custom_fields: {}
        };
    }

    getCategoryText(category) {
        const categoryMap = {
            'npc': 'NPC角色',
            'narrator': '旁白角色',
            'system': '系统角色'
        };
        return categoryMap[category] || 'NPC角色';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== 角色类别管理 - 重构后的版本 ==========

    /**
     * 设置新的角色类别选择器
     */
    setupCategorySelector() {
        const categoryOptions = this.getElements('.category-option');
        const hiddenSelect = this.getElement('character-category');
        
        if (categoryOptions.length === 0 || !hiddenSelect) {
            console.warn('角色类别选择器元素未找到');
            return;
        }

        // 为每个类别选项添加点击事件
        categoryOptions.forEach(option => {
            option.addEventListener('click', () => {
                const category = option.dataset.category;
                this.selectCategory(category);
            });
        });

        // 初始化默认选中状态
        this.selectCategory('npc');
    }

    /**
     * 选择角色类别
     */
    selectCategory(category) {
        console.log(`🎭 [Category] 选择角色类别: "${category}"`);
        
        // 更新视觉状态
        const categoryOptions = this.getElements('.category-option');
        let foundOption = false;
        categoryOptions.forEach(option => {
            option.classList.remove('active');
            if (option.dataset.category === category) {
                option.classList.add('active');
                foundOption = true;
            }
        });
        
        if (!foundOption) {
            console.warn(`⚠️ [Category] 未找到类别选项: "${category}"`);
        }

        // 更新隐藏的select值
        const hiddenSelect = this.getElement('character-category');
        if (hiddenSelect) {
            const oldValue = hiddenSelect.value;
            hiddenSelect.value = category;
            console.log(`🔄 [Category] 隐藏select值更新: "${oldValue}" -> "${category}"`);
            
            // 触发change事件以保持兼容性
            const changeEvent = new Event('change', { bubbles: true });
            hiddenSelect.dispatchEvent(changeEvent);
        } else {
            console.error(`❌ [Category] 隐藏的select元素未找到！`);
        }

        // 处理类别变化的逻辑
        this.handleCategoryChange(category);
    }

    /**
     * 处理角色类别变化
     */
    handleCategoryChange(category) {
        // 获取相关元素
        const narratorConfig = this.getElement('narrator-config');
        const characterIntroGroup = this.getElement('character-intro-group');
        const npcStorybookInfo = this.getElement('npc-storybook-info');
        const roleBindingTab = document.querySelector('.tab-btn[data-tab="role-binding"]');
        const introductionTab = document.querySelector('.tab-btn[data-tab="introduction"]');
        const storybookTab = document.querySelector('.tab-btn[data-tab="storybook"]');
        
        if (category === 'narrator') {
            // 旁白角色：显示旁白配置、简介、启用角色捆绑功能
            if (narratorConfig) {
                narratorConfig.style.display = 'block';
            }
            if (characterIntroGroup) {
                characterIntroGroup.style.display = 'block';
            }
            if (npcStorybookInfo) {
                npcStorybookInfo.style.display = 'none';
            }
            
            // 显示相关标签页
            if (roleBindingTab) {
                roleBindingTab.style.display = 'block';
            }
            if (introductionTab) {
                introductionTab.style.display = 'block';
            }
            if (storybookTab) {
                storybookTab.style.display = 'none';
            }
            
            this.enableRoleBindingFeature(true);
            this.showCategoryInfo('narrator');
        } else {
            // NPC角色：隐藏旁白配置和简介，显示AI生成数据书提示，禁用角色捆绑功能
            if (narratorConfig) {
                narratorConfig.style.display = 'none';
            }
            if (characterIntroGroup) {
                characterIntroGroup.style.display = 'none';
            }
            if (npcStorybookInfo) {
                npcStorybookInfo.style.display = 'block';
            }
            
            // 隐藏角色捆绑和简介标签页，显示数据书标签页
            if (roleBindingTab) {
                roleBindingTab.style.display = 'none';
            }
            if (introductionTab) {
                introductionTab.style.display = 'none';
            }
            if (storybookTab) {
                storybookTab.style.display = 'block';
            }
            
            this.enableRoleBindingFeature(false);
            this.showCategoryInfo('npc');
        }

        // 数据书标签页已简化，不需要动态更新状态
        
        // 更新保存按钮文本
        this.updateSaveButtonText();

        console.log(`角色类别已切换到: ${category}`);
    }

    /**
     * 更新保存按钮文本
     */
    updateSaveButtonText() {
        const saveBtn = this.getElement('save-only-btn');
        if (!saveBtn) return;

        const categorySelect = this.getElement('character-category');
        const currentCategory = categorySelect?.value || 'npc';
        const isEdit = !!this.currentCharacter;

        if (isEdit) {
            // 编辑模式，保持原有文本
            saveBtn.innerHTML = '<i class="fas fa-save"></i> 保存角色';
        } else {
            // 创建模式
            if (currentCategory === 'npc') {
                // NPC角色：检查是否有描述输入
                const npcDescriptionInput = this.getElement('npc-description-input');
                const hasDescription = npcDescriptionInput?.value?.trim();
                
                if (hasDescription) {
                    saveBtn.innerHTML = '<i class="fas fa-magic"></i> 保存角色并生成数据书';
                } else {
                    saveBtn.innerHTML = '<i class="fas fa-save"></i> 保存角色';
                }
            } else {
                // 旁白角色
                saveBtn.innerHTML = '<i class="fas fa-save"></i> 保存角色';
            }
        }
    }

    /**
     * 启用或禁用角色捆绑功能
     */
    enableRoleBindingFeature(enabled) {
        const roleBindingTab = document.querySelector('.tab-btn[data-tab="role-binding"]');
        const roleBindingContent = document.querySelector('.tab-content[data-tab="role-binding"]');
        
        if (roleBindingTab && roleBindingContent) {
            if (enabled) {
                roleBindingTab.style.display = 'block';
                roleBindingTab.disabled = false;
                roleBindingTab.classList.remove('disabled');
            } else {
                roleBindingTab.style.display = 'none';
                roleBindingTab.disabled = true;
                roleBindingTab.classList.add('disabled');
                
                // 如果当前在角色捆绑标签页，切换到基本信息
                if (roleBindingTab.classList.contains('active')) {
                    this.switchTab('basic');
                }
                
                // 重置角色捆绑配置
                this.resetRoleBindingConfig();
            }
        }
    }

    /**
     * 重置角色捆绑配置
     */
    resetRoleBindingConfig() {
        const enableRoleBinding = this.getElement('enable-role-binding');
        const roleBindingConfig = this.getElement('role-binding-config');
        
        if (enableRoleBinding) {
            enableRoleBinding.checked = false;
        }
        
        if (roleBindingConfig) {
            roleBindingConfig.style.display = 'none';
        }
        
        // 清空当前捆绑角色
        this.currentBoundRoles = [];
        this.renderSelectedBoundRoles();
    }

    /**
     * 显示类别相关信息
     */
    showCategoryInfo(category) {
        switch (category) {
            case 'narrator':
                console.log('🎭 旁白角色：多人对话协调器，通过简介和角色捆绑实现群聊');
                break;
            case 'npc':
            default:
                console.log('👤 NPC角色：使用AI生成数据书的智能角色，支持复杂对话交互');
                break;
        }
    }

    // ========== 角色渲染和筛选 - 核心功能实现 ==========

    filterAndRenderCharacters() {
        this.filteredCharacters = this.characters.filter(character => {
            // 搜索过滤
            const matchesSearch = !this.searchTerm || 
                character.name.toLowerCase().includes(this.searchTerm) ||
                character.intro.toLowerCase().includes(this.searchTerm) ||
                (character.tags && character.tags.some(tag => 
                    tag.toLowerCase().includes(this.searchTerm)
                ));
            
            // 分类过滤
            const matchesFilter = !this.currentFilter || character.category === this.currentFilter;
            
            // 标签过滤
            const matchesTag = !this.currentTagFilter || 
                (character.tags && character.tags.includes(this.currentTagFilter));
            
            return matchesSearch && matchesFilter && matchesTag;
        });

        // 排序
        this.sortCharacters();
        
        // 渲染
        this.renderCharacters();
    }

    sortCharacters() {
        this.filteredCharacters.sort((a, b) => {
            switch (this.currentSort) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'created':
                    return new Date(b.created) - new Date(a.created);
                case 'modified':
                    return new Date(b.modified) - new Date(a.modified);
                case 'category':
                    return a.category.localeCompare(b.category);
                default:
                    return 0;
            }
        });
    }

    renderCharacters() {
        const container = this.getElement('characters-grid');
        if (!container) {
            console.error('找不到角色网格容器');
            return;
        }
        
        if (this.filteredCharacters.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>暂无角色</h3>
                    <p>点击"创建新角色"按钮开始创建您的第一个角色</p>
                </div>
            `;
            return;
        }

        const charactersHTML = this.filteredCharacters.map(character => 
            this.createCharacterCard(character)
        ).join('');

        container.innerHTML = charactersHTML;
        container.className = `characters-grid ${this.currentView === 'list' ? 'list-view' : ''}`;

        // 添加事件监听器
        this.addCharacterCardEvents();
    }

    createCharacterCard(character) {
        // 角色头像路径
        const avatarSrc = `/api/roles/${encodeURIComponent(character.name)}/avatar`;
        
        const isSelected = this.selectedCharacters.has(character.name);
        
        return `
            <div class="character-card ${this.currentView === 'list' ? 'list-view' : ''} ${isSelected ? 'selected' : ''}" 
                 data-character="${character.name}">
                <input type="checkbox" class="card-checkbox" ${isSelected ? 'checked' : ''}>
                
                <div class="card-header">
                    <div class="character-avatar-container">
                        <img class="character-avatar clickable-avatar" src="${avatarSrc}" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" 
                             alt="角色头像"
                             data-character-name="${this.escapeHtml(character.name)}"
                             data-character-type="${character.type}">
                        <div class="default-avatar clickable-avatar" style="display: none;"
                             data-character-name="${this.escapeHtml(character.name)}"
                             data-character-type="${character.type}">
                            <i class="fas fa-user-circle"></i>
                        </div>
                    </div>
                    
                    <div class="character-info">
                        <h3 class="character-name">${this.escapeHtml(character.name)}</h3>
                        <span class="character-category ${character.category}">${this.getCategoryText(character.category)}</span>
                    </div>
                    
                    <div class="card-actions">
                        <button class="card-action-btn edit-btn" title="编辑">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="card-action-btn use-btn" title="使用角色">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="card-action-btn delete-btn" title="删除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="card-body">
                    <div class="character-intro">
                        ${this.escapeHtml(character.intro || '暂无介绍')}
                    </div>
                    
                    <div class="character-meta">
                        <div class="meta-item">
                            <i class="fas fa-book"></i>
                            <span>数据书: ${(character.绑定数据书 && character.绑定数据书.length) || 0}</span>
                        </div>
                        
                        <div class="meta-item">
                            <i class="fas fa-tags"></i>
                            <span>标签: ${(character.tags && character.tags.length) || 0}</span>
                        </div>
                    </div>
                    
                    ${character.tags && character.tags.length > 0 ? `
                        <div class="character-tags">
                            ${character.tags.slice(0, 3).map(tag => 
                                `<span class="tag">${this.escapeHtml(tag)}</span>`
                            ).join('')}
                            ${character.tags.length > 3 ? `<span class="tag-more">+${character.tags.length - 3}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    addCharacterCardEvents() {
        // 头像点击事件 - 显示详情
        this.getElements('.clickable-avatar').forEach(avatar => {
            avatar.addEventListener('click', (e) => {
                const characterName = e.target.getAttribute('data-character-name');
                if (characterName) {
                    this.showCharacterDetail(characterName);
                }
            });
        });

        // 编辑按钮事件
        this.getElements('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = e.target.closest('.character-card');
                const characterName = card.getAttribute('data-character');
                this.editCharacter(characterName);
            });
        });

        // 使用按钮事件
        this.getElements('.use-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = e.target.closest('.character-card');
                const characterName = card.getAttribute('data-character');
                this.useCharacterByName(characterName);
            });
        });

        // 删除按钮事件
        this.getElements('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = e.target.closest('.character-card');
                const characterName = card.getAttribute('data-character');
                this.deleteCharacterByName(characterName);
            });
        });

        // 复选框事件
        this.getElements('.card-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const card = e.target.closest('.character-card');
                const characterName = card.getAttribute('data-character');
                
                if (e.target.checked) {
                    this.selectedCharacters.add(characterName);
                    card.classList.add('selected');
                } else {
                    this.selectedCharacters.delete(characterName);
                    card.classList.remove('selected');
                }
                
                this.updateBatchOperationButtons();
            });
        });

        // 卡片点击事件（选择/取消选择）
        this.getElements('.character-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // 如果点击的是按钮或头像，不处理卡片点击
                if (e.target.closest('.card-action-btn, .clickable-avatar')) {
                    return;
                }
                
                const checkbox = card.querySelector('.card-checkbox');
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            });
        });
    }

    switchView(view) {
        this.currentView = view;
        
        // 更新视图按钮状态
        this.getElements('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // 重新渲染
        this.renderCharacters();
    }

    collectAllTags() {
        this.allTags.clear();
        this.characters.forEach(character => {
            if (character.tags && Array.isArray(character.tags)) {
                character.tags.forEach(tag => this.allTags.add(tag));
            }
        });
    }

    updateTagFilter() {
        const tagFilter = this.getElement('tag-filter');
        if (!tagFilter) return;

        const currentValue = tagFilter.value;
        const tags = Array.from(this.allTags).sort();
        
        tagFilter.innerHTML = '<option value="">全部标签</option>' +
            tags.map(tag => `<option value="${tag}">${tag}</option>`).join('');
        
        if (tags.includes(currentValue)) {
            tagFilter.value = currentValue;
        }
    }

    // ========== 辅助方法 ==========

    updateBatchOperationButtons() {
        const hasSelection = this.selectedCharacters.size > 0;
        
        const batchDeleteBtn = this.getElement('batch-delete-btn');
        const batchExportBtn = this.getElement('batch-export-btn');
        const clearSelectionBtn = this.getElement('clear-selection-btn');
        
        if (batchDeleteBtn) batchDeleteBtn.disabled = !hasSelection;
        if (batchExportBtn) batchExportBtn.disabled = !hasSelection;
        if (clearSelectionBtn) clearSelectionBtn.style.display = hasSelection ? 'inline-block' : 'none';
    }

    // ========== 模态框相关方法 - 完整实现 ==========

    async openCharacterModal(character = null) {
        this.currentCharacter = character;
        
        // 更新AI生成器的当前角色信息
        if (this.aiStorybookGenerator) {
            this.aiStorybookGenerator.currentCharacter = character;
        }
        
        if (character) {
            // 编辑模式
            await this.populateCharacterForm(character);
        } else {
            // 创建模式
            this.resetCharacterForm();
        }
        
        // 设置数据书复选框
        this.setupStorybooksCheckboxes();
        
        // 确保基本信息标签页激活
        this.switchTab('basic');
        
        // 更新保存按钮文本
        this.updateSaveButtonText();
        
        const modal = this.getElement('character-modal');
        if (modal) {
            modal.style.display = 'block';
        }
        
        // 聚焦到角色名称输入框
        setTimeout(() => {
            const nameInput = this.getElement('character-name');
            if (nameInput) {
                nameInput.focus();
            }
        }, 100);
    }

    async populateCharacterForm(character) {
        console.log('正在填充角色表单数据:', character);
        
        const nameInput = this.getElement('character-name');
        if (nameInput) nameInput.value = character.name || '';
        
        // 设置类别选择器
        const category = character.category || character.角色类别 || 'npc';
        console.log(`📋 [Populate] 角色数据中的类别信息:`, {
            'character.category': character.category,
            'character.角色类别': character.角色类别,
            '最终使用类别': category
        });
        this.selectCategory(category);
        
        // 填充角色介绍相关字段
        const introInput = this.getElement('character-intro');
        if (introInput) introInput.value = character.intro || character.介绍 || '';
        
        const introductionInput = this.getElement('character-introduction');
        if (introductionInput) introductionInput.value = character.介绍 || character.intro || '';
        
        const greetingInput = this.getElement('character-greeting');
        if (greetingInput) greetingInput.value = character.开场白 || '';
        
        const voiceInput = this.getElement('voice-id');
        if (voiceInput) voiceInput.value = character.voice_id || '';
        
        // 处理自定义字段
        const customFields = character.自定义字段 || character.custom_fields || {};
        const customFieldsInput = this.getElement('custom-fields');
        if (customFieldsInput) {
            if (Object.keys(customFields).length > 0) {
                customFieldsInput.value = JSON.stringify(customFields, null, 2);
            } else {
                customFieldsInput.value = '';
            }
        }
        
        // 设置头像预览
        this.updateAvatarPreview(character.name);
        
        // 设置标签
        this.currentTags = character.tags ? [...character.tags] : [];
        this.renderTags();
        
        
        // 设置角色捆绑配置
        const roleBindingConfig = character.角色捆绑配置 || { enabled: false, boundRoles: [] };
        
        const enableRoleBindingEl = this.getElement('enable-role-binding');
        const roleBindingConfigEl = this.getElement('role-binding-config');
        
        if (enableRoleBindingEl) {
            enableRoleBindingEl.checked = roleBindingConfig.enabled;
            this.currentBoundRoles = roleBindingConfig.boundRoles ? [...roleBindingConfig.boundRoles] : [];
            
            // 显示/隐藏捆绑配置区域
            if (roleBindingConfigEl) {
                roleBindingConfigEl.style.display = roleBindingConfig.enabled ? 'block' : 'none';
            }
            
            // 渲染已选择的捆绑角色
            this.renderSelectedBoundRoles();
        }

        // 填充旁白角色特殊配置
        if (character.角色类别 === 'narrator') {
            const narratorAutoMention = this.getElement('narrator-auto-mention');
            if (narratorAutoMention) {
                narratorAutoMention.checked = character.旁白自动提及 !== false;
            }
        }
        
        console.log('角色表单数据填充完成');
    }

    resetCharacterForm() {
        const form = this.getElement('character-form');
        if (form) form.reset();
        
        this.switchTab('basic');
        this.resetAvatarPreview();
        
        // 重置类别选择器到默认值
        this.selectCategory('npc');
        
        this.currentTags = [];
        this.renderTags();
        this.currentBoundRoles = [];
        this.renderSelectedBoundRoles();
        
        // 重置角色捆绑配置界面
        const enableRoleBindingEl = this.getElement('enable-role-binding');
        const roleBindingConfigEl = this.getElement('role-binding-config');
        
        if (enableRoleBindingEl) {
            enableRoleBindingEl.checked = false;
        }
        if (roleBindingConfigEl) {
            roleBindingConfigEl.style.display = 'none';
        }
        
        // 清除当前角色缓存数据，避免新建角色时显示旧角色信息
        this.currentCharacter = null;
        
        // 更新角色捆绑预览
        this.updateRoleBindingPreview();
    }

    showConfirmModal(message, callback) {
        this.confirmCallback = callback;
        
        const modal = this.getElement('confirm-modal');
        const messageEl = this.getElement('confirm-message');
        
        if (messageEl) messageEl.textContent = message;
        if (modal) modal.style.display = 'block';
    }

    closeCharacterModal() {
        const modal = this.getElement('character-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentCharacter = null;
        
        // 清理AI生成器的当前角色信息
        if (this.aiStorybookGenerator) {
            this.aiStorybookGenerator.currentCharacter = null;
        }
    }

    closeDetailModal() {
        const modal = this.getElement('character-detail-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentCharacter = null;
        
        // 清理AI生成器的当前角色信息
        if (this.aiStorybookGenerator) {
            this.aiStorybookGenerator.currentCharacter = null;
        }
    }

    closeConfirmModal() {
        const modal = this.getElement('confirm-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.confirmCallback = null;
    }

    closeAIStorybookModal() {
        const modal = this.getElement('ai-create-storybook-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // ========== 角色操作方法 - 核心功能实现 ==========

    async editCharacter(characterName) {
        const character = this.characters.find(c => c.name === characterName);
        if (character) {
            // 在编辑前重新获取最新的角色数据
            try {
                const latestData = await this.apiCall(`/api/roles/${encodeURIComponent(characterName)}`);
                // 更新角色对象的数据
                Object.assign(character, {
                    intro: latestData.介绍 || '',
                    voice_id: latestData.voice_id || '',
                    custom_fields: latestData.自定义字段 || {},
                    绑定数据书: latestData.绑定数据书 || [],
                    角色捆绑配置: latestData.角色捆绑配置 || { enabled: false, boundRoles: [] },
                    tags: latestData.tags || []
                });
            } catch (error) {
                console.error(`重新加载角色 ${characterName} 数据失败:`, error);
            }
            
            await this.openCharacterModal(character);
        }
    }

    async useCharacterByName(characterName) {
        // 跳转到聊天页面并选择角色
        window.location.href = `/?role=${encodeURIComponent(characterName)}`;
    }

    async deleteCharacterByName(characterName) {
        // 检查角色是否有数据书
        let confirmMessage = `确定要删除角色"${characterName}"吗？此操作不可撤销。`;
        
        try {
            // 检查是否有绑定的数据书
            const character = this.characters.find(c => c.name === characterName);
            let hasStorybook = false;
            let storybookList = [];
            
            // 检查YAML中的绑定
            if (character && character['绑定数据书'] && character['绑定数据书'].length > 0) {
                hasStorybook = true;
                storybookList = character['绑定数据书'];
            }
            
            // 检查同名数据书文件
            try {
                const response = await fetch(`/api/storybook/${encodeURIComponent(characterName)}`);
                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.data && !storybookList.includes(characterName)) {
                        hasStorybook = true;
                        storybookList.push(characterName);
                    }
                }
            } catch (error) {
                console.log('检查同名数据书失败:', error.message);
            }
            
            if (hasStorybook) {
                confirmMessage += `\n\n⚠️ 注意：该角色绑定了数据书，删除角色时会同时删除以下数据书：\n• ${storybookList.join('\n• ')}`;
            }
            
        } catch (error) {
            console.log('检查数据书状态失败:', error.message);
        }
        
        this.showConfirmModal(
            confirmMessage,
            () => this.performDeleteCharacter(characterName)
        );
    }

    async performDeleteCharacter(characterName) {
        try {
            const response = await this.apiCall(`/api/roles/${encodeURIComponent(characterName)}`, {
                method: 'DELETE'
            });
            
            // 从本地数组中移除
            this.characters = this.characters.filter(c => c.name !== characterName);
            this.selectedCharacters.delete(characterName);
            
            // 重新渲染
            this.filterAndRenderCharacters();
            
            // 显示删除结果详情
            let message = `角色"${characterName}"删除成功`;
            if (response.deleted_storybooks && response.deleted_storybooks.length > 0) {
                message += `\n同时删除了绑定的数据书: ${response.deleted_storybooks.join(', ')}`;
            }
            if (response.deleted_files && response.deleted_files.length > 1) {
                const otherFiles = response.deleted_files.filter(f => !f.endsWith('.yml') && !f.endsWith('.json'));
                if (otherFiles.length > 0) {
                    message += `\n删除的文件: ${otherFiles.join(', ')}`;
                }
            }
            
            this.showNotification(message, 'success');
            
        } catch (error) {
            console.error('删除角色失败:', error);
            this.showNotification('删除失败: ' + error.message, 'error');
        }
    }

    showCharacterDetail(characterName) {
        const character = this.characters.find(c => c.name === characterName);
        if (!character) return;
        
        this.currentCharacter = character;
        
        // 更新AI生成器的当前角色信息
        if (this.aiStorybookGenerator) {
            this.aiStorybookGenerator.currentCharacter = character;
        }
        
        // 设置标题和头像
        const titleEl = this.getElement('detail-modal-title');
        const avatarEl = this.getElement('detail-avatar');
        
        if (titleEl) titleEl.textContent = character.name;
        if (avatarEl) {
            avatarEl.src = `/api/roles/${encodeURIComponent(character.name)}/avatar`;
            avatarEl.onerror = () => {
                avatarEl.src = '/static/images/default-avatar.svg';
            };
        }
        
        // 渲染详情内容
        this.renderCharacterOverview(character);
        this.renderCharacterHistory(character);
        
        // 显示模态框
        const modal = this.getElement('character-detail-modal');
        if (modal) modal.style.display = 'block';
    }

    renderCharacterOverview(character) {
        const container = this.getElement('character-overview');
        if (!container) return;
        
        const fields = [
            { label: '角色名称', value: character.name },
            { label: '角色类别', value: this.getCategoryText(character.category) },
            { label: '角色类型', value: '角色' },
            { label: '角色简介', value: character.intro || '暂无' },
            { label: '语音ID', value: character.voice_id || '未设定' },
            { label: '绑定数据书', value: (character.绑定数据书 && character.绑定数据书.length) ? character.绑定数据书.join(', ') : '无' }
        ];
        
        // 添加自定义字段
        const customFields = character.自定义字段 || character.custom_fields || {};
        if (typeof customFields === 'object' && Object.keys(customFields).length > 0) {
            Object.entries(customFields).forEach(([key, value]) => {
                fields.push({
                    label: `${key} (自定义)`,
                    value: value || '未设定'
                });
            });
        }
        
        const fieldsHTML = fields.map(field => `
            <div class="detail-field">
                <div class="detail-label">${field.label}:</div>
                <div class="detail-value">${this.escapeHtml(String(field.value))}</div>
            </div>
        `).join('');
        
        container.innerHTML = `
            <div class="character-overview-content">
                ${fieldsHTML}
            </div>
        `;
    }

    renderCharacterHistory(character) {
        const container = this.getElement('character-usage-history');
        if (!container) return;
        
        // TODO: 实现使用历史记录功能
        container.innerHTML = `
            <div class="history-placeholder">
                <i class="fas fa-history"></i>
                <p>使用历史记录功能正在开发中...</p>
            </div>
        `;
    }

    // ========== 表单和界面相关方法 ==========

    switchTab(tabName) {
        // 更新标签按钮状态
        this.getElements('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // 更新标签内容显示
        this.getElements('.tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tab === tabName);
        });

        // 如果切换到数据书标签页，检查角色绑定状态
        if (tabName === 'storybook') {
            // 延迟执行，确保标签页切换完成
            setTimeout(() => {
                this.handleStorybookTabSwitch();
            }, 100);
        }
    }

    /**
     * 处理数据书标签页切换
     */
    async handleStorybookTabSwitch() {
        console.log('🔍 检查角色数据书绑定状态...');
        
        // 检查当前角色是否绑定了数据书
        const hasStorybook = await this.checkCharacterStorybook();
        
        if (hasStorybook) {
            // 已有数据书，显示现有数据书界面
            this.showExistingStorybookInterface();
        } else {
            // 没有数据书，显示AI生成界面
            this.showAIGeneratorInterface();
        }
    }

    /**
     * 检查角色是否已绑定数据书
     */
    async checkCharacterStorybook() {
        try {
            // 优先使用表单中的当前角色名称
            const characterName = this.getElement('character-name')?.value?.trim() || this.currentCharacter?.name;
            if (!characterName) {
                console.log('🔍 无角色名称，显示AI生成界面');
                return false;
            }

            // 方法1：检查角色文件中的绑定数据书字段（仅在编辑现有角色时检查）
            if (this.currentCharacter && this.currentCharacter.name === characterName && 
                this.currentCharacter.绑定数据书 && this.currentCharacter.绑定数据书.length > 0) {
                console.log('🔍 角色文件中已绑定数据书:', this.currentCharacter.绑定数据书);
                return true;
            }

            // 方法2：检查是否存在同名数据书文件
            try {
                const response = await fetch(`/api/v2/storybooks/${encodeURIComponent(characterName)}`);
                if (response.ok) {
                    const storybook = await response.json();
                    if (storybook.success && storybook.data) {
                        console.log('🔍 发现同名数据书文件:', characterName);
                        return true;
                    }
                }
            } catch (apiError) {
                console.log('🔍 数据书API检查失败，继续其他检查:', apiError.message);
            }

            console.log('🔍 角色未绑定数据书，显示AI生成界面');
            return false;
        } catch (error) {
            console.error('🔍 检查数据书绑定状态失败:', error);
            return false;
        }
    }

    /**
     * 显示现有数据书界面
     */
    showExistingStorybookInterface() {
        const storybookContent = document.querySelector('.tab-content[data-tab="storybook"]');
        if (!storybookContent) return;

        // 优先使用表单中的当前角色名称，而不是缓存的角色数据
        const characterName = this.getElement('character-name')?.value?.trim() || this.currentCharacter?.name;
        
        // 对于新创建的角色，不应该从缓存中获取绑定数据书信息
        // 只有在编辑现有角色时才使用缓存的绑定信息
        let boundStorybooks = [];
        
        // 如果是编辑现有角色且有绑定数据书信息，则使用缓存的信息
        if (this.currentCharacter && this.currentCharacter.name === characterName && this.currentCharacter.绑定数据书) {
            boundStorybooks = this.currentCharacter.绑定数据书;
        }
        
        // 如果角色文件中没有绑定数据书，但存在同名数据书，则显示同名数据书
        if (boundStorybooks.length === 0) {
            boundStorybooks = [characterName];
        }

        storybookContent.innerHTML = `
            <div class="existing-storybook-interface">
                <div class="storybook-header">
                    <h4><i class="fas fa-book"></i> 现有数据书</h4>
                    <p class="storybook-description">
                        角色"${characterName}"已绑定数据书，无法重复创建。
                    </p>
                </div>

                <div class="existing-storybook-info">
                    <div class="info-card">
                        <div class="info-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="info-content">
                            <h5>已绑定数据书</h5>
                            <div class="bound-storybooks">
                                ${boundStorybooks.map(name => `
                                    <div class="storybook-item">
                                        <i class="fas fa-book"></i>
                                        <span>${name}</span>
                                        <button class="btn btn-sm btn-primary" onclick="window.open('/storybook?edit=${encodeURIComponent(name)}', '_blank')">
                                            <i class="fas fa-edit"></i> 编辑
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <div class="storybook-note">
                                <i class="fas fa-info-circle"></i>
                                <span>如需重新生成数据书，请先删除现有数据书</span>
                            </div>
                        </div>
                    </div>

                    <div class="storybook-actions">
                        <button class="btn btn-secondary" onclick="window.open('/storybook', '_blank')">
                            <i class="fas fa-external-link-alt"></i> 打开数据书管理
                        </button>
                    </div>
                </div>
            </div>
        `;

        console.log('✅ 已显示现有数据书界面');
    }

    /**
     * 显示AI生成界面
     */
    showAIGeneratorInterface() {
        // 触发AI生成器的自动填充
        if (this.aiStorybookGenerator) {
            this.aiStorybookGenerator.autoFillIntroduction();
        }
        console.log('✅ 已显示AI生成界面');
    }

    switchDetailTab(tabName) {
        // 更新标签按钮状态
        this.getElements('.detail-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // 更新标签内容显示
        this.getElements('.detail-tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tab === tabName);
        });
    }

    updateAvatarPreview(characterName) {
        const preview = this.getElement('avatar-preview');
        if (!preview) return;
        
        // 角色头像路径
        const avatarSrc = `/api/roles/${encodeURIComponent(characterName)}/avatar`;
        
        preview.innerHTML = `
            <img src="${avatarSrc}" alt="头像预览" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <i class="fas fa-user-circle default-avatar" style="display: none;"></i>
        `;
        
        const removeBtn = this.getElement('remove-avatar-btn');
        if (removeBtn) removeBtn.style.display = 'inline-block';
    }

    resetAvatarPreview() {
        const preview = this.getElement('avatar-preview');
        if (preview) {
            preview.innerHTML = '<i class="fas fa-user-circle default-avatar"></i>';
        }
        
        const removeBtn = this.getElement('remove-avatar-btn');
        if (removeBtn) removeBtn.style.display = 'none';
    }

    handleAvatarUpload(file) {
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            this.showNotification('请选择图片文件', 'error');
            return;
        }
        
        if (file.size > 50 * 1024 * 1024) {
            this.showNotification('图片文件不能超过50MB', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = this.getElement('avatar-preview');
            if (preview) {
                preview.innerHTML = `<img src="${e.target.result}" alt="头像预览">`;
            }
            
            const removeBtn = this.getElement('remove-avatar-btn');
            if (removeBtn) removeBtn.style.display = 'inline-block';
        };
        reader.readAsDataURL(file);
    }

    removeAvatar() {
        this.resetAvatarPreview();
        const avatarInput = this.getElement('avatar-input');
        if (avatarInput) avatarInput.value = '';
    }

    async uploadAvatar(characterName) {
        const avatarInput = this.getElement('avatar-input');
        if (!avatarInput || !avatarInput.files || !avatarInput.files[0]) {
            return true; // 没有头像文件，不是错误
        }

        try {
            const formData = new FormData();
            formData.append('avatar', avatarInput.files[0]);

            const response = await fetch(`/api/roles/${encodeURIComponent(characterName)}/avatar`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('头像上传失败');
            }
            
            return true;
        } catch (error) {
            console.warn('头像上传失败:', error);
            throw error;
        }
    }

    setupStorybooksCheckboxes() {
        const container = this.getElement('storybooks-container');
        if (!container) return;
        
        if (this.storybooks.length === 0) {
            container.innerHTML = '<p class="text-muted">暂无可用数据书</p>';
            return;
        }
        
        // 获取当前角色的绑定数据书（一对一约束，最多只有一个）
        const boundStorybooks = this.currentCharacter ? (this.currentCharacter.绑定数据书 || []) : [];
        const currentBinding = boundStorybooks.length > 0 ? boundStorybooks[0] : null;
        
        // 添加一对一约束说明
        const constraintNotice = `
            <div class="binding-constraint-notice" style="margin-bottom: 1rem;">
                <i class="fas fa-info-circle"></i>
                <strong>绑定规则：</strong>每个角色只能绑定一个数据书，选择新数据书将自动解除旧的绑定关系。
            </div>
        `;
        
        // 使用单选按钮而不是复选框
        const radioButtonsHTML = this.storybooks.map(storybook => {
            const isChecked = currentBinding === storybook ? 'checked' : '';
            return `
                <div class="radio-item">
                    <input type="radio" name="character-storybook" id="storybook-${storybook}" value="${storybook}" ${isChecked}>
                    <label for="storybook-${storybook}">${this.escapeHtml(storybook)}</label>
                </div>
            `;
        }).join('');
        
        // 添加"无绑定"选项
        const noneOption = `
            <div class="radio-item">
                <input type="radio" name="character-storybook" id="storybook-none" value="" ${!currentBinding ? 'checked' : ''}>
                <label for="storybook-none">无绑定数据书</label>
            </div>
        `;
        
        container.innerHTML = constraintNotice + noneOption + radioButtonsHTML;
    }

    // ========== 批量操作方法 ==========

    batchDeleteCharacters() {
        if (this.selectedCharacters.size === 0) return;
        
        const characterNames = Array.from(this.selectedCharacters);
        this.showConfirmModal(
            `确定要删除选中的 ${characterNames.length} 个角色吗？此操作不可撤销。`,
            async () => {
                for (const characterName of characterNames) {
                    try {
                        await this.performDeleteCharacter(characterName);
                    } catch (error) {
                        console.error(`删除角色 ${characterName} 失败:`, error);
                    }
                }
                this.clearSelection();
            }
        );
    }

    batchExportCharacters() {
        if (this.selectedCharacters.size === 0) return;
        
        this.showNotification('批量导出功能正在开发中...', 'info');
    }

    clearSelection() {
        this.selectedCharacters.clear();
        
        // 更新UI
        this.getElements('.character-card').forEach(card => {
            card.classList.remove('selected');
            const checkbox = card.querySelector('.card-checkbox');
            if (checkbox) checkbox.checked = false;
        });
        
        this.updateBatchOperationButtons();
    }

    // ========== 标签管理 - 重构后的版本 ==========

    setupTagsInput() {
        const tagsInput = this.getElement('character-tags');
        if (!tagsInput) return;

        tagsInput.addEventListener('input', (e) => {
            const value = e.target.value;
            const trimmedValue = value.trim().toLowerCase();

            if (!trimmedValue || trimmedValue.endsWith(' ')) {
                this.hideSuggestions();
                return;
            }

            const suggestions = Array.from(this.allTags)
                .filter(tag => tag.toLowerCase().includes(trimmedValue) && 
                              !this.currentTags.includes(tag))
                .slice(0, 5);

            this.showTagSuggestions(suggestions);
        });

        tagsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const value = e.target.value.trim();
                if (value) {
                    this.addTag(value);
                    e.target.value = '';
                    this.hideSuggestions();
                }
            } else if (e.key === 'Backspace' && !e.target.value) {
                this.removeLastTag();
            }
        });

        tagsInput.addEventListener('blur', () => {
            setTimeout(() => this.hideSuggestions(), 200);
        });
    }

    showTagSuggestions(suggestions) {
        const suggestionsEl = this.getElement('tags-suggestions');
        if (!suggestionsEl) return;

        if (suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }

        suggestionsEl.innerHTML = suggestions.map(tag => 
            `<div class="tag-suggestion" data-tag="${tag}">${tag}</div>`
        ).join('');

        // 添加点击事件
        suggestionsEl.querySelectorAll('.tag-suggestion').forEach(el => {
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.addTag(el.dataset.tag);
                this.getElement('character-tags').value = '';
                this.hideSuggestions();
            });
        });

        suggestionsEl.classList.add('show');
    }

    hideSuggestions() {
        const suggestionsEl = this.getElement('tags-suggestions');
        if (suggestionsEl) {
            suggestionsEl.classList.remove('show');
        }
    }

    addTag(tag) {
        if (!tag || this.currentTags.includes(tag)) return;

        this.currentTags.push(tag);
        this.allTags.add(tag);
        this.renderTags();
        this.updateTagFilter();
    }

    removeTag(tag) {
        const index = this.currentTags.indexOf(tag);
        if (index > -1) {
            this.currentTags.splice(index, 1);
            this.renderTags();
        }
    }

    removeLastTag() {
        if (this.currentTags.length > 0) {
            this.currentTags.pop();
            this.renderTags();
        }
    }

    renderTags() {
        const tagsDisplay = this.getElement('tags-display');
        if (!tagsDisplay) return;

        tagsDisplay.innerHTML = this.currentTags.map(tag => `
            <div class="tag-item">
                ${tag}
                <button type="button" class="tag-remove" data-tag="${tag}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        // 添加删除事件
        tagsDisplay.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.removeTag(btn.dataset.tag);
            });
        });
    }

    updateTagFilter() {
        const tagFilter = this.getElement('tag-filter');
        if (!tagFilter) return;

        const currentValue = tagFilter.value;
        const tags = Array.from(this.allTags).sort();
        
        tagFilter.innerHTML = '<option value="">全部标签</option>' +
            tags.map(tag => `<option value="${tag}">${tag}</option>`).join('');
        
        if (tags.includes(currentValue)) {
            tagFilter.value = currentValue;
        }
    }

    collectAllTags() {
        this.allTags.clear();
        this.characters.forEach(character => {
            if (character.tags && Array.isArray(character.tags)) {
                character.tags.forEach(tag => this.allTags.add(tag));
            }
        });
    }


    // ========== 角色捆绑和其他功能 - 完整实现 ==========

    setupRoleBindingEvents() {
        // 角色捆绑功能的事件绑定
        const enableRoleBinding = this.getElement('enable-role-binding');
        if (enableRoleBinding) {
            enableRoleBinding.addEventListener('change', (e) => {
                const roleBindingConfig = this.getElement('role-binding-config');
                if (roleBindingConfig) {
                    roleBindingConfig.style.display = e.target.checked ? 'block' : 'none';
                }
                this.updateRoleBindingPreview();
            });
        }
    }

    renderSelectedBoundRoles() {
        // 渲染已选择的捆绑角色列表
        const container = this.getElement('selected-bound-roles');
        if (!container) return;
        
        if (this.currentBoundRoles.length === 0) {
            container.innerHTML = '<p class="text-muted">暂未选择捆绑角色</p>';
            return;
        }
        
        const rolesHTML = this.currentBoundRoles.map(role => `
            <div class="bound-role-item">
                <span>${this.escapeHtml(role)}</span>
                <button type="button" class="remove-bound-role" data-role="${role}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
        
        container.innerHTML = rolesHTML;
        
        // 绑定删除事件
        container.querySelectorAll('.remove-bound-role').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const role = e.target.closest('.remove-bound-role').dataset.role;
                this.removeBoundRole(role);
            });
        });
    }

    removeBoundRole(role) {
        const index = this.currentBoundRoles.indexOf(role);
        if (index > -1) {
            this.currentBoundRoles.splice(index, 1);
            this.renderSelectedBoundRoles();
            this.updateRoleBindingPreview();
        }
    }

    /**
     * 设置捆绑角色相关事件
     */
    setupBoundRoleEvents() {
        // 添加捆绑角色按钮
        const addBoundRoleBtn = this.getElement('add-bound-role-btn');
        if (addBoundRoleBtn) {
            addBoundRoleBtn.addEventListener('click', () => {
                this.openRoleSelector();
            });
        }

        // 角色选择器模态框事件
        this.setupRoleSelectorEvents();
    }

    /**
     * 设置角色选择器模态框事件
     */
    setupRoleSelectorEvents() {
        // 关闭按钮
        const closeBtn = this.getElement('close-role-selector-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeRoleSelector();
            });
        }

        // 取消按钮
        const cancelBtn = this.getElement('role-selector-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeRoleSelector();
            });
        }

        // 确认按钮
        const confirmBtn = this.getElement('role-selector-confirm-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.confirmRoleSelection();
            });
        }

        // 搜索框
        const searchInput = this.getElement('role-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterAvailableRoles(e.target.value);
            });
        }

        // 点击模态框外部关闭
        const modal = this.getElement('role-selector-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeRoleSelector();
                }
            });
        }
    }

    /**
     * 打开角色选择器
     */
    openRoleSelector() {
        const modal = this.getElement('role-selector-modal');
        if (!modal) return;

        // 重置搜索框
        const searchInput = this.getElement('role-search-input');
        if (searchInput) {
            searchInput.value = '';
        }

        // 加载可用角色列表
        this.loadAvailableRoles();

        // 显示模态框
        modal.style.display = 'block';
        setTimeout(() => {
            modal.classList.add('show');
            if (searchInput) {
                searchInput.focus();
            }
        }, 10);
    }

    /**
     * 关闭角色选择器
     */
    closeRoleSelector() {
        const modal = this.getElement('role-selector-modal');
        if (!modal) return;

        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
            this.selectedRolesForBinding = new Set();
        }, 300);
    }

    /**
     * 加载可用角色列表
     */
    loadAvailableRoles() {
        const container = this.getElement('available-roles-list');
        if (!container) return;

        // 获取所有角色，排除当前编辑的角色和已选择的角色
        const currentCharacterName = this.getElement('character-name')?.value || '';
        const availableRoles = this.characters.filter(character => {
            return character.name !== currentCharacterName && 
                   !this.currentBoundRoles.includes(character.name);
        });

        if (availableRoles.length === 0) {
            container.innerHTML = '<p class="text-muted">暂无可选择的角色</p>';
            return;
        }

        const rolesHTML = availableRoles.map(character => `
            <div class="role-item" data-role="${this.escapeHtml(character.name)}">
                <div class="role-avatar">
                    ${character.avatar ? 
                        `<img src="${character.avatar}" alt="${this.escapeHtml(character.name)}" />` :
                        `<div class="default-avatar"><i class="fas fa-user"></i></div>`
                    }
                </div>
                <div class="role-info">
                    <div class="role-name">${this.escapeHtml(character.name)}</div>
                    <div class="role-tags">
                        ${(character.tags || []).slice(0, 3).map(tag => 
                            `<span class="tag">${this.escapeHtml(tag)}</span>`
                        ).join('')}
                    </div>
                </div>
                <div class="role-actions">
                    <input type="checkbox" class="role-checkbox" value="${this.escapeHtml(character.name)}">
                </div>
            </div>
        `).join('');

        container.innerHTML = rolesHTML;

        // 初始化选择状态
        this.selectedRolesForBinding = new Set();

        // 绑定复选框事件
        container.querySelectorAll('.role-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const roleName = e.target.value;
                if (e.target.checked) {
                    this.selectedRolesForBinding.add(roleName);
                } else {
                    this.selectedRolesForBinding.delete(roleName);
                }
                this.updateConfirmButtonState();
            });
        });

        // 绑定角色项点击事件
        container.querySelectorAll('.role-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox') return;
                
                const checkbox = item.querySelector('.role-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });
        });
    }

    /**
     * 过滤可用角色
     */
    filterAvailableRoles(searchTerm) {
        const container = this.getElement('available-roles-list');
        if (!container) return;

        const roleItems = container.querySelectorAll('.role-item');
        const term = searchTerm.toLowerCase();

        roleItems.forEach(item => {
            const roleName = item.dataset.role.toLowerCase();
            const roleInfo = item.querySelector('.role-info').textContent.toLowerCase();
            
            if (roleName.includes(term) || roleInfo.includes(term)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    /**
     * 更新确认按钮状态
     */
    updateConfirmButtonState() {
        const confirmBtn = this.getElement('role-selector-confirm-btn');
        if (!confirmBtn) return;

        const hasSelection = this.selectedRolesForBinding && this.selectedRolesForBinding.size > 0;
        confirmBtn.disabled = !hasSelection;
        confirmBtn.textContent = hasSelection ? 
            `确认选择 (${this.selectedRolesForBinding.size})` : 
            '确认选择';
    }

    /**
     * 确认角色选择
     */
    confirmRoleSelection() {
        if (!this.selectedRolesForBinding || this.selectedRolesForBinding.size === 0) {
            this.showNotification('请至少选择一个角色', 'warning');
            return;
        }

        // 将选择的角色添加到当前捆绑角色列表
        this.selectedRolesForBinding.forEach(roleName => {
            if (!this.currentBoundRoles.includes(roleName)) {
                this.currentBoundRoles.push(roleName);
            }
        });

        // 更新UI
        this.renderSelectedBoundRoles();
        this.updateRoleBindingPreview();

        // 关闭模态框
        this.closeRoleSelector();

        // 显示成功消息
        const count = this.selectedRolesForBinding.size;
        this.showNotification(`成功添加 ${count} 个捆绑角色`, 'success');
    }

    updateRoleBindingPreview() {
        // 更新角色捆绑预览
        const preview = this.getElement('role-binding-preview');
        if (!preview) return;
        
        const enableRoleBinding = this.getElement('enable-role-binding');
        const isEnabled = enableRoleBinding ? enableRoleBinding.checked : false;
        
        if (!isEnabled) {
            preview.innerHTML = '<p class="text-muted">角色捆绑功能未启用</p>';
            return;
        }
        
        if (this.currentBoundRoles.length === 0) {
            preview.innerHTML = '<p class="text-muted">请选择要捆绑的角色</p>';
            return;
        }
        
        preview.innerHTML = `
            <p>将与以下角色进行捆绑：</p>
            <div class="bound-roles-preview">
                ${this.currentBoundRoles.map(role => `<span class="role-tag">${this.escapeHtml(role)}</span>`).join('')}
            </div>
        `;
    }

    setupNameChangeListener() {
        // 监听角色名称变化，更新预览
        const nameInput = this.getElement('character-name');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                const name = e.target.value.trim();
                if (name) {
                    console.log('角色名称变化:', name);
                }
            });
        }
    }

    // ========== 数据书管理方法 ==========

    // 旧的数据书管理方法已移除，现在使用简化的AI生成功能

    /**
     * 通过AI生成数据书 - 兼容性方法
     * 调用新的 AIStorybookGenerator 类
     */
    async generateStorybookFromDescription() {
        if (this.aiStorybookGenerator) {
            // 获取按钮元素并模拟点击
            const generateBtn = this.getElement('generate-storybook-from-description');
            if (generateBtn) {
                await this.aiStorybookGenerator.handleGenerateClick(generateBtn);
            } else {
                this.showNotification('未找到生成按钮', 'error');
            }
        } else {
            this.showNotification('AI生成器未初始化', 'error');
        }
    }

    // 数据书相关方法已简化，只保留AI生成功能

    /**
     * 处理URL参数
     */
    handleURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const editCharacter = urlParams.get('edit');
        const targetTab = urlParams.get('tab');

        if (editCharacter) {
            // 延迟执行，确保数据已加载
            setTimeout(() => {
                this.editCharacter(editCharacter).then(() => {
                    if (targetTab) {
                        this.switchTab(targetTab);
                    }
                });
            }, 500);
        }
    }

}

// 初始化角色管理系统
let characterManagement;

document.addEventListener('DOMContentLoaded', () => {
    characterManagement = new CharacterManagement();
    // 将实例绑定到window对象，供全局访问
    window.characterManagement = characterManagement;
});

// 将CharacterManagement类暴露到全局作用域，供其他模块使用
window.CharacterManagement = CharacterManagement;
