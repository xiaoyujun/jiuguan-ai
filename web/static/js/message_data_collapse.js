/**
 * 消息数据变动内容折叠管理器
 * 负责处理聊天气泡中[]内容的折叠显示功能
 */
class MessageDataCollapseManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupStyles();
        this.setupEventListeners();
    }

    /**
     * 设置折叠功能所需的CSS样式
     */
    setupStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* 数据折叠组件 - 大师级设计系统 */
            .data-section {
                margin: 8px 0;
                border-radius: 8px;
                overflow: hidden;
                transition: all 0.35s cubic-bezier(0.4, 0.0, 0.2, 1);
                background: linear-gradient(145deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
                border: 1px solid rgba(255, 255, 255, 0.08);
                backdrop-filter: blur(10px);
                position: relative;
                isolation: isolate;
            }

            .data-section::before {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(145deg, transparent, rgba(255, 255, 255, 0.02));
                border-radius: inherit;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
                z-index: -1;
            }

            .data-section:hover::before {
                opacity: 1;
            }

            .data-section.collapsed {
                background: linear-gradient(145deg, rgba(255, 255, 255, 0.015), rgba(255, 255, 255, 0.005));
            }

            .data-toggle {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 14px;
                cursor: pointer;
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
                transition: all 0.25s cubic-bezier(0.4, 0.0, 0.2, 1);
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                user-select: none;
                position: relative;
            }

            .data-toggle::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                width: 0;
                height: 1px;
                background: linear-gradient(90deg, rgba(255, 255, 255, 0.3), transparent);
                transition: width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
            }

            .data-toggle:hover::after {
                width: 100%;
            }

            .data-toggle:hover {
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
                transform: translateY(-1px);
            }

            .data-toggle:active {
                transform: translateY(0);
                transition-duration: 0.1s;
            }

            .data-toggle-text {
                font-size: 12px;
                font-weight: 500;
                color: rgba(255, 255, 255, 0.75);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                letter-spacing: 0.025em;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .data-toggle-text::before {
                content: '';
                width: 4px;
                height: 4px;
                border-radius: 50%;
                background: currentColor;
                opacity: 0.6;
                transition: all 0.2s ease;
            }

            .data-section:not(.collapsed) .data-toggle-text::before {
                background: #4ade80;
                opacity: 1;
                box-shadow: 0 0 6px rgba(74, 222, 128, 0.4);
            }

            .data-toggle-icon {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.5);
                transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
                transform-origin: center;
                display: inline-block;
            }

            .data-section.collapsed .data-toggle-icon {
                transform: rotate(90deg);
                color: rgba(255, 255, 255, 0.3);
            }

            .data-content {
                padding: 0;
                background: linear-gradient(180deg, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.3));
                max-height: 400px;
                overflow: hidden;
                transition: all 0.4s cubic-bezier(0.4, 0.0, 0.2, 1);
                opacity: 1;
                transform: translateY(0);
            }

            .data-section.collapsed .data-content {
                max-height: 0;
                opacity: 0;
                transform: translateY(-8px);
            }

            .data-content-inner {
                padding: 16px;
                overflow-y: auto;
                max-height: 350px;
                position: relative;
            }

            .data-content-inner::before {
                content: '';
                position: absolute;
                top: 0;
                left: 16px;
                right: 16px;
                height: 1px;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
            }

            .data-content pre {
                margin: 0;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
                font-size: 13px;
                line-height: 1.6;
                color: rgba(255, 255, 255, 0.85);
                white-space: pre-wrap;
                word-wrap: break-word;
                font-weight: 400;
            }

            /* 精致的内容高亮 */
            .data-highlight {
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
                border-left: 3px solid rgba(255, 255, 255, 0.15);
                border-radius: 0 6px 6px 0;
                padding: 12px 16px 12px 14px;
                margin: 0;
                position: relative;
                backdrop-filter: blur(5px);
            }

            .data-highlight::before {
                content: '';
                position: absolute;
                left: -3px;
                top: 0;
                bottom: 0;
                width: 3px;
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.1));
                border-radius: 0 3px 3px 0;
            }

            /* 现代化滚动条设计 */
            .data-content-inner::-webkit-scrollbar {
                width: 6px;
            }

            .data-content-inner::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 3px;
            }

            .data-content-inner::-webkit-scrollbar-thumb {
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1));
                border-radius: 3px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .data-content-inner::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.15));
            }

            /* 响应式设计 */
            @media (max-width: 768px) {
                .data-section {
                    margin: 6px 0;
                    border-radius: 6px;
                }
                
                .data-toggle {
                    padding: 8px 12px;
                }
                
                .data-toggle-text {
                    font-size: 11px;
                }
                
                .data-content-inner {
                    padding: 12px;
                }
                
                .data-highlight {
                    padding: 10px 12px 10px 10px;
                }
            }

            /* 无障碍设计 */
            @media (prefers-reduced-motion: reduce) {
                .data-section,
                .data-toggle,
                .data-content,
                .data-toggle-icon {
                    transition: none;
                }
                
                .data-toggle:hover {
                    transform: none;
                }
                
                .data-section.collapsed .data-content {
                    transform: none;
                }
            }

            /* 高对比度模式 */
            @media (prefers-contrast: high) {
                .data-section {
                    border: 2px solid rgba(255, 255, 255, 0.3);
                }
                
                .data-toggle-text {
                    color: rgba(255, 255, 255, 0.9);
                }
                
                .data-highlight {
                    border-left-color: rgba(255, 255, 255, 0.4);
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 使用事件委托处理动态添加的元素
        document.addEventListener('click', (e) => {
            if (e.target.closest('.data-toggle')) {
                const dataSection = e.target.closest('.data-section');
                this.toggleDataSection(dataSection);
            }
        });

        // 键盘导航支持
        document.addEventListener('keydown', (e) => {
            const toggle = e.target.closest('.data-toggle');
            if (toggle && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                const dataSection = toggle.closest('.data-section');
                this.toggleDataSection(dataSection);
            }
        });

        // 焦点管理
        document.addEventListener('focusin', (e) => {
            const toggle = e.target.closest('.data-toggle');
            if (toggle) {
                toggle.style.outline = '2px solid rgba(255, 255, 255, 0.3)';
                toggle.style.outlineOffset = '2px';
            }
        });

        document.addEventListener('focusout', (e) => {
            const toggle = e.target.closest('.data-toggle');
            if (toggle) {
                toggle.style.outline = '';
                toggle.style.outlineOffset = '';
            }
        });
    }

    /**
     * 行内排版处理：把角色扮演文本里的常见标记转成对应的语义标签。
     *   **加粗**     -> <strong class="bubble-bold">
     *   *斜体动作*   -> <em class="bubble-action">
     *   "对话" / "对话" / 「对话」 / 『对话』 -> <span class="bubble-dialogue">
     *
     * 注意事项：
     *   - 必须先做 ** 再做 *，否则 ** 会被 * 抢先匹配。
     *   - 输入可能已经包含 <br> 等 HTML 标签，因此使用 split 把字符串切成
     *     [text, tag, text, tag, ...]，只对文本部分跑正则，避免误伤 class
     *     属性里的引号、< > 等字符。
     *   - 幂等：若内容里已经存在我们注入的类名，直接原样返回；防止
     *     processExistingMessages 在 100/500/1000ms 三次回扫时把
     *     <span class="bubble-dialogue">"…"</span> 里属性值再吞一次，
     *     生成 <span class=<span class="bubble-dialogue">"bubble-dialogue"</span>>
     *     这样的畸形 HTML，进而在浏览器上暴露 "bubble-dialogue">…
     * @param {string} content
     * @returns {string}
     */
    applyInlineTypography(content) {
        if (!content) return content;

        // 幂等保护：已经处理过就不要再碰
        if (/class="bubble-(bold|action|dialogue)"/.test(content)) {
            return content;
        }

        // 把字符串按 HTML 标签拆开：偶数下标 = 文本，奇数下标 = 标签原样保留
        const parts = content.split(/(<[^>]+>)/g);

        for (let i = 0; i < parts.length; i++) {
            if (i % 2 !== 0) continue; // 标签段，跳过

            let chunk = parts[i];

            // 1) **粗体** —— 非贪婪、不跨行、内部禁止 *
            chunk = chunk.replace(/\*\*([^\*\n]+?)\*\*/g,
                '<strong class="bubble-bold">$1</strong>');

            // 2) *斜体动作* —— 两侧禁贴字母数字，避免误伤路径/通配符
            chunk = chunk.replace(/(^|[^\w*])\*([^\*\n]+?)\*(?!\w)/g,
                '$1<em class="bubble-action">$2</em>');

            // 3) 对话引号高亮：半角"…"、全角"…"、「…」、『…』
            chunk = chunk
                .replace(/"([^"\n]+?)"/g, '<span class="bubble-dialogue">"$1"</span>')
                .replace(/"([^"\n]+?)"/g, '<span class="bubble-dialogue">"$1"</span>')
                .replace(/「([^」\n]+?)」/g, '<span class="bubble-dialogue">「$1」</span>')
                .replace(/『([^』\n]+?)』/g, '<span class="bubble-dialogue">『$1』</span>');

            parts[i] = chunk;
        }

        return parts.join('');
    }

    /**
     * 处理消息内容，识别并包装[]内容、折叠显示<>内容、隐藏$$内容
     * @param {string} content - 原始消息内容
     * @returns {string} - 处理后的HTML内容
     */
    processMessageContent(content) {
        if (!content) return content;
        
        let processedContent = content;

        // 0. 先做轻量级排版处理：**粗体**、*斜体（动作/神态）*、"对话" 引号高亮
        //    放在结构化处理（<>、[]、$$）之前，因为后续的 commandPattern
        //    已经把 strong/em/span 等标签排除在外，能安全保留这些行内标签。
        processedContent = this.applyInlineTypography(processedContent);

        // 1. 首先处理<>内容的折叠显示（不再执行命令，仅作为内容显示）
        // 排除HTML标签（如<br>、<span>等）
        const commandPattern = /<(?!\/?\s*(?:br|span|div|p|strong|em|b|i|u|a|img)\b[^>]*>)([^<>]*(?:\n[^<>]*)*?)>/g;
        let commandMatch;
        let commandCounter = 0;
        const commandMatches = [];

        // 收集所有<>匹配
        while ((commandMatch = commandPattern.exec(processedContent)) !== null) {
            commandMatches.push({
                fullMatch: commandMatch[0],
                innerContent: commandMatch[1],
                index: commandMatch.index
            });
        }

        // 从后向前替换<>内容，避免索引偏移
        for (let i = commandMatches.length - 1; i >= 0; i--) {
            commandCounter = commandMatches.length - i;
            const { fullMatch, innerContent } = commandMatches[i];
            
            // 生成普通内容折叠组件HTML（不再是AI命令）
            const commandHTML = this.createAngleBracketSectionHTML(innerContent, commandCounter);
            
            // 替换原始内容
            processedContent = processedContent.replace(fullMatch, commandHTML);
        }
        
        // 3. 然后处理[]内容的折叠显示
        const dataPattern = /\[([^\[\]]*(?:\n[^\[\]]*)*)\]/g;
        let match;
        let dataCounter = 0;
        const matches = [];

        // 收集所有[]匹配
        while ((match = dataPattern.exec(processedContent)) !== null) {
            matches.push({
                fullMatch: match[0],
                innerContent: match[1],
                index: match.index
            });
        }

        // 从后向前替换，避免索引偏移
        for (let i = matches.length - 1; i >= 0; i--) {
            dataCounter = matches.length - i;
            const { fullMatch, innerContent } = matches[i];
            
            // 生成折叠组件HTML
            const collapsedHTML = this.createDataSectionHTML(innerContent, dataCounter);
            
            // 替换原始内容
            processedContent = processedContent.replace(fullMatch, collapsedHTML);
        }
        
        // 4. 最后处理$隐藏内容 - 替换为提示信息（避免与HTML标签冲突）
        const hiddenPattern = /\$([^\$]*(?:\n[^\$]*)*)\$/g;
        processedContent = processedContent.replace(hiddenPattern, '<span class="hidden-content-notice" style="color: #888; font-style: italic; font-size: 0.9em;">[系统隐藏了一段信息]</span>');

        return processedContent;
    }

    /**
     * 创建<>内容折叠区域的HTML（不再执行命令）
     * @param {string} content - 内容
     * @param {number} index - 区域索引
     * @returns {string} - HTML字符串
     */
    createAngleBracketSectionHTML(content, index) {
        const shortContent = content.length > 30 ? content.substring(0, 30) + '...' : content;
        
        return `
            <div class="data-section angle-bracket-section collapsed" data-index="${index}" role="region" aria-expanded="false" aria-label="尖括号内容">
                <div class="data-toggle angle-bracket-toggle" role="button" tabindex="0" aria-controls="angle-content-${index}" aria-expanded="false">
                    <span class="data-toggle-text">📝 内容: ${this.escapeHtml(shortContent)}</span>
                    <span class="data-toggle-icon" aria-hidden="true">▸</span>
                </div>
                <div class="data-content angle-bracket-content" id="angle-content-${index}" aria-hidden="true">
                    <div class="data-content-inner">
                        <div class="angle-bracket-text">
                            ${this.escapeHtml(content)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }


    /**
     * 创建数据折叠区域的HTML
     * @param {string} content - 数据内容
     * @param {number} index - 数据区域索引
     * @returns {string} - HTML字符串
     */
    createDataSectionHTML(content, index) {
        // 简化的内容识别
        let toggleText = '数据';
        
        if (content.includes('系统提示')) {
            toggleText = '系统';
        } else if (content.includes('警告')) {
            toggleText = '警告';
        } else if (content.includes('状态') || content.includes('属性')) {
            toggleText = '状态';
        } else if (content.includes('任务') || content.includes('学分')) {
            toggleText = '任务';
        } else if (content.includes('战斗') || content.includes('攻击')) {
            toggleText = '战斗';
        } else if (content.includes('对话') || content.includes('好感')) {
            toggleText = '互动';
        }
        
        return `
            <div class="data-section collapsed" data-index="${index}" role="region" aria-expanded="false" aria-label="${toggleText}数据">
                <div class="data-toggle" role="button" tabindex="0" aria-controls="data-content-${index}" aria-expanded="false">
                    <span class="data-toggle-text">${toggleText}</span>
                    <span class="data-toggle-icon" aria-hidden="true">▸</span>
                </div>
                <div class="data-content" id="data-content-${index}" aria-hidden="true">
                    <div class="data-content-inner">
                        <div class="data-highlight">
                            <pre>${this.escapeHtml(content)}</pre>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 切换数据区域的展开/折叠状态
     * @param {HTMLElement} dataSection - 数据区域元素
     */
    toggleDataSection(dataSection) {
        if (!dataSection) return;

        const isCollapsed = dataSection.classList.contains('collapsed');
        const toggle = dataSection.querySelector('.data-toggle');
        const content = dataSection.querySelector('.data-content');
        
        if (isCollapsed) {
            // 展开
            dataSection.classList.remove('collapsed');
            dataSection.setAttribute('aria-expanded', 'true');
            toggle.setAttribute('aria-expanded', 'true');
            content.setAttribute('aria-hidden', 'false');
        } else {
            // 折叠
            dataSection.classList.add('collapsed');
            dataSection.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-expanded', 'false');
            content.setAttribute('aria-hidden', 'true');
        }

        // 平滑滚动到视图中
        setTimeout(() => {
            dataSection.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest',
                inline: 'nearest'
            });
        }, 200);
    }

    /**
     * 转义HTML特殊字符
     * @param {string} text - 原始文本
     * @returns {string} - 转义后的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }


    /**
     * 处理现有消息气泡
     */
    processExistingMessages() {
        const messageBubbles = document.querySelectorAll('.message-bubble');
        let processedCount = 0;
        
        messageBubbles.forEach(bubble => {
            // 检查是否已经处理过
            if (bubble.querySelector('.data-section')) {
                return;
            }
            
            // 检查innerHTML和textContent，确保捕获所有包含[]的内容
            const htmlContent = bubble.innerHTML;
            const textContent = bubble.textContent || '';
            
            // 如果textContent包含[]但innerHTML没有data-section，说明需要处理
            if (textContent.includes('[') && textContent.includes(']')) {
                // 提取角色名
                const strongElement = bubble.querySelector('strong');
                if (strongElement) {
                    const roleName = strongElement.textContent.replace(':', '').trim();
                    // 提取完整文本内容
                    const fullText = textContent.replace(strongElement.textContent, '').trim();
                    
                    // 重新处理
                    const processedContent = this.processMessageContent(fullText);
                    bubble.innerHTML = `<strong>${roleName}:</strong> ${processedContent}`;
                    processedCount++;
                    
                    console.log(`处理消息: ${roleName} - ${fullText.substring(0, 50)}...`);
                }
            } else {
                // 常规处理
                const processedContent = this.processMessageContent(htmlContent);
                if (processedContent !== htmlContent) {
                    bubble.innerHTML = processedContent;
                    processedCount++;
                }
            }
        });
        
        if (processedCount > 0) {
            console.log(`MessageDataCollapseManager: 已处理 ${processedCount} 个现有消息的折叠内容`);
        }
        
        return processedCount;
    }

    /**
     * 强制重新处理所有消息（用于调试）
     */
    reprocessAllMessages() {
        const messageBubbles = document.querySelectorAll('.message-bubble');
        let processedCount = 0;
        
        messageBubbles.forEach(bubble => {
            // 首先移除已存在的折叠组件
            const existingDataSections = bubble.querySelectorAll('.data-section');
            existingDataSections.forEach(section => section.remove());
            
            // 获取原始文本内容
            const strongElement = bubble.querySelector('strong');
            if (strongElement) {
                const roleName = strongElement.textContent.replace(':', '').trim();
                const textContent = bubble.textContent.replace(strongElement.textContent, '').trim();
                
                // 重新处理
                const processedContent = this.processMessageContent(textContent);
                bubble.innerHTML = `<strong>${roleName}:</strong> ${processedContent}`;
                processedCount++;
            }
        });
        
        console.log(`MessageDataCollapseManager: 强制重新处理了 ${processedCount} 个消息`);
        return processedCount;
    }
}

// 全局实例
window.MessageDataCollapseManager = MessageDataCollapseManager;

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    window.messageDataCollapseManager = new MessageDataCollapseManager();
    
    // 处理现有消息 - 多次延迟处理以确保所有消息都被处理
    setTimeout(() => {
        window.messageDataCollapseManager.processExistingMessages();
    }, 100);
    
    setTimeout(() => {
        window.messageDataCollapseManager.processExistingMessages();
    }, 500);
    
    setTimeout(() => {
        window.messageDataCollapseManager.processExistingMessages();
    }, 1000);
});

// 提供全局方法用于手动重新处理消息
window.reprocessMessages = () => {
    if (window.messageDataCollapseManager) {
        return window.messageDataCollapseManager.reprocessAllMessages();
    }
    return 0;
};

// 提供全局方法用于处理现有消息
window.processExistingMessages = () => {
    if (window.messageDataCollapseManager) {
        return window.messageDataCollapseManager.processExistingMessages();
    }
    return 0;
};

// 立即处理现有消息的全局函数（可在控制台调用）
window.fixUnprocessedMessages = () => {
    console.log('开始修复未处理的消息...');
    const count1 = window.processExistingMessages();
    setTimeout(() => {
        const count2 = window.processExistingMessages();
        console.log(`修复完成：第一轮处理 ${count1} 个，第二轮处理 ${count2} 个消息`);
    }, 100);
};
