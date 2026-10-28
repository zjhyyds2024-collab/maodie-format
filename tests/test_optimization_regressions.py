import importlib.util
from pathlib import Path
import tempfile
import unittest
from xml.etree import ElementTree

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('optimized',ROOT/'src-tauri/python/advanced_tools.py')
advanced=importlib.util.module_from_spec(spec);spec.loader.exec_module(advanced)

class OptimizationRegressions(unittest.TestCase):
    def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
    def tearDown(self):self.tmp.cleanup()
    def structured(self,source,target):return advanced.structured({'input_paths':[str(source)],'output_path':str(target)})
    def test_structured_html_has_no_injected_title_and_a_real_code_block(self):
        source=self.root/'data.json';source.write_text('{"名称":"中文","numbers":[1,2]}')
        out=self.root/'result.html';self.structured(source,out);text=out.read_text()
        self.assertNotIn('Converted document',text);self.assertNotIn('\xa0',text);self.assertIn('<pre><code>',text)
        from lxml import html
        import json
        self.assertEqual(json.loads(html.fromstring(text).xpath('//code')[0].text),{'名称':'中文','numbers':[1,2]})
    def test_html_csv_requires_an_actual_nonempty_table(self):
        source=self.root/'source.html';out=self.root/'out.csv'
        for text in ['<p>hello</p>','<table></table>']:
            source.write_text(text)
            with self.assertRaisesRegex(ValueError,'表格'):self.structured(source,out)
            self.assertFalse(out.exists())
        source.write_text('<table><tr><td>Name</td></tr><tr><td>中文</td></tr></table>')
        self.structured(source,out);self.assertIn('中文',out.read_text())
    def test_pdf_numbers_preserve_ambiguous_ids_precision_and_formula_strings(self):
        for value,expected in [('1234.5',1234.5),('-42',-42),('0.25',.25),('0',0)]:
            self.assertEqual(advanced.pdf_table_value(value),expected)
            self.assertIsInstance(advanced.pdf_table_value(value),(int,float))
        for text in ['00123','123456789012345678','=1+1','+SUM(A1)','2026-10-27','1,234.5','1e9']:
            self.assertEqual(advanced.pdf_table_value(text),text)
        self.assertTrue(advanced.identifier_header('Account ID'))
        self.assertTrue(advanced.identifier_header('订单编号'))
        self.assertFalse(advanced.identifier_header('Amount'))
        self.assertEqual(advanced.pdf_table_value('123',force_text=True),'123')
    def test_utf16_both_byte_orders_and_xml_entity_error_are_consistent(self):
        text='中文\n  UTF16_MARKER'
        for encoding,bom in [('utf-16-le',b'\xff\xfe'),('utf-16-be',b'\xfe\xff')]:
            src=self.root/(encoding+'.txt');src.write_bytes(bom+text.encode(encoding))
            self.assertEqual(advanced.read_text(src),text)
        src=self.root/'unsafe.xml';src.write_text('<!DOCTYPE r [<!ENTITY x SYSTEM "file:///NONEXISTENT">]><r>&x;</r>')
        with self.assertRaisesRegex(ValueError,'不安全的实体'):advanced.read_data(src)

if __name__=='__main__':unittest.main()
