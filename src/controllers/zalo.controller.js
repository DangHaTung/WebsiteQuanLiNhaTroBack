// src/controllers/demoZalo.controller.js

import axios from "axios";
import CryptoJS from "crypto-js";
import moment from "moment";

// ==============================
// Cấu hình demo ZaloPay
// ==============================
const config = {
  app_id: 1234, // ID app demo
  key1: "demoKey1", // Key1 dùng để tạo mac khi tạo order
  key2: "demoKey2", // Key2 dùng để verify callback
  endpoint: "https://demo.zalopay.vn/v2/create", // endpoint tạo order demo
  queryEndpoint: "https://demo.zalopay.vn/v2/query", // endpoint query order demo
  callback_url: "http://localhost:3000/api/demo/zalopay/callback", // callback URL demo
};

// ==============================
// Tạo order mẫu
// ==============================
export const createDemoOrder = async (req, res) => {
  try {
    const { amount, userName } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!amount || !userName) {
      return res.status(400).json({ message: "Missing amount or userName" });
    }

    // Tạo transaction id giả lập
    const transID = Math.floor(Math.random() * 1000000);
    const order = {
      app_id: config.app_id,
      app_trans_id: `${moment().format("YYMMDD")}_${transID}`, // id duy nhất theo ngày
      app_user: userName, // tên người dùng demo
      app_time: Date.now(), // timestamp
      amount, // số tiền thanh toán
      description: `Demo payment for ${userName}`,
      callback_url: config.callback_url,
    };

    // Tạo mac để gửi lên ZaloPay
    const dataStr =
      order.app_id +
      "|" +
      order.app_trans_id +
      "|" +
      order.app_user +
      "|" +
      order.amount +
      "|" +
      order.app_time;

    order.mac = CryptoJS.HmacSHA256(dataStr, config.key1).toString();

    console.log("📤 Sending demo order:", order);

    // Giả lập response từ ZaloPay (không thực sự gọi API)
    const demoResponse = {
      return_code: 1,
      return_message: "Demo order created",
      order_url: `http://demo.zalopay.vn/pay/${order.app_trans_id}`,
    };

    // Trả dữ liệu về frontend
    res.status(200).json({
      success: true,
      message: "Demo ZaloPay order created",
      orderData: demoResponse,
    });
  } catch (error) {
    console.error("❌ createDemoOrder error:", error);
    res.status(500).json({ message: "Demo order creation failed" });
  }
};

// ==============================
// Callback mẫu
// ==============================
export const demoCallback = async (req, res) => {
  try {
    const { data, mac } = req.body || {};

    // Kiểm tra dữ liệu callback
    if (!data || !mac) {
      return res.json({ return_code: -1, return_message: "Missing data or mac" });
    }

    // Xác thực MAC
    const calculatedMac = CryptoJS.HmacSHA256(data, config.key2).toString();
    if (mac !== calculatedMac) {
      return res.json({ return_code: -1, return_message: "Invalid MAC" });
    }

    console.log("🔔 Demo callback received:", JSON.parse(data));

    // Trả về success cho ZaloPay
    res.json({ return_code: 1, return_message: "Demo callback success" });
  } catch (error) {
    console.error("❌ demoCallback error:", error);
    res.json({ return_code: 0, return_message: error.message });
  }
};

// ==============================
// Query trạng thái mẫu
// ==============================
export const queryDemoOrder = async (req, res) => {
  try {
    const { app_trans_id } = req.body;

    if (!app_trans_id) {
      return res.status(400).json({ message: "Missing app_trans_id" });
    }

    console.log("🔍 Querying demo order:", app_trans_id);

    // Giả lập response trạng thái đơn hàng
    const demoStatus = {
      app_trans_id,
      status: "SUCCESS", // demo luôn success
      amount: 10000, 
      description: "Demo payment",
    };

    res.json(demoStatus);
  } catch (error) {
    console.error("❌ queryDemoOrder error:", error);
    res.status(500).json({ message: "Demo query failed" });
  }
};

// ==============================
// Return URL mẫu (redirect)
// ==============================
export const demoReturn = async (req, res) => {
  try {
    const { apptransid, status } = req.query;

    // Redirect về frontend demo
    const redirectUrl = `http://localhost:5173/demo?apptransid=${apptransid}&status=${status}`;
    console.log("🔗 Redirecting demo return to:", redirectUrl);

    res.redirect(redirectUrl);
  } catch (error) {
    console.error("❌ demoReturn error:", error);
    res.status(500).send("Demo return failed");
  }
};

// ==============================
// Export tất cả các function demo
// ==============================
export default {
  createDemoOrder,
  demoCallback,
  queryDemoOrder,
  demoReturn,
};
