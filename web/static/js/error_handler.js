/**
 * 全局错误处理器模块
 * 统一处理异步错误和运行时错误，包括消息通道错误
 */

class GlobalErrorHandler {
    constructor(context = 'Unknown') {
        this.context = context;
        this.setupErrorHandlers();
    }

    /**
     * 设置全局错误处理器
     */
    setupErrorHandlers() {
        // 全局错误处理器 - 捕获未处理的异步错误
        window.addEventListener('unhandledrejection', (event) => {
            console.error(`🚨 ${this.context} - 未处理的Promise拒绝:`, {
                reason: event.reason,
                promise: event.promise,
                stack: event.reason?.stack,
                timestamp: new Date().toISOString(),
                context: this.context
            });
            
            // 检查是否是消息通道相关的错误
            if (event.reason && event.reason.message) {
                const errorMessage = event.reason.message;
                
                // 处理各种消息通道和异步响应错误
                if (this.isMessageChannelError(errorMessage)) {
                    console.warn(`🔧 ${this.context} - 检测到消息通道/异步响应错误，已自动处理:`, errorMessage);
                    event.preventDefault(); // 阻止错误继续传播
                    
                    // 只在开发模式下记录详细信息
                    if (console.debug) {
                        console.debug(`${this.context} - 异步响应错误详情:`, {
                            message: errorMessage,
                            timestamp: new Date().toISOString(),
                            context: this.context,
                            userAgent: navigator.userAgent
                        });
                    }
                    return; // 提前返回，避免重复处理
                }
            }
            
            // 处理请求中止错误
            if (event.reason && event.reason.name === 'AbortError') {
                console.warn(`🔧 ${this.context} - 检测到请求中止错误，已自动处理`);
                event.preventDefault(); // 阻止错误继续传播
                return;
            }
        });

        // 全局错误处理器 - 捕获运行时错误
        window.addEventListener('error', (event) => {
            console.error(`🚨 ${this.context} - 全局运行时错误:`, {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                stack: event.error?.stack,
                timestamp: new Date().toISOString(),
                context: this.context
            });
            
            // 如果是消息通道相关错误，阻止继续传播
            if (event.message && this.isMessageChannelError(event.message)) {
                console.warn(`🔧 ${this.context} - 检测到消息通道错误，已自动处理:`, event.message);
                event.preventDefault();
                return;
            }
            
            // 如果是网络相关错误，提供友好提示
            if (event.message && this.isNetworkError(event.message)) {
                if (typeof showToast === 'function') {
                    showToast('网络连接出现问题，请检查网络状态', 'error');
                } else {
                    console.warn('网络连接出现问题，请检查网络状态');
                }
            }
        });
    }

    /**
     * 检查是否为消息通道相关错误
     * @param {string} errorMessage - 错误消息
     * @returns {boolean}
     */
    isMessageChannelError(errorMessage) {
        const messageChannelErrorPatterns = [
            'message channel closed',
            'listener indicated an asynchronous response',
            'message channel closed before a response was received',
            'extension context invalidated',
            'Attempting to use a disconnected port object'
        ];

        return messageChannelErrorPatterns.some(pattern => 
            errorMessage.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    /**
     * 检查是否为网络相关错误
     * @param {string} errorMessage - 错误消息
     * @returns {boolean}
     */
    isNetworkError(errorMessage) {
        const networkErrorPatterns = [
            'fetch',
            'network',
            'connection',
            'ERR_CONNECTION_RESET',
            'ERR_NETWORK',
            'Failed to fetch'
        ];

        return networkErrorPatterns.some(pattern => 
            errorMessage.toLowerCase().includes(pattern.toLowerCase())
        );
    }
}

// 自动初始化错误处理器（如果没有手动初始化）
if (!window.globalErrorHandlerInitialized) {
    // 获取当前脚本的上下文
    const currentScript = document.currentScript;
    let context = 'Global';
    
    if (currentScript) {
        const scriptSrc = currentScript.src;
        const scriptName = scriptSrc.split('/').pop().replace('.js', '');
        context = scriptName;
    }
    
    // 初始化全局错误处理器
    window.globalErrorHandler = new GlobalErrorHandler(context);
    window.globalErrorHandlerInitialized = true;
    
    console.log(`✅ 全局错误处理器已初始化 (上下文: ${context})`);
}

// 导出类供手动初始化使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GlobalErrorHandler;
}

// 为向后兼容性提供全局访问
window.GlobalErrorHandler = GlobalErrorHandler;
