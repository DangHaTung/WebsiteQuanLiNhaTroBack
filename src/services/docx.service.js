import { Document, Packer, Paragraph, TextRun } from "docx";

function formatCurrencyVND(n) {
  try {
    const num = typeof n === "number" ? n : parseFloat(n?.toString?.() || String(n || 0));
    return new Intl.NumberFormat("vi-VN").format(num) + " đồng";
  } catch {
    return String(n) + " đồng";
  }
}

function t(str = "") {
  return new TextRun({ text: str, font: "Times New Roman", size: 24 });
}

function p(children = []) {
  return new Paragraph({ children, spacing: { line: 360 } });
}

export async function buildSampleContractDocBuffer(checkin, org = {}) {
  // Bên A (chủ trọ) – ưu tiên env, fallback cố định theo mẫu bạn cung cấp
  const orgName = org.name || process.env.ORG_NAME || "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"; // Header quốc hiệu (hiển thị phía trên)
  const orgOwnerName = org.owner || process.env.ORG_OWNER_NAME || process.env.ORG_OWNER || "Nguyễn Minh Đức";
  const orgOwnerIdNo = process.env.ORG_OWNER_ID_NO || "0011204012154";
  const orgOwnerIdDate = process.env.ORG_OWNER_ID_DATE || "21/07/2021";
  const orgOwnerIdPlace = process.env.ORG_OWNER_ID_PLACE || "CCS";
  const orgAddress = org.address || process.env.ORG_ADDRESS || "39 Ngõ 113 Yên Hoà - Cầu Giấy";

  const fullName = checkin?.tenantSnapshot?.fullName || "............................................................";
  const identityNo = checkin?.tenantSnapshot?.identityNo || "....................";
  const tenantPhone = checkin?.tenantSnapshot?.phone || "";
  const tenantAddress = checkin?.tenantSnapshot?.address || checkin?.tenantSnapshot?.note || "";
  const roomNumber = checkin?.roomId?.roomNumber || "............";
  const startDate = new Date(checkin?.checkinDate);
  const endDate = new Date(startDate);
  endDate.setMonth(startDate.getMonth() + Number(checkin?.durationMonths || 0));
  const depositNum = parseFloat(checkin?.deposit?.toString?.() || "0");
  const rentNum = parseFloat(checkin?.monthlyRent?.toString?.() || "0");

  const dateStr = `${String(startDate.getDate()).padStart(2, "0")} / ${String(startDate.getMonth() + 1).padStart(2, "0")} / ${startDate.getFullYear()}`;
  const endStr = `${String(endDate.getDate()).padStart(2, "0")} / ${String(endDate.getMonth() + 1).padStart(2, "0")} / ${endDate.getFullYear()}`;

  const title = new Paragraph({
    children: [
      new TextRun({ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, font: "Times New Roman", size: 28 }),
    ],
    alignment: "center",
  });
  const motto = new Paragraph({
    children: [new TextRun({ text: "Độc lập – Tự do – Hạnh phúc", bold: true, font: "Times New Roman", size: 26 })],
    alignment: "center",
  });
  const hdTitle = new Paragraph({
    children: [new TextRun({ text: "HỢP ĐỒNG THUÊ PHÒNG TRỌ", bold: true, font: "Times New Roman", size: 30 })],
    alignment: "center",
    spacing: { after: 200 },
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          title,
          motto,
          hdTitle,
          p([t(`Hôm nay, ngày ${dateStr}, tại căn nhà số ${orgAddress}, chúng tôi gồm có:`)]),
          p([t(" ")]),
          p([t("BÊN CHO THUÊ PHÒNG TRỌ (Bên A):")]),
          p([t(`Ông/bà: ${orgOwnerName}`)]),
          p([t(`CMND/CCCD số: ${orgOwnerIdNo} cấp ngày ${orgOwnerIdDate} tại ${orgOwnerIdPlace}`)]),
          p([t(`Số điện thoại: ${process.env.ORG_OWNER_PHONE || "0842346871"}`)]),
          p([t(`Địa chỉ: ${orgAddress}`)]),
          p([t(" ")]),
          p([t("BÊN THUÊ PHÒNG TRỌ (Bên B):")]),
          p([t(`Ông/bà: ${fullName}`)]),
          p([t(`CMND/CCCD số: ${identityNo}`)]),
          p([t(`Số điện thoại: ${tenantPhone}`)]),
          p([t(`Địa chỉ: ${tenantAddress}`)]),
          p([t("Điều 1. Nội dung thuê phòng trọ")]),
          p([t(`Bên A cho Bên B thuê 01 phòng trọ số ${roomNumber} tại địa chỉ ${orgAddress}`)]),
          p([t(`Thời hạn thuê: ${checkin?.durationMonths || "........"} tháng, kể từ ngày ${dateStr}`)]),
          p([t(`Giá thuê: ${formatCurrencyVND(rentNum)}.`)]),
          p([t(`Tiền đặt cọc: ${formatCurrencyVND(depositNum)}.`)]),
          p([t("Giá trên chưa bao gồm chi phí điện, nước và các dịch vụ khác.")]),
          p([t(" ")]),
          p([t("Điều 2. Trách nhiệm của Bên A")]),
          p([t("1. Đảm bảo phòng trọ hợp pháp, không có tranh chấp.")]),
          p([t("2. Đăng ký tạm trú cho người thuê theo quy định.")]),
          p([t("3. Bảo trì, sửa chữa các hư hỏng lớn không do Bên B gây ra.")]),
          p([t(" ")]),
          p([t("Điều 3. Trách nhiệm của Bên B")]),
          p([t("1. Thanh toán đúng hạn tiền thuê, điện, nước và các chi phí khác.")]),
          p([t("2. Giữ gìn tài sản, không tự ý sửa chữa, thay đổi cấu trúc phòng.")]),
          p([t("3. Chỉ sử dụng phòng để ở; không chứa hàng cấm, không vi phạm pháp luật, đảm bảo an ninh trật tự.")]),
          p([t("4. Khi trả phòng, hoàn tất nghĩa vụ tài chính và bàn giao nguyên trạng; nếu hư hỏng, Bên A được trừ chi phí từ tiền cọc.")]),
          p([t(" ")]),
          p([t("Điều 4. Thời hạn và chấm dứt hợp đồng")]),
          p([t(`1. Hợp đồng có hiệu lực từ ngày ${dateStr} đến ngày ${endStr}.`)]),
          p([t("2. Mỗi bên muốn chấm dứt hợp đồng phải thông báo trước ít nhất 30 ngày.")]),
          p([t("3. Khi hết hạn thuê, nếu Bên B có nhu cầu tiếp tục thuê, hai bên sẽ thỏa thuận và ký phụ lục gia hạn hợp đồng (hoặc ký mới).")]),
          p([t("4. Trường hợp một trong hai bên vi phạm nghĩa vụ, bên còn lại có quyền đơn phương chấm dứt hợp đồng và yêu cầu bồi thường (nếu có).")]),
          p([t(" ")]),
          p([t("Điều 5. Hiệu lực hợp đồng")]),
          p([t("• Hợp đồng lập thành 02 bản, mỗi bên giữ 01 bản, có giá trị pháp lý như nhau.")]),
          p([t("• Hai bên đã đọc kỹ, hiểu rõ nội dung và tự nguyện ký tên dưới đây.")]),
          p([t(" ")]),
          p([t("Ngày ...... tháng ...... năm 20......")]),
          p([t(" ")]),
          p([t("BÊN B (Người thuê)                                   BÊN A (Chủ trọ)")]),
          p([t("(Ký, ghi rõ họ tên)                                 (Ký, ghi rõ họ tên)")]),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}