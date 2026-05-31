"""
Web核心模块
包含项目的核心功能模块：总结管理、语音管理、数据书引用管理等
"""

from .summary_manager import StoryBookManager
from .voice_manager import (
    generate_voice_for_text,
    generate_voice_for_sentence,
    clean_audio_files,
    save_voice_settings,
    get_voice_settings
)
from .story_reference_manager import (
    StoryReferenceManager,
    get_bound_story_data_with_references,
    get_player_bound_story_data,
    get_all_bound_story_data,
    process_keyword_triggers_with_references,
    bind_story_to_player,
    unbind_story_from_player,
    get_story_bindings,
    clear_cache,
    analyze_references
)

__all__ = [
    'StoryBookManager',
    'generate_voice_for_text',
    'generate_voice_for_sentence',
    'clean_audio_files',
    'save_voice_settings',
    'get_voice_settings',
    'StoryReferenceManager',
    'get_bound_story_data_with_references',
    'get_player_bound_story_data',
    'get_all_bound_story_data',
    'process_keyword_triggers_with_references',
    'bind_story_to_player',
    'unbind_story_from_player',
    'get_story_bindings',
    'clear_cache',
    'analyze_references'
]
