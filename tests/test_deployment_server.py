import http.client
import json
import os
import tempfile
import threading
import unittest
from pathlib import Path


TEST_DATA = tempfile.TemporaryDirectory()
os.environ["TTOMS_DATA_DIR"] = TEST_DATA.name

import server


class DeploymentServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.init_database(reset=True)
        cls.httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=5)
        TEST_DATA.cleanup()

    def call(self, method, path, body=None, cookie=None, csrf=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        headers = {}
        if body is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(body)
        if cookie:
            headers["Cookie"] = cookie
        if csrf:
            headers["X-CSRF-Token"] = csrf
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        payload = json.loads(response.read())
        set_cookie = response.getheader("Set-Cookie")
        connection.close()
        return response.status, payload, set_cookie

    def login(self, username, password):
        status, payload, cookie = self.call("POST", "/api/login", {"username": username, "password": password})
        self.assertEqual(status, 200)
        return cookie.split(";", 1)[0], payload["csrf"]

    def test_wrong_password_is_rejected(self):
        status, payload, _ = self.call("POST", "/api/login", {"username": "office", "password": "wrong"})
        self.assertEqual(status, 401)
        self.assertIn("incorrect", payload["error"])

    def test_unauthenticated_records_are_denied(self):
        status, _, _ = self.call("GET", "/api/requests")
        self.assertEqual(status, 401)

    def test_role_and_approval_gate(self):
        office_cookie, office_csrf = self.login("office", "OfficeDemo!2026")
        status, payload, _ = self.call(
            "PATCH", "/api/requests/SR-1048/schedule",
            {"crew": "Crew A", "scheduled_date": "2026-09-20"}, office_cookie, office_csrf,
        )
        self.assertEqual(status, 409)
        self.assertIn("confirmation", payload["error"])

        client_cookie, client_csrf = self.login("client", "ClientDemo!2026")
        status, _, _ = self.call("PATCH", "/api/requests/SR-1048/approval", {"confirm": True}, client_cookie, client_csrf)
        self.assertEqual(status, 200)
        status, _, _ = self.call(
            "PATCH", "/api/requests/SR-1048/schedule",
            {"crew": "Crew A", "scheduled_date": "2026-09-20"}, office_cookie, office_csrf,
        )
        self.assertEqual(status, 200)

        crew_b_cookie, _ = self.login("crew-b", "CrewDemo!2026")
        status, _, _ = self.call("GET", "/api/requests/SR-1048", cookie=crew_b_cookie)
        self.assertEqual(status, 403)

    def test_csrf_is_required_for_authenticated_changes(self):
        office_cookie, _ = self.login("office", "OfficeDemo!2026")
        status, _, _ = self.call(
            "PATCH", "/api/requests/SR-1048/schedule",
            {"crew": "Crew A", "scheduled_date": "2026-09-21"}, office_cookie,
        )
        self.assertEqual(status, 403)


if __name__ == "__main__":
    unittest.main(verbosity=2)
