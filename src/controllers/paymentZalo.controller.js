import axios from "axios";
import moment from "moment";
import CryptoJS from "crypto-js";
import Bill from "../models/bill.model.js";
import Payment from "../models/payment.model.js";

const config = {
  app_id: 2554,
  key1: "sdngKKJmqEMzvh5QQcdD2A9XBSKUNaYn",
  key2: "trMrHtvjo6myautxDUiAcYsVtaeQ8nhf",
  endpoint: "https://sb-openapi.zalopay.vn/v2/create",
  queryEndpoint: "https://sb-openapi.zalopay.vn/v2/query",
  callback_url: "http://localhost:3000/api/payment/zalopay/callback", // Cập nhật URL callback thực tế
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
      console.error("❌ Missing tenant data for bill:", billId);
      return res
        .status(400)
        .json({ message: "Hợp đồng hoặc người thuê không tồn tại" });
    }

    const transID = Math.floor(Math.random() * 1000000);
    const embed_data = {
      redirecturl: `http://localhost:5173/payment-result?paymentMethod=zalopay&billId=${billId}`,
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
      amount: bill.amountDue,
      status: "PENDING",
      metadata: zaloRes.data,
    });

    return res.status(200).json({
      zaloData: zaloRes.data,
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
// Callback từ ZaloPay
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
    } else {
      const dataJson = JSON.parse(dataStr);
      const { app_trans_id, amount } = dataJson;

      const payment = await Payment.findOneAndUpdate(
        { provider: "ZALOPAY", transactionId: app_trans_id },
        { status: "SUCCESS", metadata: dataJson },
        { new: true }
      );

      if (payment) {
        await Bill.findByIdAndUpdate(payment.billId, {
          status: "PAID",
          $push: {
            payments: {
              paidAt: new Date(),
              amount: amount,
              method: "ZALOPAY",
              provider: "ZALOPAY",
              transactionId: app_trans_id,
            },
          },
        });
      }

      result.return_code = 1;
      result.return_message = "success";
    }
  } catch (ex) {
    result.return_code = 0;
    result.return_message = ex.message;
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

export default {
  createZaloOrder,
  zaloCallback,
  queryZaloOrder,
  checkPaymentStatus,
};
