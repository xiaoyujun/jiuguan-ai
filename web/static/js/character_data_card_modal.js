/**
 * 角色数据卡模态框管理器
 */
class CharacterDataCardModal {
    constructor() {
        this.modal = null;
        this.currentCharacterName = null;
        this.init();
    }

    init() {
        // 创建模态框HTML结构
        this.createModalHTML();
        
        // 绑定事件
        this.bindEvents();
    }

    createModalHTML() {
        // 使用已存在的模态框
        this.modal = document.getElementById('characterDataCardModal');
        
        if (!this.modal) {
            console.error('CharacterDataCardModal: 找不到模态框元素 #characterDataCardModal');
            return;
        }
    }

    bindEvents() {
        // 点击模态框背景关闭
        document.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal && this.modal.classList.contains('show')) {
                this.close();
            }
        });

        // 关闭按钮事件
        const closeBtn = document.getElementById('closeCharacterDataCard');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // 编辑数据书按钮事件
        const editBtn = document.getElementById('editCharacterDataBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.editStorybook());
        }

        // 查看详细属性按钮事件
        const viewBtn = document.getElementById('viewCharacterAttributesBtn');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => this.viewDetailedAttributes());
        }
    }

    /**
     * 显示角色数据卡
     * @param {string} characterName - 角色名称
     */
    async show(characterName) {
        if (!characterName) return;

        this.currentCharacterName = characterName;
        
        // 设置标题
        const titleElement = document.getElementById('characterDataCardName');
        if (titleElement) {
            titleElement.textContent = `${characterName} 的数据卡`;
        }

        // 设置头像
        this.setCharacterAvatar(characterName);

        // 显示模态框
        this.modal.classList.add('show');

        // 加载数据
        await this.loadCharacterData(characterName);
    }

    /**
     * 设置角色头像
     * @param {string} characterName - 角色名称
     */
    setCharacterAvatar(characterName) {
        // 使用统一的头像路由，已经包含fallback机制
        const avatarSrc = `/avatar/${encodeURIComponent(characterName)}`;
        
        // 设置标题栏小头像
        const headerAvatar = document.getElementById('characterAvatarHeader');
        if (headerAvatar) {
            headerAvatar.src = avatarSrc;
            headerAvatar.style.display = 'inline-block';
            headerAvatar.onerror = () => {
                console.warn(`标题栏头像加载失败: ${characterName}`);
            };
        }
        
        // 设置主要头像
        const avatarImg = document.getElementById('characterAvatarSmall');
        if (avatarImg) {
            avatarImg.src = avatarSrc;
            avatarImg.style.display = 'block';
            
            // 简化错误处理，因为/avatar/路由已经会返回默认头像
            avatarImg.onerror = () => {
                console.warn(`头像加载失败，但应该已显示默认头像: ${characterName}`);
            };
        }
    }

    /**
     * 加载角色数据
     * @param {string} characterName - 角色名称
     */
    async loadCharacterData(characterName) {
        const bodyElement = document.getElementById('characterDataCardBody');
        
        try {
            // 显示加载状态
            bodyElement.innerHTML = `
                <div class="loading-spinner" style="text-align: center; padding: 40px;">
                    <div style="font-size: 2rem; color: #4a5568; margin-bottom: 10px;">⏳</div>
                    <div style="color: #a0aec0;">加载角色数据中...</div>
                </div>
            `;

            // 获取角色属性数据
            const response = await fetch(`/api/character/${encodeURIComponent(characterName)}/attributes`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();

            if (result.success) {
                // API 直接在根级别返回数据，不是在 result.data 中
                this.displayCharacterData(result);
            } else {
                this.displayError(result.error || '获取角色数据失败');
            }

        } catch (error) {
            console.error('加载角色数据失败:', error);
            this.displayError('网络错误，无法加载角色数据');
        }
    }

    /**
     * 显示角色数据
     * @param {Object} data - 角色数据
     */
    displayCharacterData(data) {
        const bodyElement = document.getElementById('characterDataCardBody');
        
        // 检查数据是否存在
        if (!data) {
            this.displayError('角色数据为空');
            return;
        }
        
        // 检查是否有数据书
        if (!data.has_storybook) {
            this.displayCreateStorybookPrompt();
            return;
        }

        // 如果有数据书，直接跳转到用户属性编辑页面
        this.redirectToAttributesPage(data.character_name);
    }


    /**
     * 显示创建数据书提示
     */
    displayCreateStorybookPrompt() {
        const bodyElement = document.getElementById('characterDataCardBody');
        
        bodyElement.innerHTML = `
            <div class="create-storybook-prompt">
                <div class="create-storybook-icon">📚</div>
                <div class="create-storybook-title">该角色尚未绑定数据书</div>
                <div class="create-storybook-description">
                    数据书可以记录角色的详细属性、背景故事和发展历程。<br>
                    创建数据书后，您可以更好地管理和追踪角色信息。
                </div>
                <button class="create-storybook-button" onclick="characterDataCardModal.createStorybook()">
                    创建数据书
                </button>
            </div>
        `;
    }

    /**
     * 显示错误信息
     * @param {string} errorMessage - 错误消息
     */
    displayError(errorMessage) {
        const bodyElement = document.getElementById('characterDataCardBody');
        
        bodyElement.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 2rem; color: #e53e3e; margin-bottom: 15px;">⚠️</div>
                <div style="color: #e53e3e; font-weight: 600; margin-bottom: 10px;">加载失败</div>
                <div style="color: #a0aec0;">${this.escapeHtml(errorMessage)}</div>
            </div>
        `;
    }

    /**
     * HTML转义
     * @param {string} text - 要转义的文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }


    /**
     * 跳转到用户属性编辑页面
     * @param {string} characterName - 角色名称
     */
    redirectToAttributesPage(characterName) {
        // 关闭当前模态框
        this.close();
        
        // 跳转到用户属性页面，并预选择该角色
        const url = `/user-attributes?character=${encodeURIComponent(characterName)}`;
        window.location.href = url;
    }

    /**
     * 创建数据书
     */
    async createStorybook() {
        if (!this.currentCharacterName) return;

        const characterName = this.currentCharacterName;

        try {
            // 询问用户是否要自动创建数据书
            const autoCreate = confirm(`是否为角色"${characterName}"自动创建数据书？\n\n点击"确定"将自动创建，点击"取消"将打开数据书管理页面手动创建。`);
            
            if (autoCreate) {
                // 自动创建数据书
                const storybookName = characterName; // 使用角色名作为数据书名
                
                const response = await fetch(`/api/character/${encodeURIComponent(characterName)}/create-storybook`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        character_type: 'role' // 默认为角色类型，可以根据需要调整
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    // 成功创建，重新加载数据
                    alert(`✨ 成功为角色"${characterName}"创建数据书！`);
                    await this.loadCharacterData(characterName);
                } else {
                    throw new Error(result.error || '创建数据书失败');
                }
            } else {
                // 关闭当前模态框
                this.close();
                
                // 打开数据书管理页面
                window.open('/storybook', '_blank');
            }
            
        } catch (error) {
            console.error('创建数据书失败:', error);
            alert(`创建数据书失败: ${error.message}\n\n将为您打开数据书管理页面进行手动创建。`);
            
            // 出错时也打开数据书管理页面
            this.close();
            window.open('/storybook', '_blank');
        }
    }

    /**
     * 关闭模态框
     */
    close() {
        if (this.modal) {
            this.modal.classList.remove('show');
        }
        this.currentCharacterName = null;
    }

    /**
     * 编辑数据书
     */
    editStorybook() {
        if (!this.currentCharacterName) return;

        // 关闭当前模态框
        this.close();

        // 打开角色管理页面并定位到数据书标签
        const url = `/character-management?edit=${encodeURIComponent(this.currentCharacterName)}&tab=storybook`;
        window.open(url, '_blank');
    }

    /**
     * 查看详细属性
     */
    viewDetailedAttributes() {
        if (!this.currentCharacterName) return;

        // 关闭当前模态框
        this.close();

        // 打开用户属性页面
        const url = `/user-attributes?user=${encodeURIComponent(this.currentCharacterName)}`;
        const width = 900;
        const height = 700;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        window.open(
            url,
            'attributes_' + this.currentCharacterName.replace(/[^a-zA-Z0-9]/g, '_'),
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );
    }
}

// 全局实例
let characterDataCardModal;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    characterDataCardModal = new CharacterDataCardModal();
});

// 确保在其他脚本加载完成后也能初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!characterDataCardModal) {
            characterDataCardModal = new CharacterDataCardModal();
        }
    });
} else {
    if (!characterDataCardModal) {
        characterDataCardModal = new CharacterDataCardModal();
    }
}
