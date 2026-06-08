# AGENTS.md

## Scope
- This repository is a Flask-based AI roleplay/chat application with a vanilla HTML/CSS/JS frontend.
- Most domain data lives in Chinese-named folders and files; preserve those names exactly.
- Storage is file-backed rather than database-backed: JSON for storybooks/config, YAML for roles/players/settings.
- Many workflows are runtime/data driven, so small edits can affect prompt construction, chat routing, or file persistence.
- Prefer targeted, low-risk edits that match nearby patterns over broad refactors.

## Tech Stack And Architecture
- Backend: Python + Flask blueprints.
- Frontend: server-rendered Jinja templates plus plain JavaScript and CSS.
- AI access: OpenAI-compatible APIs routed through `API.py`.
- Optional integrations: direct OpenAI/Gemini image generation (`web/image_gen/`), plugin system, vectorized temporary-data analysis.
- Auth: session-based checks in `web/app_new.py`.
- Persistence: `config.json`, `聊天记录/`, `角色/`, `玩家/`, `数据书/`, `全局世界书/`, `.hidden_settings/`.

## Important Paths
- `web/app_new.py`: main Flask app, blueprint registration, session/auth gates, app entrypoint.
- `API.py`: model selection, streaming chat calls, tiered model mapping.
- `web/utils.py`: `ConfigManager`, `PathManager`, `FileManager`, `DataManager`.
- `web/chat_routes.py`: main `/chat` API and chat-specific orchestration.
- `web/config_routes.py`: model config CRUD and tier configuration endpoints.
- `web/config_loader.py`: keyword/storybook loading and prompt-side text expansion.
- `web/static/js/`: frontend modules; many features are split across dedicated files.
- `web/static/css/`: feature CSS plus shared theme files.
- `web/plugins/`: plugin framework using `PluginBase` and `PluginManager`.
- `web/ai_new/`: newer AI architecture for generation, modification, and filtering.
- `web/vectorized_temp_data/`: semantic search and chat-context analysis helpers/tests.

## Setup And Run Commands
- Preferred Windows install flow: `安装依赖.bat`.
- Direct install: `python -m pip install -r requirements.txt`.
- Optional extra deps for vectorization: `python install_vectorization_deps.py`.
- Preferred Windows start flow: `启动.bat`.
- Direct app start from repo root: `python web/app_new.py`.
- Main app runs with Flask debug mode on `0.0.0.0:8000` when launched directly.

## Build, Lint, And Verification
- There is no package build step, no `pyproject.toml`, and no repo-configured linter/formatter.
- Do not assume `pytest`, `ruff`, `black`, `isort`, `flake8`, or `mypy` are part of the standard workflow.
- For syntax-only verification, use `python -m compileall web API.py`.
- For feature verification, run the smallest relevant script/test module instead of inventing new global checks.
- If you add a new dependency, update `requirements.txt` and keep `requirements_clean.txt` aligned if the repo still uses it.

## Test Commands
- Tests in this repo are mostly standalone scripts, not a unified `pytest` suite.
- Run a single test script directly from the repo root with `python path/to/test_script.py`.
- Example single-script tests:
- `python web/auto_commands/test_auto_command.py`
- `python web/auto_commands/integration_check.py`
- `python web/vectorized_temp_data/test_chat_integration.py`
- `python web/vectorized_temp_data/test_actual_chat_prompt.py`
- `python web/vectorized_temp_data/test_role_context_enhancement.py`
- `python web/vectorized_temp_data/test_smart_narrator_selection.py`
- To run one specific test function inside a script-style module, use `python -c`.
- Example: `python -c "from web.auto_commands.test_auto_command import test_auto_command_parser; test_auto_command_parser()"`
- Example: `python -c "from web.vectorized_temp_data.test_chat_integration import test_edge_cases; test_edge_cases()"`
- Image generation tests require valid API keys for the configured image provider (OpenAI gpt-image-1 or Google Gemini multimodal) and at least one role with an avatar in `data/角色/`.
- AI/vectorized tests may depend on populated local data folders and a valid model configuration.

## Existing Cursor And Copilot Rules
- `.github/copilot-instructions.md` is not present at the time of writing.
- `.cursor/rules/主要文件.mdc` says this is a Flask roleplay chat system with JSON/YAML storage and blueprint-based organization.
- That rule also says to prefer unified path handling through `PathManager` and keep API responses consistent.
- `.cursor/rules/模型配置页面说明.md` documents the three-tier model system: high, medium, and low performance.
- `.cursor/rules/数据书标准格式.md` defines the canonical nested `属性` structure for storybook-style data.
- `.cursor/rules/AI智能修改.mdc` describes temporary-data-first editing and safe promotion to permanent files.
- `.cursor/rules/@功能实现文档.md` documents `@角色名` chat behavior, self-speak mode, and multi-character reply selection.

## Global Editing Expectations
- Use UTF-8 for text files.
- Preserve Chinese filenames, directory names, JSON keys, YAML keys, and user-facing text unless the task explicitly changes them.
- Match the local style of the file you touch; this codebase is not fully uniform.
- Prefer minimal diffs over cleanup-only rewrites.
- Avoid mass-renaming, broad formatting passes, or reorganizing imports across unrelated files.

## Python Import Conventions
- Use standard-library imports first, then third-party imports, then local imports.
- In application modules under `web/`, prefer absolute imports like `from web.utils import ConfigManager`.
- Root-level shared modules are imported directly, e.g. `from API import get_model_for_function`.
- Relative imports are mainly used inside package internals such as `web/plugins/`.
- Standalone scripts/tests often add the repo root to `sys.path`; keep that pattern only in scripts that need to run directly.
- Avoid introducing new wildcard imports even though some legacy files use `from ... import *`.

## Python Formatting And Types
- Use 4-space indentation.
- Use `snake_case` for functions, methods, and variables.
- Use `PascalCase` for classes like `ConfigManager` and `PluginManager`.
- Use `UPPER_SNAKE_CASE` for module-level constants.
- Add type hints in new or touched utilities, manager classes, and public helpers when it is easy to do so.
- Do not force full typing across legacy files; be incremental.
- Prefer `pathlib.Path` over stringly-typed path concatenation in new code.
- Keep public or non-obvious functions documented with docstrings when the surrounding file does so.

## Flask And Backend Conventions
- Keep one feature area per blueprint/module when possible.
- Validate request inputs early and return clear 4xx responses for bad input.
- Wrap risky file I/O, network calls, and AI calls in `try/except`.
- Prefer `jsonify({...})` responses with explicit HTTP status codes.
- Common response shape is `{'success': True, 'data': ..., 'message': ...}` on success.
- Common error shape is `{'success': False, 'error': '...'};` add `requires_login` when auth state matters.
- Do not bypass or weaken session checks without a clear requirement.

## Error Handling And Logging
- The repo commonly uses `print()` for diagnostics instead of the Python `logging` module.
- Existing logs often include emoji and Chinese labels; match nearby style instead of normalizing everything.
- Helper loaders often return safe defaults like `""`, `None`, `{}`, or `[]` rather than raising.
- Preserve those fallback contracts unless you also update all callers.
- Never log API keys, passwords, or full secrets from `config.json`.

## JSON, YAML, And Data Files
- JSON writes usually use `ensure_ascii=False` and `indent=4`.
- YAML reads use `yaml.safe_load`.
- YAML writes usually use block style and `allow_unicode=True`.
- Roles and players are primarily YAML files under `角色/` and `玩家/`.
- Storybooks and many generated structures are JSON files under `数据书/`.
- Use `ConfigManager`, `DataManager`, and `PathManager` instead of duplicating path logic.

## Storybook/Data-Card Rules
- Preserve the canonical `属性` layout from `.cursor/rules/数据书标准格式.md`.
- Common sections are `状态`, optional `事件`, `外貌特征`, `能力值`, `社交关系`, `描述`, and `背包`.
- When adding fields, prefer extending existing nested structures instead of inventing parallel top-level keys.
- Keep Chinese domain terminology stable so prompts, loaders, and front-end displays still align.

## AI And Model Rules
- The model-selection system is tiered in `API.py` and configured through `web/config_routes.py`.
- High-performance models are used for chat, narrator, summary, and story creation.
- Medium-performance models are used for analysis, story organization, temporary-data analysis, and smart commands.
- Low-performance models are used for simpler filtering/analysis tasks.
- When editing AI flows, preserve the separation between temporary data and permanent storybook writes.

## Frontend Conventions
- Frontend code is plain JavaScript, not React/Vue.
- Use `camelCase` for JS functions and methods, and `PascalCase` for classes.
- Some functions are intentionally global because templates call them via inline `onclick`; do not hide those without updating templates.
- Templates are Jinja HTML under `web/templates/` and often wire features through script includes rather than build tooling.
- CSS already uses custom properties heavily; extend existing variables before adding one-off colors.
- Maintain desktop and mobile behavior, including safe-area handling in `index.html` and responsive CSS files.

## Plugin System Rules
- New plugins should live under `web/plugins/<plugin_name>/`.
- Plugins inherit from `PluginBase` and must implement `get_plugin_info()` and `initialize()`.
- Register routes through `create_blueprint()`.
- Register slash commands through `register_command()`.
- Register plugin JS/CSS through `register_static_file()`.
- Keep plugin metadata stable: `id`, `name`, `version`, `description`, `author`, `icon`.

## Feature-Specific Notes
- `@角色名` parsing is primarily handled in `web/static/js/character_reply_handler.js` and corresponding chat backend logic.
- Self-speak mode is triggered when the message is only an `@角色名` mention.
- Multi-chat and narrator auto-mention flows have special-case logic; inspect both frontend and backend before changing them.
- Image generation goes through `web/image_gen/` (providers in `web/image_gen/providers/`), driven by the `image_generation` model tier configured in `/model_config`. Settings live in `data/image_gen_settings.json`; outputs land in `data/聊天记录/<book>/生成图片/` and are mirrored to `web/static/generated_images/` for serving. The chat commands `/生图` and `/生成图片第一人称` dispatch through `web/chat_routes.py` into `web/image_gen/routes.py`.

## Practical Advice For Agents
- Search for both English and Chinese identifiers before deciding a symbol is unused.
- Check neighboring files for the real pattern; similar modules are often copy-adapted rather than fully abstracted.
- If you touch persistence logic, verify both file writes and the read paths used elsewhere.
- If you touch chat behavior, inspect `web/chat_routes.py`, `web/config_loader.py`, and the relevant JS handler together.
- If there is no formal test for your change, run the smallest related script or at least `python -m compileall web API.py`.
