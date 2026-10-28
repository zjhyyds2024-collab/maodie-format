import base64
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.padding import PKCS7

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('ncm_tools', ROOT/'src-tauri/python/ncm_tools.py')
ncm=importlib.util.module_from_spec(spec);spec.loader.exec_module(ncm)

def encrypted(data, key):
    pad=PKCS7(128).padder();data=pad.update(data)+pad.finalize()
    cipher=Cipher(algorithms.AES(key),modes.ECB()).encryptor()
    return cipher.update(data)+cipher.finalize()

def make_ncm(audio, metadata=None, padding=0, cover=b'', key=b'VERT synthetic audio key', corrupt_metadata=False):
    # Independent writer for generated, non-copyrighted fixtures; production has no encoder.
    box=list(range(256));last=0
    for i in range(256):
        last=(box[i]+last+key[i%len(key)])%256
        box[i],box[last]=box[last],box[i]
    scrambled=bytearray(audio)
    for i in range(len(scrambled)):
        j=(i+1)%256
        scrambled[i]^=box[(box[j]+box[(box[j]+j)%256])%256]
    data=encrypted(b'neteasecloudmusic'+key, b'hzHRAmso5kInbaxW')
    keydata=bytes(x^100 for x in data)
    tags=b''
    if metadata is not None:
        raw=encrypted(b'music:'+json.dumps(metadata,ensure_ascii=False).encode(), bytes.fromhex('2331346c6a6b5f215c5d2630553c2728'))
        tags=bytes(x^99 for x in b"163 key(Don't modify):"+base64.b64encode(raw))
    if corrupt_metadata: tags=b'invalid metadata'
    return b'CTENFDAM\0\0'+struct.pack('<I',len(keydata))+keydata+struct.pack('<I',len(tags))+tags+b'\0'*5+struct.pack('<II',len(cover)+padding,len(cover))+cover+b'\0'*padding+scrambled

class NcmTest(unittest.TestCase):
    def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
    def tearDown(self):self.tmp.cleanup()
    def decode(self,data):
        source=self.root/'source.ncm';source.write_bytes(data)
        return ncm.decode_ncm({'input_paths':[str(source)],'output_path':str(self.root/'out')},lambda *args:None)
    def test_stream_boundary_and_reserved_cover_frame(self):
        audio=b'fLaC'+bytes(range(256))*8193
        data=make_ncm(audio,padding=4096)
        paths,notes=self.decode(data)
        self.assertEqual(Path(paths[0]).read_bytes(),audio)
        self.assertEqual((self.root/'source.ncm').read_bytes(),data)
        self.assertFalse(notes)
    def test_mp3_tags_and_cover_are_local_and_escaped(self):
        paths,notes=self.decode(make_ncm(b'ID3'+b'a'*4096,{'musicName':'中文=标题\nline','album':'本地专辑','artist':[['歌手',1]]},cover=b'cover'))
        self.assertEqual(Path(paths[0]).suffix,'.mp3')
        text=Path(paths[1]).read_text();self.assertIn('artist=歌手',text);self.assertIn('title=中文\\=标题\\\nline',text)
        self.assertTrue(any('封面' in note for note in notes))
    def test_bad_metadata_does_not_discard_audio(self):
        paths,notes=self.decode(make_ncm(b'fLaC'+b'x'*200,corrupt_metadata=True))
        self.assertEqual(Path(paths[0]).read_bytes(),b'fLaC'+b'x'*200)
        self.assertTrue(any('标签' in note for note in notes))
    def test_rejects_truncated_forged_and_unbounded_headers(self):
        valid=make_ncm(b'fLaC'+b'x'*100)
        for data in [b'',b'fakefake'+valid[8:],valid[:14],valid[:10]+struct.pack('<I',2**32-1)+valid[14:],valid[:-104]]:
            with self.subTest(size=len(data)):
                with self.assertRaises(ValueError):self.decode(data)
                self.assertFalse((self.root/'out').exists())
    def test_source_cannot_be_replaced(self):
        source=self.root/'song.ncm';source.write_bytes(make_ncm(b'fLaC'+b'x'*100))
        before=source.read_bytes()
        with self.assertRaisesRegex(ValueError,'覆盖'):
            ncm.decode_ncm({'input_paths':[str(source)],'output_path':str(source)},lambda *args:None)
        self.assertEqual(source.read_bytes(),before)

if __name__=='__main__':unittest.main()
