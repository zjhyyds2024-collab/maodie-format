import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
import pymupdf
from pypdf import PdfReader, PdfWriter
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('advanced',ROOT/'src-tauri/python/advanced_tools.py')
advanced=importlib.util.module_from_spec(spec);spec.loader.exec_module(advanced)
class PdfPagesTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name);self.source=self.path/'source.pdf'
        doc=pymupdf.open()
        for n in range(1,4):
            page=doc.new_page(width=250+n*10,height=350);page.insert_text((20,30),f'Page {n}')
        doc.save(self.source);doc.close();self.original=hashlib.sha256(self.source.read_bytes()).digest()
    def tearDown(self):
        self.assertEqual(hashlib.sha256(self.source.read_bytes()).digest(),self.original);self.tmp.cleanup()
    def run_tool(self,operation,pages='',**kwargs):
        out=self.path/f'{operation}.pdf'
        result=advanced.main(dict(operation=operation,input_paths=[str(self.source)],output_path=str(out),pages=pages,**kwargs))
        return PdfReader(out),result
    def texts(self,doc): return [page.extract_text().strip() for page in doc.pages]
    def test_rotate_selected_pages_keeps_content_and_other_angles(self):
        doc,_=self.run_tool('rotate-pdf','2',rotation=90)
        self.assertEqual([page.rotation for page in doc.pages],[0,90,0]);self.assertEqual(self.texts(doc),['Page 1','Page 2','Page 3'])
        doc,_=self.run_tool('rotate-pdf','',rotation=270);self.assertEqual([page.rotation for page in doc.pages],[270]*3)
    def test_extract_delete_and_reorder_preserve_exact_page_text(self):
        doc,_=self.run_tool('extract-pages','3,1');self.assertEqual(self.texts(doc),['Page 3','Page 1'])
        doc,_=self.run_tool('delete-pages','2');self.assertEqual(self.texts(doc),['Page 1','Page 3'])
        doc,_=self.run_tool('reorder-pages','3,1,2');self.assertEqual(self.texts(doc),['Page 3','Page 1','Page 2'])
    def test_rejects_bad_ranges_duplicate_pages_delete_all_and_incomplete_order(self):
        cases=[('extract-pages',''),('extract-pages','0'),('extract-pages','4'),('extract-pages','3-1'),('extract-pages','1,,2'),('extract-pages','1,1'),('delete-pages','1-3'),('reorder-pages','1,2')]
        for operation,pages in cases:
            with self.subTest(operation=operation,pages=pages):
                with self.assertRaises(ValueError): self.run_tool(operation,pages)
                self.assertFalse((self.path/f'{operation}.pdf').exists())
        with self.assertRaises(ValueError):self.run_tool('rotate-pdf','1',rotation=45)
    def test_password_protected_input_and_source_overwrite_rejected(self):
        writer=PdfWriter(clone_from=self.source);writer.encrypt('secret');encrypted=self.path/'encrypted.pdf';writer.write(encrypted)
        with self.assertRaisesRegex(ValueError,'加密'):
            advanced.main(dict(operation='extract-pages',input_paths=[str(encrypted)],output_path=str(self.path/'out.pdf'),pages='1'))
        with self.assertRaisesRegex(ValueError,'源 PDF'):
            advanced.main(dict(operation='delete-pages',input_paths=[str(self.source)],output_path=str(self.source),pages='1'))
    def test_structural_content_is_flagged_for_review(self):
        writer=PdfWriter(clone_from=self.source);writer.add_outline_item('Chapter',0);bookmarked=self.path/'bookmarked.pdf';writer.write(bookmarked)
        _,warnings=advanced.main(dict(operation='extract-pages',input_paths=[str(bookmarked)],output_path=str(self.path/'out.pdf'),pages='2'))
        self.assertTrue(any('书签' in value for value in warnings))
if __name__=='__main__':unittest.main()
