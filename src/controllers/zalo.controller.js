// src/controllers/demoZalo.controller.js
import axios from "axios";
import CryptoJS from "crypto-js";
import moment from "moment";

// Config giả lập
const config = {
  app_id: 1234,
  key1: "demoKey1",
  key2: "demoKey2",
  endpoint: "https://demo.zalopay.vn/v2/create",
  queryEndpoint: "https://demo.zalopay.vn/v2/query",
  callback_url: "http://localhost:3000/api/demo/zalopay/callback",
};

// ==============================
// Tạo order mẫu
// ==============================
export const createDemoOrder = async (req, res) => {
  try {
    const { amount, userName } = req.body;
    if (!amount || !userName) {
      return res.status(400).json({ message: "Missing amount or userName" });
    }

    const transID = Math.floor(Math.random() * 1000000);
    const order = {
      app_id: config.app_id,
      app_trans_id: `${moment().format("YYMMDD")}_${transID}`,
      app_user: userName,
      app_time: Date.now(),
      amount,
      description: `Demo payment for ${userName}`,
      callback_url: config.callback_url,
    };

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

    // Giả lập request tới ZaloPay (không thực sự gọi API)
    const demoResponse = {
      return_code: 1,
      return_message: "Demo order created",
      order_url: `http://demo.zalopay.vn/pay/${order.app_trans_id}`,
    };

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
    if (!data || !mac) {
      return res.json({ return_code: -1, return_message: "Missing data or mac" });
    }

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

    // Giả lập response
    const demoStatus = {
      app_trans_id,
      status: "SUCCESS",
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
export const demoReturn = async (req, res) => {
  try {
    const { apptransid, status } = req.query;

    const redirectUrl = `http://localhost:5173/demo?apptransid=${apptransid}&status=${status}`;
    console.log("🔗 Redirecting demo return to:", redirectUrl);

    res.redirect(redirectUrl);
  } catch (error) {
    console.error("❌ demoReturn error:", error);
    res.status(500).send("Demo return failed");
  }
};

export default {
  createDemoOrder,
  demoCallback,
  queryDemoOrder,
  demoReturn,
};
