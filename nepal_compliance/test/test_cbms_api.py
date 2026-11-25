import unittest
from unittest.mock import patch, MagicMock
from types import SimpleNamespace

from nepal_compliance.cbms_api import (
    CBMSIntegration,
    post_sales_invoice_or_return_to_cbms,
    post_sales_invoice_status,
)

# Pure logic tests
class TestCBMSUtils(unittest.TestCase):

    def test_convert_to_nepali_fy_format_ad(self):
        cbms = CBMSIntegration(None)
        result = cbms.convert_to_nepali_fy_format("2023-2024")
        self.assertEqual(result, "2080/81")

    def test_convert_to_nepali_fy_format_bs(self):
        cbms = CBMSIntegration(None)
        result = cbms.convert_to_nepali_fy_format("2080/81")
        self.assertEqual(result, "2080/81")

    def test_get_buyer_pan_valid(self):
        doc = SimpleNamespace(vat_number="123456789")
        cbms = CBMSIntegration(doc)
        self.assertEqual(cbms.get_buyer_pan(), "123456789")

    def test_get_buyer_pan_invalid(self):
        doc = SimpleNamespace(vat_number="ABC123")
        cbms = CBMSIntegration(doc)
        self.assertIsNone(cbms.get_buyer_pan())


# Configuration tests
class TestCBMSConfiguration(unittest.TestCase):

    def _cbms(self, rows, company="HLS"):
        cbms = CBMSIntegration(SimpleNamespace(company=company))
        settings = MagicMock()
        settings.get.return_value = rows
        patcher = patch("nepal_compliance.cbms_api.frappe.get_cached_doc", return_value=settings)
        patcher.start()
        self.addCleanup(patcher.stop)
        return cbms

    def _row(self, company="HLS", enabled=1, user="user"):
        return SimpleNamespace(
            name="row1", company=company, enabled=enabled, user_name=user,
            panvat_no="123456789", sales_api_url="http://test", credit_note_api_url="http://test",
        )

    def test_company_without_row(self):
        cbms = self._cbms([self._row("Other")])
        self.assertEqual(cbms.is_cbms_configured()["status"], "not_found")

    def test_cbms_disabled(self):
        cbms = self._cbms([self._row(enabled=0)])
        self.assertEqual(cbms.is_cbms_configured()["status"], "disabled")

    @patch("nepal_compliance.cbms_api.get_decrypted_password", return_value="pass")
    def test_cbms_configured_routes_by_company(self, _pw):
        cbms = self._cbms([self._row("Other", user="other"), self._row("HLS", user="hls")])
        self.assertEqual(cbms.is_cbms_configured()["status"], "configured")
        self.assertEqual(cbms.cbms_settings.user_name, "hls")

    @patch("nepal_compliance.cbms_api.get_decrypted_password", return_value=None)
    def test_cbms_incomplete(self, _pw):
        cbms = self._cbms([self._row()])
        self.assertEqual(cbms.is_cbms_configured()["status"], "configuration_error")


# Send to CBMS tests (Mocked HTTP)
class TestCBMSSend(unittest.TestCase):

    def setUp(self):
        self.test_doc = MagicMock()
        self.test_doc.is_return = False
        self.test_doc.name = "INV-001"
        self.test_doc.reload = MagicMock()
        self.test_doc.save = MagicMock()

        self.cbms = CBMSIntegration(self.test_doc)

        # Mock configuration
        self.cbms.is_cbms_configured = MagicMock(
            return_value={"status": "configured"}
        )

        self.cbms.prepare_payload = MagicMock(
            return_value={"test": "data"}
        )

        self.cbms.cbms_settings = MagicMock(
            sales_api_url="http://test.api",
            credit_note_api_url="http://test.credit.api"
        )

    @patch("nepal_compliance.cbms_api.frappe.db.commit")
    @patch("nepal_compliance.cbms_api.requests.post")
    def test_send_success_200(self, mock_post, mock_commit):

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "200"
        mock_post.return_value = mock_response

        result = self.cbms.send_to_cbms(self.test_doc)

        self.assertEqual(result["status"], "success")
        self.assertEqual(self.test_doc.cbms_status, "Success")
        mock_commit.assert_called_once()

    @patch("nepal_compliance.cbms_api.frappe.db.commit")
    @patch("nepal_compliance.cbms_api.requests.post")
    def test_send_invalid_response_format(self, mock_post, mock_commit):

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "INVALID"
        mock_post.return_value = mock_response

        result = self.cbms.send_to_cbms(self.test_doc)

        self.assertEqual(result["status"], "failed")
        self.assertEqual(self.test_doc.cbms_status, "Failed")
        mock_commit.assert_called_once()

    @patch("nepal_compliance.cbms_api.frappe.db.commit")
    @patch("nepal_compliance.cbms_api.requests.post")
    def test_send_http_error(self, mock_post, mock_commit):

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Server Error"
        mock_post.return_value = mock_response

        result = self.cbms.send_to_cbms(self.test_doc)

        self.assertEqual(result["status"], "failed")
        self.assertEqual(self.test_doc.cbms_status, "Failed")
        mock_commit.assert_called_once()

# Whitelist method tests
class TestCBMSWhitelist(unittest.TestCase):

    @patch("nepal_compliance.cbms_api.enqueue")
    @patch("nepal_compliance.cbms_api.frappe.get_doc")
    def test_post_sales_invoice_queued(self, mock_get_doc, mock_enqueue):

        test_doc = MagicMock()
        mock_get_doc.return_value = test_doc

        with patch.object(
            CBMSIntegration,
            "is_cbms_configured",
            return_value={"status": "configured"}
        ):
            result = post_sales_invoice_or_return_to_cbms("INV-001")

        mock_enqueue.assert_called_once()
        self.assertEqual(result["status"], "queued")

    @patch("nepal_compliance.cbms_api.frappe.db.exists")
    def test_post_sales_invoice_status_not_found(self, mock_exists):

        mock_exists.return_value = False
        result = post_sales_invoice_status("INVALID")

        self.assertEqual(result["status"], "error")
