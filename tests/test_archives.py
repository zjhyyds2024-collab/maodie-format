import importlib.util
import io
import gzip
import bz2
import lzma
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('archive_tools', ROOT/'src-tauri/python/archive_tools.py')
archives = importlib.util.module_from_spec(spec); spec.loader.exec_module(archives)
class ArchivesTest(unittest.TestCase):
    def setUp(self): self.tmp=tempfile.TemporaryDirectory(); self.path=Path(self.tmp.name)
    def tearDown(self): self.tmp.cleanup()
    def test_all_created_formats_roundtrip_unicode_duplicates_and_empty_file(self):
        a=self.path/'a';b=self.path/'b';a.mkdir();b.mkdir()
        (a/'中文.txt').write_text('中文 content');(b/'中文.txt').write_text('second');(a/'empty').touch()
        for operation, extension in archives.CREATE_FORMATS.items():
            with self.subTest(operation=operation):
                target=self.path/('result.'+extension)
                archives.create_archive(operation,[a/'中文.txt',b/'中文.txt',a/'empty'],target)
                folder=self.path/operation
                files=archives.extract_archive(target,folder)
                self.assertEqual(len(files),3)
                self.assertEqual((folder/'中文.txt').read_text(),'中文 content')
                self.assertEqual((folder/'中文 (1).txt').read_text(),'second')
                self.assertEqual((folder/'empty').stat().st_size,0)
    def test_single_compressed_files(self):
        for extension, module in [('gz',gzip),('bz2',bz2),('xz',lzma)]:
            source=self.path/('hello.txt.'+extension)
            source.write_bytes(module.compress('中文 data'.encode()))
            files=archives.extract_archive(source,self.path/extension)
            self.assertEqual(Path(files[0]).name,'hello.txt')
            self.assertEqual(Path(files[0]).read_text(),'中文 data')
    def tar(self, name, kind=None, linkname=''):
        source=self.path/'bad.tar'
        with tarfile.open(source,'w') as out:
            entry=tarfile.TarInfo(name)
            if kind: entry.type=kind;entry.linkname=linkname
            else: entry.size=4
            out.addfile(entry, None if kind else io.BytesIO(b'data'))
        return source
    def test_traversal_symlinks_hardlinks_devices_rejected(self):
        for i,(name,kind,target) in enumerate([('../outside',None,''),('/absolute',None,''),('/',tarfile.DIRTYPE,''),('C:/bad',None,''),('link',tarfile.SYMTYPE,'../outside'),('hard',tarfile.LNKTYPE,'../outside'),('device',tarfile.CHRTYPE,'')]):
            with self.subTest(name=name):
                with self.assertRaises(ValueError): archives.extract_archive(self.tar(name,kind,target),self.path/f'bad-{i}')
        self.assertFalse((self.path/'outside').exists())
    def test_bounds_and_existing_output(self):
        source=self.tar('file')
        with patch.object(archives,'MAX_BYTES',2):
            with self.assertRaisesRegex(ValueError,'大小'): archives.extract_archive(source,self.path/'limited')
        folder=self.path/'existing';folder.mkdir();(folder/'keep').write_text('keep')
        with self.assertRaisesRegex(ValueError,'独立'): archives.extract_archive(source,folder)
        self.assertEqual((folder/'keep').read_text(),'keep')
    def test_root_directory_entry_and_duplicate_member(self):
        source=self.path/'root.tar'
        with tarfile.open(source,'w') as out:
            root=tarfile.TarInfo('./');root.type=tarfile.DIRTYPE;out.addfile(root)
            info=tarfile.TarInfo('./hello.txt');info.size=2;out.addfile(info,io.BytesIO(b'hi'))
        files=archives.extract_archive(source,self.path/'root')
        self.assertEqual(Path(files[0]).read_text(),'hi')
        with tarfile.open(source,'a') as out:
            info=tarfile.TarInfo('hello.txt');info.size=2;out.addfile(info,io.BytesIO(b'no'))
        with self.assertRaisesRegex(ValueError,'重复'): archives.extract_archive(source,self.path/'duplicate')
    def test_damaged_archive_fails(self):
        for ext in ['7z', 'gz', 'bz2', 'xz']:
            source=self.path/('bad.'+ext);source.write_bytes(b'broken')
            with self.assertRaises(ValueError): archives.extract_archive(source,self.path/('damaged-'+ext))
if __name__=='__main__': unittest.main()
