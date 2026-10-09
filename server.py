"""TTOMS deployment-phase demonstration server.

Uses only the Python standard library so the submitted component can be run with
Python 3.10+ without installing packages. It provides central SQLite persistence,
password authentication, server-side sessions, CSRF protection, role checks, and
workflow rules for client approval and office scheduling.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
from contextlib import closing
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("TTOMS_DATA_DIR", ROOT / "data")).resolve()
DB_PATH = DATA_DIR / "ttoms.sqlite3"
SESSION_COOKIE = "ttoms_session"
MAX_BODY = 1_000_000
ROLES = {"office", "arborist", "sales", "crew", "client"}
STAFF_ROLES = {"office", "arborist", "sales", "crew"}


def utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    db.execute("PRAGMA journal_mode = WAL")
    return db


def password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 240_000)
    return f"pbkdf2_sha256$240000${salt.hex()}${digest.hex()}"


def password_ok(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt_hex, expected = stored.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations)
        ).hex()
        return hmac.compare_digest(digest, expected)
    except (TypeError, ValueError):
        return False


def terms_fingerprint(row: sqlite3.Row) -> str:
    canonical = json.dumps(
        {
            "scope": row["agreed_scope"] or "",
            "method": row["work_method"] or "",
            "impact": row["impact_expectations"] or "",
            "price": row["negotiated_price"],
            "terms_version": row["terms_version"],
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


def init_database(reset: bool = False) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if reset and DB_PATH.exists():
        DB_PATH.unlink()
    with closing(connect()) as db, db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('office','arborist','sales','crew','client')),
                crew TEXT,
                email TEXT
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                csrf_token TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS requests (
                id TEXT PRIMARY KEY,
                customer_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT NOT NULL,
                address TEXT NOT NULL,
                service TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending Review',
                crew TEXT NOT NULL DEFAULT 'Unassigned',
                scheduled_date TEXT NOT NULL DEFAULT '',
                priority TEXT NOT NULL DEFAULT 'Not assessed',
                assessment TEXT NOT NULL DEFAULT '',
                work_scope TEXT NOT NULL DEFAULT '',
                precautions TEXT NOT NULL DEFAULT '',
                work_method TEXT NOT NULL DEFAULT '',
                impact_expectations TEXT NOT NULL DEFAULT '',
                agreed_scope TEXT NOT NULL DEFAULT '',
                negotiated_price REAL,
                terms_version INTEGER NOT NULL DEFAULT 0,
                approved_terms_hash TEXT,
                approved_at TEXT,
                approved_by TEXT,
                crew_notes TEXT NOT NULL DEFAULT '',
                discrepancies TEXT NOT NULL DEFAULT '',
                version INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
                at TEXT NOT NULL,
                actor TEXT NOT NULL,
                action TEXT NOT NULL
            );
            """
        )
        if not db.execute("SELECT 1 FROM users LIMIT 1").fetchone():
            users = [
                ("office", "Office Demo", "office", None, "office@ttoms.test", "OfficeDemo!2026"),
                ("arborist", "Avery Arborist", "arborist", None, "arborist@ttoms.test", "ArboristDemo!2026"),
                ("sales", "Sam Sales", "sales", None, "sales@ttoms.test", "SalesDemo!2026"),
                ("crew-a", "Crew A Lead", "crew", "Crew A", "crew-a@ttoms.test", "CrewDemo!2026"),
                ("crew-b", "Crew B Lead", "crew", "Crew B", "crew-b@ttoms.test", "CrewDemo!2026"),
                ("client", "Morgan Reed", "client", None, "morgan@example.com", "ClientDemo!2026"),
            ]
            db.executemany(
                "INSERT INTO users(username,display_name,role,crew,email,password_hash) VALUES (?,?,?,?,?,?)",
                [(u, n, r, c, e, password_hash(p)) for u, n, r, c, e, p in users],
            )
        if not db.execute("SELECT 1 FROM requests LIMIT 1").fetchone():
            now = utcnow()
            db.execute(
                """INSERT INTO requests(
                    id,customer_name,phone,email,address,service,description,status,
                    priority,assessment,work_scope,precautions,work_method,
                    impact_expectations,agreed_scope,negotiated_price,terms_version,
                    created_at,updated_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    "SR-1048", "Morgan Reed", "555-0148", "morgan@example.com",
                    "48 Willow Bend", "Tree Removal",
                    "Remove declining oak beside the driveway.", "Pending Review",
                    "Priority", "Declining oak with deadwood beside driveway.",
                    "Remove T1 and leave stump above grade.",
                    "Protect driveway and maintain pedestrian exclusion zone.",
                    "Manual crew with chipper; no crane planned.",
                    "Use driveway for access and avoid lawn traffic where practical.",
                    "Remove T1; stump grinding excluded.", 1400.00, 1, now, now,
                ),
            )
            db.execute(
                "INSERT INTO activity(request_id,at,actor,action) VALUES (?,?,?,?)",
                ("SR-1048", now, "System", "Deployment demonstration record created"),
            )


def public_request(row: sqlite3.Row) -> dict:
    data = dict(row)
    data["approved"] = bool(
        row["approved_terms_hash"]
        and hmac.compare_digest(row["approved_terms_hash"], terms_fingerprint(row))
    )
    data.pop("approved_terms_hash", None)
    return data


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


class Handler(BaseHTTPRequestHandler):
    server_version = "TTOMS/0.4"

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write(f"[{self.log_date_time_string()}] {fmt % args}\n")

    def send_json(self, status: int, payload: dict | list, headers: dict | None = None) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "same-origin")
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BODY:
            raise ApiError(HTTPStatus.BAD_REQUEST, "A valid JSON request body is required.")
        try:
            data = json.loads(self.rfile.read(length))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ApiError(HTTPStatus.BAD_REQUEST, "The request body is not valid JSON.")
        if not isinstance(data, dict):
            raise ApiError(HTTPStatus.BAD_REQUEST, "The JSON body must be an object.")
        return data

    def session(self, required: bool = True) -> tuple[sqlite3.Row, str] | None:
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        raw = cookie.get(SESSION_COOKIE)
        if not raw:
            if required:
                raise ApiError(HTTPStatus.UNAUTHORIZED, "Sign in to continue.")
            return None
        token_hash = hashlib.sha256(raw.value.encode()).hexdigest()
        with closing(connect()) as db, db:
            row = db.execute(
                """SELECT u.*,s.csrf_token,s.expires_at FROM sessions s
                   JOIN users u ON u.id=s.user_id WHERE s.token_hash=?""",
                (token_hash,),
            ).fetchone()
            if not row or datetime.fromisoformat(row["expires_at"]) <= datetime.now(timezone.utc):
                db.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash,))
                if required:
                    raise ApiError(HTTPStatus.UNAUTHORIZED, "Your session expired. Sign in again.")
                return None
            return row, token_hash

    def require_role(self, *roles: str) -> sqlite3.Row:
        session = self.session()
        assert session
        user, _ = session
        if user["role"] not in roles:
            raise ApiError(HTTPStatus.FORBIDDEN, "Your role is not permitted to perform this action.")
        if self.command not in {"GET", "HEAD"}:
            supplied = self.headers.get("X-CSRF-Token", "")
            if not supplied or not hmac.compare_digest(supplied, user["csrf_token"]):
                raise ApiError(HTTPStatus.FORBIDDEN, "The request verification token is missing or invalid.")
        return user

    def visible_request(self, db: sqlite3.Connection, request_id: str, user: sqlite3.Row) -> sqlite3.Row:
        row = db.execute("SELECT * FROM requests WHERE id=?", (request_id,)).fetchone()
        if not row:
            raise ApiError(HTTPStatus.NOT_FOUND, "The service request was not found.")
        if user["role"] == "client" and row["email"].casefold() != (user["email"] or "").casefold():
            raise ApiError(HTTPStatus.FORBIDDEN, "Clients may view only their own requests.")
        if user["role"] == "crew" and row["crew"] != user["crew"]:
            raise ApiError(HTTPStatus.FORBIDDEN, "Crew members may view only work assigned to their crew.")
        return row

    def activity(self, db: sqlite3.Connection, request_id: str, user: sqlite3.Row, action: str) -> None:
        db.execute(
            "INSERT INTO activity(request_id,at,actor,action) VALUES (?,?,?,?)",
            (request_id, utcnow(), user["display_name"], action),
        )

    def route(self) -> None:
        path = unquote(urlparse(self.path).path)
        if not path.startswith("/api/"):
            return self.static(path)
        if self.command == "POST" and path == "/api/login":
            return self.login()
        if self.command == "GET" and path == "/api/session":
            return self.get_session()
        if self.command == "POST" and path == "/api/logout":
            return self.logout()
        if path == "/api/requests" and self.command == "GET":
            return self.list_requests()
        if path == "/api/requests" and self.command == "POST":
            return self.create_request()
        if path == "/api/reports" and self.command == "GET":
            return self.reports()
        match = re.fullmatch(r"/api/requests/(SR-\d+)(?:/(scope|sales|approval|schedule|crew))?", path)
        if match:
            request_id, action = match.groups()
            if self.command == "GET" and not action:
                return self.get_request(request_id)
            if self.command in {"POST", "PATCH"} and action:
                return getattr(self, f"update_{action}")(request_id)
        raise ApiError(HTTPStatus.NOT_FOUND, "The API endpoint was not found.")

    def do_GET(self) -> None:
        self.dispatch()

    def do_POST(self) -> None:
        self.dispatch()

    def do_PATCH(self) -> None:
        self.dispatch()

    def dispatch(self) -> None:
        try:
            self.route()
        except ApiError as error:
            self.send_json(error.status, {"error": str(error)})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as error:
            self.log_error("Unhandled error: %r", error)
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "The server could not complete the request."})

    def login(self) -> None:
        data = self.read_json()
        username = str(data.get("username", "")).strip().lower()
        password = str(data.get("password", ""))
        with closing(connect()) as db, db:
            user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
            if not user or not password_ok(password, user["password_hash"]):
                raise ApiError(HTTPStatus.UNAUTHORIZED, "The username or password is incorrect.")
            token = secrets.token_urlsafe(32)
            csrf = secrets.token_urlsafe(24)
            expires = datetime.now(timezone.utc) + timedelta(hours=8)
            db.execute("DELETE FROM sessions WHERE expires_at <= ?", (utcnow(),))
            db.execute(
                "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,?)",
                (hashlib.sha256(token.encode()).hexdigest(), user["id"], csrf, expires.isoformat()),
            )
        cookie = f"{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Strict"
        self.send_json(HTTPStatus.OK, {"user": self.user_json(user), "csrf": csrf}, {"Set-Cookie": cookie})

    def get_session(self) -> None:
        session = self.session(required=False)
        if not session:
            return self.send_json(HTTPStatus.OK, {"user": None})
        user, _ = session
        self.send_json(HTTPStatus.OK, {"user": self.user_json(user), "csrf": user["csrf_token"]})

    def logout(self) -> None:
        session = self.session()
        assert session
        user, token_hash = session
        if not hmac.compare_digest(self.headers.get("X-CSRF-Token", ""), user["csrf_token"]):
            raise ApiError(HTTPStatus.FORBIDDEN, "The request verification token is missing or invalid.")
        with closing(connect()) as db, db:
            db.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash,))
        self.send_json(HTTPStatus.OK, {"ok": True}, {"Set-Cookie": f"{SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict"})

    @staticmethod
    def user_json(user: sqlite3.Row) -> dict:
        return {key: user[key] for key in ("username", "display_name", "role", "crew", "email")}

    def list_requests(self) -> None:
        user = self.require_role(*ROLES)
        sql, params = "SELECT * FROM requests", []
        if user["role"] == "client":
            sql, params = sql + " WHERE lower(email)=lower(?)", [user["email"]]
        elif user["role"] == "crew":
            sql, params = sql + " WHERE crew=?", [user["crew"]]
        sql += " ORDER BY CAST(substr(id,4) AS INTEGER) DESC"
        with closing(connect()) as db, db:
            rows = db.execute(sql, params).fetchall()
        self.send_json(HTTPStatus.OK, [public_request(row) for row in rows])

    def get_request(self, request_id: str) -> None:
        user = self.require_role(*ROLES)
        with closing(connect()) as db, db:
            row = self.visible_request(db, request_id, user)
            history = [dict(item) for item in db.execute(
                "SELECT at,actor,action FROM activity WHERE request_id=? ORDER BY id DESC LIMIT 20",
                (request_id,),
            )]
        payload = public_request(row)
        payload["activity"] = history
        self.send_json(HTTPStatus.OK, payload)

    def create_request(self) -> None:
        data = self.read_json()
        required = ("customer_name", "phone", "email", "address", "service", "description")
        values = {key: str(data.get(key, "")).strip() for key in required}
        if any(not values[key] for key in required):
            raise ApiError(HTTPStatus.BAD_REQUEST, "Complete every required customer request field.")
        if "@" not in values["email"] or len(values["email"]) > 254:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Enter a valid email address.")
        if any(len(value) > 4000 for value in values.values()):
            raise ApiError(HTTPStatus.BAD_REQUEST, "One or more fields exceed the allowed length.")
        now = utcnow()
        with closing(connect()) as db, db:
            highest = db.execute("SELECT max(CAST(substr(id,4) AS INTEGER)) FROM requests").fetchone()[0] or 1047
            request_id = f"SR-{highest + 1}"
            db.execute(
                """INSERT INTO requests(id,customer_name,phone,email,address,service,description,created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (request_id, *(values[k] for k in required), now, now),
            )
            db.execute(
                "INSERT INTO activity(request_id,at,actor,action) VALUES (?,?,?,?)",
                (request_id, now, values["customer_name"], "Customer request submitted"),
            )
        self.send_json(HTTPStatus.CREATED, {"id": request_id})

    def update_scope(self, request_id: str) -> None:
        user = self.require_role("arborist")
        data = self.read_json()
        fields = ("priority", "assessment", "work_scope", "precautions")
        values = [str(data.get(key, "")).strip() for key in fields]
        if not values[1] or not values[2]:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Assessment and work scope are required.")
        with closing(connect()) as db, db:
            row = self.visible_request(db, request_id, user)
            db.execute(
                """UPDATE requests SET priority=?,assessment=?,work_scope=?,precautions=?,
                   approved_terms_hash=NULL,approved_at=NULL,approved_by=NULL,version=version+1,updated_at=? WHERE id=?""",
                (*values, utcnow(), request_id),
            )
            self.activity(db, request_id, user, "Arborist assessment and scope updated; prior approval cleared")
        self.send_json(HTTPStatus.OK, {"ok": True, "previous_version": row["version"]})

    def update_sales(self, request_id: str) -> None:
        user = self.require_role("sales")
        data = self.read_json()
        fields = ("work_method", "impact_expectations", "agreed_scope")
        values = [str(data.get(key, "")).strip() for key in fields]
        try:
            price = round(float(data.get("negotiated_price")), 2)
        except (TypeError, ValueError):
            raise ApiError(HTTPStatus.BAD_REQUEST, "Negotiated price must be a number.")
        if any(not value for value in values) or price < 0:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Work method, impact expectations, agreed scope, and a nonnegative price are required.")
        with closing(connect()) as db, db:
            self.visible_request(db, request_id, user)
            db.execute(
                """UPDATE requests SET work_method=?,impact_expectations=?,agreed_scope=?,negotiated_price=?,
                   terms_version=terms_version+1,approved_terms_hash=NULL,approved_at=NULL,approved_by=NULL,
                   version=version+1,updated_at=? WHERE id=?""",
                (*values, price, utcnow(), request_id),
            )
            self.activity(db, request_id, user, "Sales terms updated; client confirmation required")
        self.send_json(HTTPStatus.OK, {"ok": True})

    def update_approval(self, request_id: str) -> None:
        user = self.require_role("client")
        data = self.read_json()
        if data.get("confirm") is not True:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Explicit confirmation is required.")
        with closing(connect()) as db, db:
            row = self.visible_request(db, request_id, user)
            if not row["agreed_scope"] or not row["work_method"] or row["negotiated_price"] is None:
                raise ApiError(HTTPStatus.CONFLICT, "Sales must complete the terms before client confirmation.")
            fingerprint = terms_fingerprint(row)
            now = utcnow()
            db.execute(
                """UPDATE requests SET approved_terms_hash=?,approved_at=?,approved_by=?,
                   version=version+1,updated_at=? WHERE id=?""",
                (fingerprint, now, user["display_name"], now, request_id),
            )
            self.activity(db, request_id, user, f"Client confirmed sales terms version {row['terms_version']}")
        self.send_json(HTTPStatus.OK, {"ok": True})

    def update_schedule(self, request_id: str) -> None:
        user = self.require_role("office")
        data = self.read_json()
        crew = str(data.get("crew", "")).strip()
        scheduled_date = str(data.get("scheduled_date", "")).strip()
        if crew not in {"Crew A", "Crew B", "Crew C"} or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", scheduled_date):
            raise ApiError(HTTPStatus.BAD_REQUEST, "Choose a valid crew and scheduled date.")
        with closing(connect()) as db, db:
            row = self.visible_request(db, request_id, user)
            if not row["approved_terms_hash"] or not hmac.compare_digest(row["approved_terms_hash"], terms_fingerprint(row)):
                raise ApiError(HTTPStatus.CONFLICT, "Current client confirmation is required before scheduling.")
            db.execute(
                """UPDATE requests SET crew=?,scheduled_date=?,status='Scheduled',version=version+1,updated_at=? WHERE id=?""",
                (crew, scheduled_date, utcnow(), request_id),
            )
            self.activity(db, request_id, user, f"Scheduled for {crew} on {scheduled_date}")
        self.send_json(HTTPStatus.OK, {"ok": True})

    def update_crew(self, request_id: str) -> None:
        user = self.require_role("crew")
        data = self.read_json()
        status = str(data.get("status", "")).strip()
        notes = str(data.get("crew_notes", "")).strip()
        discrepancies = str(data.get("discrepancies", "")).strip()
        if status not in {"In Progress", "Delayed", "Completed"} or not notes:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Choose a field status and enter work performed notes.")
        with closing(connect()) as db, db:
            row = self.visible_request(db, request_id, user)
            if not row["scheduled_date"] or row["status"] not in {"Scheduled", "In Progress", "Delayed"}:
                raise ApiError(HTTPStatus.CONFLICT, "Only an active scheduled assignment can receive a crew update.")
            db.execute(
                """UPDATE requests SET status=?,crew_notes=?,discrepancies=?,version=version+1,updated_at=? WHERE id=?""",
                (status, notes, discrepancies, utcnow(), request_id),
            )
            self.activity(db, request_id, user, f"Crew marked work order {status}")
        self.send_json(HTTPStatus.OK, {"ok": True})

    def reports(self) -> None:
        self.require_role("office", "sales", "arborist")
        with closing(connect()) as db, db:
            rows = db.execute("SELECT status,count(*) AS count FROM requests GROUP BY status ORDER BY status").fetchall()
            total = db.execute("SELECT count(*) FROM requests").fetchone()[0]
            approved = db.execute("SELECT count(*) FROM requests WHERE approved_terms_hash IS NOT NULL").fetchone()[0]
        self.send_json(HTTPStatus.OK, {"total": total, "approved_records": approved, "by_status": [dict(row) for row in rows]})

    def static(self, path: str) -> None:
        if path == "/":
            path = "/deployment.html"
        candidate = (ROOT / path.lstrip("/")).resolve()
        if ROOT not in candidate.parents or not candidate.is_file() or any(part.startswith(".") for part in candidate.relative_to(ROOT).parts):
            raise ApiError(HTTPStatus.NOT_FOUND, "The requested file was not found.")
        body = candidate.read_bytes()
        content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self'; img-src 'self' data:; script-src 'self'; base-uri 'none'; form-action 'self'")
        self.end_headers()
        self.wfile.write(body)


def run(host: str = "127.0.0.1", port: int = 8000) -> None:
    init_database(reset="--reset" in sys.argv)
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"TTOMS deployment server: http://{host}:{port}/deployment.html")
    print(f"Database: {DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nTTOMS server stopped.")


if __name__ == "__main__":
    run(port=int(os.environ.get("TTOMS_PORT", "8000")))
