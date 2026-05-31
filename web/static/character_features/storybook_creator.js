/**
 * 数据书创建器 - 专门负责角色数据书的创建和管理
 * 整合了从各个模块中分散的数据书创建功能
 * 位于 character_features 文件夹中，提供统一的数据书创建接口
 */

class StorybookCreator {
    constructor(characterManagement) {
        this.characterManagement = characterManagement;
        this.currentCharacterName = null;
        this.currentCharacterData = null;
        
        this.init();
    }

    init() {
        this.setupStorybookCreationEvents();
        console.log('StorybookCreator: 初始化完成');
    }

    /**
     * 设置数据书创建相关事件
     */
    setupStorybookCreationEvents() {
        // AI创建数据书模态框事件
        this.setupAIStorybookModalEvents();
        
        // AI创建选项模态框事件
        this.setupAICreationOptionsModalEvents();
        
        console.log('StorybookCreator: 事件绑定完成');
    }

    /**
     * 设置AI数据书创建模态框事件
     */
    setupAIStorybookModalEvents() {
        const modal = document.getElementById('ai-create-storybook-modal');
        const closeBtn = document.getElementById('close-ai-storybook-modal-btn');
        const cancelBtn = document.getElementById('cancel-ai-storybook-btn');
        const createBtn = document.getElementById('create-ai-storybook-btn');

        if (!modal) {
            console.warn('StorybookCreator: AI创建数据书模态框未找到');
            return;
        }

        // 关闭按钮事件
        [closeBtn, cancelBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    this.closeAIStorybookModal();
                });
            }
        });

        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeAIStorybookModal();
            }
        });

        // 创建数据书按钮
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.createAIStorybook();
            });
        }
    }

    /**
     * 设置AI创建选项模态框事件
     */
    setupAICreationOptionsModalEvents() {
        const modal = document.getElementById('ai-creation-options-modal');
        const closeBtn = document.getElementById('close-ai-options-modal-btn');
        const skipBtn = document.getElementById('skip-ai-creation-btn');
        const proceedBtn = document.getElementById('proceed-ai-creation-btn');

        if (!modal) {
            console.warn('StorybookCreator: AI创建选项模态框未找到');
            return;
        }

        // 关闭按钮事件
        [closeBtn, skipBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    this.closeAICreationOptionsModal();
                });
            }
        });

        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeAICreationOptionsModal();
            }
        });

        // 开始AI创建按钮
        if (proceedBtn) {
            proceedBtn.addEventListener('click', () => {
                this.proceedWithAICreation();
            });
        }
    }

    /**
     * 显示AI创建数据书模态框
     */
    showAIStorybookModal(characterName, characterData = null) {
        const modal = document.getElementById('ai-create-storybook-modal');
        const nameInput = document.getElementById('storybook-name');
        const promptTextarea = document.getElementById('storybook-prompt');

        if (!modal) {
            console.warn('StorybookCreator: AI创建数据书模态框未找到');
            return;
        }

        // 设置当前角色信息
        this.currentCharacterName = characterName;
        this.currentCharacterData = characterData;

        // 预填充数据书名称
        if (nameInput) {
            nameInput.value = characterName || '';
        }

        // 预填充创建提示
        if (promptTextarea && characterData) {
            const defaultPrompt = this.generateDefaultPrompt(characterName, characterData);
            promptTextarea.value = defaultPrompt;
        }

        // 加载AI模型选项
        this.loadAIModels();

        modal.style.display = 'block';
    }

    /**
     * 关闭AI创建数据书模态框
     */
    closeAIStorybookModal() {
        const modal = document.getElementById('ai-create-storybook-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        this.currentCharacterName = null;
        this.currentCharacterData = null;
    }

    /**
     * 显示AI创建选项模态框
     */
    showAICreationOptionsModal(characterName, characterData = null) {
        const modal = document.getElementById('ai-creation-options-modal');
        const characterNameEl = document.getElementById('created-character-name');

        if (!modal) {
            console.warn('StorybookCreator: AI创建选项模态框未找到');
            return;
        }

        // 设置当前角色信息
        this.currentCharacterName = characterName;
        this.currentCharacterData = characterData;

        // 更新显示的角色名称
        if (characterNameEl) {
            characterNameEl.textContent = `角色 "${characterName}" 已成功保存`;
        }

        modal.style.display = 'block';
    }

    /**
     * 关闭AI创建选项模态框
     */
    closeAICreationOptionsModal() {
        const modal = document.getElementById('ai-creation-options-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        this.currentCharacterName = null;
        this.currentCharacterData = null;
    }

    /**
     * 执行AI数据书创建
     */
    async createAIStorybook() {
        const nameInput = document.getElementById('storybook-name');
        const modelSelect = document.getElementById('ai-model-select');
        const promptTextarea = document.getElementById('storybook-prompt');

        if (!nameInput || !promptTextarea) {
            this.characterManagement.showNotification('表单元素未找到', 'error');
            return;
        }

        const storybookName = nameInput.value.trim() || this.currentCharacterName;
        const selectedModel = modelSelect ? modelSelect.value : '';
        const prompt = promptTextarea.value.trim();

        if (!prompt) {
            this.characterManagement.showNotification('请输入创建需求', 'error');
            return;
        }

        try {
            this.characterManagement.showNotification('正在创建数据书...', 'info');
            this.closeAIStorybookModal();

            const response = await fetch('/api/ai_create_story', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    storybook_name: storybookName,
                    prompt: prompt,
                    model: selectedModel,
                    character_name: this.currentCharacterName,
                    character_data: this.currentCharacterData
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.characterManagement.showNotification(`数据书 "${storybookName}" 创建成功`, 'success');
                
                // 如果有回调函数，执行回调
                if (this.onStorybookCreated) {
                    this.onStorybookCreated(storybookName, result);
                }
            } else {
                const error = await response.json();
                throw new Error(error.error || '创建失败');
            }
        } catch (error) {
            console.error('创建AI数据书失败:', error);
            this.characterManagement.showNotification('创建数据书失败: ' + error.message, 'error');
        }
    }

    /**
     * 继续AI创建流程
     */
    async proceedWithAICreation() {
        const enableEventsCheckbox = document.getElementById('enable-events-checkbox');
        const additionalInstructions = document.getElementById('additional-instructions');

        if (!this.currentCharacterName) {
            this.characterManagement.showNotification('未找到角色信息', 'error');
            return;
        }

        const enableEvents = enableEventsCheckbox ? enableEventsCheckbox.checked : false;
        const instructions = additionalInstructions ? additionalInstructions.value.trim() : '';

        try {
            this.characterManagement.showNotification('正在创建角色数据书...', 'info');
            this.closeAICreationOptionsModal();

            // 构建创建数据书的请求
            const requestData = {
                character_name: this.currentCharacterName,
                enable_events: enableEvents,
                additional_instructions: instructions
            };

            // 如果有角色数据，也传递过去
            if (this.currentCharacterData) {
                requestData.character_data = this.currentCharacterData;
            }

            const response = await fetch(`/api/character/${encodeURIComponent(this.currentCharacterName)}/create-storybook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (response.ok) {
                const result = await response.json();
                this.characterManagement.showNotification(`角色 "${this.currentCharacterName}" 的数据书创建成功`, 'success');
                
                // 如果有回调函数，执行回调
                if (this.onStorybookCreated) {
                    this.onStorybookCreated(this.currentCharacterName, result);
                }
            } else {
                const error = await response.json();
                throw new Error(error.error || '创建失败');
            }
        } catch (error) {
            console.error('创建角色数据书失败:', error);
            this.characterManagement.showNotification('创建数据书失败: ' + error.message, 'error');
        }
    }

    /**
     * 从描述创建数据书
     */
    async createStorybookFromDescription(characterName, description, enableEvents = false) {
        if (!characterName || !description) {
            this.characterManagement.showNotification('角色名称和描述不能为空', 'error');
            return;
        }

        try {
            this.characterManagement.showNotification('正在从描述创建数据书...', 'info');

            const response = await fetch('/api/ai_create_character_storybook', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    character_name: characterName,
                    description: description,
                    enable_events: enableEvents
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.characterManagement.showNotification(`角色 "${characterName}" 的数据书创建成功`, 'success');
                
                // 如果有回调函数，执行回调
                if (this.onStorybookCreated) {
                    this.onStorybookCreated(characterName, result);
                }
                
                return result;
            } else {
                const error = await response.json();
                throw new Error(error.error || '创建失败');
            }
        } catch (error) {
            console.error('从描述创建数据书失败:', error);
            this.characterManagement.showNotification('创建数据书失败: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * 为现有角色创建数据书
     */
    async createStorybookForExistingCharacter(characterName) {
        if (!characterName) {
            this.characterManagement.showNotification('角色名称不能为空', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/character/${encodeURIComponent(characterName)}/create-storybook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    character_name: characterName
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.characterManagement.showNotification(`角色 "${characterName}" 的数据书创建成功`, 'success');
                
                // 如果有回调函数，执行回调
                if (this.onStorybookCreated) {
                    this.onStorybookCreated(characterName, result);
                }
                
                return result;
            } else {
                const error = await response.json();
                throw new Error(error.error || '创建失败');
            }
        } catch (error) {
            console.error('为现有角色创建数据书失败:', error);
            this.characterManagement.showNotification('创建数据书失败: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * 生成默认的创建提示
     */
    generateDefaultPrompt(characterName, characterData) {
        let prompt = `为角色 "${characterName}" 创建详细的数据书，包括：\n\n`;
        
        prompt += '• 角色的详细背景故事和来历\n';
        prompt += '• 外貌特征和穿着风格\n';
        prompt += '• 性格特征和行为习惯\n';
        prompt += '• 技能特长和能力属性\n';
        prompt += '• 人际关系和社会地位\n';
        prompt += '• 重要经历和成长历程\n';

        // 如果有角色数据，添加相关信息
        if (characterData) {
            if (characterData.介绍) {
                prompt += `\n基于以下角色介绍：\n"${characterData.介绍}"`;
            }
            
            if (characterData.tags && characterData.tags.length > 0) {
                prompt += `\n角色标签：${characterData.tags.join(', ')}`;
            }
        }

        return prompt;
    }

    /**
     * 加载可用的AI模型
     */
    async loadAIModels() {
        const modelSelect = document.getElementById('ai-model-select');
        if (!modelSelect) return;

        try {
            const response = await fetch('/api/models');
            if (response.ok) {
                const models = await response.json();
                
                // 清空现有选项
                modelSelect.innerHTML = '<option value="">使用默认模型</option>';
                
                // 添加模型选项
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id || model.name;
                    option.textContent = model.name || model.id;
                    modelSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.warn('加载AI模型列表失败:', error);
        }
    }

    /**
     * 设置数据书创建完成的回调函数
     */
    setOnStorybookCreatedCallback(callback) {
        this.onStorybookCreated = callback;
    }

    /**
     * 检查角色是否已有数据书
     */
    async checkCharacterStorybook(characterName) {
        try {
            const response = await fetch(`/api/storybook/${encodeURIComponent(characterName)}`);
            return response.ok;
        } catch (error) {
            console.warn('检查角色数据书失败:', error);
            return false;
        }
    }

    /**
     * 获取角色数据书内容
     */
    async getCharacterStorybook(characterName) {
        try {
            const response = await fetch(`/api/storybook/${encodeURIComponent(characterName)}`);
            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.warn('获取角色数据书失败:', error);
            return null;
        }
    }

    /**
     * 创建数据书的快捷方法 - 统一入口
     */
    async quickCreateStorybook(characterName, options = {}) {
        const {
            description = null,
            enableEvents = false,
            additionalInstructions = '',
            showModal = false
        } = options;

        if (showModal) {
            // 显示模态框让用户自定义
            this.showAICreationOptionsModal(characterName);
        } else if (description) {
            // 从描述创建
            return await this.createStorybookFromDescription(characterName, description, enableEvents);
        } else {
            // 为现有角色创建
            return await this.createStorybookForExistingCharacter(characterName);
        }
    }
}

// 导出类以供其他模块使用
window.StorybookCreator = StorybookCreator;
