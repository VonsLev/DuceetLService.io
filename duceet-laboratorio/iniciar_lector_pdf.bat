@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo DUCEET - LECTOR E INDICE INCREMENTAL DE PDF
echo.
if not exist "PDF_PARA_INDEXAR" mkdir "PDF_PARA_INDEXAR"
python -m pip install -r requirements_lector.txt
if errorlevel 1 (
  echo No se pudieron instalar las dependencias. Comprueba Python e Internet.
  pause
  exit /b 1
)
echo.
echo Coloca los PDF que quieras indexar en la carpeta PDF_PARA_INDEXAR.
echo Para activar OCR, instala Tesseract OCR para Windows y ejecuta:
echo python ingest_pdf.py --folder PDF_PARA_INDEXAR --ocr --lang spa
 echo.
python ingest_pdf.py --folder PDF_PARA_INDEXAR
 echo.
echo Para buscar despues: python ingest_pdf.py --search "precedente vinculante"
pause
