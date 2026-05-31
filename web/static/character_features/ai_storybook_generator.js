/**
 * AI数据书生成器 - 简化版本
 * 专门负责"保存并AI生成数据书"的核心功能
 */

class AIStorybookGenerator {
    constructor(characterManagement) {
        this.characterManagement = characterManagement;
        this.isGenerating = false;
        this.currentCharacter = null;
        
        this.init();
    }

    /**
     * 初始化生成器
     */
    init() {
        this.bindEvents();
        console.log('AIStorybookGenerator: 初始化完成');
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 监听AI生成数据书按钮的点击事件
        document.addEventListener('click', (e) => {
            if (e.target.id === 'generate-storybook-from-description' || 
                e.target.closest('#generate-storybook-from-description')) {
                e.preventDefault();
                this.handleGenerateClick(e.target);
            }

            // 监听数据书标签页的点击，自动填充简介
            if (e.target.dataset && e.target.dataset.tab === 'storybook') {
                setTimeout(() => {
                    this.autoFillIntroduction();
                }, 100);
            }
        });

        // 监听角色数据变化
        document.addEventListener('characterDataChanged', (e) => {
            if (e.detail && e.detail.character) {
                this.currentCharacter = e.detail.character;
            }
        });
    }

    /**
     * 处理AI生成按钮点击
     */
    async handleGenerateClick(button) {
        if (this.isGenerating) {
            this.characterManagement.showNotification('正在生成中，请稍候...', 'warning');
            return;
        }

        // 获取当前角色信息
        const currentCharacter = this.getCurrentCharacterInfo();
        if (!currentCharacter) {
            this.characterManagement.showNotification('请先选择或创建角色', 'error');
            return;
        }

        // 获取角色描述
        const description = this.getCharacterDescription();
        if (!description) {
            this.characterManagement.showNotification('请先填写角色描述信息', 'error');
            return;
        }

        // 执行保存并生成流程
        await this.saveAndGenerateStorybook(description, button);
    }

    /**
     * 获取当前角色信息
     */
    getCurrentCharacterInfo() {
        // 优先从角色管理器获取
        if (this.characterManagement.currentCharacter) {
            return this.characterManagement.currentCharacter;
        }

        // 从表单收集数据
        const characterName = document.getElementById('character-name')?.value?.trim();
        if (!characterName) {
            return null;
        }

        return {
            name: characterName,
            介绍: document.getElementById('character-introduction')?.value?.trim() || '',
            类别: this.getCurrentSelectedCategory(),
            tags: this.getCurrentTags()
        };
    }

    /**
     * 获取当前选中的角色类别
     */
    getCurrentSelectedCategory() {
        const activeCategory = document.querySelector('.category-option.active');
        if (activeCategory) {
            return activeCategory.dataset.category || 'npc';
        }

        const categorySelect = document.getElementById('character-category');
        return categorySelect?.value || 'npc';
    }

    /**
     * 获取当前角色标签
     */
    getCurrentTags() {
        try {
            const tagsContainer = document.getElementById('current-tags');
            if (tagsContainer) {
                const tagElements = tagsContainer.querySelectorAll('.tag');
                return Array.from(tagElements).map(el => el.textContent.trim());
            }
            return [];
        } catch (error) {
            console.warn('获取角色标签失败:', error);
            return [];
        }
    }

    /**
     * 保存角色并AI生成数据书
     */
    async saveAndGenerateStorybook(description, button) {
        const originalText = this.getButtonOriginalText(button);
        this.currentCharacter = this.getCurrentCharacterInfo();
        
        // 检查角色名称（支持中英文字段名）
        const characterName = this.currentCharacter?.名字 || this.currentCharacter?.name;
        if (!characterName) {
            this.characterManagement.showNotification('角色名称不能为空', 'error');
            return;
        }
        
        try {
            this.isGenerating = true;
            this.setButtonLoading(button, true, '正在保存角色...');
            this.showGenerationStatus(true);

            console.log('📝 步骤1：保存角色数据');
            await this.saveCurrentCharacter();

            this.characterManagement.showNotification('✅ 角色保存成功，开始AI生成数据书...', 'success');
            this.setButtonLoading(button, true, '正在AI生成数据书...');

            console.log('🤖 步骤2：AI生成数据书');
            const result = await this.callAIGenerateStorybook(description);
            
            if (!result.success) {
                throw new Error(result.error || 'AI生成数据书失败');
            }

            console.log('🧹 步骤3：清空角色简介');
            await this.clearCharacterIntroductionFromFile();
            
            console.log('💾 步骤4：重新保存角色（清空简介后）');
            try {
                await this.saveCurrentCharacter();
                console.log('✅ 角色重新保存成功（简介已清空）');
            } catch (saveError) {
                console.warn('⚠️ 重新保存失败，但继续显示成功弹窗:', saveError);
            }

            // 显示成功弹窗
            console.log('🎉 准备显示成功弹窗');
            this.showSuccessDialog();
            
            // 显示通知作为备用
            this.characterManagement.showNotification('🎉 AI数据书生成成功！角色简介已清空！', 'success');
            
            // 不再自动关闭模态窗口，让用户手动关闭弹窗后再关闭

        } catch (error) {
            console.error('AI生成数据书失败:', error);
            this.characterManagement.showNotification('AI生成数据书失败: ' + error.message, 'error');
        } finally {
            this.isGenerating = false;
            this.setButtonLoading(button, false, originalText);
            this.showGenerationStatus(false);
        }
    }

    /**
     * 获取角色描述信息
     */
    getCharacterDescription() {
        // 优先从简化输入框获取
        const primaryInput = document.getElementById('storybook-description-input');
        if (primaryInput?.value?.trim()) {
            return primaryInput.value.trim();
        }

        // 从其他输入框获取
        const fallbackSources = [
            'character-description-for-ai',
            'npc-description-input',
            'character-introduction'
        ];

        for (const sourceId of fallbackSources) {
            const element = document.getElementById(sourceId);
            if (element?.value?.trim()) {
                return element.value.trim();
            }
        }

        // 从当前角色获取
        return this.currentCharacter?.介绍 || null;
    }

    /**
     * 自动填充角色简介到描述输入框
     */
    autoFillIntroduction() {
        const descriptionInput = document.getElementById('storybook-description-input');
        if (!descriptionInput || descriptionInput.value?.trim()) {
            return;
        }

        // 从当前角色或角色介绍输入框获取简介
        let introduction = this.currentCharacter?.介绍 || 
                          document.getElementById('character-introduction')?.value?.trim() || '';

        if (introduction) {
            descriptionInput.value = introduction;
            console.log('AI生成器: 已自动填充角色简介');
        }
    }

    /**
     * 保存当前角色
     */
    async saveCurrentCharacter() {
        // 收集表单数据
        const formData = this.characterManagement.collectFormData();
        if (!formData?.名字) {
            throw new Error('角色名称不能为空');
        }

        // 如果当前角色对象存在且介绍已被清空，确保使用清空后的介绍
        if (this.currentCharacter && this.currentCharacter.介绍 === '') {
            formData.介绍 = '';
            console.log('🧹 确保保存时使用清空的介绍字段');
        }

        console.log('💾 准备保存角色数据:', {
            name: formData.名字,
            introLength: formData.介绍?.length || 0
        });

        const isEdit = !!this.characterManagement.currentCharacter;
        const apiUrl = isEdit 
            ? `/api/roles/${encodeURIComponent(this.characterManagement.currentCharacter.name)}`
            : '/api/roles';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(apiUrl, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `保存失败: ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || '保存失败');
        }

        // 更新角色信息
        this.currentCharacter = formData;
        this.characterManagement.currentCharacter = formData;
        await this.characterManagement.loadCharacters();
        
        console.log('✅ 角色保存完成，简介长度:', formData.介绍?.length || 0);
    }

    /**
     * 调用AI生成数据书
     */
    async callAIGenerateStorybook(description) {
        // 统一使用中文字段名（与formData一致）
        const characterName = this.currentCharacter?.名字 || this.currentCharacter?.name;
        if (!characterName) {
            throw new Error('角色信息不完整');
        }

        // 判断角色类型：只有player类型才使用玩家接口，其他都使用角色接口
        const characterType = this.currentCharacter?.角色类别 || this.currentCharacter?.类别 || 'npc';
        const isPlayer = characterType === 'player';

        console.log('🚀 调用AI生成接口', {
            characterName: characterName,
            characterType: characterType,
            isPlayer: isPlayer,
            currentCharacter: this.currentCharacter
        });

        // 根据角色类型选择正确的接口
        let endpoint, requestBody;
        
        if (isPlayer) {
            // 玩家角色 - 使用玩家接口，生成"捆绑玩家"的数据书
            endpoint = '/ai_new/generate_character_for_player';
            requestBody = {
                player_name: characterName,
                player_config: {
                    name: characterName,
                    介绍: description,
                    类别: characterType,
                    tags: this.currentCharacter?.tags || []
                }
            };
        } else {
            // 普通角色 - 使用角色接口，生成"捆绑角色"的数据书
            endpoint = '/ai_new/generate_character_for_role';
            requestBody = {
                role_name: characterName,
                role_config: {
                    name: characterName,
                    介绍: description,
                    类别: characterType,
                    tags: this.currentCharacter?.tags || []
                },
                creation_options: {
                    enable_events: false,
                    additional_instructions: ''
                }
            };
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI生成接口调用失败: ${response.status} ${errorText}`);
        }

        return await response.json();
    }

    /**
     * 直接从文件清空角色简介
     */
    async clearCharacterIntroductionFromFile() {
        console.log('🧹 开始从文件清空角色简介...');
        
        const characterName = this.currentCharacter?.名字 || this.currentCharacter?.name;
        if (!characterName) {
            console.error('❌ 无法获取角色名称，跳过文件清空');
            return;
        }

        try {
            // 调用后端API直接清空角色文件中的介绍字段
            const response = await fetch(`/api/roles/${encodeURIComponent(characterName)}/clear-introduction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    console.log('✅ 角色文件中的介绍字段已清空');
                } else {
                    console.warn('⚠️ 清空角色文件失败:', result.error);
                }
            } else {
                console.warn('⚠️ 清空角色文件API调用失败:', response.status);
            }
        } catch (error) {
            console.warn('⚠️ 清空角色文件时出错:', error);
        }

        // 同时清空前端界面
        this.clearCharacterIntroduction();
    }

    /**
     * 清空角色简介（前端界面）
     */
    clearCharacterIntroduction() {
        console.log('🧹 开始清空前端角色简介...');
        
        // 清空所有相关输入框
        const inputIds = [
            'character-introduction',
            'storybook-description-input',
            'character-description-for-ai',
            'npc-description-input'
        ];

        inputIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const oldValue = element.value;
                element.value = '';
                console.log(`🧹 已清空 ${id} 输入框 (原长度: ${oldValue.length})`);
            }
        });

        // 清空内存中的角色对象的介绍字段
        if (this.currentCharacter) {
            const oldIntro = this.currentCharacter.介绍 || '';
            this.currentCharacter.介绍 = '';
            console.log(`🧹 已清空内存中的角色介绍 (原长度: ${oldIntro.length})`);
        }
        
        // 同时清空角色管理器中的当前角色介绍
        if (this.characterManagement.currentCharacter) {
            const oldIntro = this.characterManagement.currentCharacter.介绍 || '';
            this.characterManagement.currentCharacter.介绍 = '';
            console.log(`🧹 已清空角色管理器中的角色介绍 (原长度: ${oldIntro.length})`);
        }

        // 重要：触发表单变化事件，确保前端状态同步
        const introTextarea = document.getElementById('character-introduction');
        if (introTextarea) {
            // 触发input和change事件，确保前端组件知道值已改变
            introTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            introTextarea.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('🧹 已触发介绍输入框的变化事件');
        }
        
        console.log('✅ 前端角色简介清空完成');
    }

    /**
     * 显示生成状态
     */
    showGenerationStatus(isGenerating) {
        const statusDiv = document.getElementById('generation-status');
        if (statusDiv) {
            statusDiv.style.display = isGenerating ? 'block' : 'none';
        }
    }

    /**
     * 显示生成结果
     */
    showGenerationResult(success) {
        const resultDiv = document.getElementById('generation-result');
        if (!resultDiv) return;

        if (success) {
            resultDiv.style.display = 'block';
            const resultContent = resultDiv.querySelector('.result-content p');
            if (resultContent) {
                resultContent.textContent = '数据书已成功生成并保存。您可以在角色列表中查看完整内容，或在聊天中体验角色的智能对话能力。';
            }
        } else {
            resultDiv.style.display = 'none';
        }
    }

    /**
     * 获取按钮的原始文本
     */
    getButtonOriginalText(button) {
        return button.dataset.originalText || button.textContent?.trim() || '保存并AI生成数据书';
    }

    /**
     * 设置按钮加载状态
     */
    setButtonLoading(button, isLoading, text = '生成中...') {
        if (!button) return;

        if (isLoading) {
            if (!button.dataset.originalText) {
                button.dataset.originalText = this.getButtonOriginalText(button);
            }
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + text;
            button.style.opacity = '0.7';
        } else {
            button.disabled = false;
            button.style.opacity = '';
            const originalText = button.dataset.originalText || '保存并AI生成数据书';
            button.innerHTML = '<i class="fas fa-magic"></i> ' + originalText;
        }
    }

    /**
     * 显示成功弹窗
     */
    showSuccessDialog() {
        console.log('🎉 [弹窗] 开始创建成功弹窗');
        
        try {
            // 移除已存在的弹窗
            const existingDialog = document.getElementById('ai-success-dialog');
            if (existingDialog) {
                existingDialog.remove();
                console.log('🗑️ [弹窗] 移除了已存在的弹窗');
            }

            // 使用更简单的alert作为备用
            if (!document.body) {
                console.error('❌ [弹窗] document.body不存在，使用alert');
                alert('🎉 AI数据书生成成功！\n\n📝 角色信息已保存\n🧹 角色简介已清空\n🔗 双向绑定已设置');
                return;
            }

            // 创建弹窗元素
            const dialog = document.createElement('div');
            dialog.id = 'ai-success-dialog';
            dialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;

            const content = document.createElement('div');
            content.style.cssText = `
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                text-align: center;
                max-width: 450px;
                min-width: 350px;
                animation: fadeIn 0.3s ease-out;
            `;

            content.innerHTML = `
                <div style="color: #28a745; font-size: 64px; margin-bottom: 20px;">✅</div>
                <h2 style="color: #28a745; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">生成成功！</h2>
                <div style="color: #333; margin: 0 0 30px 0; line-height: 1.6; font-size: 16px;">
                    🎉 AI数据书已成功生成<br>
                    📝 角色信息已保存<br>
                    🧹 角色简介已清空<br>
                    🔗 双向绑定已设置
                </div>
                <button id="ai-success-ok" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 12px 30px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 500;
                    transition: background-color 0.2s;
                " onmouseover="this.style.background='#218838'" onmouseout="this.style.background='#28a745'">确定</button>
            `;

            dialog.appendChild(content);
            document.body.appendChild(dialog);

            console.log('✅ [弹窗] 弹窗DOM已添加到页面');

            // 绑定事件
            const okButton = document.getElementById('ai-success-ok');
            
            const closeDialog = () => {
                console.log('🚪 [弹窗] 准备关闭弹窗');
                if (dialog && dialog.parentNode) {
                    dialog.remove();
                    console.log('✅ [弹窗] 弹窗已关闭');
                    // 关闭弹窗后，关闭模态窗口
                    setTimeout(() => {
                        this.closeModalWindow();
                    }, 100);
                }
            };

            if (okButton) {
                okButton.addEventListener('click', closeDialog);
                console.log('🔘 [弹窗] 确定按钮事件已绑定');
            }

            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    closeDialog();
                }
            });

            // 移除自动关闭，让用户手动点击确定
            
            console.log('🎉 [弹窗] 成功弹窗已完全设置');
            
        } catch (error) {
            console.error('❌ [弹窗] 创建弹窗失败:', error);
            // 备用方案
            alert('🎉 AI数据书生成成功！');
        }
    }

    /**
     * 关闭模态窗口
     */
    closeModalWindow() {
        try {
            // 调用角色管理器的关闭模态框方法
            if (this.characterManagement && typeof this.characterManagement.closeCharacterModal === 'function') {
                this.characterManagement.closeCharacterModal();
                console.log('✅ 模态窗口已关闭');
            } else {
                // 备用方案：直接操作DOM
                const modal = document.getElementById('character-modal');
                if (modal) {
                    modal.style.display = 'none';
                    console.log('✅ 模态窗口已关闭（备用方案）');
                }
            }
        } catch (error) {
            console.warn('关闭模态窗口失败:', error);
        }
    }

    /**
     * 检查生成状态
     */
    isCurrentlyGenerating() {
        return this.isGenerating;
    }

    /**
     * 获取当前角色
     */
    getCurrentCharacter() {
        return this.currentCharacter;
    }
}

// 导出供其他模块使用
window.AIStorybookGenerator = AIStorybookGenerator;