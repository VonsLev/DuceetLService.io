#!/usr/bin/env python3
"""Indexa PDFs locales incrementalmente y puede aplicar OCR a páginas escaneadas.
No descarga ni rastrea Internet. Los metadatos extraídos son sugerencias que deben verificarse.
"""
import argparse, hashlib, sqlite3, sys, re
from datetime import datetime, timezone
from pathlib import Path
DB_NAME = 'archivo_documental.sqlite3'

def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def extract_text(path, do_ocr=False, lang='spa'):
    try:
        import fitz
    except ImportError:
        raise RuntimeError('Falta PyMuPDF. Ejecuta iniciar_lector_pdf.bat o instala requirements_lector.txt')
    doc = fitz.open(path); pages = []
    for i, page in enumerate(doc):
        text = page.get_text('text') or ''
        if do_ocr and len(re.sub(r'\s+', '', text)) < 40:
            try:
                import pytesseract
                from PIL import Image
                import io
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                image = Image.open(io.BytesIO(pix.tobytes('png')))
                text = pytesseract.image_to_string(image, lang=lang) or text
            except Exception as e:
                print(f'  Aviso OCR página {i+1}: {e}', file=sys.stderr)
        pages.append(f'\n\n[PÁGINA {i+1}]\n{text}')
    return '\n'.join(pages)

def extract_metadata(path, extracted_text):
    """Extrae metadatos PDF y propone autor/año desde las primeras líneas; requiere revisión."""
    title = Path(path).stem; author = ''; year = ''
    try:
        import fitz
        with fitz.open(path) as pdf:
            md = pdf.metadata or {}
            title = (md.get('title') or '').strip() or title
            author = (md.get('author') or '').strip()
            m = re.search(r'(?:19|20)\d{2}', md.get('creationDate') or '')
            if m: year = m.group(0)
    except Exception:
        pass
    first = '\n'.join(extracted_text.splitlines()[:100])
    if not year:
        m = re.search(r'\b(?:19|20)\d{2}\b', first)
        if m: year = m.group(0)
    if not author:
        for line in first.splitlines():
            line = re.sub(r'\s+', ' ', line).strip(' .,:;')
            if (5 <= len(line) <= 90 and
                re.match(r'^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ-]+(?:[ ,]+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ-]+){1,4}$', line) and
                not re.search(r'UNIVERSIDAD|FACULTAD|ESCUELA|MINISTERIO|CONGRESO|REPÚBLICA|REPUBLICA|INSTITUTO', line, re.I)):
                author = line; break
    return title, author, year

def init(db):
    con = sqlite3.connect(db)
    con.execute('''CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY, sha256 TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
      source_path TEXT NOT NULL, source_url TEXT, extracted_text TEXT NOT NULL,
      page_count INTEGER, ocr_requested INTEGER NOT NULL DEFAULT 0,
      processed_at TEXT NOT NULL)''')
    cols = {r[1] for r in con.execute('PRAGMA table_info(documents)')}
    if 'author' not in cols: con.execute("ALTER TABLE documents ADD COLUMN author TEXT DEFAULT ''")
    if 'publication_year' not in cols: con.execute("ALTER TABLE documents ADD COLUMN publication_year TEXT DEFAULT ''")
    con.execute('CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(title, extracted_text, content="documents", content_rowid="id")')
    con.executescript('''CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
      INSERT INTO documents_fts(rowid,title,extracted_text) VALUES(new.id,new.title,new.extracted_text); END;
      CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts,rowid,title,extracted_text) VALUES('delete',old.id,old.title,old.extracted_text); END;''')
    con.commit(); return con

def process(folder, db, do_ocr, lang):
    con = init(db); paths = sorted(Path(folder).rglob('*.pdf'))
    if not paths: print('No se encontraron PDFs en', folder); return
    new = skip = errors = 0
    for path in paths:
        try:
            digest = sha256(path)
            if con.execute('SELECT 1 FROM documents WHERE sha256=?', (digest,)).fetchone():
                skip += 1; continue
            print('Indexando:', path)
            text = extract_text(str(path), do_ocr, lang)
            import fitz
            with fitz.open(path) as pdf: pages = len(pdf)
            sidecar = path.with_suffix('.url.txt')
            url = sidecar.read_text(encoding='utf-8').strip() if sidecar.exists() else None
            title, author, year = extract_metadata(path, text)
            con.execute('''INSERT INTO documents(sha256,title,source_path,source_url,extracted_text,page_count,ocr_requested,processed_at,author,publication_year)
              VALUES(?,?,?,?,?,?,?,?,?,?)''', (digest,title,str(path.resolve()),url,text,pages,int(do_ocr),datetime.now(timezone.utc).isoformat(),author,year))
            con.commit(); new += 1
        except Exception as e:
            errors += 1; print('ERROR', path, ':', e, file=sys.stderr)
    print(f'Finalizado: nuevos={new}, ya indexados={skip}, errores={errors}. Base: {db}')

def search(db, query):
    con = init(db)
    try:
        rows = con.execute('''SELECT d.title,d.author,d.publication_year,d.source_path,d.source_url,
          snippet(documents_fts,1,"[","]"," … ",18) FROM documents_fts JOIN documents d ON d.id=documents_fts.rowid
          WHERE documents_fts MATCH ? LIMIT 50''', (query,)).fetchall()
    except sqlite3.OperationalError as e:
        print('Consulta FTS inválida:', e); return
    if not rows: print('Sin resultados para:', query)
    for title, author, year, path, url, snippet in rows:
        print(f'\nTítulo: {title}\nAutor detectado: {author or "[no identificado]"}\nAño detectado: {year or "[no identificado]"}\nRuta local: {path}\nFuente original: {url or "[sin URL de fuente registrada]"}\nFragmento: {snippet}\nAVISO: metadatos propuestos automáticamente; verificar contra la portada/ficha original.')

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--folder', default='PDF_PARA_INDEXAR')
    ap.add_argument('--db', default=DB_NAME)
    ap.add_argument('--ocr', action='store_true', help='Intentar OCR en páginas sin texto; requiere Tesseract, pytesseract y Pillow')
    ap.add_argument('--lang', default='spa', help='Idioma Tesseract, por defecto spa')
    ap.add_argument('--search', help='Buscar en el índice FTS5, por ejemplo "títulos valores"')
    a = ap.parse_args()
    if a.search: search(a.db, a.search)
    else: process(a.folder, a.db, a.ocr, a.lang)
if __name__ == '__main__': main()
