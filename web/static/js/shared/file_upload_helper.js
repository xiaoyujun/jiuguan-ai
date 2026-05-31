/**
 * shared/file_upload_helper.js
 * ----------------------------------------------------------------
 * 通用文件上传辅助：
 *   - 触发隐藏的 <input type="file"> 选择
 *   - 校验类型/大小
 *   - 通过 FileReader 拿到 dataURL 或 ArrayBuffer
 *   - 通过 FormData + fetch 上传
 *
 * 用法：
 *   FileUploadHelper.pick({
 *     accept: 'image/*',
 *     maxSize: 2 * 1024 * 1024,
 *     read: 'dataURL',
 *   }).then(({ file, dataURL }) => { ... });
 *
 *   FileUploadHelper.upload({
 *     url: '/api/avatar/upload',
 *     file,
 *     extra: { name: 'foo' },
 *   }).then(res => ...);
 *
 * 暴露：window.FileUploadHelper
 */
(function (global) {
    'use strict';

    function pick(opts = {}) {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            if (opts.accept) input.accept = opts.accept;
            if (opts.multiple) input.multiple = true;
            input.style.display = 'none';
            document.body.appendChild(input);

            input.addEventListener('change', () => {
                const files = Array.from(input.files || []);
                input.remove();

                if (files.length === 0) {
                    reject(new Error('未选择文件'));
                    return;
                }

                const file = files[0];
                if (opts.maxSize && file.size > opts.maxSize) {
                    reject(new Error(`文件超过限制（${(opts.maxSize / 1024 / 1024).toFixed(1)} MB）`));
                    return;
                }

                if (!opts.read) {
                    resolve({ file, files });
                    return;
                }

                const reader = new FileReader();
                reader.onload = () => {
                    resolve({
                        file, files,
                        dataURL: opts.read === 'dataURL' ? reader.result : null,
                        text: opts.read === 'text' ? reader.result : null,
                        buffer: opts.read === 'buffer' ? reader.result : null,
                    });
                };
                reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
                if (opts.read === 'dataURL') reader.readAsDataURL(file);
                else if (opts.read === 'text') reader.readAsText(file);
                else if (opts.read === 'buffer') reader.readAsArrayBuffer(file);
                else resolve({ file, files });
            });

            input.click();
        });
    }

    async function upload(opts) {
        if (!opts || !opts.url || !opts.file) {
            throw new Error('upload 需要 { url, file }');
        }
        const fd = new FormData();
        fd.append(opts.fieldName || 'file', opts.file);
        if (opts.extra && typeof opts.extra === 'object') {
            for (const k of Object.keys(opts.extra)) {
                fd.append(k, opts.extra[k]);
            }
        }

        const res = await fetch(opts.url, {
            method: opts.method || 'POST',
            body: fd,
            credentials: opts.credentials || 'same-origin',
        });
        if (!res.ok) {
            throw new Error(`上传失败 ${res.status}: ${res.statusText}`);
        }
        const ct = res.headers.get('content-type') || '';
        return ct.includes('application/json') ? res.json() : res.text();
    }

    global.FileUploadHelper = { pick, upload };
})(window);
