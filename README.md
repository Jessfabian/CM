# MassMutual New Business Workbench

A local case-manager workspace for new-business review, requirements,
amendments, verbiage, forms, and illustration validation. It is a development
tool, not an official MassMutual production system; verify decisions against
current approved procedures and forms.

## Run locally

From this folder, install the Python packages and start the local Flask server:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5001`. Set `PORT` before starting the server to use a
different port. PDF OCR additionally requires Tesseract with English language
data and Poppler; see [Illustration Validation setup](./Illustration%20Validation/README.md)
for installation details and the standalone validator workflow.

## Connect a GitHub Pages frontend to the test API

GitHub Pages publishes static files and cannot run the Python validator. A
Render Blueprint and Dockerfile are included to deploy the API as a separate
free service for testing. In Render, create a Blueprint from this repository
and deploy it; the allowed Pages origin is already set to
`https://jessfabian.github.io` (origins do not include a path). After Render
deploys, copy the service URL into `scripts/validator-config.js`:

```js
window.VALIDATOR_API_BASE = "https://YOUR-SERVICE.onrender.com";
```

Publish that config change with the Pages site. The free Render service sleeps
after inactivity and has a cold start; it is for testing, not dependable
production use. This API currently has no user authentication. CORS only limits
which websites can read responses in a browser; it does not prevent direct API
requests. Do not upload real customer or policy documents to this public test
service. Use synthetic test PDFs until an approved, authenticated hosting
solution is in place.

## Project map

| Location | Purpose |
| --- | --- |
| `home.html`, `index.html`, and other root HTML files | Main workspace and review screens |
| `mycases/` | Case queue and case-detail screens |
| `scripts/` | Browser-side workflows and shared application logic |
| `Styling/` | Shared design system and screen stylesheets |
| `data/` | Form, state, requirement, and workflow reference data |
| `Illustration Validation/` | Standalone validator UI and setup guide |
| `app.py`, `pdf_validator.py` | Local API, PDF/OCR extraction, and comparison |
| `images/` | Workspace images and visual assets |
| `tests/` | Focused Python regression tests |

Part 1 extraction currently reviews pages 1, 4, 7, and 13 only. The page mapping
is form-version dependent; confirm it against the approved application before
using the results operationally. Extracted values require human review.

## Keeping the workspace manageable

The `.venv`, Python caches, and macOS metadata are local/generated files and
should not be committed. VS Code hides those items and the large
`Overthetop-output.*` project exports from the everyday Explorer/search view.
The exports are retained because the root and `data/` copies are different
snapshots; they are not runtime inputs. Source screens, scripts, styles, and
data stay in their existing folders so their current references continue to
work.

Run the focused Python regression tests with:

```sh
python -m unittest discover -s tests
```
