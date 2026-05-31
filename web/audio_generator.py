import json
from pathlib import Path
import re
import time
import os
import threading
import queue
import yaml

from web.utils import ConfigManager, PathManager

try:
    from openai import OpenAI
except Exception as e:
    OpenAI = None
    _OPENAI_IMPORT_ERROR = e


def _ensure_openai_installed():
    """Delay dependency errors until voice generation is actually used."""
    if OpenAI is None:
        raise RuntimeError(
            f"Missing dependency 'openai' ({_OPENAI_IMPORT_ERROR}). "
            "Run: python -m pip install -r requirements.txt"
        )

DEFAULT_VOICE_SETTINGS = {
    "api_key": "",
    "base_url": "https://api.siliconflow.cn/v1",
    "model": "FunAudioLLM/CosyVoice2-0.5B",
    "default_voice": "speech:lumabang:d2ejc5h719ns73evoen0:slscuunyvsbcaohwwxix",
    "auto_play": False,
    "auto_reply_enabled": True,
}


def _load_voice_settings():
    """Safely load voice settings and persist defaults when needed."""
    full_config = ConfigManager.load_config()
    if not isinstance(full_config, dict):
        full_config = {}

    voice_settings = full_config.get("voice_settings")
    if not isinstance(voice_settings, dict):
        voice_settings = {}

    merged_settings = DEFAULT_VOICE_SETTINGS.copy()
    merged_settings.update(voice_settings)

    if full_config.get("voice_settings") != merged_settings:
        full_config["voice_settings"] = merged_settings
        ConfigManager.save_config(full_config)

    return merged_settings


config = _load_voice_settings()

def generate_audio(text, voice_id=None):
    _ensure_openai_installed()

    if voice_id is None:
        print("鉂?閿欒锛氭湭璁剧疆璇煶ID锛岃涓鸿鑹查厤缃畍oice_id瀛楁")
        return []
    
    # 娓呯悊鏃х殑闊抽鏂囦欢
    cleanup_old_audio_files()
    
    # 娓呯悊鏂囨湰锛屽彧淇濈暀闇€瑕佹湕璇荤殑鍐呭
    text = clean_text_for_speech(text)
    
    # 鐩存帴灏嗘暣涓枃鏈綋浣滀竴涓彞瀛?
    sentences = [text] if text.strip() else []
    
    print(f"Starting audio generation, total sentences: {len(sentences)}")
    
    # 鐢熸垚鍞竴鐨勬椂闂存埑鍓嶇紑
    timestamp = int(time.time() * 1000)
    
    # 纭繚audio鐩綍瀛樺湪
    audio_dir = Path(__file__).parent / "audio"
    audio_dir.mkdir(exist_ok=True)
    
    client = OpenAI(
        api_key=config['api_key'],
        base_url=config['base_url']
    )
    
    audio_files = []
    for i, sentence in enumerate(sentences):
        sentence = sentence.strip()
        if sentence:
            print(f"姝ｅ湪鐢熸垚鍙ュ瓙 {i+1}: {sentence}")
            # 浣跨敤鏃堕棿鎴崇‘淇濇枃浠跺悕鍞竴锛屼繚瀛樺埌audio鐩綍
            audio_file = Path(__file__).parent / "audio" / f"sentence_{timestamp}_{i}.mp3"
            try:
                with client.audio.speech.with_streaming_response.create(
                    model=config['model'],
                    input=sentence,
                    voice=voice_id,
                    response_format="mp3",
                    speed=1.0
                ) as response:
                    response.stream_to_file(audio_file)
                
                print(f"鍙ュ瓙 {i+1} 鐢熸垚鎴愬姛")
                audio_files.append(audio_file)
            except Exception as e:
                print(f"鍙ュ瓙 {i+1} 鐢熸垚澶辫触: {e}")
                # 缁х画涓嬩竴涓彞瀛?
    
    print(f"Audio generation finished, files created: {len(audio_files)}")
    return audio_files

def generate_audio_async(text, voice_id=None, callback=None):
    """Generate audio asynchronously."""
    def worker():
        audio_files = generate_audio(text, voice_id)
        if callback:
            callback(audio_files)
    
    thread = threading.Thread(target=worker)
    thread.daemon = True
    thread.start()
    return thread

def generate_single_sentence_audio(sentence, voice_id=None, timestamp=None, index=0):
    """Generate audio for one sentence."""
    _ensure_openai_installed()
    if voice_id is None:
        print("鉂?閿欒锛氭湭璁剧疆璇煶ID锛岃涓鸿鑹查厤缃畍oice_id瀛楁")
        return None
    
    if timestamp is None:
        timestamp = int(time.time() * 1000)
    
    client = OpenAI(
        api_key=config['api_key'],
        base_url=config['base_url']
    )
    
    sentence = clean_text_for_speech(sentence).strip()
    if not sentence:
        return None
    
    audio_file = Path(__file__).parent / "audio" / f"sentence_{timestamp}_{index}.mp3"
    try:
        with client.audio.speech.with_streaming_response.create(
            model=config['model'],
            input=sentence,
            voice=voice_id,
            response_format="mp3",
            speed=1.0
        ) as response:
            response.stream_to_file(audio_file)
        
        print(f"鍙ュ瓙 {index+1} 鐢熸垚鎴愬姛: {sentence[:50]}...")
        return audio_file
    except Exception as e:
        print(f"鍙ュ瓙 {index+1} 鐢熸垚澶辫触: {e}")
        return None

def clean_text_for_speech(text):
    """清理文本，只保留适合语音朗读的内容。"""
    if not text:
        return text

    # Remove bracketed meta text (half-width and full-width brackets).
    text = re.sub(r"\([^)]*\)", "", text)
    text = re.sub(r"\uFF08[^\uFF09]*\uFF09", "", text)
    text = re.sub(r"\[[^\]]*\]", "", text)
    text = re.sub(r"\{[^}]*\}", "", text)
    text = re.sub(r"<[^>]*>", "", text)

    # Strip common markdown wrappers.
    text = re.sub(r"```[\s\S]*?```", "", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"~~([^~]+)~~", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)

    # Keep CJK text, word chars, spaces and common punctuation.
    text = re.sub(r"[^\w\s\u4e00-\u9fff,.!?;:'\"，。！？；：、\-]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"^[^\w\u4e00-\u9fff]+", "", text)
    return text

def get_role_voice_id(role_name):
    """
    鏍规嵁瑙掕壊鍚嶈幏鍙栧搴旂殑璇煶ID
    
    Args:
        role_name: 瑙掕壊鍚?
    
    Returns:
        str: 璇煶ID锛屽鏋滄壘涓嶅埌鍒欒繑鍥濶one
    """
    try:
        # 鍏堝皾璇曚粠瑙掕壊鐨剏ml鏂囦欢璇诲彇锛堜富瑕侀厤缃枃浠讹級
        role_yml_path = PathManager.get_roles_dir() / f"{role_name}.yml"
        
        if role_yml_path.exists():
            with open(role_yml_path, 'r', encoding='utf-8') as f:
                role_data = yaml.safe_load(f) or {}
            voice_id = role_data.get('voice_id')
            if voice_id:
                print(f"鉁?浠嶻ML鏂囦欢鑾峰彇瑙掕壊 '{role_name}' 鐨勮闊矷D: {voice_id}")
                return voice_id
        
        # 鍏煎鏃х増鏈細灏濊瘯浠巎son鏂囦欢璇诲彇
        role_json_path = PathManager.get_roles_dir() / f"{role_name}.json"
        if role_json_path.exists():
            with open(role_json_path, 'r', encoding='utf-8') as f:
                role_data = json.load(f)
            voice_id = role_data.get('voice_id')
            if voice_id:
                print(f"鉁?浠嶫SON鏂囦欢鑾峰彇瑙掕壊 '{role_name}' 鐨勮闊矷D: {voice_id}")
                return voice_id
        
        # 灏濊瘯浠庣帺瀹堕厤缃鍙?
        player_yml_path = PathManager.get_players_dir() / f"{role_name}.yml"
        if player_yml_path.exists():
            with open(player_yml_path, 'r', encoding='utf-8') as f:
                player_data = yaml.safe_load(f) or {}
            voice_id = player_data.get('voice_id')
            if voice_id:
                print(f"鉁?浠庣帺瀹堕厤缃幏鍙?'{role_name}' 鐨勮闊矷D: {voice_id}")
                return voice_id
        
        print(f"鈿狅笍 鏈壘鍒拌鑹?'{role_name}' 鐨勮闊矷D閰嶇疆锛岃鍦ㄨ鑹查厤缃枃浠朵腑娣诲姞voice_id瀛楁")
        return None
    except Exception as e:
        print(f"鉂?鑾峰彇瑙掕壊璇煶ID澶辫触: {e}")
        return None

def cleanup_old_audio_files():
    """清理旧音频文件，避免磁盘空间浪费。"""
    try:
        audio_dir = Path(__file__).parent / "audio"
        current_time = time.time()
        
        for file_path in audio_dir.glob("sentence_*.mp3"):
            # 濡傛灉鏂囦欢瓒呰繃5鍒嗛挓锛屽垹闄ゅ畠
            if current_time - file_path.stat().st_mtime > 300:  # 5鍒嗛挓 = 300绉?
                file_path.unlink()
                print(f"娓呯悊鏃ч煶棰戞枃浠? {file_path.name}")
    except Exception as e:
        print(f"娓呯悊闊抽鏂囦欢鏃跺嚭閿? {e}")



