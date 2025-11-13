import mongoose from "mongoose";
import axios from "axios";
import moment from "moment";
import CryptoJS from "crypto-js";
import Bill from "../models/bill.model.js";
import Payment from "../models/payment.model.js";
import { applyPaymentToBill } from "../controllers/payment.controller.js";

const config = {
  app_id: 2554,
  key1: "sdngKKJmqEMzvh5QQcdD2A9XBSKUNaYn",
  key2: "trMrHtvjo6myautxDUiAcYsVtaeQ8nhf",
  endpoint: "https://sb-openapi.zalopay.vn/v2/create",
  queryEndpoint: "https://sb-openapi.zalopay.vn/v2/query",
  // Sử dụng env variable cho callback URL - có thể dùng ngrok URL khi test
  callback_url: process.env.ZALOPAY_CALLBACK_URL || "http://localhost:3000/api/payment/zalopay/callback",
};

// ==============================
// Tạo order thanh toán ZaloPay
// ==============================
export const createZaloOrder = async (req, res) => {
  try {
    const { billId } = req.body;
    if (!billId) return res.status(400).json({ message: "Missing billId" });

    // Lấy bill và populate contract với roomId và tenantId (nếu có)
    const bill = await Bill.findById(billId).populate({
      path: "contractId",
      populate: [
        { path: "tenantId", select: "fullName email phone" },
        { path: "roomId", select: "roomNumber" },
      ],
    }).lean(); // Sử dụng lean() để lấy plain object, giữ nguyên tenantSnapshot

    if (!bill || !bill.contractId) {
      console.error("Missing contract data for bill:", billId);
      return res
        .status(400)
        .json({ message: "Hợp đồng không tồn tại" });
    }

    // Debug log
    console.log("Bill contractId:", bill.contractId._id);
    console.log("Has tenantId:", !!bill.contractId.tenantId);
    console.log("Has tenantSnapshot:", !!bill.contractId.tenantSnapshot);
    console.log("tenantSnapshot data:", bill.contractId.tenantSnapshot);

    // Lấy thông tin tenant từ tenantId hoặc tenantSnapshot
    let tenantInfo = null;
    
    // Ưu tiên lấy từ tenantId nếu có
    if (bill.contractId.tenantId) {
      tenantInfo = {
        fullName: bill.contractId.tenantId.fullName || "Khách thuê",
        email: bill.contractId.tenantId.email || "guest@example.com",
        phone: bill.contractId.tenantId.phone || "0000000000",
      };
      console.log("✅ Using tenantId:", tenantInfo);
    } 
    // Nếu không có tenantId, lấy từ tenantSnapshot
    else if (bill.contractId.tenantSnapshot) {
      tenantInfo = {
        fullName: bill.contractId.tenantSnapshot.fullName || "Khách thuê",
        email: bill.contractId.tenantSnapshot.email || "guest@example.com",
        phone: bill.contractId.tenantSnapshot.phone || "0000000000",
      };
      console.log("✅ Using tenantSnapshot:", tenantInfo);
    }

    if (!tenantInfo) {
      console.error("❌ Missing tenant info for bill:", billId);
      console.error("Contract data:", JSON.stringify(bill.contractId, null, 2));
      return res
        .status(400)
        .json({ message: "Không tìm thấy thông tin người thuê" });
    }

    // Kiểm tra nếu bill đã thanh toán rồi
    if (bill.status === "PAID") {
      return res
        .status(400)
        .json({ message: "Hóa đơn này đã được thanh toán" });
    }

    // Kiểm tra xem đã có payment nào của bill này chưa
    const existingPayment = await Payment.findOne({
      billId,
      provider: "ZALOPAY",
    }).sort({ createdAt: -1 });

    if (existingPayment) {
      if (existingPayment.status === "SUCCESS") {
        // Nếu đã thanh toán thành công rồi thì không tạo mới
        return res
          .status(400)
          .json({ message: "Hóa đơn này đã thanh toán thành công" });
      } else if (existingPayment.status === "PENDING") {
        // Nếu đang pending thì trả lại payment cũ với payUrl
        const metadata = existingPayment.metadata || {};
        const zaloResponse = metadata.zaloResponse || metadata.zaloData || {};
        const payUrl = zaloResponse.order_url || zaloResponse.orderurl;
        
        console.log("⚠️ Found existing PENDING payment");
        console.log("📦 Existing payment metadata:", metadata);
        console.log("🔗 Extracted payUrl:", payUrl);
        
        return res.status(200).json({
          message: "Đang có giao dịch ZaloPay đang chờ xử lý",
          zaloData: zaloResponse,
          payUrl: payUrl,
          paymentId: existingPayment._id,
          transactionId: existingPayment.transactionId,
          status: "PENDING",
        });
      }
    }

    const transID = Math.floor(Math.random() * 1000000);
    const returnUrl = process.env.ZALOPAY_RETURN_URL || "http://localhost:3000/api/payment/zalopay/return";
    const embed_data = {
      redirecturl: returnUrl,
      billId,
    };

    const items = [
      {
        itemid: billId,
        itemname:
          "Thanh toán hóa đơn phòng " + bill.contractId.roomId.roomNumber,
        itemprice: Math.round(Number(bill.amountDue)),
        itemquantity: 1,
      },
    ];

    const order = {
      app_id: config.app_id,
      app_trans_id: `${moment().format("YYMMDD")}_${transID}`,
      app_user: tenantInfo.fullName || "anonymous",
      app_time: Date.now(),
      item: JSON.stringify(items),
      embed_data: JSON.stringify(embed_data),
      amount: Math.round(Number(bill.amountDue)),
      description: `Thanh toán phòng ${bill.contractId.roomId?.roomNumber || 'N/A'} - ${tenantInfo.fullName}`,
      bank_code: "",
      callback_url: config.callback_url,
    };

    const data =
      config.app_id +
      "|" +
      order.app_trans_id +
      "|" +
      order.app_user +
      "|" +
      order.amount +
      "|" +
      order.app_time +
      "|" +
      order.embed_data +
      "|" +
      order.item;

    order.mac = CryptoJS.HmacSHA256(data, config.key1).toString();

    const zaloRes = await axios.post(config.endpoint, order);
    
    console.log("📤 ZaloPay API Response:", JSON.stringify(zaloRes.data, null, 2));

    // Lưu Payment trạng thái PENDING
    await Payment.create({
      billId,
      provider: "ZALOPAY",
      transactionId: order.app_trans_id,
      amount: mongoose.Types.Decimal128.fromString(Math.round(Number(bill.amountDue)).toFixed(2)),
      status: "PENDING",
      method: "REDIRECT",
      metadata: { createdFrom: "createZaloOrder", zaloResponse: zaloRes.data },
    });

    const responseData = {
      success: true,
      zaloData: zaloRes.data,
      payUrl: zaloRes.data?.order_url || zaloRes.data?.orderurl,
      transactionId: order.app_trans_id,
    };
    
    console.log("📤 Sending to frontend:", JSON.stringify(responseData, null, 2));

    return res.status(200).json(responseData);
  } catch (error) {
    console.error(
      "ZaloPay create order error:",
      error.response?.data || error.message
    );
    res.status(500).json({
      message: "Create ZaloPay order failed",
      error: error.response?.data || error.message,
    });
  }
};

// ==============================
// Callback từ ZaloPay (IPN - nguồn chân lý)
// ==============================
export const zaloCallback = async (req, res) => {
  let result = {};
  try {
    console.log("🔔 ZaloPay Callback received:", new Date().toISOString());
    
    const dataStr = req.body.data;
    const reqMac = req.body.mac;
    const mac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();

    if (reqMac !== mac) {
      console.log("❌ ZaloPay callback: Invalid MAC");
      result.return_code = -1;
      result.return_message = "mac not equal";
      return res.json(result);
    }

    const dataJson = JSON.parse(dataStr);
    const { app_trans_id, zp_trans_id, amount, return_code } = dataJson;
    
    console.log("📦 ZaloPay callback data:", {
      app_trans_id,
      zp_trans_id,
      amount,
      return_code,
      status: return_code === 1 ? "SUCCESS" : "FAILED"
    });

    // Tìm payment theo transactionId
    let payment = await Payment.findOne({ provider: "ZALOPAY", transactionId: app_trans_id });

    if (!payment) {
      result.return_code = 1;
      result.return_message = "Payment record not found";
      return res.json(result);
    }

    // Idempotency: nếu đã SUCCESS, return success
    if (payment.status === "SUCCESS") {
      result.return_code = 1;
      result.return_message = "Already processed";
      return res.json(result);
    }

    // ZaloPay return_code = 1 là thành công
    if (return_code === 1 && Number(amount) > 0) {
      console.log("✅ ZaloPay payment SUCCESS - Processing...");
      // Apply payment using shared helper (atomic) - tự động cập nhật bill status
      try {
        await applyPaymentToBill(payment, dataJson);
        console.log("✅ Payment applied successfully to bill");
        result.return_code = 1;
        result.return_message = "Confirm Success";
      } catch (e) {
        console.error("❌ applyPaymentToBill error (ZaloPay callback):", e);
        result.return_code = 0;
        result.return_message = "Internal error";
      }
    } else {
      // Mark failed
      payment.status = "FAILED";
      payment.metadata = { ...payment.metadata, callbackData: dataJson };
      await payment.save();
      result.return_code = 1;
      result.return_message = "Payment failed";
    }
  } catch (ex) {
    console.error("ZaloPay callback error:", ex);
    result.return_code = 0;
    result.return_message = ex.message || "Internal error";
  }

  res.json(result);
};

// ==============================
// Truy vấn trạng thái đơn hàng
// ==============================
export const queryZaloOrder = async (req, res) => {
  try {
    const { app_trans_id } = req.body;
    if (!app_trans_id)
      return res.status(400).json({ message: "Missing app_trans_id" });

    const data = config.app_id + "|" + app_trans_id + "|" + config.key1;
    const mac = CryptoJS.HmacSHA256(data, config.key1).toString();

    const response = await axios.post(config.queryEndpoint, null, {
      params: {
        app_id: config.app_id,
        app_trans_id,
        mac,
      },
    });

    return res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: "Query failed", error: error.message });
  }
};

// ==============================
// Kiểm tra trạng thái Payment trong database
// ==============================
export const checkPaymentStatus = async (req, res) => {
  try {
    const { billId, transactionId } = req.query;

    if (!billId && !transactionId) {
      return res
        .status(400)
        .json({ message: "Missing billId or transactionId" });
    }

    let query = { provider: "ZALOPAY" };
    if (billId) query.billId = billId;
    if (transactionId) query.transactionId = transactionId;

    const payment = await Payment.findOne(query).populate({
      path: "billId",
      populate: {
        path: "contractId",
        populate: [
          { path: "tenantId", select: "fullName email phone" },
          { path: "roomId", select: "roomNumber" },
        ],
      },
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    return res.json({
      payment: {
        _id: payment._id,
        billId: payment.billId,
        transactionId: payment.transactionId,
        amount: payment.amount.toString(),
        status: payment.status,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        bill: payment.billId
          ? {
              _id: payment.billId._id,
              status: payment.billId.status,
              amountDue: payment.billId.amountDue.toString(),
              contract: payment.billId.contractId
                ? {
                    _id: payment.billId.contractId._id,
                    tenant: payment.billId.contractId.tenantId,
                    room: payment.billId.contractId.roomId,
                  }
                : null,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Check payment status error:", error);
    res
      .status(500)
      .json({ message: "Check payment status failed", error: error.message });
  }
};

export const zaloReturn = async (req, res) => {
  try {
    console.log("🔙 ZaloPay Return received:", req.query);
    const { apptransid, status } = req.query;

    // Tìm payment theo transactionId
    const payment = await Payment.findOne({ provider: "ZALOPAY", transactionId: apptransid });
    if (!payment) {
      console.log("❌ Payment not found:", apptransid);
      return res.status(404).send("Payment record not found");
    }

    console.log("📦 Payment status:", payment.status);

    // Lưu return data vào metadata (không apply payment ở đây)
    if (!payment.metadata) payment.metadata = {};
    payment.metadata.returnData = req.query;
    await payment.save();

    // Redirect về frontend với thông báo thành công
    if (status === "1" || status === "success") {
      console.log("✅ Payment success - redirecting to frontend");
      
      // Redirect về trang quản lý checkin với thông báo
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const redirectUrl = `${frontendUrl}/admin/checkins?payment=success&provider=zalopay&transactionId=${apptransid}`;
      
      return res.redirect(redirectUrl);
    }

    // Failed
    console.log("❌ Payment failed or cancelled");
    payment.status = "FAILED";
    await payment.save();
    return res.send(`
      <html>
        <head>
          <title>Thanh toán thất bại</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 20px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            }
            h2 { color: #ff4d4f; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>❌ Thanh toán thất bại</h2>
            <p>Giao dịch đã bị hủy hoặc thất bại</p>
            <p style="margin-top: 20px;">
              <a href="javascript:window.close()">Đóng cửa sổ này</a>
            </p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("❌ ZaloPay return error:", error);
    return res.status(500).send("ZaloPay return failed.");
  }
};

export default {
  createZaloOrder,
  zaloCallback,
  queryZaloOrder,
  checkPaymentStatus,
  zaloReturn,
};
