# --- COPY KODE INI KE DALAM FILE be/main.py (Gantikan Endpoint /scan yang lama) ---

@app.post("/scan")
async def scan_document(
    file: UploadFile = File(...), 
    receiver: str = Form(...),
    authorization: str = Header(None)
):
    """Endpoint Utama: Upload -> Cek Kredit -> OCR -> Simpan DB"""
    try:
        user_email = get_user_email_from_token(authorization)
        remaining_credits = 0 # Default

        # 1. Cek Kredit (Wajib ada saldo minimal 1)
        if credit_service and prisma.is_connected():
            credits = await credit_service.get_user_credits(user_email, prisma)
            remaining_credits = credits # Set awal
            if credits < 1:
                return {
                    "status": "error", 
                    "message": "Kredit habis. Silakan topup.", 
                    "error_type": "insufficient_credits",
                    "remaining_credits": 0
                }

        # 2. Proses Image & OCR
        content = await file.read()
        image_np = np.array(Image.open(io.BytesIO(content)))
        
        # Jalankan OCR (Pastikan OCR_API_KEY valid di .env)
        ocr_res = await extract_text_from_image(image_np)

        # 3. Klasifikasi Data
        doc_data = ocr_res.get("structured_data", {})
        nomor_dokumen = doc_data.get('invoice_number') or doc_data.get('do_number') or doc_data.get('po_number') or "TIDAK TERDETEKSI"
        
        doc_type = ocr_res.get("document_type", "unknown")
        kategori = "DOKUMEN LAIN"
        if doc_type == "invoice": kategori = "INVOICE"
        elif doc_type == "delivery_note": kategori = "SURAT JALAN"
        elif doc_type == "purchase_order": kategori = "PURCHASE ORDER"

        # 4. Simpan File Lokal
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f: f.write(content)

        # Generate URL
        BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
        if os.getenv("ENVIRONMENT") == "production":
            BASE_URL = os.getenv("PRODUCTION_URL", "https://api-ocr.xyz")
        image_url = f"{BASE_URL}/uploads/{filename}"

        # 5. Simpan ke Database & Potong Kredit
        log_id = 0
        if prisma.is_connected():
            try:
                # A. Pastikan User Ada (Self-Healing)
                user = await prisma.user.find_unique(where={"email": user_email})
                if not user:
                    await credit_service.ensure_default_credits(user_email, prisma)

                # B. Simpan LOG (Hubungkan dengan User ID)
                # NOTE: Sesuaikan 'userId' dengan schema Prisma kamu. 
                # Jika schema pakai relation field 'user', Prisma butuh user email/id yang valid.
                log = await prisma.logs.create(data={
                    "userId": user_email, # Asumsi di schema: userId String @map("user_id")
                    "timestamp": datetime.now(),
                    "filename": file.filename,
                    "kategori": kategori,
                    "nomorDokumen": nomor_dokumen,
                    "receiver": receiver.upper(),
                    "imagePath": image_url,
                    "summary": ocr_res.get("summary", ""),
                    "fullText": ocr_res.get("raw_text", "")
                })
                log_id = log.id

                # C. Potong Kredit (Return saldo terbaru)
                if credit_service:
                    new_bal = await credit_service.deduct_credits(user_email, 1, f"Scan OCR #{log_id}", prisma)
                    if new_bal is not None:
                        remaining_credits = new_bal

            except Exception as db_error:
                print(f"❌ DATABASE ERROR: {str(db_error)}")
                # Jangan crash jika DB error, kembalikan hasil OCR saja
                # remaining_credits tetap pakai nilai lama

        return {
            "status": "success",
            "data": {
                "id": log_id,
                "kategori": kategori,
                "nomorDokumen": nomor_dokumen,
                "summary": ocr_res.get("summary", ""),
                "imagePath": image_url
            },
            # 🔥 PENTING: Kirim sisa kredit ke frontend
            "remaining_credits": remaining_credits 
        }

    except Exception as e:
        print(f"Scan Error: {traceback.format_exc()}")
        return {"status": "error", "message": str(e)}
