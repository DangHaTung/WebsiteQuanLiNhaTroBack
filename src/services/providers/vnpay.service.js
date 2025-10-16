// src/services/providers/vnpay.service.js
import crypto from "crypto";
import qs from "qs";

/**
 * VNPay service
 * - Build payment URL
 * - Verify response (return / ipn)
 *
 * Env vars expected:
 *  - VNP_TMNCODE
 *  - VNP_HASHSECRET
 *  - VNP_URL (optional)
 *  - VNP_RETURN_URL (optional)
 *  - VNP_MULTIPLY_100 (true/false)
 *  - VNP_SECURE_HASH_TYPE (HMACSHA512 or SHA256)
 *  - VNP_DEBUG (optional, true to log signData and hashes for debugging)
 */

// Basic config loaded from env
const tmnCode = (process.env.VNP_TMNCODE || "").trim();
const secretKeyRaw = process.env.VNP_HASHSECRET || "";
const secretKey = secretKeyRaw && secretKeyRaw.trim();
const vnpUrl = process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
const vnpReturnUrl = process.env.VNP_RETURN_URL || "";
const multiply100 = String(process.env.VNP_MULTIPLY_100 || "").toLowerCase() === "true";
const secureHashType = (process.env.VNP_SECURE_HASH_TYPE || "HMACSHA512").toUpperCase();
const debug = String(process.env.VNP_DEBUG || "").toLowerCase() === "true";

// Fail fast: require key pieces
if (!tmnCode) {
  throw new Error("VNP_TMNCODE not defined in environment");
}
if (!secretKey) {
  throw new Error("VNP_HASHSECRET not defined in environment");
}
if (!vnpReturnUrl) {
  // Not fatal but warn
  console.warn("Warning: VNP_RETURN_URL not defined. VNPay return URL may be incorrect.");
}

// Map secureHashType to algorithm
function hashAlgoFromType(type) {
  if (!type) return "sha512";
  const t = String(type).toUpperCase();
  if (t === "SHA256") return "sha256";
  // default HMACSHA512
  return "sha512";
}
const defaultAlgo = hashAlgoFromType(secureHashType);

/**
 * Helper: build sorted & filtered params object (no secure hash fields)
 */
function buildFilteredParams(paramsObj) {
  const filtered = {};
  Object.keys(paramsObj)
    .sort()
    .forEach((k) => {
      const v = paramsObj[k];
      if (v !== undefined && v !== null && v !== "") {
        filtered[k] = v;
      }
    });
  return filtered;
}

/**
 * Build VNPay payment URL
 * params: { amount, orderId, orderInfo, locale, bankCode, ipAddr }
 * amount: number (VND). If multiply100=true, will be multiplied by 100 before sending to VNPay.
 *
 * Returns: { paymentUrl, filtered, signData, secureHash }
 */
function buildVnPayUrl({ amount, orderId, orderInfo = "", locale = "vn", bankCode, ipAddr = "" } = {}) {
  let vnpAmount = parseInt(amount, 10) || 0;
  if (multiply100) vnpAmount = vnpAmount * 100;

  const createDate = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14); // YYYYMMDDhhmmss
  const orderType = "other";

  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Locale: locale || "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: String(orderId),
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: orderType,
    vnp_Amount: String(vnpAmount),
    vnp_ReturnUrl: vnpReturnUrl,
    vnp_CreateDate: createDate,
  };

  if (bankCode) params.vnp_BankCode = bankCode;
  if (ipAddr) params.vnp_IpAddr = ipAddr;

  // Filter out empty and sort keys
  const filtered = buildFilteredParams(params);

  // Build sign data: VNPay expects "key=value&key2=value2" sorted by key, without URL-encoding for signature
  const signData = new URLSearchParams(filtered).toString();

  // Generate secure hash
  const algo = hashAlgoFromType(secureHashType);
  let secureHash = "";
  if (algo === "sha256") {
    // VNPay legacy SHA256 expects secret + signData (some docs)
    secureHash = crypto.createHash("sha256").update(secretKey + signData).digest("hex");
  } else {
    // HMAC-SHA512
    secureHash = crypto.createHmac("sha512", secretKey).update(signData).digest("hex");
  }

  // Build final query (URL-encoded) and include vnp_SecureHash & vnp_SecureHashType
  const query = qs.stringify(filtered, { encode: true });
  const paymentUrl = `${vnpUrl}?${query}&vnp_SecureHash=${secureHash}&vnp_SecureHashType=${secureHashType}`;

  if (debug) {
    // Be careful with logging secrets in production; debug flag controls this.
    console.log("VNPAY build debug:", {
      filtered,
      signData,
      secureHash,
      paymentUrl: paymentUrl.replace(secretKey, "[REDACTED]"),
    });
  }

  return { paymentUrl, filtered, signData, secureHash };
}

/**
 * Verify VNPAY response (return or ipn)
 * Input: an object of query params received from vnpay (req.query or req.body)
 * Returns: { valid: bool, calculatedHash, receivedHash, signData, filtered }
 */
function verifyVnPayResponse(queryParams = {}) {
  // Make a shallow clone
  const params = { ...queryParams };

  // Extract received hash and hash type (if provided)
  const receivedHash = params.vnp_SecureHash ? String(params.vnp_SecureHash) : "";
  const receivedHashType = params.vnp_SecureHashType ? String(params.vnp_SecureHashType).toUpperCase() : secureHashType;

  // Remove secure fields for sign calculation
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  // Build filtered & sorted params
  const filtered = buildFilteredParams(params);

  // Build signData (same as build: encode:false)
  const signData = new URLSearchParams(filtered).toString();

  // Calculate hash using same algorithm
  const algo = hashAlgoFromType(receivedHashType);
  let calculatedHash = "";
  if (algo === "sha256") {
    calculatedHash = crypto.createHash("sha256").update(secretKey + signData).digest("hex");
  } else {
    calculatedHash = crypto.createHmac("sha512", secretKey).update(signData).digest("hex");
  }

  const valid = calculatedHash === (receivedHash || "");

  if (debug) {
    console.log("VNPAY verify debug:", {
      receivedHash,
      receivedHashType,
      filtered,
      signData,
      calculatedHash,
      valid,
    });
  }

  return { valid, calculatedHash, receivedHash, signData, filtered };
}

export default { buildVnPayUrl, verifyVnPayResponse };
