"""VERT adapters around the pinned MIT music-geshizhuanhuan engines.
Read only user-selected files/databases. Never start the upstream web server.
"""
from pathlib import Path
import re

MAX_SOURCE = 256 * 1024**2
MAX_DATABASE = 128 * 1024**2

def decode_music(request, progress):
    source = Path(request['input_paths'][0]); output = Path(request['output_path'])
    if source.stat().st_size > MAX_SOURCE:
        raise ValueError('此类加密音乐单文件暂支持 256 MB 以内；NCM 不受此项限制。')
    if output.resolve() == source.resolve(): raise ValueError('必须导出新副本，不能覆盖源文件。')
    from music_unlock.formats.base import DecodeOptions
    from music_unlock.formats.kgm import KgmDecoder
    from music_unlock.formats.kwm import KwmDecoder
    from music_unlock.formats.qmc import QmcDecoder
    from music_unlock.model import normalize_audio
    ext = source.suffix.lower()
    with source.open('rb') as stream: head = stream.read(16)
    from music_unlock.formats.kgm import KGM_MAGIC, VPR_MAGIC
    if head in {KGM_MAGIC, VPR_MAGIC} or ext in {'.kgm', '.kgma', '.vpr', '.kgg'} or source.name.lower().endswith(('.kgm.flac', '.vpr.flac')):
        if ext == '.kgg': raise ValueError('KGG v5 暂不支持；当前可处理 KGM、KGMA 和 VPR。')
        decoder = KgmDecoder()
    elif ext == '.kwm' or head.startswith(b'yeelion-kuwo'): decoder = KwmDecoder()
    else: decoder = QmcDecoder()
    ekey = (request.get('music_ekey') or '').strip() or None
    if ekey and (len(ekey) > 4096 or not re.fullmatch(r'[A-Za-z0-9+/=]+', ekey)):
        raise ValueError('EKey 应为有效的 Base64 文本，且不超过 4096 字符。')
    db = request.get('music_key_db'); db = Path(db) if db else None
    if db and (not db.is_file() or db.stat().st_size > MAX_DATABASE):
        raise ValueError('请选择 128 MB 以内的 QQ 音乐 SQLite 密钥库文件。')
    progress(0, 1, '正在读取加密音乐')
    try: result = decoder.decode(source, DecodeOptions(ekey=ekey, ekey_db=db))
    except Exception as error:
        from music_unlock.errors import KeyError_
        if isinstance(error, KeyError_):
            raise ValueError('此 QQ 音乐文件没有内嵌密钥，请在转换设置的音乐解码中提供对应 EKey 或本地密钥库。') from None
        # Never expose key material from malformed base64/codec exceptions.
        from music_unlock.errors import UnlockError
        if isinstance(error, UnlockError): raise ValueError(str(error)) from None
        raise ValueError('音乐解析失败，密钥可能不匹配、文件损坏或版本暂不支持。') from None
    payload, container = normalize_audio(result.payload)
    if not payload or container == 'bin':
        raise ValueError('未还原出可识别的音频；文件可能损坏、密钥不匹配或版本暂不支持。')
    if container not in {'mp3','flac','ogg','m4a','wav'}: raise ValueError('内部音频类型暂不支持。')
    output.mkdir(parents=True, exist_ok=False)
    audio = output / ('audio.'+container); audio.write_bytes(payload)
    tags = output / 'tags.ffmeta'; tags.write_text(';FFMETADATA1\n', encoding='utf-8')
    progress(1, 1, '加密音乐已读取')
    return [str(audio), str(tags)], []

def music_cover(request):
    output = Path(request['output_path']); cover = Path(request['input_paths'][0])
    from music_unlock.tags import embed
    if output.suffix.lower() not in {'.mp3','.flac','.m4a'}:
        return [str(output)], ['此输出格式暂不写入封面；音频和支持的文字标签已导出。']
    if cover.stat().st_size > 8 * 1024**2:
        return [str(output)], ['封面超过 8 MB，未写入；音频已导出。']
    import tempfile, shutil, os
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=output.parent, suffix=output.suffix, delete=False) as handle:
            temporary = Path(handle.name)
        shutil.copyfile(output, temporary)
        embed(output.suffix.lower()[1:], temporary, {}, cover.read_bytes())
        os.replace(temporary, output)
    except Exception:
        return [str(output)], ['封面写入失败，音频已导出；请核对输出标签。']
    finally:
        if temporary: temporary.unlink(missing_ok=True)
    return [str(output)], []

def music_preview(request):
    import json, io
    import mutagen
    from PIL import Image
    source=Path(request['input_paths'][0]);output=Path(request['output_path'])
    details={};cover=None
    try:
        audio=mutagen.File(source,easy=True)
        if audio:
            for key in ['title','artist','album']:
                values=audio.get(key,[])
                if values: details[key]='/'.join(str(v) for v in values)[:4096]
            info=audio.info
            details.update(duration=round(getattr(info,'length',0),2),sample_rate=getattr(info,'sample_rate',None),bitrate=getattr(info,'bitrate',None))
        full=mutagen.File(source)
        if full is not None:
            if hasattr(full,'pictures') and full.pictures:cover=full.pictures[0].data
            elif getattr(full,'tags',None):
                tags=full.tags
                if hasattr(tags,'getall'):
                    frames=tags.getall('APIC')
                    if frames:cover=frames[0].data
                elif tags.get('covr'):cover=bytes(tags['covr'][0])
        if cover and len(cover)<=8*1024**2:
            try:
                with Image.open(io.BytesIO(cover)) as image:
                    if image.width*image.height<=50_000_000:
                        image.thumbnail((320,320));image.convert('RGB').save(output.with_suffix('.png'),'PNG')
            except Exception:pass
    except Exception:
        details['note']='此格式的标签暂无法读取，请使用系统应用核对。'
    output.write_text(json.dumps(details,ensure_ascii=False),encoding='utf-8')
    return [str(output)],[]
