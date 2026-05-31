/**
 * 数据书编辑器（/storybook 页面入口）
 * 实际渲染与字段收集由 storybook_editor_shared.js 中的 StorybookEditor 类承担。
 * 本文件保留早期暴露的全局函数门面，让 storybook.js 与 storybook.html 不需要改动。
 */

let editingItem = null;
let currentEditor = null;

function openEditPanel(type, name, data, isNew = false) {
    const panel = document.getElementById('edit-panel');
    const form = document.getElementById('edit-form');
    const titleEl = document.getElementById('edit-title');
    if (!panel || !form) {
        console.error('openEditPanel: 找不到 #edit-panel 或 #edit-form');
        return;
    }
    if (typeof window.StorybookEditor !== 'function') {
        console.error('openEditPanel: StorybookEditor 未加载');
        return;
    }

    editingItem = { type, name, data, isNew };
    if (titleEl) titleEl.textContent = isNew ? '创建新数据书' : '编辑数据书';

    if (currentEditor) {
        currentEditor.destroy();
        currentEditor = null;
    }

    currentEditor = new window.StorybookEditor(form, {
        name,
        data,
        isNew,
        rolesData: window.rolesData,
        playersData: window.playersData,
        submitLabel: isNew ? '创建' : '保存',
        onSave: ({ name: updatedName, doc, isNew: wasNew }) => saveStory(updatedName, doc, wasNew, name),
        onCancel: closeEditPanel
    });
    currentEditor.mount();

    panel.classList.add('open');

    // 数据未加载时拉一遍（与旧逻辑一致）
    if (!window.rolesData || Object.keys(window.rolesData).length === 0) {
        if (typeof window.loadRoles === 'function') window.loadRoles();
    }
    if (!window.playersData || Object.keys(window.playersData).length === 0) {
        if (typeof window.loadPlayers === 'function') window.loadPlayers();
    }
}

function closeEditPanel() {
    const panel = document.getElementById('edit-panel');
    if (panel) panel.classList.remove('open');
    if (currentEditor) {
        currentEditor.destroy();
        currentEditor = null;
    }
    editingItem = null;
}

// 兼容历史调用
function saveEdit() {
    if (currentEditor) currentEditor.requestSave();
}

async function saveStory(updatedName, doc, isNew, originalName) {
    const url = isNew
        ? '/api/stories'
        : `/api/stories/${encodeURIComponent(originalName || updatedName)}`;
    const method = isNew ? 'POST' : 'PUT';
    const body = isNew ? { ...doc, story_name: updatedName } : doc;

    try {
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.success) {
            closeEditPanel();
            if (typeof window.loadStories === 'function') window.loadStories();
            if (typeof showToast === 'function') showToast('数据书保存成功', 'success');
        } else if (typeof showToast === 'function') {
            showToast('保存失败: ' + (data.error || '未知错误'), 'error');
        } else {
            alert('保存失败: ' + (data.error || '未知错误'));
        }
    } catch (e) {
        console.error('保存失败:', e);
        if (typeof showToast === 'function') {
            showToast('保存失败: ' + e.message, 'error');
        } else {
            alert('保存失败: ' + e.message);
        }
    }
}

// 创建新数据书入口（storybook.js 仍调用）
function createNewStory() {
    const storyName = prompt('输入新编年史的名称:');
    if (!storyName || storyName.trim() === '') {
        alert('数据书名不能为空');
        return;
    }

    const storyData = {
        总结词: [],
        关键词: [],
        属性: {
            "状态": { "名称": "", "描述": "", "性格特点": "" },
            "外貌特征": { "身高": "", "体重": "", "发色": "", "瞳色": "", "特征": "" },
            "能力值": { "力量": "/100", "智力": "/100", "敏捷": "/100", "体质": "/100", "生命": "/100", "金币": "" },
            "社交关系": { "朋友": [], "恋人": "无", "敌人": [] },
            "背包": {}
        },
        标签: [],
        捆绑角色: [],
        捆绑玩家: [],
        描述: '新编年史，等待铭刻...'
    };

    openEditPanel('story', storyName.trim(), storyData, true);
}

// 当 rolesData/playersData 异步加载完成后由 storybook.js 调用
function refreshExistingSelectors() {
    if (currentEditor) {
        currentEditor.refreshSelectors(window.rolesData, window.playersData);
    }
}

// 暴露到全局（storybook.js / storybook.html 依赖）
window.openEditPanel = openEditPanel;
window.closeEditPanel = closeEditPanel;
window.saveEdit = saveEdit;
window.createNewStory = createNewStory;
window.refreshExistingSelectors = refreshExistingSelectors;
// 旧 API 占位，保持向后兼容
window.openEditPanelWithFix = openEditPanel;
window.fixExistingCustomAttributes = function () {};

console.log('数据书编辑器入口（薄包装版）已加载');
