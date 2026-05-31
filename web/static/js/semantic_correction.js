/**
 * 语义修正功能
 * 处理消息-数据书关联修正的前端逻辑
 */

class SemanticCorrectionManager {
    constructor() {
        this.currentMessage = '';
        this.selectedStorybook = '';
        this.extractedKeywords = {};
        this.approvedKeywords = {};
        this.rejectedKeywords = [];
        
        this.initializeElements();
        this.bindEvents();
        this.loadStorybooks();
        this.loadMessageFromURL();
    }
    
    initializeElements() {
        this.messageContent = document.getElementById('messageContent');
        this.storybookSearch = document.getElementById('storybookSearch');
        this.storybookSelect = document.getElementById('storybookSelect');
        this.refreshStorybooksBtn = document.getElementById('refreshStorybooks');
        this.extractKeywordsBtn = document.getElementById('extractKeywordsBtn');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.errorMessage = document.getElementById('errorMessage');
        this.successMessage = document.getElementById('successMessage');
        this.keywordsSection = document.getElementById('keywordsSection');
        this.keywordsGrid = document.getElementById('keywordsGrid');
        this.saveSection = document.getElementById('saveSection');
        this.approvedCountSpan = document.getElementById('approvedCount');
        this.rejectedCountSpan = document.getElementById('rejectedCount');
        this.saveBtn = document.getElementById('saveBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        
        // 存储所有数据书数据用于搜索
        this.allStorybooks = [];
    }
    
    bindEvents() {
        this.refreshStorybooksBtn.addEventListener('click', () => {
            this.loadStorybooks();
        });
        
        // 搜索框事件监听
        this.storybookSearch.addEventListener('input', (e) => {
            this.filterStorybooks(e.target.value);
        });
        
        // 搜索框回车键选择第一个匹配项
        this.storybookSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const firstOption = this.storybookSelect.options[1]; // 跳过默认选项
                if (firstOption && firstOption.style.display !== 'none') {
                    this.storybookSelect.value = firstOption.value;
                    this.selectedStorybook = firstOption.value;
                    this.updateExtractButton();
                }
            }
        });
        
        this.extractKeywordsBtn.addEventListener('click', () => {
            this.extractKeywords();
        });
        
        this.saveBtn.addEventListener('click', () => {
            this.saveKeywords();
        });
        
        this.cancelBtn.addEventListener('click', () => {
            this.cancelCorrection();
        });
        
        this.storybookSelect.addEventListener('change', () => {
            this.selectedStorybook = this.storybookSelect.value;
            this.updateExtractButton();
        });
        
        // 监听分类选择变化
        document.querySelectorAll('.category-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateExtractButton();
            });
        });
    }
    
    loadMessageFromURL() {
        // 从URL参数获取消息内容
        const urlParams = new URLSearchParams(window.location.search);
        const message = urlParams.get('message');
        const storybook = urlParams.get('storybook');
        
        if (message) {
            this.currentMessage = decodeURIComponent(message);
            this.messageContent.textContent = this.currentMessage;
        }
        
        if (storybook) {
            this.selectedStorybook = decodeURIComponent(storybook);
            // 等待数据书列表加载完成后选择
            setTimeout(() => {
                this.storybookSelect.value = this.selectedStorybook;
            }, 500);
        }
        
        this.updateExtractButton();
    }
    
    async loadStorybooks() {
        try {
            const response = await fetch('/api/semantic-correction/storybooks');
            const data = await response.json();
            
            if (data.success) {
                this.populateStorybookSelect(data.storybooks);
            } else {
                this.showError('获取数据书列表失败: ' + data.error);
            }
        } catch (error) {
            this.showError('网络错误: ' + error.message);
        }
    }
    
    populateStorybookSelect(storybooks) {
        // 存储所有数据书数据用于搜索
        this.allStorybooks = storybooks;
        
        // 清空现有选项（保留第一个默认选项）
        while (this.storybookSelect.children.length > 1) {
            this.storybookSelect.removeChild(this.storybookSelect.lastChild);
        }
        
        // 添加数据书选项
        storybooks.forEach(storybook => {
            const option = document.createElement('option');
            option.value = storybook.name;
            option.textContent = `${storybook.display_name} (${storybook.name})`;
            option.title = `总结词: ${storybook.summary.join(', ')}\n关键词: ${storybook.keywords.join(', ')}`;
            this.storybookSelect.appendChild(option);
        });
        
        // 如果有预选的数据书，设置选中
        if (this.selectedStorybook) {
            this.storybookSelect.value = this.selectedStorybook;
        }
    }
    
    filterStorybooks(searchTerm) {
        const options = this.storybookSelect.querySelectorAll('option');
        
        // 如果搜索词为空，显示所有选项
        if (!searchTerm.trim()) {
            options.forEach(option => {
                if (option.value !== '') { // 跳过默认选项
                    option.style.display = '';
                }
            });
            return;
        }
        
        const searchLower = searchTerm.toLowerCase();
        
        options.forEach(option => {
            if (option.value === '') { // 默认选项始终显示
                return;
            }
            
            const optionText = option.textContent.toLowerCase();
            const optionValue = option.value.toLowerCase();
            
            // 检查名称或显示名称是否包含搜索词
            if (optionText.includes(searchLower) || optionValue.includes(searchLower)) {
                option.style.display = '';
            } else {
                option.style.display = 'none';
            }
        });
        
        // 如果当前选中的选项被隐藏了，清空选择
        const selectedOption = this.storybookSelect.selectedOptions[0];
        if (selectedOption && selectedOption.style.display === 'none') {
            this.storybookSelect.value = '';
            this.selectedStorybook = '';
            this.updateExtractButton();
        }
    }
    
    updateExtractButton() {
        const hasMessage = this.currentMessage.trim().length > 0;
        const hasStorybook = this.selectedStorybook.length > 0;
        const hasSelectedCategories = document.querySelectorAll('.category-item input[type="checkbox"]:checked').length > 0;
        
        this.extractKeywordsBtn.disabled = !(hasMessage && hasStorybook && hasSelectedCategories);
    }
    
    getSelectedCategories() {
        const selected = [];
        document.querySelectorAll('.category-item input[type="checkbox"]:checked').forEach(checkbox => {
            selected.push(checkbox.value);
        });
        return selected;
    }
    
    async extractKeywords() {
        if (!this.currentMessage.trim()) {
            this.showError('消息内容不能为空');
            return;
        }
        
        if (!this.selectedStorybook) {
            this.showError('请选择数据书');
            return;
        }
        
        const selectedCategories = this.getSelectedCategories();
        if (selectedCategories.length === 0) {
            this.showError('请至少选择一个分类');
            return;
        }
        
        this.showLoading();
        this.hideMessages();
        
        try {
            const response = await fetch('/api/semantic-correction/extract-keywords', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: this.currentMessage,
                    storybook_name: this.selectedStorybook,
                    expected_categories: selectedCategories
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.extractedKeywords = data.extracted_keywords;
                this.displayExtractedKeywords();
                this.showSuccess('关键词提取完成，请审批以下关键词');
            } else {
                this.showError('提取关键词失败: ' + data.error);
            }
        } catch (error) {
            this.showError('网络错误: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    displayExtractedKeywords() {
        this.keywordsGrid.innerHTML = '';
        this.approvedKeywords = {};
        this.rejectedKeywords = [];
        
        // 按分类显示关键词
        for (const [category, subcategories] of Object.entries(this.extractedKeywords)) {
            const categorySection = this.createCategorySection(category, subcategories);
            this.keywordsGrid.appendChild(categorySection);
        }
        
        this.keywordsSection.style.display = 'block';
        this.updateSaveSection();
    }
    
    createCategorySection(category, subcategories) {
        const section = document.createElement('div');
        section.className = 'category-section';
        
        const title = document.createElement('div');
        title.className = 'category-section-title';
        title.textContent = this.getCategoryDisplayName(category);
        section.appendChild(title);
        
        for (const [subcategory, keywords] of Object.entries(subcategories)) {
            if (Object.keys(keywords).length === 0) continue;
            
            const subcategoryDiv = this.createSubcategoryDiv(category, subcategory, keywords);
            section.appendChild(subcategoryDiv);
        }
        
        return section;
    }
    
    createSubcategoryDiv(category, subcategory, keywords) {
        const div = document.createElement('div');
        div.className = 'subcategory';
        
        const title = document.createElement('div');
        title.className = 'subcategory-title';
        title.textContent = this.getSubcategoryDisplayName(subcategory);
        div.appendChild(title);
        
        for (const [keyword, weight] of Object.entries(keywords)) {
            const keywordItem = this.createKeywordItem(category, subcategory, keyword, weight);
            div.appendChild(keywordItem);
        }
        
        return div;
    }
    
    createKeywordItem(category, subcategory, keyword, weight) {
        const item = document.createElement('div');
        item.className = 'keyword-item';
        item.dataset.category = category;
        item.dataset.subcategory = subcategory;
        item.dataset.keyword = keyword;
        item.dataset.weight = weight;
        
        const text = document.createElement('span');
        text.className = 'keyword-text';
        text.textContent = keyword;
        
        const weightSpan = document.createElement('span');
        weightSpan.className = 'keyword-weight';
        weightSpan.textContent = weight > 0 ? `+${weight}` : weight.toString();
        
        const actions = document.createElement('div');
        actions.className = 'keyword-actions';
        
        const approveBtn = document.createElement('button');
        approveBtn.className = 'keyword-btn approve-btn';
        approveBtn.textContent = '✓';
        approveBtn.title = '批准此关键词';
        approveBtn.onclick = () => this.approveKeyword(item);
        
        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'keyword-btn reject-btn';
        rejectBtn.textContent = '✗';
        rejectBtn.title = '拒绝此关键词';
        rejectBtn.onclick = () => this.rejectKeyword(item);
        
        actions.appendChild(approveBtn);
        actions.appendChild(rejectBtn);
        
        item.appendChild(text);
        item.appendChild(weightSpan);
        item.appendChild(actions);
        
        return item;
    }
    
    approveKeyword(item) {
        const category = item.dataset.category;
        const subcategory = item.dataset.subcategory;
        const keyword = item.dataset.keyword;
        const weight = parseFloat(item.dataset.weight);
        
        // 从拒绝列表中移除（如果存在）
        const rejectedIndex = this.rejectedKeywords.indexOf(keyword);
        if (rejectedIndex > -1) {
            this.rejectedKeywords.splice(rejectedIndex, 1);
        }
        
        // 添加到批准列表
        const path = `${category}.${subcategory}`;
        if (!this.approvedKeywords[path]) {
            this.approvedKeywords[path] = {};
        }
        this.approvedKeywords[path][keyword] = weight;
        
        // 更新UI
        item.classList.remove('rejected');
        item.classList.add('approved');
        
        this.updateSaveSection();
    }
    
    rejectKeyword(item) {
        const category = item.dataset.category;
        const subcategory = item.dataset.subcategory;
        const keyword = item.dataset.keyword;
        
        // 从批准列表中移除（如果存在）
        const path = `${category}.${subcategory}`;
        if (this.approvedKeywords[path] && this.approvedKeywords[path][keyword]) {
            delete this.approvedKeywords[path][keyword];
            if (Object.keys(this.approvedKeywords[path]).length === 0) {
                delete this.approvedKeywords[path];
            }
        }
        
        // 添加到拒绝列表
        if (!this.rejectedKeywords.includes(keyword)) {
            this.rejectedKeywords.push(keyword);
        }
        
        // 更新UI
        item.classList.remove('approved');
        item.classList.add('rejected');
        
        this.updateSaveSection();
    }
    
    updateSaveSection() {
        const approvedCount = Object.values(this.approvedKeywords).reduce((count, keywords) => {
            return count + Object.keys(keywords).length;
        }, 0);
        
        const rejectedCount = this.rejectedKeywords.length;
        
        this.approvedCountSpan.textContent = approvedCount;
        this.rejectedCountSpan.textContent = rejectedCount;
        
        if (approvedCount > 0 || rejectedCount > 0) {
            this.saveSection.classList.add('show');
        } else {
            this.saveSection.classList.remove('show');
        }
    }
    
    async saveKeywords() {
        if (Object.keys(this.approvedKeywords).length === 0) {
            this.showError('没有要保存的关键词');
            return;
        }
        
        this.saveBtn.disabled = true;
        this.saveBtn.textContent = '保存中...';
        
        try {
            const response = await fetch('/api/semantic-correction/approve-keywords', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    storybook_name: this.selectedStorybook,
                    approved_keywords: this.approvedKeywords,
                    rejected_keywords: this.rejectedKeywords
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess(`成功保存 ${data.updated_count} 个关键词到用户配置文件`);
                
                // 提供选项：继续修正或返回
                setTimeout(() => {
                    const continueCorrection = confirm('关键词已保存成功！\n\n点击"确定"继续修正其他消息\n点击"取消"返回聊天界面');
                    if (continueCorrection) {
                        this.resetForm();
                    } else {
                        this.returnToChat();
                    }
                }, 2000);
            } else {
                this.showError('保存失败: ' + data.error);
            }
        } catch (error) {
            this.showError('网络错误: ' + error.message);
        } finally {
            this.saveBtn.disabled = false;
            this.saveBtn.textContent = '💾 保存关键词到用户配置';
        }
    }
    
    cancelCorrection() {
        const hasChanges = Object.keys(this.approvedKeywords).length > 0 || this.rejectedKeywords.length > 0;
        
        if (hasChanges) {
            const shouldCancel = confirm('您有未保存的更改，确定要取消修正吗？');
            if (!shouldCancel) {
                return;
            }
        }
        
        this.returnToChat();
    }
    
    resetForm() {
        this.currentMessage = '';
        this.selectedStorybook = '';
        this.extractedKeywords = {};
        this.approvedKeywords = {};
        this.rejectedKeywords = [];
        
        this.messageContent.textContent = '';
        this.storybookSelect.value = '';
        this.keywordsSection.style.display = 'none';
        this.saveSection.classList.remove('show');
        this.hideMessages();
        
        this.updateExtractButton();
    }
    
    returnToChat() {
        // 尝试返回聊天界面
        if (window.opener && window.opener !== window) {
            // 如果是从聊天界面打开的弹窗，关闭弹窗
            window.close();
        } else {
            // 否则跳转到主页面
            window.location.href = '/';
        }
    }
    
    getCategoryDisplayName(category) {
        const names = {
            'gender': '性别特征',
            'sports': '运动特征',
            'personality': '性格特征',
            'occupation': '职业特征',
            'race': '种族特征'
        };
        return names[category] || category;
    }
    
    getSubcategoryDisplayName(subcategory) {
        const names = {
            'female_keywords': '女性关键词',
            'male_keywords': '男性关键词',
            'running_keywords': '跑步关键词',
            'athletics_keywords': '田径关键词',
            'general_sports_keywords': '通用运动关键词',
            'positive_traits': '正面特质',
            'negative_traits': '负面特质',
            'student_keywords': '学生关键词',
            'artist_keywords': '艺术家关键词',
            'adventurer_keywords': '冒险者关键词',
            'human_keywords': '人类关键词',
            'elf_keywords': '精灵关键词',
            'dark_elf_keywords': '黑暗精灵关键词'
        };
        return names[subcategory] || subcategory;
    }
    
    showLoading() {
        this.loadingIndicator.style.display = 'block';
    }
    
    hideLoading() {
        this.loadingIndicator.style.display = 'none';
    }
    
    showError(message) {
        this.hideMessages();
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
    }
    
    showSuccess(message) {
        this.hideMessages();
        this.successMessage.textContent = message;
        this.successMessage.style.display = 'block';
    }
    
    hideMessages() {
        this.errorMessage.style.display = 'none';
        this.successMessage.style.display = 'none';
    }
}

// 全局函数：从聊天界面打开修正页面
window.openSemanticCorrection = function(message, storybookHint = '') {
    const params = new URLSearchParams({
        message: encodeURIComponent(message)
    });
    
    if (storybookHint) {
        params.append('storybook', encodeURIComponent(storybookHint));
    }
    
    const url = `/semantic-correction?${params.toString()}`;
    
    // 在新窗口中打开修正页面
    const width = 1200;
    const height = 800;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    
    window.open(
        url,
        'semantic_correction',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new SemanticCorrectionManager();
});
