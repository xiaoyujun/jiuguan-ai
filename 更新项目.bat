@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "GIT_EXE=git"
if exist "C:\Program Files\Git\bin\git.exe" set "GIT_EXE=C:\Program Files\Git\bin\git.exe"

%GIT_EXE% --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Git，请先安装 Git 后重试。
    exit /b 1
)

if not exist ".git" (
    echo [错误] 当前目录不是 Git 仓库：%CD%
    exit /b 1
)

set "HAS_CHANGES=0"
for /f %%i in ('%GIT_EXE% status --porcelain') do (
    set "HAS_CHANGES=1"
    goto :status_checked
)
:status_checked

if "!HAS_CHANGES!"=="1" (
    echo [提示] 检测到未提交改动，请先提交或暂存后再更新。
    echo 你可以先执行：git add . ^&^& git commit -m "wip"
    exit /b 1
)

echo [1/2] 拉取远程更新（origin/main）...
%GIT_EXE% pull --ff-only origin main
if errorlevel 1 (
    echo [错误] 拉取失败，请检查网络、权限或远程配置。
    exit /b 1
)

echo [2/2] 更新 Python 依赖（requirements.txt）...
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查 Python/pip 环境。
    exit /b 1
)

echo [完成] 项目已更新。
exit /b 0

