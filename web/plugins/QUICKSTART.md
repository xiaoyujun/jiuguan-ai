# 插件开发快速入门（5分钟上手）

## 🎯 三步创建你的第一个插件

### 步骤1：复制模板（30秒）

```bash
cd web/plugins
cp -r _template hello_world
cd hello_world
```

### 步骤2：修改插件信息（2分钟）

编辑 `plugin.py`：

```python
def get_plugin_info(self):
    return {
        'id': 'hello-world',
        'name': 'Hello World',
        'version': '1.0.0',
        'description': '我的第一个插件',
        'author': '我',
        'icon': '👋'
    }
```

修改命令注册：

```python
self.register_command({
    'id': 'hello-cmd',
    'name': '打个招呼',
    'description': '向角色问好',
    'icon': '👋',
    'category': 'plugin',
    'action': 'executeHelloCommand'  # ← 注意这个名字
})
```

### 步骤3：实现功能（2分钟）

编辑 `static/script.js`：

```javascript
function executeHelloCommand() {
    const client = window.pluginClient;
    
    // 获取当前角色
    const role = client.getCurrentRole();
    if (!role) {
        client.showToast('请先选择一个角色', 'warning');
        return;
    }
    
    // 触发角色发送消息
    client.triggerCharacterMessage(
        role.name,
        '你好啊！',
        true
    );
    
    client.showToast('已向角色问好！', 'success');
}

// ⚠️ 重要：必须导出到全局
window.executeHelloCommand = executeHelloCommand;

console.log('✅ Hello World 插件已加载');
```

### 完成！测试插件

1. 重启Flask应用
2. 在聊天输入框输入 `/`
3. 找到"打个招呼"命令
4. 选择一个角色
5. 执行命令！

---

## 🚀 进阶：添加更多功能

### 添加API路由

`plugin.py` 中的 `register_routes()`:

```python
@bp.route('/get-time', methods=['GET'])
def get_time():
    import datetime
    now = datetime.datetime.now()
    return jsonify({
        'success': True,
        'time': now.strftime('%H:%M:%S')
    })
```

### 调用API

`static/script.js`:

```javascript
fetch('/plugins/hello-world/get-time')
    .then(r => r.json())
    .then(data => {
        alert('当前时间: ' + data.time);
    });
```

### 添加样式

`static/style.css`:

```css
.hello-world-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
}
```

---

## 📚 常用API速查

### 前端API

```javascript
// 提示消息
pluginClient.showToast('消息', 'success');

// 获取当前角色
const role = pluginClient.getCurrentRole();

// 触发角色消息
await pluginClient.triggerCharacterMessage(roleName, message);

// 模拟AI事件
await pluginClient.simulateAIEvent(roleName, '事件描述');

// 创建浮动窗口
pluginClient.createFloatingWindow('<div>内容</div>', {
    duration: 5000,
    position: 'bottom-right'
});

// 显示对话框
pluginClient.showDialog('标题', '<p>内容</p>');
```

### 后端API

```python
# 注册命令
self.register_command({
    'id': 'cmd-id',
    'name': '命令名',
    'description': '描述',
    'icon': '🎯',
    'category': 'plugin',
    'action': 'functionName'
})

# 注册静态文件
self.register_static_file('js', '/path/to/file.js')
self.register_static_file('css', '/path/to/file.css')
```

---

## ⚠️ 常见错误

### 1. 命令不显示

✅ 检查：
- `register_command()` 被调用了吗？
- `initialize()` 返回 `True` 了吗？

### 2. 点击命令没反应

✅ 检查：
- JS函数名与 `action` 一致吗？
- 函数导出到 `window` 了吗？
- 浏览器控制台有错误吗？

### 3. API请求失败

✅ 检查：
- URL前缀是 `/plugins/你的插件id/...` 吗？
- 路由注册在蓝图上了吗？
- 控制台有错误日志吗？

---

## 🎓 学习资源

1. **完整文档** - `README.md` - 详细的API参考
2. **示范插件** - `pomodoro/` - 完整实现示例
3. **插件模板** - `_template/` - 快速开始模板

---

## 💡 插件创意

- 🍅 **番茄钟** - 工作计时器（已实现）
- 📝 **笔记本** - 保存重要对话
- 🎲 **骰子** - 掷骰子小游戏
- 🎵 **音乐播放器** - 背景音乐
- 📊 **数据统计** - 聊天分析
- 🌤️ **天气** - 实时天气查询
- 📅 **日程** - 提醒系统
- 🎮 **小游戏** - 互动游戏

---

**现在就开始创建你的插件吧！** 🚀

有问题？查看完整文档：`README.md`

