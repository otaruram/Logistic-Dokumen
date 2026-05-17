from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request

from config.settings import settings
from services.otaru_finance_service import calculate_otaru_index, resolve_user_id_by_chat

try:
    from aiogram import Bot, Dispatcher, F
    from aiogram.filters import CommandStart
    from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Update
    from aiogram.types import Message, CallbackQuery
except Exception:  # pragma: no cover - dependency may be optional in some envs
    Bot = None  # type: ignore[assignment]
    Dispatcher = None  # type: ignore[assignment]
    InlineKeyboardMarkup = lambda **kwargs: None
    InlineKeyboardButton = lambda **kwargs: None
    Message = None
    CallbackQuery = None
    F = None
    Update = None
    CommandStart = lambda: None

router = APIRouter(prefix="/api/telegram", tags=["Telegram Webhook"])

_main_bot: Bot | None = None
_main_dp: Dispatcher | None = None
_fin_bot: Bot | None = None
_fin_dp: Dispatcher | None = None


FIN_MENU = InlineKeyboardMarkup(
    inline_keyboard=[
        [InlineKeyboardButton(text="📊 Cek Skor Kesehatan", callback_data="fin:score")],
        [InlineKeyboardButton(text="🏦 Sisa Plafon Aman", callback_data="fin:plafon")],
        [InlineKeyboardButton(text="💬 Tanya Otaru AI", callback_data="fin:ask")],
        [InlineKeyboardButton(text="👨‍👩‍👧‍👦 Family Sharing", callback_data="fin:family")],
        [InlineKeyboardButton(text="🛡️ Sertifikat Kredit", callback_data="fin:cert")],
    ]
)


def _ensure_finance_bot() -> tuple[Bot, Dispatcher]:
    global _fin_bot, _fin_dp
    if Bot is None or Dispatcher is None:
        raise HTTPException(status_code=500, detail="aiogram belum terpasang")
    if not settings.TELEGRAM_FINANCE_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="TELEGRAM_FINANCE_BOT_TOKEN belum diset")

    if _fin_bot and _fin_dp:
        return _fin_bot, _fin_dp

    _fin_bot = Bot(token=settings.TELEGRAM_FINANCE_BOT_TOKEN)
    _fin_dp = Dispatcher()

    @_fin_dp.message(CommandStart())
    async def on_start(message: Message) -> None:
        await message.answer(
            "<b>Otaru Finance Assistant</b>\n"
            "Pilih menu untuk cek kesehatan kredit Anda.",
            parse_mode="HTML",
            reply_markup=FIN_MENU,
        )

    @_fin_dp.callback_query(F.data == "fin:score")
    async def on_score(callback: CallbackQuery) -> None:
        chat_id = callback.message.chat.id if callback.message else 0
        user_id = resolve_user_id_by_chat(chat_id)
        if not user_id:
            await callback.message.answer("Akun belum terhubung ke OtaruChain. Gunakan /start di bot utama dulu.")
            await callback.answer()
            return

        score = calculate_otaru_index(user_id)
        text = (
            f"📊 <b>Otaru Index</b>: <b>{score['otaru_index']}</b>/1000\n"
            f"Grade: <b>{score['credit_grade']}</b>\n"
            f"DSR: <b>{score['dsr_percent']}%</b> (target <30%)\n"
            f"Integrity: <b>{score['integrity_level']}</b>\n"
            f"Tampered Attempts: <b>{score['tampered_attempts']}</b>"
        )
        await callback.message.answer(text, parse_mode="HTML", reply_markup=FIN_MENU)
        await callback.answer()

    @_fin_dp.callback_query(F.data == "fin:plafon")
    async def on_plafon(callback: CallbackQuery) -> None:
        chat_id = callback.message.chat.id if callback.message else 0
        user_id = resolve_user_id_by_chat(chat_id)
        if not user_id:
            await callback.message.answer("Akun belum terhubung ke OtaruChain. Gunakan /start di bot utama dulu.")
            await callback.answer()
            return

        score = calculate_otaru_index(user_id)
        text = (
            f"🏦 <b>Sisa Plafon Aman</b>\n"
            f"Limit: <b>Rp {score['limit_pinjaman']:,}</b>\n"
            f"Sisa Aman: <b>Rp {score['sisa_plafon_aman']:,}</b>\n"
            f"Cicilan Aktif: <b>Rp {score['cicilan_aktif_total']:,}</b>"
        ).replace(",", ".")
        await callback.message.answer(text, parse_mode="HTML", reply_markup=FIN_MENU)
        await callback.answer()

    @_fin_dp.callback_query(F.data == "fin:family")
    async def on_family(callback: CallbackQuery) -> None:
        await callback.message.answer(
            "👨‍👩‍👧‍👦 <b>Family Sharing</b>\n"
            "Fitur ini memberikan akses <b>view-only</b> ke keluarga.\n"
            "Buat invite dari dashboard web untuk keamanan & persetujuan PDP.",
            parse_mode="HTML",
            reply_markup=FIN_MENU,
        )
        await callback.answer()

    @_fin_dp.callback_query(F.data == "fin:cert")
    async def on_cert(callback: CallbackQuery) -> None:
        await callback.message.answer(
            "🛡️ <b>Sertifikat Kredit</b>\n"
            "Sertifikat memuat Otaru Index + jejak segel SHA-256 (reconciliation history).",
            parse_mode="HTML",
            reply_markup=FIN_MENU,
        )
        await callback.answer()

    @_fin_dp.callback_query(F.data == "fin:ask")
    async def on_ask_prompt(callback: CallbackQuery) -> None:
        await callback.message.answer(
            "💬 <b>Mode Tanya Otaru</b>\n\n"
            "Ketik pertanyaan apapun soal kondisi keuanganmu.\n"
            "Otaru AI akan menjawab berdasarkan data profilmu secara langsung.\n\n"
            "<i>Contoh: 'Apakah DSR saya masih aman?' atau 'Berapa budget harian saya?'</i>",
            parse_mode="HTML",
        )
        await callback.answer()

    # ── /ask command shortcut ────────────────────────────────────────────
    from aiogram.filters import Command

    @_fin_dp.message(Command("ask"))
    async def on_ask_command(message: Message) -> None:
        chat_id = message.chat.id
        user_id = resolve_user_id_by_chat(chat_id)
        if not user_id:
            await message.answer("Akun belum terhubung. Gunakan /start di bot utama dulu.")
            return

        # Extract question after /ask
        raw = (message.text or "").strip()
        question = raw[4:].strip() if raw.lower().startswith("/ask") else raw
        if not question:
            await message.answer(
                "💬 <b>Mode Tanya Otaru</b>\n\n"
                "Tulis pertanyaanmu setelah /ask.\n"
                "Contoh: <code>/ask Apakah DSR saya aman?</code>\n\n"
                "Atau ketik pertanyaan langsung sebagai teks biasa.",
                parse_mode="HTML",
            )
            return

        await message.answer("⏳ Otaru sedang menganalisis data keuanganmu...")

        try:
            from services.telegram_service import answer_finance_question_with_context
            answer = await answer_finance_question_with_context(user_id, question)
            await message.answer(answer, reply_markup=FIN_MENU)
        except Exception as exc:
            await message.answer(f"Maaf, terjadi kesalahan: {exc}")

    # ── Catch-all: Mode Tanya Otaru (free-text) ──────────────────────────
    @_fin_dp.message(F.text)
    async def on_free_text(message: Message) -> None:
        """Intercept any free text message as a financial question.
        
        Resolves user_id via chat_id → telegram_links, then routes the
        question through Gemini-powered answer_finance_question_with_context.
        """
        chat_id = message.chat.id
        user_id = resolve_user_id_by_chat(chat_id)
        if not user_id:
            await message.answer(
                "Akun belum terhubung ke OtaruChain.\n"
                "Gunakan /start di bot utama (@otaruchain_bot) untuk menghubungkan akun.",
                reply_markup=FIN_MENU,
            )
            return

        question = (message.text or "").strip()
        if not question:
            await message.answer("Ketik pertanyaanmu, Otaru siap membantu.", reply_markup=FIN_MENU)
            return

        if len(question) > 800:
            await message.answer("Pertanyaan terlalu panjang (max 800 karakter). Ringkas dulu ya.")
            return

        await message.answer("⏳ Otaru sedang menganalisis data keuanganmu...")

        try:
            from services.telegram_service import answer_finance_question_with_context
            answer = await answer_finance_question_with_context(user_id, question)
            await message.answer(answer, reply_markup=FIN_MENU)
        except Exception as exc:
            await message.answer(f"Maaf, Otaru tidak bisa memproses saat ini: {exc}")

    return _fin_bot, _fin_dp


def _ensure_main_bot() -> tuple[Bot, Dispatcher]:
    global _main_bot, _main_dp
    if Bot is None or Dispatcher is None:
        raise HTTPException(status_code=500, detail="aiogram belum terpasang")
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="TELEGRAM_BOT_TOKEN belum diset")

    if _main_bot and _main_dp:
        return _main_bot, _main_dp

    _main_bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
    _main_dp = Dispatcher()
    return _main_bot, _main_dp


@router.post("/webhook/otaruchain/{secret}")
async def webhook_otaruchain(secret: str, request: Request) -> dict[str, Any]:
    expected = settings.TELEGRAM_MAIN_WEBHOOK_SECRET
    if expected and secret != expected:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    bot, dp = _ensure_main_bot()
    payload = await request.json()
    update = Update.model_validate(payload, context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}


@router.post("/webhook/otarufinance/{secret}")
async def webhook_otarufinance(secret: str, request: Request) -> dict[str, Any]:
    expected = settings.TELEGRAM_FINANCE_WEBHOOK_SECRET
    if expected and secret != expected:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    bot, dp = _ensure_finance_bot()
    payload = await request.json()
    update = Update.model_validate(payload, context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}


@router.post("/webhook/setup")
async def setup_dual_webhook() -> dict[str, Any]:
    if not settings.BACKEND_BASE_URL:
        raise HTTPException(status_code=500, detail="BACKEND_BASE_URL belum diset")

    base = settings.BACKEND_BASE_URL.rstrip("/")
    result: dict[str, Any] = {}

    if settings.TELEGRAM_BOT_TOKEN:
        bot, _ = _ensure_main_bot()
        secret = settings.TELEGRAM_MAIN_WEBHOOK_SECRET or "main-secret"
        url = f"{base}/api/telegram/webhook/otaruchain/{secret}"
        await bot.set_webhook(url=url)
        result["otaruchain"] = url

    if settings.TELEGRAM_FINANCE_BOT_TOKEN:
        bot, _ = _ensure_finance_bot()
        secret = settings.TELEGRAM_FINANCE_WEBHOOK_SECRET or "finance-secret"
        url = f"{base}/api/telegram/webhook/otarufinance/{secret}"
        await bot.set_webhook(url=url)
        result["otarufinance"] = url

    return {"ok": True, "webhooks": result}
