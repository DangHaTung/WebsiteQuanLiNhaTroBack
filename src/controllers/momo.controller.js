import crypto from "crypto";
import https from "https";
import Bill from "../models/bill.model.js";
import Payment from "../models/payment.model.js";

/**
 * MoMo v2 (payWithMethod) integration — with DB synchronization
 */

const createPayment = async (req, res) => {
  try {
    const { billId, amount, orderInfo } = req.body;

    if (!billId || !amount)
      return res.status(400).json({ success: false, message: "Thiếu billId hoặc amount" });

    const accessKey = "F8BBA842ECF85";
    const secretKey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";
    const partnerCode = "MOMO";

    const redirectUrl = "https://tailieu-zhost.io.vn/api/payment/momo/return";
    const ipnUrl = "https://tailieu-zhost.io.vn/api/payment/momo/ipn";

    const requestType = "payWithMethod";
    const orderId = partnerCode + new Date().getTime();
    const requestId = orderId;
    const extraData = JSON.stringify({ billId }); // lưu kèm billId để IPN biết cập nhật hóa đơn nào
    const autoCapture = true;
    const lang = "vi";

    const rawSignature =
      "accessKey=" + accessKey +
      "&amount=" + amount +
      "&extraData=" + extraData +
      "&ipnUrl=" + ipnUrl +
      "&orderId=" + orderId +
      "&orderInfo=" + orderInfo +
      "&partnerCode=" + partnerCode +
      "&redirectUrl=" + redirectUrl +
      "&requestId=" + requestId +
      "&requestType=" + requestType;

    const signature = crypto.createHmac("sha256", secretKey)
      .update(rawSignature)
      .digest("hex");

    const requestBody = JSON.stringify({
      partnerCode,
      partnerName: "TailieuZHost",
      storeId: "MomoZHostStore",
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      lang,
      requestType,
      autoCapture,
      extraData,
      signature,
    });

    const options = {
      hostname: "test-payment.momo.vn",
      port: 443,
      path: "/v2/gateway/api/create",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestBody),
      },
    };

    const momoReq = https.request(options, (momoRes) => {
      let data = "";
      momoRes.on("data", (chunk) => (data += chunk));
      momoRes.on("end", async () => {
        try {
          const result = JSON.parse(data);

          // Lưu record Payment tạm thời (pending)
          await Payment.create({
            billId,
            provider: "MOMO",
            transactionId: orderId,
            amount,
            status: result.resultCode === 0 ? "SUCCESS" : "PENDING",
            method: "REDIRECT",
            metadata: result,
          });

          return res.json({ success: true, data: result, payUrl: result.payUrl });
        } catch (err) {
          console.error("Parse error:", err);
          return res.status(500).json({ success: false, raw: data });
        }
      });
    });

    momoReq.on("error", (e) => {
      console.error("HTTPS error:", e.message);
      return res.status(500).json({ success: false, message: e.message });
    });

    momoReq.write(requestBody);
    momoReq.end();
  } catch (err) {
    console.error("createPayment error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const momoReturn = async (req, res) => {
  const { resultCode, orderId, amount, message } = req.query;
  const success = Number(resultCode) === 0;

  // Cập nhật Payment record nếu có
  await Payment.findOneAndUpdate(
    { provider: "MOMO", transactionId: orderId },
    {
      status: success ? "SUCCESS" : "FAILED",
      "metadata.returnData": req.query,
    },
    { new: true }
  );

  if (success) {
    res.send(`
      <h2>🎉 Thanh toán thành công!</h2>
      <p>Mã giao dịch: ${orderId}</p>
      <p>Số tiền: ${amount}đ</p>
      <a href="/">Về trang chủ</a>
    `);
  } else {
    res.send(`
      <h2>❌ Thanh toán thất bại</h2>
      <p>Lý do: ${message}</p>
      <a href="/">Thử lại</a>
    `);
  }
};

const momoIPN = async (req, res) => {
  try {
    const params = req.body;
    console.log("✅ MoMo IPN:", params);

    const { orderId, amount, resultCode, message, extraData } = params;
    const extra = JSON.parse(extraData || "{}");
    const billId = extra.billId;

    if (!billId) {
      console.warn("⚠️ Không có billId trong extraData:", params);
      return res.json({ resultCode: 0, message: "Missing billId, ignored" });
    }

    // Tạo/ghi Payment log
    const payment = await Payment.findOneAndUpdate(
      { provider: "MOMO", transactionId: orderId },
      {
        status: Number(resultCode) === 0 ? "SUCCESS" : "FAILED",
        amount,
        method: "REDIRECT",
        metadata: params,
      },
      { upsert: true, new: true }
    );

    // Nếu thanh toán thành công → cập nhật Bill
    if (Number(resultCode) === 0) {
      await Bill.findByIdAndUpdate(
        billId,
        {
          status: "PAID",
          $push: {
            payments: {
              paidAt: new Date(),
              amount,
              method: "MOMO",
              provider: "MoMo",
              transactionId: orderId,
              note: message,
              metadata: params,
            },
          },
        },
        { new: true }
      );

      console.log(`💰 Đã cập nhật Bill ${billId} → PAID`);
    }

    return res.json({ resultCode: 0, message: "Confirm Success" });
  } catch (err) {
    console.error("momoIPN error:", err);
    return res.status(500).json({ resultCode: 99, message: err.message });
  }
};

export default { createPayment, momoReturn, momoIPN };
