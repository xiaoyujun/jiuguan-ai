/**
 * 旁白角色表单扩展
 * 扩展角色管理表单以支持旁白角色的特殊配置
 */
class NarratorFormExtension {
    constructor() {
        this.maxRetries = 10; // 减少最大重试次数
        this.currentRetries = 0;
        this.retryInterval = 500; // 增加重试间隔，减少频率
        this.isExtended = false; // 标记是否已经扩展过
        this.init();
    }

    init() {
        // 检查是否在角色管理页面，如果不在则不初始化
        if (!window.location.pathname.includes('character-management')) {
            return;
        }
        
        // 监听自定义事件，如果CharacterManagement主动通知加载完成
        document.addEventListener('CharacterManagementReady', () => {
            if (!this.isExtended) {
                this.setupFormExtensions();
            }
        });
        
        // 等待DOM加载完成后初始化，并延迟一点确保CharacterManagement已经实例化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.setupFormExtensions(), 300);
            });
        } else {
            setTimeout(() => this.setupFormExtensions(), 300);
        }
    }

    setupFormExtensions() {
        // 如果已经扩展过，直接返回
        if (this.isExtended) {
            return;
        }
        
        // 增加重试计数
        this.currentRetries++;
        
        // 检查是否超过最大重试次数
        if (this.currentRetries > this.maxRetries) {
            console.warn('⚠️ NarratorFormExtension: 超过最大重试次数，停止尝试加载扩展');
            return;
        }
        
        // 只在第一次尝试时显示开始信息
        if (this.currentRetries === 1) {
            console.log('🔧 NarratorFormExtension: 开始设置表单扩展...');
        }
        
        // 检查CharacterManagement是否已加载
        if (!window.CharacterManagement || !window.CharacterManagement.prototype.collectFormData) {
            // 静默重试，只在最后一次失败时显示错误
            if (this.currentRetries === this.maxRetries) {
                console.error('❌ NarratorFormExtension: CharacterManagement 加载失败，表单扩展将不可用');
                return;
            }
            setTimeout(() => this.setupFormExtensions(), this.retryInterval);
            return;
        }
        
        console.log('✅ CharacterManagement 已加载，开始扩展...');
        
        // 标记为已扩展
        this.isExtended = true;
        
        // 扩展原有的collectFormData函数
        this.extendCollectFormData();
        
        // 扩展原有的populateForm函数
        this.extendPopulateForm();
        
        // 扩展原有的validateForm函数
        this.extendValidateForm();
        
        console.log('🎉 NarratorFormExtension: 表单扩展设置完成');
    }

    /**
     * 扩展表单数据收集函数
     */
    extendCollectFormData() {
        // 保存原有的collectFormData函数
        if (window.CharacterManagement && window.CharacterManagement.prototype.collectFormData) {
            const originalCollectFormData = window.CharacterManagement.prototype.collectFormData;
            
            window.CharacterManagement.prototype.collectFormData = function() {
                // 调用原有函数获取基础数据
                const formData = originalCollectFormData.call(this);
                
                // 添加旁白角色特殊字段
                const categorySelect = document.getElementById('character-category');
                if (categorySelect) {
                    formData['角色类别'] = categorySelect.value;
                }
                
                const autoMentionCheckbox = document.getElementById('narrator-auto-mention');
                if (autoMentionCheckbox) {
                    formData['旁白自动提及'] = autoMentionCheckbox.checked;
                }
                
                console.log('📋 收集到的表单数据（包含旁白配置）:', formData);
                
                return formData;
            };
        }
    }

    /**
     * 扩展表单填充函数
     */
    extendPopulateForm() {
        // 保存原有的populateForm函数
        if (window.CharacterManagement && window.CharacterManagement.prototype.populateForm) {
            const originalPopulateForm = window.CharacterManagement.prototype.populateForm;
            
            window.CharacterManagement.prototype.populateForm = function(character) {
                // 调用原有函数填充基础数据
                originalPopulateForm.call(this, character);
                
                // 填充旁白角色特殊字段
                const categorySelect = document.getElementById('character-category');
                if (categorySelect && character.角色类别) {
                    categorySelect.value = character.角色类别;
                    
                    // 触发类别变化事件
                    if (window.narratorRoleHandler) {
                        window.narratorRoleHandler.handleCategoryChange(character.角色类别);
                    }
                }
                
                const autoMentionCheckbox = document.getElementById('narrator-auto-mention');
                if (autoMentionCheckbox && typeof character.旁白自动提及 !== 'undefined') {
                    autoMentionCheckbox.checked = character.旁白自动提及;
                }
                
                console.log('📝 填充表单数据（包含旁白配置）:', character);
            };
        }
    }

    /**
     * 扩展表单验证函数
     */
    extendValidateForm() {
        // 保存原有的validateForm函数
        if (window.CharacterManagement && window.CharacterManagement.prototype.validateForm) {
            const originalValidateForm = window.CharacterManagement.prototype.validateForm;
            
            window.CharacterManagement.prototype.validateForm = function(formData) {
                // 调用原有验证
                const baseValidation = originalValidateForm.call(this, formData);
                if (!baseValidation.isValid) {
                    return baseValidation;
                }
                
                // 添加旁白角色特殊验证
                if (window.narratorRoleHandler) {
                    const narratorValidation = window.narratorRoleHandler.validateNarratorConfig(formData);
                    if (!narratorValidation.isValid) {
                        return narratorValidation;
                    }
                    
                    // 显示警告信息
                    if (narratorValidation.warnings.length > 0) {
                        narratorValidation.warnings.forEach(warning => {
                            this.showNotification(warning, 'warning');
                        });
                    }
                }
                
                return { isValid: true, errors: [], warnings: [] };
            };
        }
    }
}

// 创建实例
window.narratorFormExtension = new NarratorFormExtension();