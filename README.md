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
