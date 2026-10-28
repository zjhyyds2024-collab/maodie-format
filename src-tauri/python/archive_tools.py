"""Bounded archive handling using macOS libarchive; never restore links or file modes."""
import ctypes as C
import os
from pathlib import Path, PurePosixPath
import stat
import tarfile

MAX_MEMBERS = 10000
MAX_BYTES = 2 * 1024 ** 3
CREATE_FORMATS = {"create-tar": "tar", "create-tgz": "tar.gz", "create-tbz2": "tar.bz2", "create-txz": "tar.xz", "create-7z": "7z"}

def library():
    lib = C.CDLL('/usr/lib/libarchive.2.dylib')
    signatures = {
        'archive_read_new': (C.c_void_p, []),
        'archive_read_support_filter_all': (C.c_int, [C.c_void_p]),
        'archive_read_support_format_all': (C.c_int, [C.c_void_p]),
        'archive_read_support_format_raw': (C.c_int, [C.c_void_p]),
        'archive_read_open_filename': (C.c_int, [C.c_void_p, C.c_char_p, C.c_size_t]),
        'archive_read_next_header': (C.c_int, [C.c_void_p, C.POINTER(C.c_void_p)]),
        'archive_read_data': (C.c_ssize_t, [C.c_void_p, C.c_void_p, C.c_size_t]),
        'archive_read_free': (C.c_int, [C.c_void_p]),
        'archive_format': (C.c_int, [C.c_void_p]),
        'archive_error_string': (C.c_char_p, [C.c_void_p]),
        'archive_entry_pathname_utf8': (C.c_char_p, [C.c_void_p]),
        'archive_entry_pathname': (C.c_char_p, [C.c_void_p]),
        'archive_entry_size': (C.c_int64, [C.c_void_p]),
        'archive_entry_filetype': (C.c_uint, [C.c_void_p]),
        'archive_entry_symlink': (C.c_char_p, [C.c_void_p]),
        'archive_entry_hardlink': (C.c_char_p, [C.c_void_p]),
        'archive_entry_is_encrypted': (C.c_int, [C.c_void_p]),
        'archive_write_new': (C.c_void_p, []),
        'archive_write_set_format_7zip': (C.c_int, [C.c_void_p]),
        'archive_write_open_filename': (C.c_int, [C.c_void_p, C.c_char_p]),
        'archive_write_header': (C.c_int, [C.c_void_p, C.c_void_p]),
        'archive_write_data': (C.c_ssize_t, [C.c_void_p, C.c_void_p, C.c_size_t]),
        'archive_write_close': (C.c_int, [C.c_void_p]),
        'archive_write_free': (C.c_int, [C.c_void_p]),
        'archive_entry_new': (C.c_void_p, []),
        'archive_entry_free': (None, [C.c_void_p]),
        'archive_entry_set_pathname': (None, [C.c_void_p, C.c_char_p]),
        'archive_entry_set_size': (None, [C.c_void_p, C.c_int64]),
        'archive_entry_set_filetype': (None, [C.c_void_p, C.c_uint]),
        'archive_entry_set_perm': (None, [C.c_void_p, C.c_int]),
    }
    for name, (result, arguments) in signatures.items():
        function = getattr(lib, name); function.restype = result; function.argtypes = arguments
    return lib

def check(lib, archive, status):
    if status < 0:
        message = lib.archive_error_string(archive)
        raise ValueError('压缩包处理失败（损坏、加密、分卷或不支持的变体）：' + (message.decode('utf-8', 'replace')[:300] if message else 'unknown error'))
    return status

def member_path(name):
    name = name.replace('\\', '/')
    path = PurePosixPath(name)
    if path.is_absolute() or '..' in path.parts or not path.parts or ':' in path.parts[0] or '\x00' in name:
        raise ValueError('压缩包包含越界路径，已拒绝解压。')
    return path

def extract_archive(source, destination, progress=lambda *_: None):
    source = Path(source); destination = Path(destination)
    signatures = {'.gz': b'\x1f\x8b', '.bz2': b'BZh', '.xz': b'\xfd7zXZ\x00'}
    if source.suffix.lower() in signatures:
        with source.open('rb') as stream:
            if not stream.read(6).startswith(signatures[source.suffix.lower()]):
                raise ValueError('压缩文件头无效，文件可能损坏。')
    if destination.exists() and (destination.is_symlink() or not destination.is_dir() or any(destination.iterdir())):
        raise ValueError('请使用空的独立解压目录。')
    destination.mkdir(parents=True, exist_ok=True)
    lib = library(); archive = lib.archive_read_new()
    if not archive: raise MemoryError('Cannot allocate archive reader')
    files = []; names = set(); declared = 0; written = 0; count = 0
    try:
        check(lib, archive, lib.archive_read_support_filter_all(archive))
        check(lib, archive, lib.archive_read_support_format_all(archive))
        if source.suffix.lower() in {'.gz', '.bz2', '.xz'}:
            check(lib, archive, lib.archive_read_support_format_raw(archive))
        check(lib, archive, lib.archive_read_open_filename(archive, os.fsencode(source), 65536))
        entry = C.c_void_p(); buffer = C.create_string_buffer(1024 * 1024)
        while True:
            status = lib.archive_read_next_header(archive, C.byref(entry))
            if status == 1: break
            check(lib, archive, status)
            count += 1
            if count > MAX_MEMBERS: raise ValueError('压缩包条目超过 10000 个。')
            raw = lib.archive_entry_pathname_utf8(entry) or lib.archive_entry_pathname(entry)
            if not raw: raise ValueError('压缩包文件名不可读取。')
            name = source.stem if lib.archive_format(archive) == 0x90000 else raw.decode('utf-8')
            kind = lib.archive_entry_filetype(entry)
            if kind == stat.S_IFDIR and name.replace("\\", "/") in {".", "./"}: continue
            path = member_path(name)
            if kind not in {stat.S_IFREG, stat.S_IFDIR} or lib.archive_entry_symlink(entry) is not None or lib.archive_entry_hardlink(entry) is not None:
                raise ValueError('压缩包包含链接或特殊文件，已拒绝解压。')
            if lib.archive_entry_is_encrypted(entry) > 0: raise ValueError('暂不支持加密压缩包。')
            identity = str(path).casefold()
            if identity in names: raise ValueError('压缩包包含重复或大小写冲突的路径。')
            names.add(identity)
            size = lib.archive_entry_size(entry)
            if size < 0 or size > MAX_BYTES: raise ValueError('压缩包展开大小超过 2 GB。')
            declared += size
            if declared > MAX_BYTES: raise ValueError('压缩包展开大小超过 2 GB。')
            target = destination.joinpath(*path.parts)
            if kind == stat.S_IFDIR:
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as out:
                while True:
                    length = lib.archive_read_data(archive, buffer, len(buffer))
                    if length == 0: break
                    check(lib, archive, length)
                    written += length
                    if written > MAX_BYTES: raise ValueError('压缩包实际展开大小超过 2 GB。')
                    out.write(buffer.raw[:length])
            files.append(str(target)); progress(count, None, '正在解压')
        if count == 0: raise ValueError('压缩包为空或无法读取。')
        return files
    finally:
        lib.archive_read_free(archive)

def inputs(paths):
    if not paths or len(paths) > MAX_MEMBERS: raise ValueError('请选择 1–10000 个普通文件。')
    seen = set(); total = 0; result = []
    for value in paths:
        path = Path(value)
        if not path.is_file() or path.is_symlink(): raise ValueError('压缩入口只接受普通文件。')
        total += path.stat().st_size
        if total > MAX_BYTES: raise ValueError('本次压缩文件总大小超过 2 GB。')
        name = path.name; index = 1
        while name.casefold() in seen:
            name = f'{path.stem} ({index}){path.suffix}'; index += 1
        member_path(name); seen.add(name.casefold()); result.append((path, name))
    return result

def create_archive(operation, paths, output, progress=lambda *_: None):
    files = inputs(paths)
    checked_size = 0
    if operation != 'create-7z':
        mode = {'create-tar': 'w', 'create-tgz': 'w:gz', 'create-tbz2': 'w:bz2', 'create-txz': 'w:xz'}[operation]
        with tarfile.open(output, mode, format=tarfile.PAX_FORMAT) as archive:
            for index, (path, name) in enumerate(files):
                # Open before stat, do not follow a replaced symlink.
                fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
                with os.fdopen(fd, 'rb') as data:
                    info = os.fstat(data.fileno())
                    checked_size += info.st_size
                    if checked_size > MAX_BYTES: raise ValueError('本次压缩文件总大小超过 2 GB。')
                    if not stat.S_ISREG(info.st_mode): raise ValueError('压缩入口只接受普通文件。')
                    member = tarfile.TarInfo(name); member.size = info.st_size; member.mode = 0o644
                    archive.addfile(member, data)
                progress(index + 1, len(files), '正在压缩')
        return [str(output)], []
    lib = library(); archive = lib.archive_write_new()
    if not archive: raise MemoryError('Cannot allocate archive writer')
    try:
        check(lib, archive, lib.archive_write_set_format_7zip(archive))
        check(lib, archive, lib.archive_write_open_filename(archive, os.fsencode(output)))
        for index, (path, name) in enumerate(files):
            fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
            with os.fdopen(fd, 'rb') as data:
                info = os.fstat(data.fileno())
                checked_size += info.st_size
                if checked_size > MAX_BYTES: raise ValueError('本次压缩文件总大小超过 2 GB。')
                if not stat.S_ISREG(info.st_mode): raise ValueError('压缩入口只接受普通文件。')
                entry = lib.archive_entry_new()
                if not entry: raise MemoryError('Cannot allocate archive entry')
                try:
                    lib.archive_entry_set_pathname(entry, name.encode('utf-8'))
                    lib.archive_entry_set_size(entry, info.st_size)
                    lib.archive_entry_set_filetype(entry, stat.S_IFREG)
                    lib.archive_entry_set_perm(entry, 0o644)
                    check(lib, archive, lib.archive_write_header(archive, entry))
                    remaining = info.st_size
                    while remaining:
                        block = data.read(min(remaining, 1024 * 1024))
                        if not block: raise ValueError("压缩时源文件发生变化，请重试。")
                        remaining -= len(block)
                        buffer = C.create_string_buffer(block); offset = 0
                        while offset < len(block):
                            length = lib.archive_write_data(archive, C.byref(buffer, offset), len(block) - offset)
                            check(lib, archive, length)
                            if length == 0: raise ValueError('7Z 写入失败。')
                            offset += length
                finally: lib.archive_entry_free(entry)
            progress(index + 1, len(files), '正在压缩')
        check(lib, archive, lib.archive_write_close(archive))
        return [str(output)], []
    finally: lib.archive_write_free(archive)
