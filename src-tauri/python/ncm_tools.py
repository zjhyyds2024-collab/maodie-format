"""Bounded, local-only reader for the NCM container. Format reference:
https://github.com/taurusxin/ncmdump/blob/master/src/ncmcrypt.cpp
No remote cover lookup; filenames and metadata never become output paths.
"""
from pathlib import Path
import base64
import json
import struct

CORE_KEY = b'hzHRAmso5kInbaxW'
META_KEY = bytes.fromhex('2331346c6a6b5f215c5d2630553c2728')

def _exact(stream, count):
    value = stream.read(count)
    if len(value) != count: raise ValueError('NCM 文件不完整，无法读取所需数据。')
    return value

def _length(stream, limit):
    length = struct.unpack('<I', _exact(stream, 4))[0]
    if length > limit: raise ValueError('NCM 数据块超出支持范围，文件可能损坏。')
    return length

def _decrypt(data, key):
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.primitives.padding import PKCS7
    if not data or len(data) % 16: raise ValueError('NCM 密钥块无效或文件已损坏。')
    decryptor = Cipher(algorithms.AES(key), modes.ECB()).decryptor()
    padded = decryptor.update(data) + decryptor.finalize()
    unpad = PKCS7(128).unpadder()
    try: return unpad.update(padded) + unpad.finalize()
    except ValueError as error: raise ValueError('NCM 密钥校验失败，文件可能损坏或版本不受支持。') from error

def _mask(key):
    if not key: raise ValueError('NCM 音频密钥为空。')
    box = list(range(256)); position = 0
    for index in range(256):
        position = (position + box[index] + key[index % len(key)]) & 255
        box[index], box[position] = box[position], box[index]
    return bytes(box[(box[j] + box[(box[j] + j) & 255]) & 255] for j in list(range(1, 256)) + [0])

def _metadata(data):
    if not data: return {}
    encoded = bytes(value ^ 0x63 for value in data)
    if not encoded.startswith(b"163 key(Don't modify):"): raise ValueError('Invalid metadata marker')
    value = _decrypt(base64.b64decode(encoded[22:], validate=True), META_KEY)
    if not value.startswith(b'music:'): raise ValueError('Invalid metadata type')
    result = json.loads(value[6:])
    if not isinstance(result, dict): raise ValueError('Invalid metadata object')
    return result

def _ffescape(value):
    text = str(value).replace('\x00', '')[:4096]
    return ''.join('\\' + char if char in '\\=;#\n\r' else char for char in text)

def decode_ncm(request, progress):
    source = Path(request['input_paths'][0]); output = Path(request['output_path'])
    if source.resolve() == output.resolve(): raise ValueError('NCM 必须导出为新副本，不能覆盖源文件。')
    warnings = []
    with source.open('rb') as stream:
        size = source.stat().st_size
        if size > 8 * 1024**3: raise ValueError('NCM 文件超过 8 GB，请使用较小文件。')
        if _exact(stream, 8) != b'CTENFDAM': raise ValueError('不是有效的 NCM 文件，不能只修改音频扩展名。')
        _exact(stream, 2)
        encrypted_key = _exact(stream, _length(stream, 4096))
        key = _decrypt(bytes(value ^ 0x64 for value in encrypted_key), CORE_KEY)
        if not key.startswith(b'neteasecloudmusic') or len(key) <= 17:
            raise ValueError('NCM 音频密钥格式不受支持。')
        mask = _mask(key[17:])
        raw_metadata = _exact(stream, _length(stream, 8 * 1024**2))
        try: metadata = _metadata(raw_metadata)
        except (ValueError, UnicodeError, RecursionError):
            metadata = {}; warnings.append('NCM 歌曲标签无法解析；音频将继续处理，请核对歌曲信息。')
        _exact(stream, 5)  # CRC32 and cover version
        frame_length = _length(stream, 64 * 1024**2)
        cover_length = _length(stream, 64 * 1024**2)
        if cover_length > frame_length or frame_length > size - stream.tell():
            raise ValueError('NCM 封面数据长度无效或文件已截断。')
        cover_data = _exact(stream, cover_length) if cover_length <= 8 * 1024**2 else b''
        stream.seek(frame_length - (cover_length if cover_data else 0), 1)
        if cover_length and not cover_data: warnings.append('NCM 封面超过 8 MB，未写入；音频将继续处理。')
        start = stream.tell(); total = size - start
        if total < 4: raise ValueError('NCM 文件中没有完整的音频数据。')
        head = _exact(stream, min(total, 16))
        plain = bytes(value ^ mask[index] for index, value in enumerate(head))
        if plain.startswith(b'fLaC'): extension = 'flac'
        elif plain.startswith(b'ID3') or plain[0] == 255 and plain[1] & 224 == 224: extension = 'mp3'
        elif plain[4:8] == b'ftyp': extension = 'm4a'
        else: raise ValueError('NCM 内部音频类型不受支持或文件已损坏。')
        output.mkdir(parents=True, exist_ok=False)
        audio = output / ('audio.' + extension)
        stream.seek(start)
        processed = 0
        try:
            with audio.open('xb') as dest:
                while chunk := stream.read(1024 * 1024):
                    dest.write(bytes(value ^ mask[index & 255] for index, value in enumerate(chunk)))
                    processed += len(chunk)
                    if processed % (8 * 1024**2) == 0 or processed == total:
                        progress(processed, total, '正在读取 NCM 音频')
            tags = {'title': metadata.get('musicName'), 'album': metadata.get('album')}
            artists = metadata.get('artist')
            if isinstance(artists, list):
                tags['artist'] = '/'.join(str(item[0]) for item in artists[:64] if isinstance(item, list) and item)
            tagfile = output / 'tags.ffmeta'
            tagfile.write_text(';FFMETADATA1\n' + ''.join(f'{name}={_ffescape(value)}\n' for name, value in tags.items() if isinstance(value, str) and value), encoding='utf-8')
        except Exception:
            audio.unlink(missing_ok=True)
            raise
    outputs = [str(audio), str(tagfile)]
    if cover_data:
        try:
            from PIL import Image
            import io
            with Image.open(io.BytesIO(cover_data)) as image:
                if image.format not in {'PNG', 'JPEG'} or image.width * image.height > 50_000_000: raise ValueError()
                suffix = 'png' if image.format == 'PNG' else 'jpg'
                image.verify()
            cover = output / ('cover.' + suffix); cover.write_bytes(cover_data); outputs.append(str(cover))
        except Exception: warnings.append('NCM 封面无效，未写入；音频将继续处理。')
    return outputs, warnings
