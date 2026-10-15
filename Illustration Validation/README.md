# Illustration Validator

## Install

Install the Python dependencies from the project folder:

```sh
python -m pip install -r requirements.txt
```

OCR also requires Tesseract 5 with English language data and Poppler
(`pdfinfo` and `pdftoppm`). On macOS with Anaconda, install them with:

```sh
conda install -c conda-forge tesseract poppler
```

The validator detects Tesseract's English data when it is installed alongside
the Tesseract executable. If using a custom installation, put its executable on
`PATH`, set `TESSERACT_CMD` to its path, and set `TESSDATA_PREFIX` to the
directory containing `eng.traineddata`.

## Start the website

```powershell
python app.py
```

Open the standalone validator:

```text
http://127.0.0.1:5001/illustration-validation
```

The app uses port `5001` by default to avoid macOS services that may occupy
port `5000`. Set `PORT=5000` before starting it if that port is available.

The validator can be used without completing the full initial-review workflow.
Do not double-click `index.html`; the browser must send the PDFs to the local Flask API.

Part 1 extraction is limited to sections A, C, G, and N, including the
signature block on section N. The validator streams progress and an estimated
time remaining while it reviews the selected pages and illustration.
The page reports when OCR setup is incomplete or key Part 1 values could not
be identified; verify extracted text and review uncertain fields manually.
For Term applications, page 4 receives a focused OCR pass for the waiver
checkbox when full-page OCR does not preserve the mark. Page 7 recognizes
checkbox marks that OCR represents as a digit, such as `[1] Annual`.

## GitHub Pages test deployment

GitHub Pages cannot execute the Python API. For a testing deployment, use the
Render Blueprint at the project root to deploy a separate free backend,
configured with the `https://jessfabian.github.io` Pages origin,
then set `window.VALIDATOR_API_BASE` in `scripts/validator-config.js` to the
Render service URL and publish that change to Pages.

The free backend sleeps when idle and is not suitable for dependable
production use. The API has no authentication, and CORS is not access control.
Only use synthetic test PDFs on this public test service; do not upload real
customer or policy documents.

## Project flow

1. `index.html` provides upload and results containers.
2. `validation.js` sends both PDFs to `POST /api/validate-stream`.
3. `app.py` saves uploads in a temporary folder and invokes `pdf_validator.py`.
4. `pdf_validator.py` performs native extraction, OCR fallback, parsing, normalization, and comparison.
5. The Flask API returns JSON, and `validation.js` renders it.
