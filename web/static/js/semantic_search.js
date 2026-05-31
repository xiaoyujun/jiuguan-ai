/**
 * 语义搜索前端JavaScript
 * 提供智能搜索功能的用户界面交互
 */

class SemanticSearchUI {
    constructor() {
        this.initElements();
        this.bindEvents();
        this.loadEngineStatus();
    }

    initElements() {
        // 搜索输入和按钮
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.searchType = document.getElementById('searchType');
        this.maxResults = document.getElementById('maxResults');
        this.searchCategory = document.getElementById('searchCategory');
        
        // 结果显示区域
        this.resultsSection = document.getElementById('resultsSection');
        this.resultsHeader = document.getElementById('resultsHeader');
        this.resultsInfo = document.getElementById('resultsInfo');
        this.resultsList = document.getElementById('resultsList');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.noResults = document.getElementById('noResults');
        
        // 建议区域
        this.suggestionsSection = document.getElementById('suggestionsSection');
        this.suggestionsList = document.getElementById('suggestionsList');
        
        // 状态显示
        this.engineStatusValue = document.getElementById('engineStatusValue');
        this.dataLoadedValue = document.getElementById('dataLoadedValue');
        this.fuzzyAvailableValue = document.getElementById('fuzzyAvailableValue');
        
        // 快速搜索按钮
        this.quickBtns = document.querySelectorAll('.quick-btn');
        
        // 类别组
        this.categoryGroup = document.querySelector('.category-group');
    }

    bindEvents() {
        // 搜索事件
        this.searchBtn.addEventListener('click', () => this.performSearch());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });
        
        // 搜索类型变化
        this.searchType.addEventListener('change', () => {
            this.onSearchTypeChange();
        });
        
        // 快速搜索按钮
        this.quickBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const query = e.target.getAttribute('data-query');
                this.searchInput.value = query;
                this.performSearch();
            });
        });
        
        // 输入建议
        this.searchInput.addEventListener('input', () => {
            this.debounce(this.loadSuggestions.bind(this), 300)();
        });
        
        // 点击建议项
        this.suggestionsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('suggestion-item')) {
                this.searchInput.value = e.target.textContent;
                this.hideSuggestions();
                this.performSearch();
            }
        });
    }

    onSearchTypeChange() {
        const searchType = this.searchType.value;
        // 显示或隐藏类别选择
        if (searchType === 'category') {
            this.categoryGroup.style.display = 'flex';
        } else {
            this.categoryGroup.style.display = 'none';
        }
    }

    async performSearch() {
        const query = this.searchInput.value.trim();
        if (!query) {
            this.showError('请输入搜索内容');
            return;
        }

        const searchType = this.searchType.value;
        const maxResults = parseInt(this.maxResults.value);
        const category = this.searchCategory.value;

        this.showLoading();
        this.hideSuggestions();

        try {
            let result;
            
            if (searchType === 'tiered') {
                result = await this.apiTieredSearch(query, maxResults);
            } else if (searchType === 'category' && category) {
                result = await this.apiCategorySearch(query, category, maxResults);
            } else {
                result = await this.apiSemanticSearch(query, searchType, maxResults);
            }

            if (result.success) {
                this.displayResults(result);
            } else {
                this.showError(result.error || '搜索失败');
            }
        } catch (error) {
            console.error('搜索错误:', error);
            this.showError('搜索请求失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async apiSemanticSearch(query, searchType, maxResults) {
        const response = await fetch('/api/semantic/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                search_type: searchType,
                max_results: maxResults
            })
        });
        return await response.json();
    }

    async apiTieredSearch(query, maxResults) {
        const response = await fetch('/api/semantic/tiered-search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                max_results: maxResults
            })
        });
        return await response.json();
    }

    async apiCategorySearch(query, category, maxResults) {
        const response = await fetch('/api/semantic/category-search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                category: category,
                max_results: maxResults
            })
        });
        return await response.json();
    }

    async loadSuggestions() {
        const query = this.searchInput.value.trim();
        if (query.length < 2) {
            this.hideSuggestions();
            return;
        }

        try {
            const response = await fetch(`/api/semantic/suggestions?q=${encodeURIComponent(query)}&limit=5`);
            const result = await response.json();
            
            if (result.success && result.suggestions.length > 0) {
                this.displaySuggestions(result.suggestions);
            } else {
                this.hideSuggestions();
            }
        } catch (error) {
            console.error('获取建议失败:', error);
            this.hideSuggestions();
        }
    }

    async loadEngineStatus() {
        try {
            const response = await fetch('/api/semantic/status');
            const result = await response.json();
            
            if (result.success) {
                this.displayEngineStatus(result.status);
            }
        } catch (error) {
            console.error('获取引擎状态失败:', error);
            this.engineStatusValue.textContent = '获取失败';
            this.engineStatusValue.className = 'status-value error';
        }
    }

    displayResults(result) {
        // 显示结果头部信息
        this.resultsHeader.style.display = 'block';
        this.resultsInfo.innerHTML = `
            <div>查询: "${result.query}"</div>
            <div>搜索类型: ${this.getSearchTypeLabel(result.search_type || result.category)}</div>
            <div>找到 ${result.results_count} 个结果</div>
        `;

        // 清空结果列表
        this.resultsList.innerHTML = '';

        if (result.results && result.results.length > 0) {
            result.results.forEach((item, index) => {
                const resultElement = this.createResultElement(item, index + 1, result.search_type);
                this.resultsList.appendChild(resultElement);
            });
            this.noResults.style.display = 'none';
        } else {
            this.noResults.style.display = 'block';
        }
    }

    createResultElement(item, index, searchType) {
        const div = document.createElement('div');
        div.className = 'result-item';
        
        // 根据相关度设置样式
        if (item.relevance_level) {
            if (item.relevance_level.includes('高')) {
                div.classList.add('high-relevance');
            } else if (item.relevance_level.includes('中')) {
                div.classList.add('medium-relevance');
            } else {
                div.classList.add('low-relevance');
            }
        }

        const scoreDisplay = typeof item.score === 'number' ? item.score.toFixed(3) : item.score;
        const relevanceDisplay = item.relevance_level ? ` (${item.relevance_level})` : '';

        div.innerHTML = `
            <div class="result-header">
                <h3 class="result-title">${this.escapeHtml(item.name)}</h3>
                <span class="result-score">${scoreDisplay}${relevanceDisplay}</span>
            </div>
            
            <div class="result-meta">
                <div class="result-meta-item">
                    <span>🔑</span>
                    <span>键名: ${this.escapeHtml(item.key)}</span>
                </div>
                <div class="result-meta-item">
                    <span>🔍</span>
                    <span>匹配类型: ${this.escapeHtml(item.match_type || 'unknown')}</span>
                </div>
            </div>
            
            ${item.tags && item.tags.length > 0 ? `
                <div class="result-tags">
                    ${item.tags.slice(0, 5).map(tag => 
                        `<span class="result-tag">${this.escapeHtml(tag)}</span>`
                    ).join('')}
                </div>
            ` : ''}
            
            ${item.description ? `
                <div class="result-description">
                    ${this.escapeHtml(this.truncateText(item.description, 200))}
                </div>
            ` : ''}
            
            <div class="result-actions">
                <button class="result-action" onclick="semanticSearchUI.toggleFormatted(${index})">
                    查看详细数据
                </button>
                <button class="result-action" onclick="semanticSearchUI.copyToClipboard('${item.key}')">
                    复制键名
                </button>
            </div>
            
            ${searchType === 'tiered' && item.formatted_output ? `
                <div class="result-formatted" id="formatted-${index}" style="display: none;">
                    ${this.escapeHtml(item.formatted_output)}
                </div>
            ` : `
                <div class="result-formatted" id="formatted-${index}" style="display: none;">
                    ${this.escapeHtml(JSON.stringify(item.full_data, null, 2))}
                </div>
            `}
        `;

        return div;
    }

    displaySuggestions(suggestions) {
        this.suggestionsList.innerHTML = '';
        suggestions.forEach(suggestion => {
            const span = document.createElement('span');
            span.className = 'suggestion-item';
            span.textContent = suggestion;
            this.suggestionsList.appendChild(span);
        });
        this.suggestionsSection.style.display = 'block';
    }

    displayEngineStatus(status) {
        this.engineStatusValue.textContent = status.engine_type || '未知';
        this.engineStatusValue.className = 'status-value success';
        
        this.dataLoadedValue.textContent = `${status.data_loaded || 0} 个数据文件`;
        this.dataLoadedValue.className = 'status-value success';
        
        this.fuzzyAvailableValue.textContent = status.fuzzy_available ? '可用' : '不可用';
        this.fuzzyAvailableValue.className = status.fuzzy_available ? 'status-value success' : 'status-value error';
    }

    showLoading() {
        this.loadingIndicator.style.display = 'flex';
        this.resultsList.innerHTML = '';
        this.resultsHeader.style.display = 'none';
        this.noResults.style.display = 'none';
    }

    hideLoading() {
        this.loadingIndicator.style.display = 'none';
    }

    hideSuggestions() {
        this.suggestionsSection.style.display = 'none';
    }

    showError(message) {
        this.resultsList.innerHTML = `
            <div class="error-message" style="
                text-align: center; 
                padding: 40px; 
                color: #dc3545; 
                background: #f8d7da; 
                border: 1px solid #f5c6cb; 
                border-radius: 8px;
            ">
                <h3>搜索出错</h3>
                <p>${this.escapeHtml(message)}</p>
            </div>
        `;
        this.resultsHeader.style.display = 'none';
        this.noResults.style.display = 'none';
    }

    // 工具方法
    toggleFormatted(index) {
        const element = document.getElementById(`formatted-${index}`);
        if (element) {
            element.style.display = element.style.display === 'none' ? 'block' : 'none';
        }
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('已复制到剪贴板');
        } catch (err) {
            console.error('复制失败:', err);
            this.showToast('复制失败');
        }
    }

    showToast(message) {
        // 简单的toast提示
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 1000;
            font-size: 14px;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 2000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    getSearchTypeLabel(searchType) {
        const labels = {
            'smart': '智能搜索',
            'fuzzy': '模糊搜索',
            'name': '名称搜索',
            'tolerant': '容错搜索',
            'precise': '精确搜索',
            'tiered': '分层搜索',
            'category': '分类搜索',
            'female': '女性角色',
            'sports': '运动角色',
            'athlete': '女性运动员',
            'student': '学生角色',
            'artist': '艺术家角色',
            'adventurer': '冒险者角色',
            'elf': '精灵角色',
            'dark_elf': '黑暗精灵'
        };
        return labels[searchType] || searchType;
    }

    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// 全局实例
let semanticSearchUI;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    semanticSearchUI = new SemanticSearchUI();
});
