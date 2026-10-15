import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch

from pdf_validator import (
  PageText,
  configure_tesseract_data,
  extract_pages,
  ocr_available,
  parse_application,
  selected_checkbox_option,
)


class SelectedCheckboxOptionTests(unittest.TestCase):
  def test_detects_numeric_ocr_marks(self):
    self.assertEqual(
      selected_checkbox_option("[1] Annual", ["Annual"]),
      "Annual",
    )
    self.assertEqual(
      selected_checkbox_option("[7] Annual", ["Annual"]),
      "Annual",
    )
    self.assertEqual(
      selected_checkbox_option("[¥] Annual", ["Annual"]),
      "Annual",
    )

  def test_detects_ocr_mark_variants_for_no(self):
    for marker in ("WI]", "MW]", "WJ"):
      with self.subTest(marker=marker):
        self.assertEqual(
          selected_checkbox_option(f"{marker} No", ["Yes", "No"]),
          "No",
        )

  def test_does_not_treat_an_empty_box_as_selected(self):
    self.assertEqual(
      selected_checkbox_option("[ ] Annual", ["Annual"]),
      "",
    )


class ApplicationExtractionTests(unittest.TestCase):
  def test_term_waiver_and_annual_frequency(self):
    pages = [
      PageText(
        4,
        (
          "Plan: Vantage Term 20\n"
          "18. Waiver of Premium (for Disability) Rider: [_] Yes No\n"
          "18. Waiver of Premium (for Disability) Rider: "
          "Rider: [_] Yes MW] No\n"
        ),
        "ocr",
      ),
      PageText(
        7,
        "2. Frequency (Select one): [¥] Annual [] Single Premium",
        "ocr",
      ),
    ]

    fields = parse_application(pages)

    self.assertEqual(fields["waiver"].value, "No")
    self.assertEqual(fields["frequency"].value, "Annual")

  def test_whole_life_waiver_checkbox_ocr_label_is_parsed(self):
    pages = [
      PageText(
        4,
        (
          "Plan: Whole Life 100\n"
          "18. Waiver of Premium (for Disability) Rider: [X] Yes No"
        ),
        "native",
      ),
    ]

    fields = parse_application(pages)

    self.assertEqual(fields["waiver"].value, "Yes")

  def test_whole_life_rider_choices_and_frequency_use_section_labels(self):
    pages = [
      PageText(
        4,
        (
          "Plan: Whole Life 100\n"
          "C7 Waiver of Premium: [X] Yes [ ] No\n"
          "C10. Guaranteed Insurability Rider: [ ] Yes [X] No"
        ),
        "native",
      ),
      PageText(
        7,
        "G2. Payment Frequency (Select one): [X] Annual [ ] Monthly",
        "native",
      ),
    ]

    fields = parse_application(pages)

    self.assertEqual(fields["waiver"].value, "Yes")
    self.assertEqual(fields["gir"].value, "No")
    self.assertEqual(fields["frequency"].value, "Annual")
    self.assertEqual(fields["waiver"].matched_label, "C7 Waiver of Premium")
    self.assertEqual(fields["gir"].matched_label, "C10")
    self.assertTrue(fields["frequency"].matched_label.startswith("G2"))

  def test_gir_choice_is_read_from_section_c(self):
    pages = [
      PageText(
        4,
        (
          "Plan: Whole Life 100\n"
          "C10. Guaranteed Insurability Rider: [X] Yes [ ] No"
        ),
        "native",
      ),
    ]

    fields = parse_application(pages)

    self.assertEqual(fields["gir"].value, "Yes")

  def test_page_four_waiver_checkbox_is_ocrd_when_native_text_is_readable(self):
    readable_text = (
      "Application for Individual Life " + "insured information " * 15
      + "Waiver of Premium Yes No"
    )
    pdf = MagicMock()
    pdf.__enter__.return_value.pages = [
      MagicMock(extract_text=MagicMock(return_value=readable_text))
      for _ in range(4)
    ]

    with (
      patch("pdf_validator.validate_pdf"),
      patch("pdf_validator.pdfplumber.open", return_value=pdf),
      patch(
        "pdf_validator.ocr_application_waiver_checkbox",
        return_value="[X] Yes No",
      ) as waiver_ocr,
    ):
      pages = extract_pages(
        "application.pdf",
        page_numbers={1, 4},
        application_checkbox_ocr=True,
      )

    self.assertEqual(waiver_ocr.call_count, 1)
    self.assertIn("18. Waiver of Premium", pages[-1].text)
    self.assertIn("[X] Yes No", pages[-1].text)


class TesseractDiscoveryTests(unittest.TestCase):
  def test_finds_debian_tesseract_english_data(self):
    with TemporaryDirectory() as temporary_directory:
      root = Path(temporary_directory)
      executable = root / "bin" / "tesseract"
      data_file = (
        root
        / "share"
        / "tesseract-ocr"
        / "5"
        / "tessdata"
        / "eng.traineddata"
      )
      executable.parent.mkdir(parents=True)
      executable.touch()
      data_file.parent.mkdir(parents=True)
      data_file.touch()

      with (
        patch("pdf_validator.shutil.which", return_value=str(executable)),
        patch.dict(os.environ, {"TESSDATA_PREFIX": ""}),
      ):
        configure_tesseract_data()
        self.assertEqual(
          Path(os.environ["TESSDATA_PREFIX"]).resolve(),
          data_file.parent.resolve(),
        )
        self.assertTrue(ocr_available())


if __name__ == "__main__":
  unittest.main()
