/**
 * 配置切换模态框管理
 */

console.log('🔧 config_switch_modal.js 已加载');

// 全局变量
let configSwitchModal = null;
let currentConfigs = [];
let isConfigSwitching = false;

// 初始化配置切换模态框
document.addEventListener('DOMContentLoaded', function() {
    configSwitchModal = document.getElementById('configSwitchModal');
    
    // 加载当前配置名称
    loadCurrentConfigName();
    
    // 设置模态框点击外部关闭
    setupModalOutsideClick();
});

/**
 * 加载当前配置名称到header按钮
 */
async function loadCurrentConfigName() {
    try {
        const response = await fetch('/api/config_switch/current');
        const result = await response.json();
        
        if (result.success) {
            const configNameElement = document.getElementById('currentConfigName');
            if (configNameElement) {
                configNameElement.textContent = result.current_config;
            }
        } else {
            console.error('获取当前配置失败:', result.error);
        }
    } catch (error) {
        console.error('加载当前配置名称失败:', error);
        const configNameElement = document.getElementById('currentConfigName');
        if (configNameElement) {
            configNameElement.textContent = '加载失败';
        }
    }
}

/**
 * 打开配置切换模态框
 */
window.openConfigSwitchModal = function() {
    console.log('🎛️ 配置切换按钮被点击');
    
    if (!configSwitchModal) {
        console.error('❌ 配置切换模态框未找到');
        console.log('🔍 尝试重新获取模态框元素...');
        configSwitchModal = document.getElementById('configSwitchModal');
        if (!configSwitchModal) {
            console.error('❌ 模态框元素确实不存在');
            return;
        }
        console.log('✅ 成功重新获取模态框元素');
    }
    
    // 显示模态框
    configSwitchModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // 添加show类来触发动画
    setTimeout(() => {
        configSwitchModal.classList.add('show');
    }, 10);
    
    // 加载配置列表
    loadConfigList();
};

/**
 * 关闭配置切换模态框
 */
window.closeConfigSwitchModal = function() {
    if (!configSwitchModal) return;
    
    // 移除show类来触发关闭动画
    configSwitchModal.classList.remove('show');
    
    // 等待动画完成后隐藏模态框
    setTimeout(() => {
        configSwitchModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }, 300);
    
    // 清理状态
    currentConfigs = [];
    isConfigSwitching = false;
};

/**
 * 设置点击模态框外部关闭
 */
function setupModalOutsideClick() {
    if (!configSwitchModal) return;
    
    configSwitchModal.addEventListener('click', function(event) {
        if (event.target === configSwitchModal) {
            closeConfigSwitchModal();
        }
    });
}

/**
 * 加载配置列表
 */
async function loadConfigList() {
    const loadingState = document.getElementById('configLoadingState');
    const emptyState = document.getElementById('configEmptyState');
    const configsGrid = document.getElementById('configsGrid');
    const configCount = document.getElementById('configCount');
    const modalCurrentConfig = document.getElementById('modalCurrentConfig');
    
    // 显示加载状态
    if (loadingState) loadingState.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    if (configsGrid) configsGrid.innerHTML = '';
    
    try {
        const response = await fetch('/api/config_switch/list');
        const result = await response.json();
        
        if (result.success) {
            currentConfigs = result.configs;
            
            // 更新当前配置显示
            if (modalCurrentConfig) {
                modalCurrentConfig.textContent = result.current_config;
            }
            
            // 更新配置计数
            if (configCount) {
                configCount.textContent = `共 ${currentConfigs.length} 个配置`;
            }
            
            // 渲染配置列表
            renderConfigList(currentConfigs);
            
        } else {
            console.error('获取配置列表失败:', result.error);
            showEmptyState('获取配置列表失败');
        }
        
    } catch (error) {
        console.error('加载配置列表失败:', error);
        showEmptyState('网络错误，请稍后重试');
        
    } finally {
        // 隐藏加载状态
        if (loadingState) loadingState.style.display = 'none';
    }
}

/**
 * 渲染配置列表
 */
function renderConfigList(configs) {
    const configsGrid = document.getElementById('configsGrid');
    const emptyState = document.getElementById('configEmptyState');
    
    if (!configsGrid) return;
    
    if (!configs || configs.length === 0) {
        showEmptyState('没有找到可用配置');
        return;
    }
    
    // 隐藏空状态
    if (emptyState) emptyState.style.display = 'none';
    
    // 清空现有内容
    configsGrid.innerHTML = '';
    
    // 渲染每个配置项
    configs.forEach(config => {
        const configItem = createConfigItem(config);
        configsGrid.appendChild(configItem);
    });
}

/**
 * 创建配置项元素
 */
function createConfigItem(config) {
    const configItem = document.createElement('div');
    configItem.className = `config-item ${config.is_active ? 'active' : ''}`;
    configItem.setAttribute('data-folder', config.folder_name);
    
    configItem.innerHTML = `
        <div class="config-info">
            <div class="config-name">${escapeHtml(config.display_name)}</div>
            <div class="config-folder">文件夹: ${escapeHtml(config.folder_name)}</div>
        </div>
        <div class="config-actions">
            <button class="config-export-btn-small" 
                    onclick="exportConfig('${escapeHtml(config.folder_name)}', '${escapeHtml(config.display_name)}')"
                    title="导出此配置">
                📤
            </button>
            ${!config.is_active ? `
                <button class="config-delete-btn-small" 
                        onclick="deleteConfig('${escapeHtml(config.folder_name)}', '${escapeHtml(config.display_name)}')"
                        title="删除此配置">
                    🗑️
                </button>
                <button class="config-switch-btn-small" 
                        onclick="switchToConfig('${escapeHtml(config.folder_name)}', '${escapeHtml(config.display_name)}')"
                        ${isConfigSwitching ? 'disabled' : ''}>
                    切换
                </button>
            ` : `
                <span class="current-indicator">当前</span>
            `}
        </div>
    `;
    
    // 为非当前配置添加点击事件
    if (!config.is_active) {
        configItem.addEventListener('click', (e) => {
            // 避免按钮点击事件冒泡
            if (e.target.tagName === 'BUTTON') return;
            
            switchToConfig(config.folder_name, config.display_name);
        });
    }
    
    return configItem;
}

/**
 * 切换到指定配置
 */
window.switchToConfig = async function(folderName, displayName) {
    if (isConfigSwitching) {
        console.log('正在切换配置中，请稍候...');
        return;
    }
    
    // 确认切换
    const confirmed = confirm(`确定要切换到配置 "${displayName}" 吗？\n\n当前配置将被备份，然后加载新配置的所有数据。`);
    if (!confirmed) return;
    
    isConfigSwitching = true;
    
    // 禁用所有切换按钮
    const switchButtons = document.querySelectorAll('.config-switch-btn-small');
    switchButtons.forEach(btn => {
        btn.disabled = true;
        btn.textContent = '切换中...';
    });
    
    try {
        const response = await fetch('/api/config_switch/switch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                config_folder: folderName
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 切换成功
            alert(`配置切换成功！\n\n${result.message}`);
            
            // 更新当前配置名称显示
            const configNameElement = document.getElementById('currentConfigName');
            if (configNameElement) {
                configNameElement.textContent = displayName;
            }
            
            // 关闭模态框
            closeConfigSwitchModal();
            
            // 刷新页面以加载新配置的数据
            setTimeout(() => {
                window.location.reload();
            }, 500);
            
        } else {
            // 切换失败
            alert(`配置切换失败：\n\n${result.error}`);
            console.error('配置切换失败:', result.error);
        }
        
    } catch (error) {
        console.error('切换配置时发生错误:', error);
        alert(`切换配置时发生错误：\n\n${error.message}`);
        
    } finally {
        isConfigSwitching = false;
        
        // 恢复按钮状态
        const switchButtons = document.querySelectorAll('.config-switch-btn-small');
        switchButtons.forEach(btn => {
            btn.disabled = false;
            btn.textContent = '切换';
        });
    }
};

/**
 * 刷新配置列表
 */
window.refreshConfigList = function() {
    loadConfigList();
};

/**
 * 显示空状态
 */
function showEmptyState(message = '没有找到可用配置') {
    const emptyState = document.getElementById('configEmptyState');
    const configsGrid = document.getElementById('configsGrid');
    
    if (configsGrid) configsGrid.innerHTML = '';
    
    if (emptyState) {
        const emptyMessage = emptyState.querySelector('p');
        if (emptyMessage) {
            emptyMessage.textContent = message;
        }
        emptyState.style.display = 'block';
    }
}

/**
 * HTML转义函数
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 键盘事件处理
 */
document.addEventListener('keydown', function(event) {
    // ESC键关闭模态框
    if (event.key === 'Escape') {
        if (createConfigModal && createConfigModal.style.display === 'flex') {
            closeCreateConfigModal();
        } else if (configSwitchModal && configSwitchModal.style.display === 'flex') {
            closeConfigSwitchModal();
        }
    }
});

// 页面可见性变化时重新加载当前配置名称
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        loadCurrentConfigName();
    }
});

/**
 * 创建新配置相关功能
 */

// 全局变量
let createConfigModal = null;

// 初始化创建配置模态框
document.addEventListener('DOMContentLoaded', function() {
    createConfigModal = document.getElementById('createConfigModal');
    
    // 设置模态框点击外部关闭
    setupCreateConfigModalOutsideClick();
    
    // 设置配置名称自动生成文件夹名称
    setupAutoFolderNameGeneration();
});

/**
 * 打开创建新配置模态框
 */
window.openCreateConfigModal = function() {
    console.log('🎛️ 创建新配置按钮被点击');
    
    if (!createConfigModal) {
        console.error('❌ 创建新配置模态框未找到');
        createConfigModal = document.getElementById('createConfigModal');
        if (!createConfigModal) {
            console.error('❌ 创建新配置模态框元素确实不存在');
            return;
        }
    }
    
    // 显示模态框
    createConfigModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // 添加show类来触发动画
    setTimeout(() => {
        createConfigModal.classList.add('show');
    }, 10);
    
    // 清空表单
    resetCreateConfigForm();
    
    // 聚焦到配置名称输入框
    const configNameInput = document.getElementById('newConfigName');
    if (configNameInput) {
        setTimeout(() => configNameInput.focus(), 300);
    }
};

/**
 * 关闭创建新配置模态框
 */
window.closeCreateConfigModal = function() {
    if (!createConfigModal) return;
    
    // 移除show类来触发关闭动画
    createConfigModal.classList.remove('show');
    
    // 等待动画完成后隐藏模态框
    setTimeout(() => {
        createConfigModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }, 300);
    
    // 清空表单
    resetCreateConfigForm();
};

/**
 * 设置点击模态框外部关闭
 */
function setupCreateConfigModalOutsideClick() {
    if (!createConfigModal) return;
    
    createConfigModal.addEventListener('click', function(event) {
        if (event.target === createConfigModal) {
            closeCreateConfigModal();
        }
    });
}

/**
 * 重置创建配置表单
 */
function resetCreateConfigForm() {
    const form = document.getElementById('createConfigForm');
    if (form) {
        form.reset();
    }
}

/**
 * 设置配置名称自动生成文件夹名称
 */
function setupAutoFolderNameGeneration() {
    const configNameInput = document.getElementById('newConfigName');
    const configFolderInput = document.getElementById('newConfigFolder');
    
    if (!configNameInput || !configFolderInput) return;
    
    let isManualFolder = false;
    
    // 监听文件夹名称手动输入
    configFolderInput.addEventListener('input', function() {
        isManualFolder = this.value.trim() !== '';
    });
    
    // 监听配置名称变化，自动生成文件夹名称
    configNameInput.addEventListener('input', function() {
        if (isManualFolder) return; // 如果用户手动输入了文件夹名称，不再自动生成
        
        const configName = this.value.trim();
        if (!configName) {
            configFolderInput.value = '';
            return;
        }
        
        // 生成文件夹名称：移除特殊字符，保留中英文数字下划线短横线
        let folderName = configName
            .replace(/[^\w\u4e00-\u9fa5-]/g, '_') // 替换特殊字符为下划线
            .replace(/_+/g, '_') // 合并多个下划线
            .replace(/^_|_$/g, ''); // 移除首尾下划线
        
        configFolderInput.value = folderName;
    });
}

/**
 * 创建新配置
 */
window.createNewConfig = async function() {
    const form = document.getElementById('createConfigForm');
    if (!form) {
        alert('表单未找到');
        return;
    }
    
    // 验证表单
    const formData = new FormData(form);
    const configName = formData.get('configName').trim();
    const configFolder = formData.get('configFolder').trim();
    const configDescription = formData.get('configDescription').trim();
    const copyFromCurrent = formData.get('copyFromCurrent') === 'on';
    
    // 基础验证
    if (!configName) {
        alert('请输入配置名称');
        document.getElementById('newConfigName').focus();
        return;
    }
    
    if (!configFolder) {
        alert('请输入文件夹名称');
        document.getElementById('newConfigFolder').focus();
        return;
    }
    
    // 验证文件夹名称格式
    const folderPattern = /^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/;
    if (!folderPattern.test(configFolder)) {
        alert('文件夹名称只能包含字母、数字、中文、下划线和短横线');
        document.getElementById('newConfigFolder').focus();
        return;
    }
    
    // 确认创建
    const confirmMessage = `确定要创建新配置吗？\n\n配置名称: ${configName}\n文件夹名称: ${configFolder}${configDescription ? `\n描述: ${configDescription}` : ''}${copyFromCurrent ? '\n\n将从当前配置复制基础文件' : ''}`;
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // 禁用创建按钮
    const createButton = document.querySelector('#createConfigModal .btn-primary');
    if (createButton) {
        createButton.disabled = true;
        createButton.textContent = '创建中...';
    }
    
    try {
        const response = await fetch('/api/config_switch/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                config_name: configName,
                config_folder: configFolder,
                config_description: configDescription,
                copy_from_current: copyFromCurrent
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 创建成功
            alert(`配置创建成功！\n\n${result.message}`);
            
            // 关闭创建配置模态框
            closeCreateConfigModal();
            
            // 刷新配置列表
            if (typeof loadConfigList === 'function') {
                loadConfigList();
            }
            
        } else {
            // 创建失败
            alert(`配置创建失败：\n\n${result.error}`);
            console.error('配置创建失败:', result.error);
        }
        
    } catch (error) {
        console.error('创建配置时发生错误:', error);
        alert(`创建配置时发生错误：\n\n${error.message}`);
        
    } finally {
        // 恢复按钮状态
        if (createButton) {
            createButton.disabled = false;
            createButton.textContent = '创建配置';
        }
    }
};

/**
 * 导出当前配置
 */
window.exportCurrentConfig = async function() {
    try {
        // 显示加载提示
        const exportButton = document.querySelector('.btn-export');
        if (exportButton) {
            exportButton.disabled = true;
            exportButton.textContent = '📤 导出中...';
        }
        
        const response = await fetch('/api/config_switch/export', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({}) // 空对象表示导出当前配置
        });
        
        if (response.ok) {
            // 获取文件名
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'config_export.zip';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, '');
                }
            }
            
            // 创建下载链接
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            // 显示成功消息
            alert('配置导出成功！');
            
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || '导出失败');
        }
        
    } catch (error) {
        console.error('导出配置失败:', error);
        alert(`导出配置失败：\n\n${error.message}`);
        
    } finally {
        // 恢复按钮状态
        const exportButton = document.querySelector('.btn-export');
        if (exportButton) {
            exportButton.disabled = false;
            exportButton.textContent = '📤 导出当前';
        }
    }
};

/**
 * 删除指定配置
 */
window.deleteConfig = async function(folderName, displayName) {
    try {
        // 阻止事件冒泡
        event.stopPropagation();
        
        // 安全检查：防止删除当前配置
        const modalCurrentConfig = document.getElementById('modalCurrentConfig');
        const currentConfig = modalCurrentConfig ? modalCurrentConfig.textContent : '';
        if (displayName === currentConfig) {
            alert('不能删除当前正在使用的配置！\n\n请先切换到其他配置，然后再删除此配置。');
            return;
        }
        
        // 确认删除
        const confirmed = confirm(`⚠️ 危险操作 ⚠️\n\n确定要删除配置 "${displayName}" 吗？\n\n此操作将永久删除该配置的所有数据，包括：\n• 角色数据\n• 玩家数据\n• 数据书\n• 聊天记录\n• 全局世界书\n\n此操作无法撤销！`);
        if (!confirmed) return;
        
        // 二次确认
        const doubleConfirmed = confirm(`最后确认：真的要删除配置 "${displayName}" 吗？\n\n输入配置名称进行确认删除。`);
        if (!doubleConfirmed) return;
        
        // 要求用户输入配置名称确认
        const confirmName = prompt(`请输入配置名称 "${displayName}" 来确认删除：`);
        if (confirmName !== displayName) {
            alert('配置名称不匹配，删除操作已取消。');
            return;
        }
        
        const response = await fetch('/api/config_switch/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                config_folder: folderName
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 删除成功
            alert(`配置 "${displayName}" 已成功删除！`);
            
            // 刷新配置列表
            loadConfigList();
            
        } else {
            // 删除失败
            alert(`删除配置失败：\n\n${result.error}`);
            console.error('删除配置失败:', result.error);
        }
        
    } catch (error) {
        console.error('删除配置时发生错误:', error);
        alert(`删除配置时发生错误：\n\n${error.message}`);
    }
};

/**
 * 导出指定配置
 */
window.exportConfig = async function(folderName, displayName) {
    try {
        // 阻止事件冒泡
        event.stopPropagation();
        
        // 确认导出
        const confirmed = confirm(`确定要导出配置 "${displayName}" 吗？`);
        if (!confirmed) return;
        
        const response = await fetch('/api/config_switch/export', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                config_folder: folderName
            })
        });
        
        if (response.ok) {
            // 获取文件名
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'config_export.zip';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, '');
                }
            }
            
            // 创建下载链接
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            // 显示成功消息
            alert(`配置 "${displayName}" 导出成功！`);
            
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || '导出失败');
        }
        
    } catch (error) {
        console.error('导出配置失败:', error);
        alert(`导出配置失败：\n\n${error.message}`);
    }
};

/**
 * 打开配置导入
 */
window.openConfigImport = function() {
    const fileInput = document.getElementById('configFileInput');
    if (fileInput) {
        fileInput.click();
    }
};

/**
 * 处理配置文件选择
 */
window.handleConfigFileSelect = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 检查文件类型
    if (!file.name.toLowerCase().endsWith('.zip')) {
        alert('请选择ZIP格式的配置文件！');
        return;
    }
    
    // 询问配置名称
    const customName = prompt(`即将导入配置文件：${file.name}\n\n请输入新配置的名称（留空使用原名称）:`);
    if (customName === null) {
        // 用户取消
        event.target.value = ''; // 清空文件选择
        return;
    }
    
    importConfigFile(file, customName);
};

/**
 * 导入配置文件
 */
async function importConfigFile(file, configName) {
    try {
        // 显示加载提示
        const importButton = document.querySelector('.btn-import');
        if (importButton) {
            importButton.disabled = true;
            importButton.textContent = '📥 导入中...';
        }
        
        // 创建FormData
        const formData = new FormData();
        formData.append('config_file', file);
        if (configName && configName.trim()) {
            formData.append('config_name', configName.trim());
        }
        
        const response = await fetch('/api/config_switch/import', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 导入成功
            alert(`配置导入成功！\n\n${result.message}`);
            
            // 刷新配置列表
            loadConfigList();
            
        } else {
            // 导入失败
            alert(`配置导入失败：\n\n${result.error}`);
            console.error('配置导入失败:', result.error);
        }
        
    } catch (error) {
        console.error('导入配置时发生错误:', error);
        alert(`导入配置时发生错误：\n\n${error.message}`);
        
    } finally {
        // 恢复按钮状态
        const importButton = document.querySelector('.btn-import');
        if (importButton) {
            importButton.disabled = false;
            importButton.textContent = '📥 导入配置';
        }
        
        // 清空文件选择
        const fileInput = document.getElementById('configFileInput');
        if (fileInput) {
            fileInput.value = '';
        }
    }
}

// 测试函数是否正确定义
console.log('✅ openCreateConfigModal函数已定义:', typeof window.openCreateConfigModal);
