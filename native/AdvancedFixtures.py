from pathlib import Path
from reportlab.pdfgen import canvas
from pypdf import PdfWriter
import json
root=Path(__file__).resolve().parents[1]/"work/fixtures";root.mkdir(parents=True,exist_ok=True)
(root/"structured.json").write_text(json.dumps({"标题":"中文测试","rows":[["a",1],["b",2]],"enabled":True},ensure_ascii=False))
(root/"plain.log").write_text("2026-10-24 中文日志\nSecond line\n")
path=root/"table.pdf";c=canvas.Canvas(str(path),pagesize=(612,792));rows=[["Name","Value","Unit"],["Alpha","123","kg"],["Beta","456","kg"],["Gamma","789","kg"]];xs=[40,220,370,550];ys=[700,670,640,610,580]
for x in xs:c.line(x,580,x,700)
for y in ys:c.line(40,y,550,y)
for i,row in enumerate(rows):
 for j,text in enumerate(row):c.drawString(xs[j]+8,ys[i]-20,text)
c.save()
writer=PdfWriter(clone_from=root/"digital.pdf");writer.encrypt("fixture-password",algorithm="AES-256");writer.write(root/"encrypted.pdf")
print("Advanced fixtures ready")
