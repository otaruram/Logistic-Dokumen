# File: be/main.py

@app.post("/scan")
async def scan_document(
    file: UploadFile = File(...), 
    receiver: str = Form(...),
    authorization: str = Header(None)
):
    try:
        user_email = get_user_email_from_token(authorization)

        # 1. Cek Kredit
        if credit_service and prisma.is_connected():
            credits = await credit_service.get_user_credits(user_email, prisma)
            if credits < 1:
                return {"status": "error", "message": "Kredit habis. Silakan topup.", "error_type": "insufficient_credits"}

        # 2. Proses Image & OCR
        content = await file.read()
        image_np = np.array(Image.open(io.BytesIO(content)))
        
        # Jalankan OCR (Pastikan API KEY di .env valid!)
        ocr_res = await extract_text_from_image(image_np)

        # ... (Logika klasifikasi dokumen tetap sama) ...
        doc_data = ocr_res.get("structured_data", {})
        nomor_dokumen = doc_data.get('invoice_number') or doc_data.get('do_number') or "TIDAK TERDETEKSI"
        kategori = "DOKUMEN" # (Sederhanakan logic kategori jika perlu)

        # Simpan File Fisik
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f: f.write(content)
        
        # Generate URL
        BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
        image_url = f"{BASE_URL}/uploads/{filename}"

        # 3. Simpan ke Database (FIXED USER ID ISSUE)
        log_id = 0
        remaining_credits = credits # Default

        if prisma.is_connected():
            try:
                # Pastikan user ada di DB
                user_check = await prisma.user.find_unique(where={"email": user_email})
                if not user_check:
                    # Auto-create user jika belum ada (self-healing)
                    await credit_service.ensure_default_credits(user_email, prisma)
                
                # Simpan Log
                log = await prisma.logs.create(data={
                    "userId": user_email, # Pastikan ini sesuai schema Prisma (String)
                    "timestamp": datetime.now(),
                    "filename": file.filename,
                    "kategori": kategori,
                    "nomorDokumen": nomor_dokumen,
                    "receiver": receiver.upper(),
                    "imagePath": image_url,
                    "summary": ocr_res.get("summary", ""),
                })
                log_id = log.id

                # Potong Kredit
                new_bal = await credit_service.deduct_credits(user_email, 1, f"Scan OCR #{log_id}", prisma)
                if new_bal is not None: remaining_credits = new_bal

            except Exception as db_e:
                print(f"⚠️ DB Error (Log tetap tersimpan lokal): {db_e}")

        return {
            "status": "success",
            "data": {
                "id": log_id,
                "kategori": kategori,
                "summary": ocr_res.get("summary", ""),
            },
            "remaining_credits": remaining_credits # Kirim sisa saldo ke Frontend
        }

    except Exception as e:
        print(f"Scan Error: {str(e)}")
        return {"status": "error", "message": str(e)}
