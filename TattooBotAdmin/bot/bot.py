import os, logging, requests, random, time, re
import io
from io import BytesIO
from datetime import datetime, timedelta, time as dtime, date
from dateutil import tz
from telegram import (
    InlineKeyboardMarkup, InlineKeyboardButton, ParseMode, InputFile
)
from telegram.ext import (
    Updater, CommandHandler, CallbackQueryHandler, ConversationHandler,
    MessageHandler, Filters, CallbackContext
)
from captcha.image import ImageCaptcha

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("tattoo-bot")


# === availability helpers (module-scope) ===
def api_get_json(path, params=None):
    url = f"{API_BASE}{path}"
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    return r.json()

def get_master_month_avail(master_id: str, ym: str):
    try:
        data = api_get_json(f"/api/masters/{master_id}/availability", {"ym": ym})
        return data.get("days", {}) if isinstance(data, dict) else {}
    except Exception as e:
        log.debug("availability fetch failed: %s", e)
        return {}

def get_available_slots(master_id: str, service_id: str, d: str):
    try:
        data = api_get_json("/api/availability", {"masterId": master_id, "serviceId": service_id, "date": d})
        return data.get("slots", []) if isinstance(data, dict) else []
    except Exception as e:
        log.debug("slots fetch failed: %s", e)
        return []
# ===== API discovery =====
API_BASE = os.getenv("API_BASE", "https://tatto.shadownet.live")
log.info(f"Using API_BASE: {API_BASE}")
API_CANDIDATES = [
    API_BASE,
    "http://localhost:6050",
    "http://app:6050",
]
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TZ = tz.gettz(os.getenv("TZ", "Europe/Moscow"))

# ===== Auth =====
import base64
AUTH = ("admin", "1XmgOOuLkGO8@")  # Из Login.tsx
auth_header = base64.b64encode(f"{AUTH[0]}:{AUTH[1]}".encode()).decode()


# ===== helpers =====

def send_photo_safe(target, url_or_path, caption, kb):
    try:
        target.reply_photo(url_or_path, caption=caption, parse_mode=ParseMode.MARKDOWN, reply_markup=kb)
        return
    except Exception as e:
        try:
            import requests, io
            r = requests.get(url_or_path, timeout=10)
            if r.ok and r.content:
                target.reply_photo(InputFile(io.BytesIO(r.content), filename='image.jpg'), caption=caption, parse_mode=ParseMode.MARKDOWN, reply_markup=kb)
                return
        except Exception as e2:
            log.warning(f"send_photo_safe: fallback failed: {e2}")
    target.reply_text(caption, parse_mode=ParseMode.MARKDOWN, reply_markup=kb)


# ===== messages cache =====
_MESSAGES_CACHE = {"ts": 0, "data": {}}
_CERTS_CACHE = {"ts": 0, "data": []}
TERMS_DEFAULT = (
    "Продолжая, вы подтверждаете, что ознакомились и согласны с\n"
    "[Условия использования](https://telegra.ph/Terms-of-Use-11-29-2) и "
    "[Политика конфиденциальности](https://telegra.ph/Privacy-Policy-11-29-122)."
)


def edit_or_send_new(q, text, *, parse_mode=None, reply_markup=None):
    """Safely replace the current callback message regardless of its media type."""
    try:
        q.edit_message_text(
            text,
            parse_mode=parse_mode,
            reply_markup=reply_markup,
        )
        return
    except Exception as e:
        msg = str(e).lower()
        if "no text" not in msg and "message is not modified" not in msg:
            raise

    try:
        q.message.delete()
    except Exception:
        pass

    q.message.bot.send_message(
        chat_id=q.message.chat_id,
        text=text,
        parse_mode=parse_mode,
        reply_markup=reply_markup,
    )

def safe_get_messages():
    try:
        now = time.time()
        if now - _MESSAGES_CACHE["ts"] < 60 and _MESSAGES_CACHE["data"]:
            return _MESSAGES_CACHE["data"]
        data = api_get("/api/messages") or {}
        items = data.get("messages", []) if isinstance(data, dict) else []
        out = {}
        for m in items:
            key = m.get("key")
            if not key: 
                continue
            out[key] = {
                "text": m.get("value") or "",
                "imageUrl": build_full_url(m.get("imageUrl") or m.get("image_url") or ""),
                "type": m.get("type") or "text",
            }
        _MESSAGES_CACHE["data"] = out
        _MESSAGES_CACHE["ts"] = now
        return out
    except Exception as e:
        log.warning("messages fetch failed: %s", e)
        return {}

def bot_text(key: str, default: str = "") -> str:
    msgs = safe_get_messages()
    val = (msgs.get(key) or {}).get("text") if msgs else None
    return val or default

def bot_image(key: str) -> str:
    msgs = safe_get_messages()
    val = (msgs.get(key) or {}).get("imageUrl") if msgs else None
    return val or ""


def apply_placeholders(text: str, replacements: dict[str, str]) -> str:
    if not replacements:
        return text
    result = text
    for key, value in replacements.items():
        result = result.replace(f"{{{key}}}", value or "")
    return result


def render_bot_text(key: str, default: str, replacements: dict[str, str] | None = None) -> str:
    raw = bot_text(key, default)
    if not raw:
        return ""
    return apply_placeholders(raw, replacements or {})


def format_payment_methods(raw: str | None) -> str:
    if not raw:
        return (
            "• Наличные в студии\n"
            "• СБП (по номеру телефона)\n"
            "• Банковские карты\n"
            "• Криптовалюта (по запросу)"
        )
    tokens = [token.strip() for token in re.split(r"[,\n;]+", str(raw)) if token.strip()]
    if not tokens:
        return (
            "• Наличные в студии\n"
            "• СБП (по номеру телефона)\n"
            "• Банковские карты\n"
            "• Криптовалюта (по запросу)"
        )
    return "\n".join(f"• {token}" for token in tokens)

RU_DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


def build_full_url(relative_url):
    if not relative_url:
        return ""
    rel = str(relative_url).strip()
    if not rel:
        return ""
    if rel.startswith("http://") or rel.startswith("https://"):
        return rel
    base = API_BASE.rstrip("/")
    if rel.startswith("/"):
        return f"{base}{rel}"
    return f"{base}/{rel}"


def api_get(path, params=None):
    last_err = None
    for base in API_CANDIDATES:
        if not base: continue
        try:
            full_url = f"{base}{path}"
            log.debug(f"Attempting API get: {full_url}")
            r = requests.get(full_url, params=params or {}, timeout=10, headers={"Authorization": f"Basic {auth_header}"})
            r.raise_for_status()
            log.debug(f"API response status: {r.status_code}, content-type: {r.headers.get('Content-Type')}")
            return r.json()
        except Exception as e:
            log.debug(f"API get failed for {full_url}: {e}")
            last_err = e
    log.error(f"All API attempts failed: {last_err}")
    raise last_err

def api_post(path, payload):
    last_err = None
    for base in API_CANDIDATES:
        if not base: continue
        try:
            full_url = f"{base}{path}"
            log.debug(f"Attempting API post: {full_url}")
            r = requests.post(full_url, json=payload, timeout=15, headers={"Authorization": f"Basic {auth_header}"})
            r.raise_for_status()
            return r.json() if r.content else {}
        except Exception as e:
            try:
                txt = r.text
                log.warning("api_post %s failed: %s :: %s", full_url, e, txt)
            except: pass
            last_err = e
    log.error(f"All API post attempts failed: {last_err}")
    raise last_err

def safe_get_settings():
    try:
        data = api_get("/api/settings")
        return data.get("settings", {}) if isinstance(data, dict) else {}
    except Exception as e:
        log.warning("settings fetch failed: %s", e)
        return {}


def safe_get_certificates():
    try:
        now = time.time()
        if now - _CERTS_CACHE["ts"] < 60 and _CERTS_CACHE["data"]:
            return _CERTS_CACHE["data"]
        data = api_get("/api/certs") or {}
        items = data.get("certs", []) if isinstance(data, dict) else []
        parsed = []
        for item in items:
            url = item.get("url")
            if not url:
                continue
            parsed.append(
                {
                    "url": build_full_url(url),
                    "type": (item.get("type") or "image").lower(),
                    "caption": item.get("caption") or item.get("description") or None,
                    "description": item.get("description") or item.get("caption") or None,
                }
            )
        _CERTS_CACHE["data"] = parsed
        _CERTS_CACHE["ts"] = now
        return parsed
    except Exception as e:
        log.warning("certificates fetch failed: %s", e)
        return []


def register_client_profile(user):
    if not user:
        return
    try:
        api_post(
            "/api/bot/clients",
            {
                "telegramId": user.id,
                "username": user.username,
                "firstName": getattr(user, "first_name", None),
                "lastName": getattr(user, "last_name", None),
            },
        )
    except Exception as e:
        log.debug("register client profile failed: %s", e)


def generate_captcha_code():
    # исключаем похожие символы
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choice(alphabet) for _ in range(5))


def send_captcha_image(target, uid):
    code = generate_captcha_code()
    captcha_codes[uid] = code
    img = ImageCaptcha(width=260, height=120)
    buffer = BytesIO()
    img.write(code, buffer)
    buffer.seek(0)

    caption = bot_text(
        "captcha_prompt",
        "Вводя код с картинки, вы подтверждаете, что согласны с условиями использования и политикой конфиденциальности, указанными выше.",
    )

    if getattr(target, "message", None):
        target.message.reply_photo(
            photo=InputFile(buffer, filename="captcha.png"),
            caption=caption,
        )
    else:
        target.callback_query.message.reply_photo(
            photo=InputFile(buffer, filename="captcha.png"),
            caption=caption,
        )
    return S_CAPTCHA


def start_captcha_for_user(target, uid):
    return send_captcha_image(target, uid)


def send_terms_and_captcha(target, uid):
    terms_text = bot_text("terms", TERMS_DEFAULT)
    if getattr(target, "message", None):
        target.message.reply_text(
            terms_text,
            parse_mode=ParseMode.MARKDOWN,
            disable_web_page_preview=True,
        )
    else:
        target.callback_query.message.reply_text(
            terms_text,
            parse_mode=ParseMode.MARKDOWN,
            disable_web_page_preview=True,
        )
    return start_captcha_for_user(target, uid)

def safe_get_services():
    try:
        data = api_get("/api/services")
        items = data.get("services", []) if isinstance(data, dict) else []
        out = []
        for s in items:
            out.append({
                "id": s.get("id"),
                "name": s.get("name") or s.get("title") or "Услуга",
                "duration": int(s.get("duration", 60)),
                "price": int(s.get("price", 0)),
            })
        return out
    except Exception as e:
        log.warning("services fetch failed: %s", e)
        return []

def safe_get_portfolio():
    try:
        data = api_get("/api/portfolio")
        items = data.get("portfolio", []) if isinstance(data, dict) else []
        out = []
        for p in items:
            out.append({
                "id": p.get("id"),
                "url": p.get("url"),
                "title": p.get("title") or "",
                "description": p.get("description") or "",
                "mediaType": p.get("mediaType") or "image",
                "masterId": p.get("masterId"),
                "style": p.get("style") or "",
                "thumbnail": p.get("thumbnail"),
                "attachments": p.get("attachments") or [],
            })
        return out
    except Exception as e:
        log.warning("portfolio fetch failed: %s", e)
        return []

def safe_get_masters(include_inactive: bool = False):
    try:
        path = "/api/masters" if not include_inactive else "/api/masters?includeInactive=true"
        data = api_get(path)
        items = data.get("masters", []) if isinstance(data, dict) else []
        out = []
        for m in items:
            out.append({
                "id": m.get("id"),
                "name": m.get("name") or m.get("title") or "Мастер",
                "nickname": m.get("nickname") or "",
                "telegram": m.get("telegram") or "",
                "specialization": m.get("specialization") or "",
                "avatar": m.get("avatar") or "",
                "teletypeUrl": build_full_url(m.get("teletypeUrl")) or "",
                "isActive": bool(m.get("isActive", m.get("active", True))),
        })
        return out
    except Exception as e:
        log.warning("masters fetch failed: %s", e)
        return []

def safe_get_bookings():
    try:
        data = api_get("/api/bookings")
        return data.get("bookings", []) if isinstance(data, dict) else []
    except Exception as e:
        log.warning("bookings fetch failed: %s", e)
        return []

def safe_create_booking(payload):
    try:
        return api_post("/api/bookings", payload)
    except Exception as e:
        log.warning("booking create failed: %s", e)
        return None

def money(v: int) -> str:
    try:
        return f"{int(v):,}".replace(",", " ") + " ₽"
    except:
        return str(v)

def has_future_booking_for_user(user_id: int) -> bool:
    now = datetime.now(tz=TZ)
    for b in safe_get_bookings():
        uid = b.get("userId") or b.get("telegramId")
        status = (b.get("status") or "").lower()
        if uid == user_id and status not in ("canceled", "cancelled", "done", "completed"):
            dt = b.get("dateTime") or b.get("start") or b.get("date")
            try:
                t = datetime.fromisoformat(dt.replace("Z","+00:00") if "Z" in str(dt) else dt)
                if t.tzinfo is None: t = t.replace(tzinfo=TZ)
                if t >= now:
                    return True
            except: pass
    return False

# ===== ui =====
def kb_main():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🗓 Записаться", callback_data="book")],
        [InlineKeyboardButton("🧭 Как добраться", callback_data="route"),
         InlineKeyboardButton("👥 О мастерах", callback_data="about")],
        [InlineKeyboardButton("🎉 Акции", callback_data="certs")],
        [InlineKeyboardButton("💳 Оплата", callback_data="pay")],
    ])

def kb_back_home():
    return InlineKeyboardMarkup([[InlineKeyboardButton("↩️ Назад", callback_data="home")]])

def kb_master_card(master_id, teletype_url):
    teletype_url = build_full_url(teletype_url) if teletype_url else ""
    btn_detail = InlineKeyboardButton("Подробнее", url=teletype_url) if teletype_url else InlineKeyboardButton("Подробнее", callback_data=f"detail:{master_id}")
    return InlineKeyboardMarkup([
        [
            btn_detail,
            InlineKeyboardButton("Портфолио", callback_data=f"portfolio:{master_id}")
        ],
        [InlineKeyboardButton("↩️ Назад", callback_data="home")]
    ])


# ===== home helpers =====
def show_home(update_or_query, kb=None):
    """Совместимость со старым кодом, отдаёт приветственный экран."""
    kb = kb or kb_main()
    s = safe_get_settings()
    welcome_text = bot_text(
        "welcome",
        s.get("welcomeText")
        or (
            "👋 Привет! Я бот тату-студии.\n"
            "• Запись в пару кликов\n• Напомню о визите\n• Покажу маршрут до студии\n"
            "• Расскажу о мастерах, портфолио и акциях\n\nРаботаю 24/7."
        ),
    )
    welcome_img = bot_image("welcome")
    try:
        if getattr(update_or_query, "message", None):
            if welcome_img:
                send_photo_safe(update_or_query.message, welcome_img, welcome_text, kb)
            else:
                update_or_query.message.reply_text(
                    welcome_text,
                    parse_mode=ParseMode.MARKDOWN,
                    reply_markup=kb,
                )
        else:
            q = update_or_query.callback_query
            if welcome_img:
                try:
                    q.message.delete()
                except Exception:
                    pass
                send_photo_safe(q.message, welcome_img, welcome_text, kb)
            else:
                q.edit_message_text(
                    welcome_text,
                    parse_mode=ParseMode.MARKDOWN,
                    reply_markup=kb,
                )
    except Exception as e:
        log.warning("show_home failed: %s", e)


def notify_register_chat(booking_id: str, chat_id: int) -> None:
    try:
        api_post(
            "/api/notifications/register-chat",
            {"bookingId": booking_id, "chatId": chat_id},
        )
    except Exception as e:
        log.debug("notify_register_chat failed: %s", e)


# ===== conversation states =====
(
    S_CAPTCHA,     # капча при первом входе
    S_SVC,         # выбор услуги
    S_MASTER,      # выбор мастера
    S_DATE,        # выбор даты
    S_TIME,        # выбор времени
    S_NAME,        # ввод имени
    S_PHONE,       # ввод телефона
) = range(7)

verified = set()
captcha = {}
participants = {}
captcha_codes = {}

# ===== /start + captcha =====
def cmd_start(update, ctx: CallbackContext):
    register_client_profile(update.effective_user)
    uid = update.effective_user.id
    if uid in verified:
        send_home_text(update, ctx)
        return ConversationHandler.END

    return send_terms_and_captcha(update, uid)

def on_start_button(update, ctx: CallbackContext):
    q = update.callback_query; q.answer()
    register_client_profile(q.from_user)
    uid = q.from_user.id
    if uid in verified:
        send_home_text(update, ctx)
        return ConversationHandler.END
    return send_terms_and_captcha(update, uid)

def on_captcha(update, ctx: CallbackContext):
    uid = update.effective_user.id
    register_client_profile(update.effective_user)
    ans = update.message.text.strip()
    expected = captcha_codes.get(uid)
    if not expected:
        return send_terms_and_captcha(update, uid)

    if ans and ans.strip().upper() == expected.upper():
        verified.add(uid)
        captcha_codes.pop(uid, None)
        send_home_text(update, ctx)
        return ConversationHandler.END

    update.message.reply_text(bot_text("captcha_wrong", "Попробуйте пожалуйста снова ввести капчу"))
    return S_CAPTCHA


def cmd_captcha(update, ctx: CallbackContext):
    register_client_profile(update.effective_user)
    return send_terms_and_captcha(update, update.effective_user.id)


def send_home_text(update_or_query, ctx: CallbackContext):
    s = safe_get_settings()
    # Prefer admin-managed message with key "welcome"
    welcome_text = bot_text("welcome", s.get("welcomeText") or (
        "👋 Привет! Я бот тату-студии.\n"
        "• Запись в пару кликов\n• Напомню о визите\n• Покажу маршрут до студии\n"
        "• Расскажу о мастерах, портфолио и акциях\n\nРаботаю 24/7."
    ))
    welcome_img = bot_image("welcome")
    kb = kb_main()
    if getattr(update_or_query, "message", None):
        if welcome_img:
            try:
                send_photo_safe(update_or_query.message, welcome_img, welcome_text, kb)
            except Exception as e:
                log.warning("send_photo failed, fallback to text: %s", e)
                update_or_query.message.reply_text(welcome_text, parse_mode=ParseMode.MARKDOWN, reply_markup=kb)
        else:
            update_or_query.message.reply_text(welcome_text, parse_mode=ParseMode.MARKDOWN, reply_markup=kb)
    else:
        q = update_or_query.callback_query
        if welcome_img:
            try:
                # edit message media if possible, else send new
                send_photo_safe(q.message, welcome_img, welcome_text, kb)
                q.delete_message()
            except Exception as e:
                log.warning("edit to photo failed: %s", e)
                q.edit_message_text(welcome_text, parse_mode=ParseMode.MARKDOWN, reply_markup=kb)
        else:
            q.edit_message_text(welcome_text, parse_mode=ParseMode.MARKDOWN, reply_markup=kb)

# ===== entry for booking is INSIDE ConversationHandler =====
def entry_book(update, ctx: CallbackContext):
    q = update.callback_query
    q.answer()

    # запрет на множественные записи
    uid = q.from_user.id
    register_client_profile(q.from_user)
    if uid not in verified:
        return send_terms_and_captcha(update, uid)

    if has_future_booking_for_user(uid):
        edit_or_send_new(
            q,
            bot_text(
                "active_booking_exists",
                "У тебя уже есть активная запись. Если нужно изменить время — напиши администратору или дождись завершения визита.",
            ),
            reply_markup=kb_back_home(),
        )
        return ConversationHandler.END

    services = safe_get_services()
    if not services:
        edit_or_send_new(
            q,
            bot_text("no_services", "Нет доступных услуг. Попробуй позже."),
            reply_markup=kb_back_home(),
        )
        return ConversationHandler.END

    ctx.user_data.clear()
    ctx.user_data["services"] = {str(s["id"]): s for s in services}
    kb = [[InlineKeyboardButton(f"{s['name']} • {money(s['price'])}", callback_data=f"svc:{s['id']}")] for s in services[:30]]
    kb.append([InlineKeyboardButton("↩️ Назад", callback_data="home")])
    edit_or_send_new(
        q,
        bot_text("choose_service", "Выбери услугу:"),
        reply_markup=InlineKeyboardMarkup(kb),
    )
    return S_SVC

def pick_service(update, ctx: CallbackContext):
    q = update.callback_query; q.answer()
    _, sid = q.data.split(":",1)
    ctx.user_data["svc_id"]=sid
    svc = ctx.user_data["services"].get(sid,{})
    dur = int(svc.get("duration",60))

    masters = [m for m in safe_get_masters() if m.get("isActive", True)]
    if not masters:
        edit_or_send_new(q, bot_text("no_active_masters", "Пока нет активных мастеров."), reply_markup=kb_back_home())
        return ConversationHandler.END

    ctx.user_data["masters"] = {str(m["id"]): m for m in masters if m.get("id")}
    rows = []
    for m in masters[:25]:
        label = m.get("name") or "Мастер"
        if m.get("specialization"):
            label += f" • {m['specialization']}"
        rows.append([InlineKeyboardButton(label, callback_data=f"m:{m['id']}")])
    rows.append([InlineKeyboardButton("↩️ Назад", callback_data="book")])

    intro = render_bot_text(
        "choose_master",
        f"Услуга: {svc.get('name','Услуга')}\nДлительность: {dur} мин\nЦена: {money(svc.get('price', 0))}\n\nВыберите мастера:",
        {
            "service": svc.get("name", ""),
            "duration": str(dur),
            "price": money(svc.get("price", 0)),
        },
    )

    edit_or_send_new(q, intro, parse_mode=ParseMode.MARKDOWN, reply_markup=InlineKeyboardMarkup(rows))
    return S_MASTER

def pick_date(update, ctx: CallbackContext):
    q = update.callback_query; q.answer()
    _, ds = q.data.split(":",1)
    ctx.user_data["date"]=ds
    svc_id = ctx.user_data.get("svc_id")
    slots_cache = ctx.user_data.setdefault("slots_cache", {})
    master_id = ctx.user_data.get("master_id")
    slots = slots_cache.get(ds) or get_available_slots(master_id, svc_id, ds)
    slots_cache[ds] = slots

    if not slots:
        edit_or_send_new(
            q,
            bot_text("no_slots_for_day", "Свободных слотов нет. Выберите другую дату."),
            reply_markup=kb_back_home(),
        )
        return S_DATE

    rows,row=[],[]
    for i,s in enumerate(slots,1):
        row.append(InlineKeyboardButton(s, callback_data=f"t:{s}"))
        if i%4==0: rows.append(row); row=[]
    if row: rows.append(row)
    rows.append([InlineKeyboardButton("↩️ Назад", callback_data=f"m:{ctx.user_data.get('master_id')}")])

    edit_or_send_new(
        q,
        bot_text("choose_time", "Выбери время:"),
        reply_markup=InlineKeyboardMarkup(rows),
    )
    return S_TIME

def pick_time(update, ctx: CallbackContext):
    q = update.callback_query; q.answer()
    _, ts = q.data.split(":",1)
    ctx.user_data["time"]=ts
    edit_or_send_new(
        q,
        bot_text(
            "ask_name",
            "Как к тебе обращаться? Напиши имя (можно просто как тебя обычно называют).",
        ),
        reply_markup=InlineKeyboardMarkup(
            [[InlineKeyboardButton("↩️ Назад", callback_data=f"d:{ctx.user_data['date']}")]]
        ),
    )
    return S_NAME

def pick_master(update, ctx: CallbackContext):
    q = update.callback_query; q.answer()
    _, mid = q.data.split(":",1)
    ctx.user_data["master_id"]=mid
    svc_id = ctx.user_data.get("svc_id")
    svc = ctx.user_data.get("services", {}).get(svc_id, {})
    slots_cache = ctx.user_data.setdefault("slots_cache", {})

    available_days = []
    today = date.today()
    for i in range(30):
        d = today + timedelta(days=i)
        d_iso = d.isoformat()
        slots = get_available_slots(mid, svc_id, d_iso)
        if slots:
            slots_cache[d_iso] = slots
            available_days.append(d)

    if not available_days:
        edit_or_send_new(q, bot_text("no_slots_any", "Свободных слотов нет в ближайшее время."), reply_markup=kb_back_home())
        return ConversationHandler.END

    rows, row = [], []
    for i, d in enumerate(available_days, 1):
        dow = RU_DOW[d.weekday()]
        row.append(InlineKeyboardButton(d.strftime(f"%d.%m ({dow})"), callback_data=f"d:{d.isoformat()}"))
        if i % 3 == 0:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([InlineKeyboardButton("↩️ Назад", callback_data=f"svc:{svc_id}")])

    edit_or_send_new(
        q,
        render_bot_text(
            "choose_date",
            f"Услуга: {svc.get('name','Услуга')}\nДлительность: {svc.get('duration',60)} мин\nЦена: {money(svc.get('price',0))}\n\nВыберите дату:",
            {
                "service": svc.get("name", ""),
                "duration": str(svc.get("duration", 60)),
                "price": money(svc.get("price", 0)),
            },
        ),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup(rows),
    )
    return S_DATE

def ask_phone(update, ctx: CallbackContext):
    name = update.message.text.strip()
    if not name or len(name)<2:
        update.message.reply_text(bot_text("invalid_name", "Имя слишком короткое. Пришли нормальное имя 🙂"))
        return S_NAME
    ctx.user_data["customer_name"]=name
    update.message.reply_text(
        bot_text("ask_phone", "Огонь! А теперь номер телефона для связи (в любом формате, можно +7... или 8...)."),
    )
    return S_PHONE

PHONE_RX = re.compile(r"^\+?\d[\d \-\(\)]{8,}$")

def finalize_booking(update, ctx: CallbackContext):
    phone = update.message.text.strip()
    if not PHONE_RX.match(phone):
        update.message.reply_text(bot_text("invalid_phone", "Не похоже на номер телефона. Пришли в формате +7... или 8..."))
        return S_PHONE

    # Проверка данных
    if not all(k in ctx.user_data for k in ["customer_name", "svc_id", "date", "time", "master_id"]):
        update.message.reply_text(
            bot_text("booking_failed", "Не удалось создать запись. Попробуйте ещё раз или выберите другое время."),
            reply_markup=kb_back_home(),
        )
        return ConversationHandler.END

    # Финальный payload
    ds = ctx.user_data["date"]
    ts = ctx.user_data["time"]
    dt_iso = f"{ds}T{ts}:00"

    svc = ctx.user_data["services"].get(ctx.user_data["svc_id"], {})
    payload = {
        "clientName": ctx.user_data.get("customer_name"),
        "clientPhone": phone,
        "serviceId": ctx.user_data["svc_id"],
        "masterId": ctx.user_data.get("master_id"),
        "date": ds,  # Явная передача даты
        "time": ts,  # Явная передача времени
        "dateTime": dt_iso,
        "clientTelegram": update.effective_user.username,
        "clientUsername": update.effective_user.username,
        "telegramId": update.effective_user.id,
    }

    created = safe_create_booking(payload)
    if not created:
        update.message.reply_text(
            bot_text("booking_slot_taken", "Не удалось подтвердить запись (возможно, слот успели занять). Попробуй другое время."),
            reply_markup=kb_back_home()
        )
        return ConversationHandler.END

    booking = created.get("booking") if isinstance(created, dict) else created
    if not isinstance(booking, dict):
        booking = {}

    status = (booking.get("status") or created.get("status") or "").lower()

    s = safe_get_settings()
    address = s.get("address", "Адрес уточним в чате")
    when = datetime.fromisoformat(dt_iso).astimezone(TZ).strftime("%d.%m.%Y • %H:%M")
    master = (ctx.user_data.get("masters", {}) or {}).get(ctx.user_data.get("master_id"), {})
    master_name = master.get("name") or master.get("title") or "Любой"

    contact = master.get("telegram", "") or ""
    if contact and not contact.startswith("@"):
        contact = "@" + contact.lstrip("@")

    replacements = {
        "service": svc.get("name", "Услуга"),
        "master": master_name,
        "date": when.split(" • ")[0] if " • " in when else when,
        "time": when.split(" • ")[1] if " • " in when else ctx.user_data.get("time", ""),
        "address": address,
        "master_contact": contact,
    }

    if status == "confirmed":
        txt = render_bot_text(
            "booking_confirmed",
            "✅ Запись подтверждена!\n\nУслуга: {service}\nМастер: {master}\nДата и время: {date} • {time}\nАдрес: {address}",
            replacements,
        )
    else:
        txt = render_bot_text(
            "booking_pending",
            "🕓 Заявка отправлена. Как только мастер подтвердит время, я пришлю сообщение и напоминание заранее.",
            replacements,
        )
    update.message.reply_text(txt, parse_mode=ParseMode.MARKDOWN, reply_markup=kb_back_home())

    try:
        bid = booking.get("id") or created.get("id")
        if bid:
            notify_register_chat(str(bid), update.effective_chat.id)
    except Exception as e:
        log.debug("register chat failed: %s", e)

    return ConversationHandler.END

# ===== safe media helpers =====
def safe_send_photo(bot, chat_id, photo_url, caption=None, reply_markup=None, parse_mode=None):
    try:
        r = requests.get(photo_url, timeout=10, headers={"Authorization": f"Basic {auth_header}"})
        r.raise_for_status()
        log.debug(f"Sending photo: size={len(r.content)}, type={r.headers.get('Content-Type')}")
        bot.send_photo(
            chat_id=chat_id,
            photo=InputFile(io.BytesIO(r.content), filename="photo.png"),
            caption=caption,
            reply_markup=reply_markup,
            parse_mode=parse_mode
        )
    except Exception as e:
        log.warning(f"safe_send_photo failed: {e} for URL {photo_url}")
        try:
            bot.send_message(
                chat_id=chat_id,
                text="⚠️ Не удалось отправить изображение.",
                reply_markup=reply_markup
            )
        except Exception as _:
            log.debug("failed to notify user about photo send failure")

def safe_send_video(bot, chat_id, video_url, caption=None, reply_markup=None, parse_mode=None):
    try:
        r = requests.get(video_url, timeout=15, headers={"Authorization": f"Basic {auth_header}"})
        r.raise_for_status()
        log.debug(f"Sending video: size={len(r.content)}, type={r.headers.get('Content-Type')}")
        bot.send_video(
            chat_id=chat_id,
            video=InputFile(io.BytesIO(r.content), filename="video.mp4"),
            caption=caption,
            reply_markup=reply_markup,
            parse_mode=parse_mode,
            supports_streaming=True
        )
    except Exception as e:
        log.warning(f"safe_send_video failed: {e} for URL {video_url}")
        try:
            bot.send_message(
                chat_id=chat_id,
                text="⚠️ Не удалось отправить видео.",
                reply_markup=reply_markup
            )
        except Exception as _:
            log.debug("failed to notify user about video send failure")

def safe_send_media_group(bot, chat_id, media_list):
    from telegram import InputMediaPhoto as _IMP, InputMediaVideo as _IMV

    # режем на небольшие пачки, чтобы запросы были стабильнее
    batches = [media_list[i:i+4] for i in range(0, len(media_list or []), 4)]

    for batch in batches:
        group = []

        for idx, m in enumerate(batch):
            url = m.get("url")
            if not url:
                continue

            caption = (m.get("caption") or "").strip()
            # подпись только у первого элемента группы
            caption = caption if idx == 0 else None

            t = (m.get("type") or m.get("mediaType") or "image").lower()

            if t == "video":
                group.append(_IMV(media=url, caption=caption))
            else:
                group.append(_IMP(media=url, caption=caption))

        if not group:
            continue

        try:
            bot.send_media_group(chat_id=chat_id, media=group)
        except Exception as e:
            log.warning(f"media group send failed: {e}")
            # фолбэк – шлём по одному, как и везде
            for idx, m in enumerate(batch):
                url = m.get("url")
                if not url:
                    continue

                full_caption = (m.get("caption") or "").strip()
                # чтобы текст не дублировался под каждой картинкой
                caption = full_caption if idx == 0 else None

                t = (m.get("type") or m.get("mediaType") or "image").lower()
                try:
                    if t == "video":
                        safe_send_video(bot, chat_id, url, caption=caption)
                    else:
                        safe_send_photo(bot, chat_id, url, caption=caption)
                except Exception as ie:
                    log.warning(f"fallback single media failed: {ie}")

# ===== generic buttons out of conversation =====
def btn(update, ctx: CallbackContext):
    q = update.callback_query
    q.answer()
    data = q.data

    if data == "home":
        send_home_text(update, ctx)
        return

    if data == "route":
        s = safe_get_settings()
        studio = s.get("studioName") or "Тату-студия"
        address = s.get("address", "Адрес не указан")

        lat = s.get("lat") or s.get("latitude")
        lon = s.get("lng") or s.get("lon") or s.get("longitude")

        try:
            if isinstance(lat, str):
                lat = lat.strip()
            if isinstance(lon, str):
                lon = lon.strip()
        except Exception as e:
            log.debug("lat/lon strip failed: %s", e)

        links = []
        yandex_direct = s.get("yandexMapUrl")
        if yandex_direct:
            links.append(f"[Открыть в Яндекс.Картах]({yandex_direct})")

        if lat and lon:
            yan_link = f"https://yandex.ru/maps/?pt={lon},{lat}&z=16&l=map"
            goo_link = f"https://maps.google.com/?q={lat},{lon}"
            if not yandex_direct:
                links.append(f"[Открыть в Яндекс.Картах]({yan_link})")
            links.append(f"[Открыть в Google Maps]({goo_link})")

            static_candidates = [
                f"https://static-maps.yandex.ru/1.x/?ll={lon},{lat}&z=16&l=map&size=650,300&pt={lon},{lat},pm2blm&lang=ru_RU",
                f"https://staticmap.openstreetmap.de/staticmap.php?center={lat},{lon}&zoom=16&size=650x300&markers={lat},{lon}",
            ]
            for url in static_candidates:
                try:
                    safe_send_photo(q.message.bot, q.message.chat_id, url)
                    break
                except Exception as e:
                    log.debug("static map try failed: %s", e)

            try:
                q.message.bot.send_location(
                    chat_id=q.message.chat_id,
                    latitude=float(lat),
                    longitude=float(lon),
                )
            except Exception as e:
                log.debug("send_location failed: %s", e)

        route_text = render_bot_text(
            "route",
            "📍 *{studio}*\n{address}\n\n{links}\n\nНапиши, если нужна помощь с маршрутом.",
            {
                "studio": studio,
                "address": address,
                "links": "\n".join(links),
            },
        )
        kb = kb_back_home()
        cover = bot_image("route")
        if cover:
            safe_send_photo(
                q.message.bot,
                q.message.chat_id,
                build_full_url(cover),
                caption=route_text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=kb,
            )
        else:
            q.message.bot.send_message(
                chat_id=q.message.chat_id,
                text=route_text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=kb,
            )
        return

    if data == "about":
        s = safe_get_settings()
        masters = safe_get_masters(include_inactive=True)
        if not masters:
            edit_or_send_new(q, "Пока нет мастеров.", reply_markup=kb_back_home())
            return

        from telegram.utils.helpers import escape_markdown
        for m in masters[:10]:
            caption = f"*{escape_markdown(m['name'], version=2)}*\n"
            if m.get("nickname"):
                caption += f"@{escape_markdown(m['nickname'], version=2)}\n"
            if m.get("specialization"):
                caption += f"Стили: {escape_markdown(m['specialization'], version=2)}\n"
            if not m.get("isActive", True):
                caption += "_(временно недоступен для записи)_\n"

            caption = caption.replace("(", "\\(").replace(")", "\\)")

            kb = kb_master_card(m["id"], m.get("teletypeUrl"))
            avatar = m.get("avatar")
            full_avatar = build_full_url(avatar) if avatar else None
            if full_avatar:
                try:
                    log.debug(f"Sending avatar for {m['name']}: {full_avatar}")
                    r = requests.head(full_avatar, timeout=5, headers={"Authorization": f"Basic {auth_header}"})
                    log.debug(f"Avatar HEAD response: status={r.status_code}, content-type={r.headers.get('Content-Type')}")
                    # use safe_send_photo with bot and chat_id
                    safe_send_photo(q.message.bot, q.message.chat_id, full_avatar, caption=caption, parse_mode=ParseMode.MARKDOWN_V2, reply_markup=kb)
                except Exception as e:
                    log.warning("photo send failed: %s for URL %s", e, full_avatar)
                    q.message.bot.send_message(
                        chat_id=q.message.chat_id,
                        text=caption,
                        parse_mode=ParseMode.MARKDOWN_V2,
                        reply_markup=kb
                    )
            else:
                log.warning(f"Invalid or empty avatar URL for {m['name']}: {avatar}")
                q.message.bot.send_message(
                    chat_id=q.message.chat_id,
                    text=caption,
                    parse_mode=ParseMode.MARKDOWN_V2,
                    reply_markup=kb
                )
        return

    if data.startswith("portfolio:"):
        master_id = data.split(":", 1)[1]
        masters = {m["id"]: m for m in safe_get_masters(include_inactive=True)}
        master = masters.get(master_id, {})
        portfolio = safe_get_portfolio()
        master_works = [p for p in portfolio if p.get("masterId") == master_id]
        styles = list(set(p["style"] for p in master_works if p["style"]))
        if not styles:
            q.message.bot.send_message(
                chat_id=q.message.chat_id,
                text="У мастера нет указанных стилей.",
                reply_markup=kb_back_home()
            )
            return

        kb = [[InlineKeyboardButton(style.strip(), callback_data=f"style:{master_id}:{style.strip()}")] for style in styles]
        kb.append([InlineKeyboardButton("↩️ Назад", callback_data="about")])
        # Instead of edit, delete the original and send new
        try:
            q.message.delete()
        except Exception as e:
            log.debug(f"Failed to delete message for portfolio: {e}")
        q.message.bot.send_message(
            chat_id=q.message.chat_id,
            text=f"Выбери стиль для портфолио {master.get('name','')}:",
            reply_markup=InlineKeyboardMarkup(kb)
        )
        return

    if data.startswith("style:"):
        _, master_id, selected_style = q.data.split(":", 2)
        portfolio = safe_get_portfolio()
        master_works = [p for p in portfolio if p.get("masterId") == master_id and p.get("style") == selected_style]
        if not master_works:
            q.message.bot.send_message(
                chat_id=q.message.chat_id,
                text="Работы мастера не найдены.",
                reply_markup=kb_back_home()
            )
            return

        bot = q.message.bot
        chat_id = q.message.chat_id
        sent_count = 0
        for work in master_works[:5]:
            media_items = work.get("attachments") or []
            if work.get("url"):
                media_items = [{
                    "url": build_full_url(work.get("url")),
                    "type": work.get("mediaType") or "image",
                    "caption": work.get("description") or work.get("title") or selected_style,
                }, *media_items]

            sanitized_media = []
            for item in media_items:
                url = item.get("url")
                if not url:
                    continue
                sanitized_media.append({
                    "url": build_full_url(url),
                    "type": item.get("mediaType") or item.get("type") or "image",
                    "caption": item.get("caption") or work.get("description") or work.get("title") or selected_style,
                })

            if not sanitized_media:
                continue

            unique_media = []
            for item in sanitized_media:
                if any(existing.get("url") == item.get("url") for existing in unique_media):
                    continue
                unique_media.append(item)

            try:
                if len(unique_media) > 1:
                    safe_send_media_group(bot, chat_id, unique_media)
                    sent_count += 1
                else:
                    single = unique_media[0]
                    caption = single.get("caption")
                    if (single.get("type") or "image") == "video":
                        safe_send_video(bot, chat_id, single.get("url"), caption=caption)
                    else:
                        safe_send_photo(bot, chat_id, single.get("url"), caption=caption)
                    sent_count += 1
            except Exception as e:
                log.warning(f"failed to load or send media {unique_media[0].get('url')}: {e}")

        if sent_count > 0:
            q.message.reply_text("Работы мастера", reply_markup=kb_back_home())
        else:
            q.message.bot.send_message(
                chat_id=chat_id,
                text="Изображения или видео работ не найдены или не удалось отправить.",
                reply_markup=kb_back_home()
            )
        return

    if data=="certs":
        s = safe_get_settings()
        certs = safe_get_certificates()
        if certs:
            sent = 0
            for cert in certs[:6]:
                url = cert.get("url")
                if not url:
                    continue
                caption = cert.get("caption") or cert.get("description")
                media_type = cert.get("type")
                try:
                    if media_type == "video":
                        safe_send_video(
                            q.message.bot,
                            q.message.chat_id,
                            url,
                            caption=caption,
                            parse_mode=None,
                            reply_markup=kb_back_home() if sent == 0 else None,
                        )
                    else:
                        safe_send_photo(
                            q.message.bot,
                            q.message.chat_id,
                            url,
                            caption=caption,
                            parse_mode=None,
                            reply_markup=kb_back_home() if sent == 0 else None,
                        )
                    sent += 1
                except Exception as e:
                    log.warning("send cert media failed: %s", e)

            certs_text = render_bot_text(
                "certs",
                "🎉 Наши акции и спецпредложения.",
                {"studio": s.get("studioName") or "Студия"},
            )
            if certs_text:
                q.message.bot.send_message(
                    chat_id=q.message.chat_id,
                    text=certs_text,
                    parse_mode=ParseMode.MARKDOWN,
                    reply_markup=kb_back_home(),
                )
        else:
            empty_text = render_bot_text(
                "certs_empty",
                "Акции пока не опубликованы.",
                {"studio": s.get("studioName") or "Студия"},
            )
            try:
                q.edit_message_text(empty_text, parse_mode=ParseMode.MARKDOWN, reply_markup=kb_back_home())
            except Exception as e:
                if "no text in the message to edit" in str(e):
                    try:
                        q.message.delete()
                    except:
                        pass
                    q.message.bot.send_message(
                        chat_id=q.message.chat_id,
                        text=empty_text,
                        parse_mode=ParseMode.MARKDOWN,
                        reply_markup=kb_back_home(),
                    )
                else:
                    raise
        return

    if data=="pay":
        s = safe_get_settings()
        methods = format_payment_methods(s.get("paymentInfo") or s.get("paymentMethods"))
        pay = render_bot_text(
            "pay",
            (
                "💳 *Оплата*\n\n"
                "{methods}\n\n"
                "_Депозит фиксирует слот и вычитается из стоимости сеанса._"
            ),
            {
                "methods": methods,
                "studio": s.get("studioName") or "Студия",
            },
        )

        cover = bot_image("pay")
        if cover:
            safe_send_photo(
                q.message.bot,
                q.message.chat_id,
                build_full_url(cover),
                caption=pay,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=kb_back_home(),
            )
        else:
            try:
                q.edit_message_text(pay, parse_mode=ParseMode.MARKDOWN, reply_markup=kb_back_home())
            except Exception as e:
                if "no text in the message to edit" in str(e):
                    try:
                        q.message.delete()
                    except:
                        pass
                    q.message.bot.send_message(
                        chat_id=q.message.chat_id,
                        text=pay,
                        parse_mode=ParseMode.MARKDOWN,
                        reply_markup=kb_back_home(),
                    )
                else:
                    raise
        return

def cmd_ping(u, c): u.message.reply_text("pong")

def error_handler(update, context):
    log.error(f"Exception while handling an update: {context.error}")
    if update and update.effective_message:
        update.effective_message.reply_text("Произошла ошибка. Попробуйте заново.")

def main():
    if not TOKEN:
        log.error("TELEGRAM_BOT_TOKEN is empty – set token in admin.")
        while True: time.sleep(30)

    upd = Updater(TOKEN, use_context=True)
    dp = upd.dispatcher

    conv = ConversationHandler(
        entry_points=[
            CommandHandler("start", cmd_start),
            CommandHandler("captcha", cmd_captcha),
            CallbackQueryHandler(on_start_button, pattern=r"^start_bot$"),
            CallbackQueryHandler(entry_book, pattern=r"^book$"),
        ],
        states={
            S_CAPTCHA: [MessageHandler(Filters.text & ~Filters.command, on_captcha)],
            S_SVC:     [CallbackQueryHandler(pick_service, pattern=r"^svc:.+"), CallbackQueryHandler(on_start_button, pattern=r"^start_bot$")],
            S_MASTER:  [
                CallbackQueryHandler(pick_master,  pattern=r"^m:.+"),
                CallbackQueryHandler(pick_service, pattern=r"^svc:.+"),
            ],
            S_DATE:    [
                CallbackQueryHandler(pick_date,    pattern=r"^d:.+"),
                CallbackQueryHandler(pick_master,  pattern=r"^m:.+"),
                CallbackQueryHandler(pick_service, pattern=r"^svc:.+"),
            ],
            S_TIME:    [
                CallbackQueryHandler(pick_time,    pattern=r"^t:.+"),
                CallbackQueryHandler(pick_date,    pattern=r"^d:.+"),
                CallbackQueryHandler(pick_master,  pattern=r"^m:.+"),
                CallbackQueryHandler(pick_service, pattern=r"^svc:.+"),
            ],
            S_NAME:    [MessageHandler(Filters.text & ~Filters.command, ask_phone)],
            S_PHONE:   [MessageHandler(Filters.text & ~Filters.command, finalize_booking)],
        },
        fallbacks=[CallbackQueryHandler(btn)],
        allow_reentry=True
    )

    dp.add_handler(conv)
    dp.add_handler(CallbackQueryHandler(btn))
    dp.add_handler(CommandHandler("ping", cmd_ping))
    dp.add_error_handler(error_handler)

    log.info("Bot starting polling...")
    upd.start_polling()
    upd.idle()

if __name__ == "__main__":
    main()