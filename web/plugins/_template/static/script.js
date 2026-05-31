/**
 * 插件模板 - 前端脚本
 * 复制并修改以实现你的功能
 */

/**
 * 执行模板命令
 * 这个函数名必须与 register_command 中的 action 一致
 */
function executeTemplateCommand() {
    const client = window.pluginClient;
    
    // 1. 检查是否选择了角色
    const role = client.getCurrentRole();
    if (!role) {
        client.showToast('请先选择一个角色', 'warning');
        return;
    }
    
    // 2. 显示处理提示
    client.showToast('正在执行模板命令...', 'info');
    
    // 3. 调用后端API
    fetch('/plugins/template-plugin/process', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            role_name: role.name
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            client.showToast(data.message, 'success');
            
            // TODO: 在这里处理成功响应
            
        } else {
            client.showToast('操作失败: ' + data.error, 'error');
        }
    })
    .catch(error => {
        console.error('请求失败:', error);
        client.showToast('请求失败: ' + error.message, 'error');
    });
}

// 示例：创建浮动窗口
function showExampleWindow() {
    const client = window.pluginClient;
    
    const content = `
        <div style="padding: 20px; text-align: center;">
            <h3>示例窗口</h3>
            <p>这是一个浮动窗口示例</p>
            <button onclick="alert('按钮被点击')">点击我</button>
        </div>
    `;
    
    const windowId = client.createFloatingWindow(content, {
        duration: 5000,
        position: 'bottom-right'
    });
}

// 示例：触发角色消息
async function triggerCharacterExample() {
    const client = window.pluginClient;
    const role = client.getCurrentRole();
    
    if (!role) {
        client.showToast('请先选择角色', 'warning');
        return;
    }
    
    await client.triggerCharacterMessage(
        role.name,
        '[系统提示] 这是一条测试消息',
        true
    );
}

// 示例：模拟AI事件
async function simulateEventExample() {
    const client = window.pluginClient;
    const role = client.getCurrentRole();
    
    if (!role) {
        client.showToast('请先选择角色', 'warning');
        return;
    }
    
    await client.simulateAIEvent(
        role.name,
        '角色突然感到一阵疲惫'
    );
}

// 导出到全局（重要！）
window.executeTemplateCommand = executeTemplateCommand;
window.showExampleWindow = showExampleWindow;
window.triggerCharacterExample = triggerCharacterExample;
window.simulateEventExample = simulateEventExample;

console.log('✅ 模板插件前端脚本已加载');

