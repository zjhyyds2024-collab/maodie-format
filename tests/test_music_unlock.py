from pathlib import Path
import importlib.util
import json
import sqlite3
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src-tauri/python'))
sys.path.insert(0,str(ROOT/'tests/music_unlock_fixtures'))
from builders import FIXTURE_MP3,build_kgm,build_kwm,build_qmc_v1,build_qmc_v2,build_stag,load_kgm_pub_key,make_ekey_v1,make_ekey_v2
from encrypted_music import decode_music
from music_unlock.formats.qmc import QmcDecoder
from music_unlock.formats.base import DecodeOptions

class MusicUnlockTests(unittest.TestCase):
    def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
    def tearDown(self):self.tmp.cleanup()
    def decode(self,name,data,**extra):
        source=self.root/name;source.write_bytes(data)
        return decode_music({'input_paths':[str(source)],'output_path':str(self.root/(name+'.out')),**extra},lambda *args:None)
    def test_qmc_v1_crosses_7fff_boundary(self):
        plain=FIXTURE_MP3+b'\0'*40000+b'TAIL'
        paths,_=self.decode('old.qmc0',build_qmc_v1(plain))
        self.assertEqual(Path(paths[0]).read_bytes(),plain)
    def test_qmc_map_rc4_and_pcv1(self):
        import struct
        from music_unlock.ciphers import make_qmc2_stream
        for size in [24,512]:
            key=bytes((i*7+3)&255 for i in range(size));ekey=make_ekey_v2(key) if size>300 else make_ekey_v1(key)
            paths,_=self.decode(str(size)+'.mflac',build_qmc_v2(FIXTURE_MP3,key,ekey))
            self.assertEqual(Path(paths[0]).read_bytes(),FIXTURE_MP3)
        key=bytes(range(24));ekey=make_ekey_v1(key).encode()
        data=make_qmc2_stream(key).decrypt(FIXTURE_MP3)+ekey+struct.pack('<I',len(ekey))
        paths,_=self.decode('legacy.mgg',data);self.assertEqual(Path(paths[0]).read_bytes(),FIXTURE_MP3)
    def test_missing_key_and_explicit_key(self):
        key=bytes(range(24));data=build_stag(FIXTURE_MP3,key)
        with self.assertRaisesRegex(ValueError,'没有内嵌密钥'):self.decode('missing.mflac',data)
        paths,_=self.decode('provided.mflac',data,music_ekey=make_ekey_v1(key))
        self.assertEqual(Path(paths[0]).read_bytes(),FIXTURE_MP3)
    def test_selected_database_is_read_only_with_special_path(self):
        key=bytes(range(24));data=build_stag(FIXTURE_MP3,key)
        db=self.root/'keys #? 数据.sqlite'
        with sqlite3.connect(db) as connection:
            connection.execute('CREATE TABLE audio_file_ekey_table (file_path TEXT, ekey TEXT)')
            connection.execute('INSERT INTO audio_file_ekey_table VALUES (?,?)',('123',make_ekey_v1(key)))
        before=db.read_bytes();paths,_=self.decode('database.mflac',data,music_key_db=str(db))
        self.assertEqual(Path(paths[0]).read_bytes(),FIXTURE_MP3);self.assertEqual(db.read_bytes(),before)
    def test_kgm_and_kwm(self):
        paths,_=self.decode('old.kgm',build_kgm(FIXTURE_MP3,load_kgm_pub_key()))
        self.assertEqual(Path(paths[0]).read_bytes(),FIXTURE_MP3)
        plain=b'\0'*64+FIXTURE_MP3
        paths,_=self.decode('old.kwm',build_kwm(plain));self.assertEqual(Path(paths[0]).read_bytes(),FIXTURE_MP3)
    def test_malformed_or_unknown_audio_never_succeeds(self):
        for name,data in [('bad.kgm',b'bad'*1000),('bad.kwm',b'bad'*1000),('bad.qmc0',b'bad'*1000),('new.kgg',b'bad'*1000)]:
            with self.subTest(name=name):
                with self.assertRaises(ValueError):self.decode(name,data)
        data=bytearray(build_kgm(FIXTURE_MP3,load_kgm_pub_key()));data[16:20]=(1).to_bytes(4,'little')
        with self.assertRaisesRegex(ValueError,'偏移'):self.decode('offset.kgm',data)
    def test_ekey_errors_do_not_echo_secrets(self):
        data=build_stag(FIXTURE_MP3,bytes(range(24)))
        secret='not-a-key-PRIVATE'
        with self.assertRaises(ValueError) as context:self.decode('private.mflac',data,music_ekey=secret)
        self.assertNotIn(secret,str(context.exception))


class ContainerNormalizationTests(unittest.TestCase):
    def test_m4a_zero_length_prefix_is_not_padding(self):
        from music_unlock.model import normalize_audio
        data=b'\0\0\0\x18ftypM4A '+b'\0'*128
        self.assertEqual(normalize_audio(data),(data,'m4a'))
        self.assertEqual(normalize_audio(b'\0'*64+data),(data,'m4a'))
    def test_only_verified_padding_is_removed(self):
        from music_unlock.model import normalize_audio
        self.assertEqual(normalize_audio(b'\0'*64+FIXTURE_MP3),(FIXTURE_MP3,'mp3'))
        self.assertEqual(normalize_audio(b'\0'*64+b'garbage')[1],'bin')


class CoverWriteTests(unittest.TestCase):
    def test_failed_cover_write_keeps_valid_audio_untouched(self):
        from encrypted_music import music_cover
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);audio=root/'audio.mp3';cover=root/'cover.jpg'
            audio.write_bytes(FIXTURE_MP3);cover.write_bytes(b'cover')
            def fail(container,path,*args):
                path.write_bytes(b'partial');raise OSError('simulated disk failure')
            with patch('music_unlock.tags.embed',side_effect=fail):
                _,warnings=music_cover({'input_paths':[str(cover)],'output_path':str(audio)})
            self.assertTrue(warnings);self.assertEqual(audio.read_bytes(),FIXTURE_MP3)
            self.assertEqual({p.name for p in root.iterdir()},{'audio.mp3','cover.jpg'})
