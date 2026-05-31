/**
 * 角色功能模块主入口文件
 * 整合角色导入、数据书创建等功能
 * 提供统一的角色管理功能接口
 */

class CharacterFeatures {
    constructor(characterManagement) {
        this.characterManagement = characterManagement;
        this.importer = null;
        this.exporter = null;
        this.storybookCreator = null;
        
        this.init();
    }

    async init() {
        console.log('CharacterFeatures: 开始初始化角色功能模块...');
        
        // 等待依赖的类加载完成
        await this.waitForDependencies();
        
        // 初始化各个子模块
        this.initImporter();
        this.initExporter();
        this.initStorybookCreator();
        
        // 设置模块间的协作关系
        this.setupModuleInteractions();
        
        console.log('CharacterFeatures: 角色功能模块初始化完成');
    }

    /**
     * 等待依赖的类加载完成
     */
    async waitForDependencies() {
        const maxAttempts = 50; // 最多等待5秒
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            if (window.CharacterImporter && window.CharacterExporter && window.StorybookCreator) {
                console.log('CharacterFeatures: 依赖类已加载完成');
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        console.warn('CharacterFeatures: 等待依赖类加载超时');
    }

    /**
     * 初始化角色导入器
     */
    initImporter() {
        if (window.CharacterImporter) {
            this.importer = new window.CharacterImporter(this.characterManagement);
            console.log('CharacterFeatures: 角色导入器初始化完成');
        } else {
            console.warn('CharacterFeatures: CharacterImporter 类未找到');
        }
    }

    /**
     * 初始化角色导出器
     */
    initExporter() {
        if (window.CharacterExporter) {
            this.exporter = new window.CharacterExporter(this.characterManagement);
            console.log('CharacterFeatures: 角色导出器初始化完成');
        } else {
            console.warn('CharacterFeatures: CharacterExporter 类未找到');
        }
    }

    /**
     * 初始化数据书创建器
     */
    initStorybookCreator() {
        if (window.StorybookCreator) {
            this.storybookCreator = new window.StorybookCreator(this.characterManagement);
            console.log('CharacterFeatures: 数据书创建器初始化完成');
        } else {
            console.warn('CharacterFeatures: StorybookCreator 类未找到');
        }
    }

    /**
     * 设置模块间的协作关系
     */
    setupModuleInteractions() {
        if (this.importer && this.storybookCreator) {
            // 设置数据书创建完成后的回调
            this.storybookCreator.setOnStorybookCreatedCallback((storybookName, result) => {
                console.log(`CharacterFeatures: 数据书 "${storybookName}" 创建完成`, result);
                
                // 刷新角色列表
                if (this.characterManagement.loadCharacters) {
                    this.characterManagement.loadCharacters();
                }
                
                // 触发自定义事件
                this.dispatchStorybookCreatedEvent(storybookName, result);
            });
            
            console.log('CharacterFeatures: 模块协作关系设置完成');
        }
    }

    /**
     * 打开角色导入模态框
     */
    openImportModal() {
        if (this.importer) {
            this.importer.openImportModal();
        } else {
            console.warn('CharacterFeatures: 角色导入器未初始化');
        }
    }

    /**
     * 显示AI创建数据书模态框
     */
    showAIStorybookModal(characterName, characterData = null) {
        if (this.storybookCreator) {
            this.storybookCreator.showAIStorybookModal(characterName, characterData);
        } else {
            console.warn('CharacterFeatures: 数据书创建器未初始化');
        }
    }

    /**
     * 显示AI创建选项模态框
     */
    showAICreationOptionsModal(characterName, characterData = null) {
        if (this.storybookCreator) {
            this.storybookCreator.showAICreationOptionsModal(characterName, characterData);
        } else {
            console.warn('CharacterFeatures: 数据书创建器未初始化');
        }
    }

    /**
     * 为角色创建数据书 - 快捷方法
     */
    async createStorybookForCharacter(characterName, options = {}) {
        if (this.storybookCreator) {
            return await this.storybookCreator.quickCreateStorybook(characterName, options);
        } else {
            console.warn('CharacterFeatures: 数据书创建器未初始化');
            throw new Error('数据书创建器未初始化');
        }
    }

    /**
     * 从描述创建数据书
     */
    async createStorybookFromDescription(characterName, description, enableEvents = false) {
        if (this.storybookCreator) {
            return await this.storybookCreator.createStorybookFromDescription(characterName, description, enableEvents);
        } else {
            console.warn('CharacterFeatures: 数据书创建器未初始化');
            throw new Error('数据书创建器未初始化');
        }
    }

    /**
     * 检查角色是否已有数据书
     */
    async checkCharacterStorybook(characterName) {
        if (this.storybookCreator) {
            return await this.storybookCreator.checkCharacterStorybook(characterName);
        } else {
            console.warn('CharacterFeatures: 数据书创建器未初始化');
            return false;
        }
    }

    /**
     * 打开角色导出模态框
     */
    openExportModal() {
        if (this.exporter) {
            this.exporter.showExportModal();
        } else {
            console.warn('CharacterFeatures: 角色导出器未初始化');
        }
    }

    /**
     * 导出角色为图片 (兼容旧方法)
     */
    async exportCharacterAsImage() {
        if (this.importer) {
            return await this.importer.exportCharacterAsImage();
        } else {
            console.warn('CharacterFeatures: 角色导入器未初始化');
        }
    }

    /**
     * 触发数据书创建完成事件
     */
    dispatchStorybookCreatedEvent(storybookName, result) {
        const event = new CustomEvent('storybookCreated', {
            detail: {
                storybookName,
                result,
                timestamp: new Date().toISOString()
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * 获取导入器实例
     */
    getImporter() {
        return this.importer;
    }

    /**
     * 获取导出器实例
     */
    getExporter() {
        return this.exporter;
    }

    /**
     * 获取数据书创建器实例
     */
    getStorybookCreator() {
        return this.storybookCreator;
    }

    /**
     * 销毁模块，清理资源
     */
    destroy() {
        this.importer = null;
        this.exporter = null;
        this.storybookCreator = null;
        this.characterManagement = null;
        
        console.log('CharacterFeatures: 模块已销毁');
    }

    /**
     * 获取模块状态信息
     */
    getStatus() {
        return {
            initialized: !!(this.importer && this.exporter && this.storybookCreator),
            importerReady: !!this.importer,
            exporterReady: !!this.exporter,
            storybookCreatorReady: !!this.storybookCreator,
            characterManagement: !!this.characterManagement
        };
    }
}

// 导出类以供其他模块使用
window.CharacterFeatures = CharacterFeatures;

// 提供便捷的初始化函数
window.initCharacterFeatures = function(characterManagement) {
    if (!window.characterFeatures) {
        window.characterFeatures = new CharacterFeatures(characterManagement);
    }
    return window.characterFeatures;
};
