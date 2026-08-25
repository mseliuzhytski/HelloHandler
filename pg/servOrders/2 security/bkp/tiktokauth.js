/**
 * tiktok-shop.js
 * ---------------------------------------------------------------
 * TikTok Shop (Partner API v2) integration mirroring the pattern
 * you already use for ShipStation:
 *
 *   GET /tiktokdailyopen    -> rows for orders awaiting shipment
 *   GET /tiktokdailyshipped -> rows for orders that shipped today
 *
 * Mount into your existing app.js with:
 *
 *   const tiktok = require("./tiktok-shop");
 *   tiktok.mount(app);
 *
 * REQUIRED ENV VARS (put in your .env / systemd unit / pm2 config):
 *   TT_APP_KEY
 *   TT_APP_SECRET
 *   TT_REDIRECT_URI        e.g. https://your-server.com/tiktok/oauth/callback
 *   TT_TOKEN_FILE           e.g. /home/ubuntu/tiktok-tokens.json (persists across restarts)
 *
 * ONE-TIME SETUP:
 *   1. Deploy this file, restart your server.
 *   2. In Partner Center, generate the "Authorize" link for your app and
 *      open it in a browser while logged in as your seller account.
 *   3. TikTok redirects to TT_REDIRECT_URI?code=XXXX&shop_region=US — this
 *      module's /tiktok/oauth/callback route catches that, exchanges the
 *      code for tokens, and writes them to TT_TOKEN_FILE. You only do this
 *      once (or again if you ever fully revoke authorization).
 *   4. After that, the module auto-refreshes the access_token before it
 *      expires, using the refresh_token, and rewrites TT_TOKEN_FILE.
 * ---------------------------------------------------------------
 */

const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");

const APP_KEY = process.env.TT_APP_KEY;
const APP_SECRET = process.env.TT_APP_SECRET;
const REDIRECT_URI = process.env.TT_REDIRECT_URI;
const TOKEN_FILE = process.env.TT_TOKEN_FILE || "./tiktok-tokens.json";

const AUTH_BASE = "https://auth.tiktok-shops.com"; // token exchange / refresh
const API_BASE = "https://open-api.tiktokglobalshop.com"; // data calls

// ---------------------------------------------------------------
// Token persistence (simple JSON file — swap for a DB if you prefer)
// ---------------------------------------------------------------
function loadTokens() {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
  } catch {
    return null; // not authorized yet
  }
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

// ---------------------------------------------------------------
// TikTok Shop request signing
// sign = HMAC_SHA256(key=app_secret, message = app_secret + path + sortedParams + app_secret)
// (Note: /token/get and /token/refresh use app_key/app_secret directly in the
//  querystring and are NOT signed the same way — see exchangeCodeForTokens.)
// ---------------------------------------------------------------
function signRequest(path, params) {
  const filteredKeys = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "access_token")
    .sort();

  const paramString = filteredKeys.map((k) => `${k}${params[k]}`).join("");
  const base = APP_SECRET + path + paramString + APP_SECRET;

  return crypto.createHmac("sha256", APP_SECRET).update(base).digest("hex");
}

async function signedRequest({ method = "GET", path, query = {}, body = null, accessToken }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const baseParams = {
    app_key: APP_KEY,
    timestamp,
    ...query,
  };
  const sign = signRequest(path, baseParams);

  const url = `${API_BASE}${path}`;
  const finalParams = { ...baseParams, sign };

  const response = await axios({
    method,
    url,
    params: finalParams,
    data: body,
    headers: {
      "content-type": "application/json",
      "x-tts-access-token": accessToken,
    },
  });

  return response.data;
}

// ---------------------------------------------------------------
// OAuth: exchange code -> tokens, and refresh
// ---------------------------------------------------------------
async function exchangeCodeForTokens(code) {
  const url = `${AUTH_BASE}/api/v2/token/get`;
  const response = await axios.get(url, {
    params: {
      app_key: APP_KEY,
      app_secret: APP_SECRET,
      auth_code: code,
      grant_type: "authorized_code",
    },
  });

  if (response.data.code !== 0) {
    throw new Error(`Token exchange failed: ${JSON.stringify(response.data)}`);
  }

  const { access_token, refresh_token, access_token_expire_in, shop_cipher } = response.data.data;
  const tokens = {
    access_token,
    refresh_token,
    shop_cipher,
    // expire_at as a real timestamp so we know when to refresh
    expire_at: Date.now() + access_token_expire_in * 1000,
  };
  saveTokens(tokens);
  return tokens;
}

async function refreshTokens(refresh_token) {
  const url = `${AUTH_BASE}/api/v2/token/refresh`;
  const response = await axios.get(url, {
    params: {
      app_key: APP_KEY,
      app_secret: APP_SECRET,
      refresh_token,
      grant_type: "refresh_token",
    },
  });

  if (response.data.code !== 0) {
    throw new Error(`Token refresh failed: ${JSON.stringify(response.data)}`);
  }

  const { access_token, refresh_token: newRefresh, access_token_expire_in, shop_cipher } =
    response.data.data;
  const tokens = {
    access_token,
    refresh_token: newRefresh,
    shop_cipher,
    expire_at: Date.now() + access_token_expire_in * 1000,
  };
  saveTokens(tokens);
  return tokens;
}

// Returns a live access_token + shop_cipher, refreshing first if needed
async function getValidTokens() {
  let tokens = loadTokens();
  if (!tokens) {
    throw new Error(
      "No TikTok tokens on file yet. Visit /tiktok/oauth/start to authorize your shop first."
    );
  }
  // Refresh if within 10 minutes of expiry
  if (Date.now() > tokens.expire_at - 10 * 60 * 1000) {
    tokens = await refreshTokens(tokens.refresh_token);
  }
  return tokens;
}

// ---------------------------------------------------------------
// Order fetch + flatten helpers
// ---------------------------------------------------------------
function todayRangeUnix() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return {
    ge: Math.floor(start.getTime() / 1000),
    le: Math.floor(end.getTime() / 1000),
  };
}

async function fetchOrders({ accessToken, shopCipher, orderStatus, updateTimeGe, updateTimeLe }) {
  const path = "/order/202309/orders/search";
  let allOrders = [];
  let pageToken = "";

  do {
    const body = {
      order_status: orderStatus,
      ...(updateTimeGe ? { update_time_ge: updateTimeGe } : {}),
      ...(updateTimeLe ? { update_time_le: updateTimeLe } : {}),
    };

    const query = {
      shop_cipher: shopCipher,
      page_size: 100,
      sort_field: "create_time",
      sort_order: "DESC",
      ...(pageToken ? { page_token: pageToken } : {}),
    };

    const data = await signedRequest({
      method: "POST",
      path,
      query,
      body,
      accessToken,
    });

    if (data.code !== 0) {
      throw new Error(`Order search failed: ${JSON.stringify(data)}`);
    }

    allOrders = allOrders.concat(data.data.orders || []);
    pageToken = data.data.next_page_token || "";
  } while (pageToken);

  return allOrders;
}

// Flatten TikTok orders -> one row per line item (mirrors your ShipStation shape)
function flattenOrders(orders) {
  const rows = [];
  for (const order of orders) {
    const items =
      order.line_items && order.line_items.length > 0
        ? order.line_items
        : [{ seller_sku: "NO ITEMS", sku_id: "", product_name: "" }];

    // TikTok typically returns one line_item entry per unit rather than a
    // quantity field. Group identical seller_sku entries within an order
    // and count them, but fall back to an explicit quantity field if present.
    const grouped = {};
    for (const item of items) {
      const sku = item.seller_sku || item.sku_id || "NO SKU";
      if (!grouped[sku]) {
        grouped[sku] = { sku, quantity: 0, skuStatus: item.seller_sku ? "sku" : "TikTok Sku" };
      }
      grouped[sku].quantity += item.quantity || 1;
    }

    for (const sku of Object.values(grouped)) {
      rows.push({
        orderNumber: order.id,
        sku: sku.sku,
        quantity: sku.quantity,
        skuStatus: sku.skuStatus,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------
// Express routes
// ---------------------------------------------------------------
function mount(app) {
  // Step: kick off authorization (open this URL in a browser once)
  app.get("/tiktok/oauth/start", (req, res) => {
    const authUrl = `https://services.tiktokshop.com/open/authorize?service_id=YOUR_SERVICE_ID`;
    res.send(
      `Open this in a browser while logged into your TikTok Shop seller account: <a href="${authUrl}">${authUrl}</a>` +
        ` (Find your exact service_id / authorize link in Partner Center > App > Authorization.)`
    );
  });

  // Step: TikTok redirects here after the seller approves
  app.get("/tiktok/oauth/callback", async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) return res.status(400).send("Missing ?code from TikTok redirect");
      const tokens = await exchangeCodeForTokens(code);
      console.log("✅ TikTok Shop authorized. shop_cipher:", tokens.shop_cipher);
      res.send("TikTok Shop connected successfully. You can close this tab.");
    } catch (err) {
      console.error("❌ TikTok OAuth callback error:", err.message);
      res.status(500).send("OAuth exchange failed: " + err.message);
    }
  });

  // GET /tiktokdailyopen — orders awaiting shipment
  app.get("/tiktokdailyopen", async (req, res) => {
    try {
      const { access_token, shop_cipher } = await getValidTokens();
      const orders = await fetchOrders({
        accessToken: access_token,
        shopCipher: shop_cipher,
        orderStatus: "AWAITING_SHIPMENT",
      });
      const rows = flattenOrders(orders);
      console.log(`📊 /tiktokdailyopen — ${orders.length} orders returned`);
      res.json({ orderCount: orders.length, rows });
    } catch (err) {
      console.error("❌ /tiktokdailyopen error:", err.message);
      res.status(500).json({ error: "Failed to fetch TikTok orders", detail: err.message });
    }
  });

  // GET /tiktokdailyshipped — orders that moved past awaiting_shipment today
  // NOTE: TikTok has no single "shipped" status. AWAITING_COLLECTION / IN_TRANSIT /
  // DELIVERED / COMPLETED all mean a shipping label exists. Confirm which
  // statuses apply to your fulfillment type (seller-fulfilled vs TikTok-fulfilled)
  // in Partner Center docs, and adjust the list below if needed.
  app.get("/tiktokdailyshipped", async (req, res) => {
    try {
      const { access_token, shop_cipher } = await getValidTokens();
      const { ge, le } = todayRangeUnix();

      const shippedStatuses = ["AWAITING_COLLECTION", "IN_TRANSIT", "DELIVERED", "COMPLETED"];
      let allOrders = [];
      for (const status of shippedStatuses) {
        const orders = await fetchOrders({
          accessToken: access_token,
          shopCipher: shop_cipher,
          orderStatus: status,
          updateTimeGe: ge,
          updateTimeLe: le,
        });
        allOrders = allOrders.concat(orders);
      }

      const rows = flattenOrders(allOrders);
      console.log(`📊 /tiktokdailyshipped — ${allOrders.length} orders returned`);
      res.json({ orderCount: allOrders.length, rows });
    } catch (err) {
      console.error("❌ /tiktokdailyshipped error:", err.message);
      res.status(500).json({ error: "Failed to fetch TikTok orders", detail: err.message });
    }
  });
}

module.exports = { mount };