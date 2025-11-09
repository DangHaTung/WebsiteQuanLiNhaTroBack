import mongoose from "mongoose";
import axios from "axios";
import moment from "moment";
import CryptoJS from "crypto-js";
import Bill from "../models/bill.model.js";
import Payment from "../models/payment.model.js";
import { applyPaymentToBill } from "../controllers/payment.controller.js";

const config = {
  app_id: process.env.ZALOPAY_APP_ID,
  key1: process.env.ZALOPAY_KEY1,
  key2: process.env.ZALOPAY_KEY2,
  endpoint: process.env.ZALOPAY_ENDPOINT,
  queryEndpoint: process.env.ZALOPAY_QUERY_ENDPOINT,
  callback_url: process.env.ZALOPAY_CALLBACK_URL, // Cập nhật URL callback thực tế
};  

// ==============================
// Tạo order thanh toán ZaloPay
// ==============================
export const createZaloOrder = async (req, res) => {
  try {
    const { billId } = req.body;
    if (!billId) return res.status(400).json({ message: "Missing billId" });

    const bill = await Bill.findById(billId).populate({
      path: "contractId",
      populate: [
        { path: "tenantId", select: "fullName email phone" },
        { path: "roomId", select: "roomNumber" },
      ],
    });

    if (!bill || !bill.contractId || !bill.contractId.tenantId) {
      console.error("Missing tenant data for bill:", billId);
      return res
        .status(400)
        .json({ message: "Hợp đồng hoặc người thuê không tồn tại" });
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
        // Nếu đang pending thì trả lại payment cũ
        return res.status(200).json({
          message: "Đang có giao dịch ZaloPay đang chờ xử lý",
          zaloData:
            existingPayment.metadata?.zaloData || existingPayment.metadata,
          paymentId: existingPayment._id,
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
      app_user: bill.contractId.tenantId.fullName || "anonymous",
      app_time: Date.now(),
      item: JSON.stringify(items),
      embed_data: JSON.stringify(embed_data),
      amount: Math.round(Number(bill.amountDue)),
      description: `Thanh toán hợp đồng ${bill.contractId._id}`,
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

    return res.status(200).json({
      success: true,
      zaloData: zaloRes.data,
      payUrl: zaloRes.data?.order_url || zaloRes.data?.orderurl,
      transactionId: order.app_trans_id,
    });
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
    const dataStr = req.body.data;
    const reqMac = req.body.mac;
    const mac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();

    if (reqMac !== mac) {
      result.return_code = -1;
      result.return_message = "mac not equal";
      return res.json(result);
    }

    const dataJson = JSON.parse(dataStr);
    const { app_trans_id, zp_trans_id, amount, return_code } = dataJson;

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
      // Apply payment using shared helper (atomic) - tự động cập nhật bill status
      try {
        await applyPaymentToBill(payment, dataJson);
        result.return_code = 1;
        result.return_message = "Confirm Success";
      } catch (e) {
        console.error("applyPaymentToBill error (ZaloPay callback):", e);
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
    const { apptransid, status } = req.query;

    // Tìm payment theo transactionId
    const payment = await Payment.findOne({ provider: "ZALOPAY", transactionId: apptransid });
    if (!payment) {
      return res.status(404).send("Payment record not found");
    }

    if (payment.status === "SUCCESS") {
      // Đã xử lý rồi, redirect về frontend
      const successUrl = process.env.FRONTEND_SUCCESS_URL || "http://localhost:5173/payment-success";
      const qs = new URLSearchParams({
        orderId: String(apptransid || ""),
        amount: String(payment.amount.toString() || ""),
      }).toString();
      return res.redirect(`${successUrl}?${qs}`);
    }

    // Nếu chưa success, thử apply payment nếu status = success từ query (fallback khi test local)
    if (status === "1" || status === "success") {
      try {
        await applyPaymentToBill(payment, req.query);
        const successUrl = process.env.FRONTEND_SUCCESS_URL || "http://localhost:5173/payment-success";
        const qs = new URLSearchParams({
          orderId: String(apptransid || ""),
          amount: String(payment.amount.toString() || ""),
        }).toString();
        return res.redirect(`${successUrl}?${qs}`);
      } catch (e) {
        console.error("applyPaymentToBill error (ZaloPay return):", e);
        return res.status(500).send("Server error while applying payment");
      }
    }

    // Failed
    payment.status = "FAILED";
    payment.metadata = { ...payment.metadata, returnData: req.query };
    await payment.save();
    return res.send("Payment failed or cancelled");
  } catch (error) {
    console.error("ZaloPay return error:", error);
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
