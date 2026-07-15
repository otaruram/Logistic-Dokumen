export function buildDummyDocBlob(kind: "slip_gaji" | "struk_belanja") {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1520;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111827";
  ctx.font = "bold 44px Arial";
  ctx.fillText("OTARU BETA DUMMY DOCUMENT", 70, 100);

  ctx.fillStyle = "#334155";
  ctx.font = "28px Arial";
  ctx.fillText(`TYPE: ${kind === "slip_gaji" ? "SLIP GAJI" : "STRUK BELANJA"}`, 70, 155);
  ctx.fillText("Format dummy resmi untuk beta testing upload OCR", 70, 200);

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 3;
  ctx.strokeRect(60, 250, 960, 1120);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 32px Arial";
  ctx.fillText("DATA UTAMA", 90, 320);

  ctx.font = "26px Arial";
  if (kind === "slip_gaji") {
    ctx.fillText("Nama Karyawan : Dummy User", 90, 390);
    ctx.fillText("Periode Gaji  : 2026-05", 90, 440);
    ctx.fillText("Gaji Pokok    : Rp 5.500.000", 90, 490);
    ctx.fillText("Tunjangan     : Rp   750.000", 90, 540);
    ctx.fillText("Potongan      : Rp   250.000", 90, 590);
    ctx.fillText("Take Home Pay : Rp 6.000.000", 90, 640);
    ctx.fillText("Dokumen ini dipakai untuk simulasi OCR beta Otaru Financial.", 90, 730);
  } else {
    ctx.fillText("Vendor        : PT Dummy Supplier", 90, 390);
    ctx.fillText("No. Invoice   : INV-2026-00042", 90, 440);
    ctx.fillText("Tanggal       : 2026-05-10", 90, 490);
    ctx.fillText("Subtotal      : Rp 12.000.000", 90, 540);
    ctx.fillText("PPN 11%       : Rp  1.320.000", 90, 590);
    ctx.fillText("Total         : Rp 13.320.000", 90, 640);
    ctx.fillText("Dokumen ini dipakai untuk simulasi OCR beta Otaru Financial.", 90, 730);
  }

  ctx.fillStyle = "#64748b";
  ctx.font = "22px Arial";
  ctx.fillText("Kode Template: Otaru Beta Dummy v1", 90, 1340);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}
