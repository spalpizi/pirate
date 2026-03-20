#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import secrets
import tempfile
import time
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
PRIVATE_DIR = ROOT_DIR / "private"
PRODUCTS_FILE = DATA_DIR / "products.json"
EVENTS_FILE = DATA_DIR / "events.json"
CREDENTIALS_FILE = PRIVATE_DIR / "admin-credentials.json"

SESSION_COOKIE = "bp_admin_session"
SESSION_TTL_SECONDS = 8 * 60 * 60

CATEGORY_LABELS = {
    "stampe-3d": "Stampe 3D",
    "serigrafie-vestiti": "Serigrafie & Vestiti",
}
ALLOWED_PRODUCT_STATUSES = {"available", "made-to-order", "out-of-stock", "coming-soon"}
SESSIONS: dict[str, dict[str, object]] = {}


def load_json_file(path: Path, default):
    if not path.exists():
      return default
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        return default


def write_json_file(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", delete=False, dir=path.parent, encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        tmp_name = handle.name
    os.replace(tmp_name, path)


def normalize_bool(value, default=False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"1", "true", "yes", "on"}:
            return True
        if lowered in {"0", "false", "no", "off"}:
            return False
    return default


def normalize_string(value, default="") -> str:
    if value is None:
        return default
    return str(value).strip()


def normalize_number(value, default=0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def normalize_int(value, default=0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return int(default)


def slugify(value: str, fallback: str) -> str:
    cleaned = []
    last_dash = False
    for char in normalize_string(value).lower():
        if char.isalnum():
            cleaned.append(char)
            last_dash = False
            continue
        if not last_dash:
            cleaned.append("-")
            last_dash = True
    slug = "".join(cleaned).strip("-")
    return slug or fallback


def public_slug(value: str) -> str:
    return slugify(value, "")


def parse_string_list(value) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [normalize_string(item) for item in value if normalize_string(item)]
    return [normalize_string(value)] if normalize_string(value) else []


def parse_key_value_list(value) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    rows = []
    for item in value:
        if not isinstance(item, dict):
            continue
        label = normalize_string(item.get("label"))
        row_value = normalize_string(item.get("value"))
        if not (label or row_value):
            continue
        rows.append({"label": label, "value": row_value})
    return rows


def parse_variants(value) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    rows = []
    for item in value:
        if not isinstance(item, dict):
            continue
        key = normalize_string(item.get("key"))
        if not key:
            continue
        label = normalize_string(item.get("label"), key.title())
        default = normalize_string(item.get("default"))
        options = parse_string_list(item.get("options"))
        if default and default not in options:
            options.insert(0, default)
        rows.append({
            "key": key,
            "label": label,
            "default": default or (options[0] if options else ""),
            "options": options,
        })
    return rows


def validate_product_payload(payload: dict, items: list[dict], current_id: str | None = None) -> list[str]:
    errors: list[str] = []
    product_id = normalize_string(payload.get("id"))
    slug = public_slug(normalize_string(payload.get("slug")))
    name = normalize_string(payload.get("name"))
    category = normalize_string(payload.get("category"))
    image = normalize_string(payload.get("image"))
    card_description = normalize_string(payload.get("cardDescription"))

    if not product_id:
        errors.append("Identificativo obbligatorio.")
    if not slug:
        errors.append("Slug obbligatorio.")
    if not name:
        errors.append("Nome prodotto obbligatorio.")
    if category not in CATEGORY_LABELS:
        errors.append("Categoria non valida.")
    if normalize_number(payload.get("price"), -1) < 0:
        errors.append("Prezzo non valido.")
    if not card_description:
        errors.append("Descrizione breve obbligatoria.")
    if not image:
        errors.append("Immagine principale obbligatoria.")

    if product_id:
        duplicate_id = next((item for item in items if item.get("id") == product_id and item.get("id") != current_id), None)
        if duplicate_id:
            errors.append("Identificativo gia esistente.")

    if slug:
        duplicate_slug = next((item for item in items if normalize_string(item.get("slug")) == slug and item.get("id") != current_id), None)
        if duplicate_slug:
            errors.append("Slug gia esistente.")

    return errors


def product_public_url(product_id: str) -> str:
    return f"./product.html?id={product_id}"


def normalize_product(payload: dict, existing: dict | None = None) -> dict:
    base = dict(existing or {})
    name = normalize_string(payload.get("name"), normalize_string(base.get("name"), "Nuovo prodotto"))
    raw_id = normalize_string(payload.get("id"), normalize_string(base.get("id")))
    product_id = raw_id or slugify(name, "prodotto")
    category = normalize_string(payload.get("category"), normalize_string(base.get("category"), "stampe-3d"))
    if category not in CATEGORY_LABELS:
        category = "stampe-3d"

    status = normalize_string(payload.get("status"), normalize_string(base.get("status"), "available"))
    if status not in ALLOWED_PRODUCT_STATUSES:
        status = "available"

    published = normalize_bool(payload.get("published"), normalize_bool(base.get("published"), True))
    featured = normalize_bool(payload.get("featured"), normalize_bool(base.get("featured"), False))
    available = normalize_bool(payload.get("available"), normalize_bool(base.get("available"), status not in {"out-of-stock", "coming-soon"}))

    image = normalize_string(payload.get("image"), normalize_string(base.get("image")))
    gallery = parse_string_list(payload.get("gallery"))
    if image and image not in gallery:
        gallery.insert(0, image)

    base.update({
        "id": product_id,
        "name": name,
        "slug": public_slug(normalize_string(payload.get("slug"), normalize_string(base.get("slug"), slugify(name, product_id)))),
        "category": category,
        "categoryLabel": CATEGORY_LABELS[category],
        "price": round(normalize_number(payload.get("price"), base.get("price", 0)), 2),
        "currency": normalize_string(payload.get("currency"), normalize_string(base.get("currency"), "EUR")) or "EUR",
        "url": product_public_url(product_id),
        "image": image,
        "gallery": gallery,
        "thumbClass": normalize_string(payload.get("thumbClass"), normalize_string(base.get("thumbClass"))),
        "thumbTypeClass": normalize_string(payload.get("thumbTypeClass"), normalize_string(base.get("thumbTypeClass"), "thumb--3d")),
        "cardTag": normalize_string(payload.get("cardTag"), normalize_string(base.get("cardTag"), "PROD")),
        "badge": normalize_string(payload.get("badge"), normalize_string(base.get("badge"))),
        "badges": parse_string_list(payload.get("badges")),
        "badgesStandard": parse_string_list(payload.get("badgesStandard")),
        "featured": featured,
        "featuredTag": normalize_string(payload.get("featuredTag"), normalize_string(base.get("featuredTag"))),
        "available": available,
        "published": published,
        "status": status,
        "stockQty": max(0, normalize_int(payload.get("stockQty"), base.get("stockQty", 0))),
        "leadTimeDays": max(0, normalize_int(payload.get("leadTimeDays"), base.get("leadTimeDays", 0))),
        "sortOrder": normalize_int(payload.get("sortOrder"), base.get("sortOrder", 0)),
        "related": parse_string_list(payload.get("related")),
        "cardDescription": normalize_string(payload.get("cardDescription"), normalize_string(base.get("cardDescription"))),
        "description": normalize_string(payload.get("description"), normalize_string(base.get("description"))),
        "lead": normalize_string(payload.get("lead"), normalize_string(base.get("lead"))),
        "details": normalize_string(payload.get("details"), normalize_string(base.get("details"))),
        "seoTitle": normalize_string(payload.get("seoTitle"), normalize_string(base.get("seoTitle"))),
        "seoDescription": normalize_string(payload.get("seoDescription"), normalize_string(base.get("seoDescription"))),
        "variants": parse_variants(payload.get("variants")),
        "specs": parse_key_value_list(payload.get("specs")),
    })
    return base


def normalize_event(payload: dict, existing: dict | None = None) -> dict:
    base = dict(existing or {})
    title = normalize_string(payload.get("title"), normalize_string(base.get("title"), "Nuovo evento"))
    raw_id = normalize_string(payload.get("id"), normalize_string(base.get("id")))
    event_id = raw_id or slugify(title, "evento")

    base.update({
        "id": event_id,
        "title": title,
        "description": normalize_string(payload.get("description"), normalize_string(base.get("description"))),
        "image": normalize_string(payload.get("image"), normalize_string(base.get("image"))),
        "dateLabel": normalize_string(payload.get("dateLabel"), normalize_string(base.get("dateLabel"))),
        "period": normalize_string(payload.get("period"), normalize_string(base.get("period"))),
        "status": normalize_string(payload.get("status"), normalize_string(base.get("status"), "Attivo")),
        "ctaLabel": normalize_string(payload.get("ctaLabel"), normalize_string(base.get("ctaLabel"))),
        "ctaUrl": normalize_string(payload.get("ctaUrl"), normalize_string(base.get("ctaUrl"))),
        "published": normalize_bool(payload.get("published"), normalize_bool(base.get("published"), True)),
        "sortOrder": normalize_int(payload.get("sortOrder"), base.get("sortOrder", 0)),
    })
    return base


def list_products() -> list[dict]:
    items = load_json_file(PRODUCTS_FILE, [])
    if not isinstance(items, list):
        return []
    return sorted(items, key=lambda item: (normalize_int(item.get("sortOrder"), 0), normalize_string(item.get("name")).lower()))


def list_events() -> list[dict]:
    items = load_json_file(EVENTS_FILE, [])
    if not isinstance(items, list):
        return []
    return sorted(items, key=lambda item: (normalize_int(item.get("sortOrder"), 0), normalize_string(item.get("title")).lower()))


def load_credentials() -> list[dict]:
    payload = load_json_file(CREDENTIALS_FILE, {"users": []})
    users = payload.get("users", []) if isinstance(payload, dict) else []
    return [user for user in users if isinstance(user, dict)]


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def parse_request_json(handler: "AdminHandler") -> dict:
    length = int(handler.headers.get("Content-Length", "0") or "0")
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def session_from_request(handler: "AdminHandler") -> dict | None:
    now = time.time()
    expired = [token for token, session in SESSIONS.items() if now - float(session.get("created_at", 0)) > SESSION_TTL_SECONDS]
    for token in expired:
        SESSIONS.pop(token, None)

    raw_cookie = handler.headers.get("Cookie")
    if not raw_cookie:
        return None
    cookie = SimpleCookie()
    cookie.load(raw_cookie)
    morsel = cookie.get(SESSION_COOKIE)
    if not morsel:
        return None
    token = morsel.value
    return SESSIONS.get(token)


class AdminHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, payload, status=HTTPStatus.OK, headers: dict[str, str] | None = None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if headers:
            for key, value in headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def require_session(self) -> dict | None:
        session = session_from_request(self)
        if session:
            return session
        self.send_json({"error": "unauthorized"}, status=HTTPStatus.UNAUTHORIZED)
        return None

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/admin/"):
            self.handle_api_get(parsed.path)
            return
        if parsed.path.startswith("/private/") or parsed.path.endswith("/admin-credentials.json"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if parsed.path == "/admin":
            self.send_response(HTTPStatus.FOUND)
            self.send_header("Location", "/admin/login.html")
            self.end_headers()
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/admin/"):
            self.handle_api_post(parsed.path)
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def handle_api_get(self, path: str):
        if path == "/api/admin/session":
            session = session_from_request(self)
            self.send_json({
                "authenticated": bool(session),
                "user": {"username": session["username"], "role": session["role"]} if session else None,
            })
            return

        if path == "/api/admin/products":
            if not self.require_session():
                return
            self.send_json({"items": list_products()})
            return

        if path == "/api/admin/events":
            if not self.require_session():
                return
            self.send_json({"items": list_events()})
            return

        self.send_json({"error": "not_found"}, status=HTTPStatus.NOT_FOUND)

    def handle_api_post(self, path: str):
        if path == "/api/admin/login":
            payload = parse_request_json(self)
            username = normalize_string(payload.get("username"))
            password = normalize_string(payload.get("password"))
            password_hash = hash_password(password)

            matched = next(
                (
                    user for user in load_credentials()
                    if normalize_bool(user.get("enabled"), True)
                    and normalize_string(user.get("username")) == username
                    and normalize_string(user.get("passwordHash")) == password_hash
                ),
                None,
            )
            if not matched:
                self.send_json({"error": "invalid_credentials"}, status=HTTPStatus.UNAUTHORIZED)
                return

            token = secrets.token_urlsafe(32)
            SESSIONS[token] = {
                "username": username,
                "role": normalize_string(matched.get("role"), "admin"),
                "created_at": time.time(),
            }
            headers = {
                "Set-Cookie": f"{SESSION_COOKIE}={token}; HttpOnly; Path=/; SameSite=Lax; Max-Age={SESSION_TTL_SECONDS}"
            }
            self.send_json({"ok": True, "user": {"username": username, "role": SESSIONS[token]["role"]}}, headers=headers)
            return

        if path == "/api/admin/logout":
            session = session_from_request(self)
            if session:
                token_to_remove = None
                for token, current in SESSIONS.items():
                    if current is session:
                        token_to_remove = token
                        break
                if token_to_remove:
                    SESSIONS.pop(token_to_remove, None)
            headers = {
                "Set-Cookie": f"{SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"
            }
            self.send_json({"ok": True}, headers=headers)
            return

        if path == "/api/admin/products/upsert":
            if not self.require_session():
                return
            payload = parse_request_json(self)
            incoming = payload.get("product")
            if not isinstance(incoming, dict):
                self.send_json({"error": "invalid_product"}, status=HTTPStatus.BAD_REQUEST)
                return

            items = list_products()
            existing_index = next((index for index, item in enumerate(items) if item.get("id") == incoming.get("id")), None)
            existing = items[existing_index] if existing_index is not None else None
            validation_errors = validate_product_payload(incoming, items, existing.get("id") if existing else None)
            if validation_errors:
                self.send_json({"error": "validation_failed", "errors": validation_errors}, status=HTTPStatus.BAD_REQUEST)
                return
            normalized = normalize_product(incoming, existing)

            replace_index = next((index for index, item in enumerate(items) if item.get("id") == normalized["id"]), None)
            if replace_index is not None:
                items[replace_index] = normalized
            elif existing_index is not None:
                items[existing_index] = normalized
            else:
                items.append(normalized)

            write_json_file(PRODUCTS_FILE, items)
            self.send_json({"ok": True, "item": normalized})
            return

        if path == "/api/admin/events/upsert":
            if not self.require_session():
                return
            payload = parse_request_json(self)
            incoming = payload.get("event")
            if not isinstance(incoming, dict):
                self.send_json({"error": "invalid_event"}, status=HTTPStatus.BAD_REQUEST)
                return

            items = list_events()
            existing_index = next((index for index, item in enumerate(items) if item.get("id") == incoming.get("id")), None)
            existing = items[existing_index] if existing_index is not None else None
            normalized = normalize_event(incoming, existing)

            replace_index = next((index for index, item in enumerate(items) if item.get("id") == normalized["id"]), None)
            if replace_index is not None:
                items[replace_index] = normalized
            elif existing_index is not None:
                items[existing_index] = normalized
            else:
                items.append(normalized)

            write_json_file(EVENTS_FILE, items)
            self.send_json({"ok": True, "item": normalized})
            return

        self.send_json({"error": "not_found"}, status=HTTPStatus.NOT_FOUND)


def main():
    port = int(os.environ.get("BP_ADMIN_PORT", "8000"))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", port), AdminHandler)
    except OSError as exc:
        if exc.errno == 98:
            print(f"Porta {port} gia in uso. Ferma la vecchia istanza oppure avvia con BP_ADMIN_PORT su un'altra porta.")
            return
        raise
    print(f"Server avviato su http://127.0.0.1:{port}")
    print("Dashboard admin: /admin/login.html")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
