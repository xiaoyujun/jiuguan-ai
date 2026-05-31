@echo off
chcp 65001 >nul
cd /d "%~dp0"

:: 优先使用本地虚拟环境（若可用）
set "VENV_PY=%~dp0venv\Scripts\python.exe"
if exist "%VENV_PY%" (
    "%VENV_PY%" --version >nul 2>&1
    if not errorlevel 1 (
        call "%~dp0venv\Scripts\activate.bat"
    ) else (
        echo [WARN] 检测到虚拟环境但Python不可用，改用系统Python
    )
)

echo ====================================
echo    Python Flask 应用启动脚本
echo ====================================
echo.

:: 检测Python环境
echo [1/4] 检测Python环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未检测到Python环境
    echo.
    echo 请先安装Python:
    echo 1. 访问 https://www.python.org/downloads/
    echo 2. 下载并安装Python 3.8或更高版本
    echo 3. 安装时勾选"Add Python to PATH"
    echo.
    pause
    exit /b 1
) else (
    python --version
    echo ✅ Python环境检测成功
)
echo.

:: 检测pip
echo [2/4] 检测pip包管理器...
pip --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: pip未安装或不可用
    echo 尝试使用python -m pip...
    python -m pip --version >nul 2>&1
    if errorlevel 1 (
        echo ❌ pip完全不可用，请重新安装Python
        pause
        exit /b 1
    ) else (
        echo ✅ 使用python -m pip
        set PIP_CMD=python -m pip
    )
) else (
    echo ✅ pip可用
    set PIP_CMD=pip
)
echo.

:: 检测并安装依赖
echo [3/4] 检测Python依赖包...

:: 检查requirements.txt是否存在
if not exist "requirements.txt" (
    echo 📝 创建requirements.txt文件...
    echo flask>>requirements.txt
    echo requests>>requirements.txt
    echo pyyaml>>requirements.txt
    echo werkzeug>>requirements.txt
    echo pathlib>>requirements.txt
    echo ✅ requirements.txt已创建
)

:: 调用统一的依赖自检脚本（缺什么自动按国内镜像优先安装）
python web\bootstrap_dependencies.py
if errorlevel 1 (
    echo ❌ 自动安装依赖失败，请检查网络后重试
    echo 也可以手动执行: %PIP_CMD% install -r requirements.txt
    pause
    exit /b 1
)
echo ✅ 所有必需的依赖包已就绪
echo.

:: 启动应用
echo [4/4] 启动Flask应用...
echo 🚀 正在启动服务器...
echo.
echo ====================================
echo    应用正在运行中...
echo    按Ctrl+C停止服务器
echo ====================================
echo.

python web/app_new.py

echo.
echo ====================================
echo    应用已停止
echo ====================================
pause
