import os
import unittest
from unittest.mock import patch

from app import app


class ApiCorsTests(unittest.TestCase):
  def setUp(self):
    app.config["TESTING"] = True
    self.client = app.test_client()

  def test_allows_configured_frontend_origin(self):
    with patch.dict(
      os.environ,
      {"APP_ALLOWED_ORIGINS": "https://owner.github.io"},
    ):
      response = self.client.get(
        "/api/health",
        headers={"Origin": "https://owner.github.io"},
      )

    self.assertEqual(
      response.headers.get("Access-Control-Allow-Origin"),
      "https://owner.github.io",
    )
    self.assertNotIn("Access-Control-Allow-Credentials", response.headers)

  def test_does_not_allow_unconfigured_origin(self):
    with patch.dict(
      os.environ,
      {"APP_ALLOWED_ORIGINS": "https://owner.github.io"},
    ):
      response = self.client.get(
        "/api/health",
        headers={"Origin": "https://untrusted.example"},
      )

    self.assertNotIn("Access-Control-Allow-Origin", response.headers)

  def test_handles_preflight_for_configured_frontend(self):
    with patch.dict(
      os.environ,
      {"APP_ALLOWED_ORIGINS": "https://owner.github.io"},
    ):
      response = self.client.options(
        "/api/validate-stream",
        headers={
          "Origin": "https://owner.github.io",
          "Access-Control-Request-Method": "POST",
        },
      )

    self.assertEqual(response.status_code, 200)
    self.assertEqual(
      response.headers.get("Access-Control-Allow-Origin"),
      "https://owner.github.io",
    )
    self.assertIn(
      "POST",
      response.headers.get("Access-Control-Allow-Methods", ""),
    )

  def test_api_only_mode_does_not_serve_workspace_files(self):
    with patch.dict(os.environ, {"APP_API_ONLY": "true"}):
      home_response = self.client.get("/")
      file_response = self.client.get("/index.html")
      health_response = self.client.get("/api/health")

    self.assertEqual(home_response.status_code, 404)
    self.assertEqual(file_response.status_code, 404)
    self.assertEqual(health_response.status_code, 200)


if __name__ == "__main__":
  unittest.main()
