/**
 * ShipStation Packing Station Backend
 * Node.js / Express server for AWS
 * 
 * https://api.ancienthowl.net
 */

const express = require("express");
const cors    = require("cors");
const axios   = require("axios");
const crypto = require("crypto");
const fs = require("fs");
require("dotenv").config();

const TKTK_KEY = process.env.TT_APP_KEY;
const TKTK_SECRET = process.env.TT_APP_SECRET;
const TKTK_URI = process.env.TT_REDIRECT_URI;
const TKTK_FILE = process.env.TT_TOKEN_FILE || "./tiktok-tokens.json";

const TKTK_AUTH_BASE = "https://auth.tiktok-shops.com"; // token exchange / refresh
const TKTK_API_BASE = "https://open-api.tiktokglobalshop.com"; // data calls

const app  = express();
const PORT = process.env.PORT || 3000;
const path = require("path");

app.use(cors(
  /*{
    origin: "http://localhost:8000",
    credentials: true
  }*/
));
app.use(express.json());

// ─── API Key Auth Middleware ───────────────────────────────────────────────────
const API_KEY = process.env.API_KEY;
const SITE_PASSWORD = "Argo";
const COOKIE_SECRET = "abc123FOG";

if (!API_KEY) {
  console.error("❌  Missing API_KEY in .env");
  process.exit(1);
}

// ShipStation webhook calls POST /webhook without an API key,
// so we skip key check for that route and require it everywhere else.
function requireApiKey(req, res, next) {

  // Cookie Session
  if (req.path === "/authsessionin" && req.method === "POST"){
    console.warn(`✅-Authorized-from ${req.ip} || ${req.headers["x-forwarded-for"]} at ${new Date().toLocaleString("en-US",{timeZone: "America/New_York"})} to ${req.method} ${req.path}`);
    return next();
  }

  //console.log(req.headers);
  //console.log(req.headers.cookie || "wrong guess");
  const sessionCond = req.headers.cookie || "";
  if(sessionCond && sessionCond.length > 0 && sessionCond === "hallpass="+COOKIE_SECRET){ 
    console.warn(`✅-Authorized-from ${req.ip} || ${req.headers["x-forwarded-for"]} at ${new Date().toLocaleString("en-US",{timeZone: "America/New_York"})} to ${req.method} ${req.path}`);
    return next();
  }
  /*if(false){
    const raw = req.cookies.hallpass || "";
    console.log("hallpass:",raw);
    const [payload, sig] = raw.split(".");
    const xencr = crypto.createHmac("sha256", payload).update(xword).digest("hex");
    const expected = payload ? xencr : "";
    if (!payload || !sig || sig.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
          console.log("❌  Cookie testing gone wrong");
          return res.state(401);
    }
    return next();
  }*/

  // Allow ShipStation webhooks through without a key —
  // they are already IP-restricted at the Nginx level.
  if (req.path === "/webhook" && req.method === "POST") {
    console.warn(`✅-Authorized-from ${req.ip} || ${req.headers["x-forwarded-for"]} at ${new Date().toLocaleString("en-US",{timeZone: "America/New_York"})} to ${req.method} ${req.path}`);
    return next();
  }
  //"/tiktokrcw/callback"
  if (req.path === "/tiktokrcw/callback" && req.method === "GET"){
    console.warn(`✅-Authorized-from ${req.ip} || ${req.headers["x-forwarded-for"]} at ${new Date().toLocaleString("en-US",{timeZone: "America/New_York"})} to ${req.method} ${req.path}`);
    return next();
  }

  const key = req.headers["x-api-key"];
  if (!key || key !== API_KEY) {
    console.warn(`🚫-Unauthorized-from ${req.ip} || ${req.headers["x-forwarded-for"]} at ${new Date().toLocaleString("en-US",{timeZone: "America/New_York"})} to ${req.method} ${req.path}`);
    return res.status(401).json({ error: "Unauthorized — missing or invalid API key" });
  } else {
    console.warn(`✅-Authorized-from ${req.ip} || ${req.headers["x-forwarded-for"]} at ${new Date().toLocaleString("en-US",{timeZone: "America/New_York"})} to ${req.method} ${req.path}`);
  }
  next();
}

app.use(requireApiKey);

// ─── In-Memory Store ──────────────────────────────────────────────────────────
// Map<trackingNumber, { orderNumber, trackingNumber, items, receivedAt }>
const shipmentsStore = new Map();
const INVENTORY_FILE = path.join(__dirname, "count-inventory.json");
const INVENTORY_FILE_COMPLETE = path.join(__dirname, "count-inventory-complete.json");
let countPayloadStart = null;

// ─── ShipStation Auth ─────────────────────────────────────────────────────────
const SS_API_KEY    = process.env.SS_API_KEY;
const SS_API_SECRET = process.env.SS_API_SECRET;

if (!SS_API_KEY || !SS_API_SECRET) {
  console.error("❌  Missing SS_API_KEY or SS_API_SECRET in .env");
  process.exit(1);
}

const ssAuthHeader = "Basic " + Buffer.from(`${SS_API_KEY}:${SS_API_SECRET}`).toString("base64");

// ─── ShipStation API Helper ───────────────────────────────────────────────────
async function fetchShipmentFromSS(resourceUrl) {
  const url = new URL(resourceUrl);

  // ShipStation webhook sends `shipmentId` but the value is actually orderId
  if (url.searchParams.has("shipmentId")) {
    const id = url.searchParams.get("shipmentId");
    url.searchParams.delete("shipmentId");
    url.searchParams.set("orderId", id);
    console.log(`   🔄 Rewrote shipmentId → orderId: ${id}`);
  }

  url.searchParams.set("includeShipmentItems", "true");
  url.searchParams.set("pageSize", "500");
  const finalUrl = url.toString();
  console.log(`   🌐 ${finalUrl}`);

  const response = await axios.get(finalUrl, {
    headers: { Authorization: ssAuthHeader, "Content-Type": "application/json" },
  });
  return response.data;
}

// ─── Core: process a resource_url and store shipments ─────────────────────────
async function processResourceUrl(resource_url) {
  const shipmentData = await fetchShipmentFromSS(resource_url);
  const shipments    = shipmentData.shipments || [shipmentData];
  console.log(`   📋 Shipments to process: ${shipments.length}`);

  const stored = [];

  for (const shipment of shipments) {
    const { trackingNumber, orderId, orderNumber, voided } = shipment;
    console.log(`   🔍 order: ${orderNumber} | tracking: ${trackingNumber} | voided: ${voided}`);

    if (!trackingNumber || voided) {
      console.warn("   ⚠️  No authentic tracking number, skipping.");
      continue;
    }

    const items = (shipment.shipmentItems && shipment.shipmentItems.length > 0)
      ? shipment.shipmentItems.map(i => ({ sku: i.sku || "NO-SKU", quantity: i.quantity, name: i.name || "" }))
      : [];

    if (items.length === 0) console.warn(`   ⚠️  No items found for tracking ${trackingNumber}`);

    const record = { orderNumber, trackingNumber, items, receivedAt: new Date().toISOString() };
    shipmentsStore.set(trackingNumber, record);
    stored.push(record);
    console.log(`   ✅ Stored — Order: ${orderNumber} | Tracking: ${trackingNumber} | Items: ${items.length}`);
  }

  return stored;
}

// ---------------------------------------------------------------
// OAuth: exchange code -> tokens, and refresh
// ---------------------------------------------------------------
async function exchangeCodeForTokens(code) {
  const url = `${TKTK_AUTH_BASE}/api/v2/token/get`;
  const response = await axios.get(url, {
    params: {
      app_key: TKTK_KEY,
      app_secret: TKTK_SECRET,
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
  const url = `${TKTK_AUTH_BASE}/api/v2/token/refresh`;
  const response = await axios.get(url, {
    params: {
      app_key: TKTK_KEY,
      app_secret: TKTK_SECRET,
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
// Token persistence (simple JSON file — swap for a DB if you prefer)
// ---------------------------------------------------------------
function loadTokens() {
  try {
    return JSON.parse(fs.readFileSync(TKTK_FILE, "utf8"));
  } catch {
    return null; // not authorized yet
  }
}

function saveTokens(tokens) {
  fs.writeFileSync(TKTK_FILE, JSON.stringify(tokens, null, 2));
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
  const base = TKTK_SECRET + path + paramString + TKTK_SECRET;

  return crypto.createHmac("sha256", TKTK_SECRET).update(base).digest("hex");
}

async function signedRequest({ method = "GET", path, query = {}, body = null, accessToken }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const baseParams = {
    app_key: TKTK_KEY,
    timestamp,
    ...query,
  };
  const sign = signRequest(path, baseParams);

  const url = `${TKTK_API_BASE}${path}`;
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

// ─── Routes ───────────────────────────────────────────────────────────────────

// Session Cookie
app.post("/authsessionin", async (req, res) => {
  const { password } = req.body;
  if (password !== SITE_PASSWORD) {
    console.log("❌ session attempt failure")
    return res.status(401).send("Invalid password");
  }
  res.cookie("hallpass",COOKIE_SECRET,{
    httpOnly: true,   
    secure: true,     
    sameSite: "strict",  
    maxAge: 1000 * 60 * 60 * 24 * 365 * 10 // effectively "no timeframe"
  })
  /*const xword = "gandalf";
  const xencr = crypto.createHmac("sha256", COOKIE_SECRET).update(xword).digest("hex");
  res.cookie("hallpass", `${xword}.${xencr}`, {   
    httpOnly: true,   // JS on the page can't read/steal it
    secure: true,     // only sent over HTTPS
    sameSite: "strict",  // strict vs lax
    maxAge: 1000 * 60 * 60 * 24 * 365 * 10 // effectively "no timeframe"
  });*/
  console.log("✅ Someone got a cookie 🍪")
  res.status(200).send("✅ Have a cookie 🍪");
});

app.get("/authsessionstate", async(req,res)=>{
  console.log("✅ Security check completed");
  res.status(200).send("Session confirmed");
});

app.post("/authsessionout", async(req,res)=>{
  res.cookie("hallpass","",{
    httpOnly: true,   
    secure: true,     
    sameSite: "strict",  
    maxAge: 0 // effectively "no timeframe"
  })
  console.log("✅ Cookie 🍪 was giventh, cookie 🍪 has been takenth")
  res.status(200).send("Session terminated");
});

//
// POST /count-inventory-persist
//
app.post("/count-inventory-persist", (req, res) => {
  try {
    const payload = req.body;

    fs.writeFileSync(
      INVENTORY_FILE,
      JSON.stringify(payload, null, 2),
      "utf8"
    );

    res.status(200).json({
      success: true,
      message: "Inventory payload persisted successfully"
    });
    console.log(" ✅  Saved locally Count State"); 
  } catch (error) {
    console.error("Error persisting inventory:", error);

    res.status(500).json({
      success: false,
      message: "Failed to persist inventory"
    });
    console.log(" ❌  Count State did not save");
  }
});

//
// GET /count-inventory-persist
//
app.get("/count-inventory-persist", (req, res) => {
  try {
    if (!fs.existsSync(INVENTORY_FILE)) {
      return res.status(404).json({
        success: false,
        message: "No persisted inventory found"
      });
    }

    const fileContents = fs.readFileSync(INVENTORY_FILE, "utf8");
    const payload = JSON.parse(fileContents);
     
    res.status(200).json(payload);
    console.log(" ✅  Count State copy transfered"); 
  } catch (error) {
    console.error(" ❌  Error reading inventory:", error);

    res.status(500).json({
      success: false,
      message: "Failed to read persisted inventory"
    });
  }
});

//
// POST /count-inventory-complete
//
app.post("/count-inventory-complete", (req, res) => {
  try {
    const payload = req.body;

    // Split payload based on the condition at index 9
    const completeItems = payload.filter(item => item[9] === true);
    const incompleteItems = payload.filter(item => item[9] === false);

    // Save complete items
    fs.writeFileSync(
      INVENTORY_FILE_COMPLETE,
      JSON.stringify(completeItems, null, 2),
      "utf8"
    );

    // Save incomplete items
    fs.writeFileSync(
      INVENTORY_FILE,
      JSON.stringify(incompleteItems, null, 2),
      "utf8"
    );

    res.status(200).json({
      success: true,
      message: "Inventory payloads persisted successfully",
      completeCount: completeItems.length,
      incompleteCount: incompleteItems.length
    });

    console.log(
      `✅ Saved ${completeItems.length} complete items to Complete Count State`
    );
    console.log(
      `✅ Saved ${incompleteItems.length} incomplete items to Inventory State`
    );

  } catch (error) {
    console.error("Error persisting inventory:", error);

    res.status(500).json({
      success: false,
      message: "Failed to persist inventory"
    });

    console.log("❌ Inventory-complete state did not save");
  }
});

//
// GET /count-inventory-complete
//
app.get("/count-inventory-complete", (req, res) => {
  try {
    if (!fs.existsSync(INVENTORY_FILE_COMPLETE)) {
      return res.status(404).json({
        success: false,
        message: "No persisted inventory found"
      });
    }

    const fileContents = fs.readFileSync(INVENTORY_FILE_COMPLETE, "utf8");
    const payload = JSON.parse(fileContents);
     
    res.status(200).json(payload);
    console.log(" ✅  Complete Count State copy transfered"); 
  } catch (error) {
    console.error(" ❌  Error reading inventory-complete:", error);

    res.status(500).json({
      success: false,
      message: "Failed to read persisted inventory"
    });
  }
});

/**
 * POST /webhook
 * Called by ShipStation (SHIP_NOTIFY) OR by the static HTML page when a
 * tracking number is entered manually.
 *
 * Accepts two formats:
 *   1. ShipStation native:  { resource_type, resource_url }
 *   2. Manual from HTML:    { resource_type, resource_url }
 *      where resource_url = "https://ssapi.shipstation.com/shipments?trackingNumber=XXXXX"
 */
app.post("/webhook", async (req, res) => {
  const { resource_url, resource_type } = req.body;

  console.log(`\n📦 Webhook received: ${resource_type}`);

  if (resource_type !== "SHIP_NOTIFY") {
    return res.status(200).json({ message: "Ignored non-ship event" });
  }
  if (!resource_url) {
    return res.status(400).json({ error: "Missing resource_url" });
  }

  console.log(`   🔗 resource_url: ${resource_url}`);

  try {
    const stored = await processResourceUrl(resource_url);

    if (stored.length === 0) {
      return res.status(404).json({ error: "No shipments found for that tracking number" });
    }

    // Return the first stored record so the HTML page can display it immediately
    res.status(200).json({ message: "OK", shipment: stored[0] });

  } catch (err) {
    console.error("   ❌ Error:", err.message);
    if (err.response) console.error("   ❌ SS response:", JSON.stringify(err.response.data));
    res.status(500).json({ error: "Failed to process", detail: err.message });
  }
});

app.post("/shipmenttracking", async (req, res) => {
  const { resource_url, resource_type } = req.body;

  console.log(`\n📦 Tracking received: ${resource_type}`);

  if (!resource_url) {
    return res.status(400).json({ error: "Missing resource_url" });
  }

  console.log(`   🔗 resource_url: ${resource_url}`);

  try {
    const stored = await processResourceUrl(resource_url);

    if (stored.length === 0) {
      return res.status(404).json({ error: "No shipments found for that tracking number" });
    }

    // Return the first stored record so the HTML page can display it immediately
    res.status(200).json({ message: "OK", shipment: stored[0] });

  } catch (err) {
    console.error("   ❌ Error:", err.message);
    if (err.response) console.error("   ❌ SS response:", JSON.stringify(err.response.data));
    res.status(500).json({ error: "Failed to process", detail: err.message });
  }
});

/**
 * GET /shipments
 * Returns all stored shipments as a flat row-per-item array for the table.
 */
app.get("/shipments", (req, res) => {
  const rows = [];
  for (const record of shipmentsStore.values()) {
    for (const item of record.items) {
      if(record.voided){}
      else{
        rows.push({
          orderNumber:    record.orderNumber,
          trackingNumber: record.trackingNumber,
          sku:            item.sku,
          quantity:       item.quantity,
          name:           item.name,
          receivedAt:     record.receivedAt,
        });
      }
    }
  }
  rows.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
  res.json(rows);
});

/**
 * GET /health
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", shipmentsStored: shipmentsStore.size, uptime: process.uptime() });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 ShipStation backend on port ${PORT}`);
  console.log(`   Health   : http://localhost:${PORT}/health`);
  console.log(`   Shipments: http://localhost:${PORT}/shipments`);
  console.log(`   Webhook  : https://api.ancienthowl.net/webhook\n`);
});

/**
 * GET /orders?date=YYYY-MM-DD
 * Returns all shipped orders for a given date (defaults to yesterday).
 * Used by Google Apps Script to sync to Google Sheets.
 */
app.get("/ordersdaily", async (req, res) => {
  try {
    // Default to yesterday if no date provided: d.setDate(d.getDate() - 1
    /*const date = req.query.date
      ? new Date(req.query.date)
      : (() => { const d = new Date(); d.setDate(d.getDate()); return d; })();
    */
    //const start = new Date(date);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const fmt = d => d.toISOString().replace("T", " ").substring(0, 19);

    let allShipments = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const url = `https://ssapi.shipstation.com/shipments?shipDateStart=${encodeURIComponent(fmt(start))}&shipDateEnd=${encodeURIComponent(fmt(end))}&includeShipmentItems=true&pageSize=500&page=${page}`;

      const response = await axios.get(url, {
        headers: { Authorization: ssAuthHeader, "Content-Type": "application/json" },
      });

      totalPages = response.data.pages;
      allShipments = allShipments.concat(response.data.shipments);
      page++;
    }

    // Flatten to one row per line item
    const rows = [];
    for (const record of allShipments) {
      if(record.voided){}
      else{
        const items = (record.shipmentItems && record.shipmentItems.length > 0) 
          ? record.shipmentItems
          : [{ sku: "NO ITEMS", quantity: 1, name: "", itemImg: "" }];
        for (const item of items) {
          if(items.length > 1 && item.sku.length < 1){}
          else{
            rows.push({
              orderNumber:    record.orderNumber,
              trackingNumber: record.trackingNumber,
              sku:            item.sku || "NO SKU",
              quantity:       item.quantity,
              name:           item.name || "",
              itemImg:        item.imageUrl || "",
              shipDate:       record.shipDate,
              shipToName:     record.shipTo?.name || "",
              address:        record.shipTo?.street1 || "",
              serviceCost:    record.shipmentCost,
              service:        record.serviceCode
            });
          }
        }
      }
    }

    console.log(`📊 /orders — ${allShipments.length} orders returned for ${fmt(start)}`);
    res.json({ date: fmt(start), orderCount: allShipments.length, rows });

  } catch (err) {
    console.error("❌ /orders error:", err.message);
    res.status(500).json({ error: "Failed to fetch orders", detail: err.message });
  }
});

/**
 * POST /create-orders
 * Body: { orders: [ { id, firstName, lastName, address, address2, city, zip, state, sku } ] }
 * Creates each order in ShipStation. Returns per-row success/failure.
 */
app.post("/create-orders-trll", async (req, res) => {
  const { orders } = req.body;

  if (!orders || !Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json({ error: "Missing or empty 'orders' array" });
  }

  console.log(`\n📥 /create-orders — received ${orders.length} orders`);

  const results = [];

  for (const order of orders) {
    try {
      const payload = {
        orderNumber: order.id,
        orderDate: new Date().toISOString(),
        orderStatus: "awaiting_shipment",
        billTo: {
          name: `${order.firstName} ${order.lastName}`,
          country: "US"
        },
        shipTo: {
          name: `${order.firstName} ${order.lastName}`,
          street1: order.address,
          street2: order.address2 || "",
          city: order.city,
          state: order.state,
          postalCode: order.zip,
          country: "US"
        },
        items: [
          {
            sku: order.sku,
            name: " ",
            quantity: 1,
            weight: {
              value: order.weight * 16,
              units: "ounces"
            }
          }
        ]
      };

      const response = await axios.post(
        "https://ssapi.shipstation.com/orders/createorder",
        payload,
        { headers: { Authorization: ssAuthHeader, "Content-Type": "application/json" } }
      );

      console.log(`   ✅ Created order ${payload.orderNumber} (ShipStation orderId: ${response.data.orderId})`);
      results.push({ id: order.id, success: true, shipstationOrderId: response.data.orderId });

    } catch (err) {
      console.error(`   ❌ Failed order ID ${order.id}:`, err.response?.data || err.message);
      results.push({ id: order.id, success: false, error: err.response?.data?.message || err.message });
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`📊 Done — ${successCount}/${orders.length} succeeded\n`);

  res.json({ results });
});

/**
 * GET /tracking?orderNumbers=MAN-1,MAN-2,MAN-3
 * Looks up tracking numbers for the given order numbers in ShipStation.
 */
app.get("/tracking-list", async (req, res) => {
  const { orderNumbers } = req.query;

  if (!orderNumbers) {
    return res.status(400).json({ error: "Missing orderNumbers query param" });
  }

  const numbers = orderNumbers.split(",").map(n => n.trim()).filter(Boolean);
  console.log(`\n🔍 /tracking — looking up ${numbers.length} orders`);

  const results = [];

  for (const orderNumber of numbers) {
    try {
      const response = await axios.get(
        `https://ssapi.shipstation.com/orders?orderNumber=${encodeURIComponent(orderNumber)}`,
        { headers: { Authorization: ssAuthHeader, "Content-Type": "application/json" } }
      );

      const orders = response.data.orders || [];

      if (orders.length === 0) {
        console.warn(`   ⚠️  No order found for ${orderNumber}`);
        results.push({ orderNumber, trackingNumber: null, status: "not_found" });
        continue;
      }

      const order = orders[0];

      // Get shipments for this order to find the tracking number
      const shipmentsResponse = await axios.get(
        `https://ssapi.shipstation.com/shipments?orderId=${order.orderId}`,
        { headers: { Authorization: ssAuthHeader, "Content-Type": "application/json" } }
      );

      const shipments = shipmentsResponse.data.shipments || [];
      //const tracking = shipments.length > 0 ? shipments[0].trackingNumber : null;
      // Ignore voided shipments
      const activeShipments = shipments.filter(s => !s.voided);
      const tracking = activeShipments.length > 0 ? activeShipments[0].trackingNumber : null;

      console.log(`   ${tracking ? "✅" : "⏳"} ${orderNumber} → ${tracking || "not shipped yet"}`);
      results.push({
        orderNumber,
        trackingNumber: tracking || null,
        shipStationStatus: order.orderStatus
      });

    } catch (err) {
      console.error(`   ❌ Error looking up ${orderNumber}:`, err.response?.data || err.message);
      results.push({ orderNumber, trackingNumber: null, status: "error", error: err.message });
    }
  }

  res.json({ results });
});

/**
 * GET /orders open
 * Returns all orders
 * Used by Google Apps Script to sync to Google Sheets.
 */
app.get("/ordersdailyopen", async (req, res) => {
  try {

    let allShipments = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const url = `https://ssapi.shipstation.com/orders?orderStatus=awaiting_shipment&pageSize=500&page=${page}`; //awaiting_shipment

      const response = await axios.get(url, {
        headers: { Authorization: ssAuthHeader, "Content-Type": "application/json" },
      });
      totalPages = response.data.pages;
      allShipments = allShipments.concat(response.data.orders);
      page++;
    }

    // Flatten to one row per line item
    const rows = [];
    let voidedcount = 0;
    
    for (const record of allShipments) {
      if(record.voided){ voidedcount++; }
      else {
        const items = (record.items && record.items.length > 0) 
          ? record.items
          : [{ sku: "NO ITEMS", quantity: 1}];
        for (const item of items) {
          let skuf = item.fulfillmentSku;
          let skustatus = item.sku;
          if(!item.fulfillmentSku || item.fulfillmentSku.length < 1){
            skuf = item.sku;
            skustatus = "Shop Sku";
          } else {
            if(skuf === skustatus){skustatus="sku";}
          }
          if(items.length > 1 && skuf.length < 1){}
          else{
            rows.push({
              orderNumber:    record.orderNumber,
              sku:            skuf,
              quantity:       item.quantity,
              skuStatus:      skustatus
            });
          }
        }
      }
    }

    console.log(`📊 /orders daily — ${allShipments.length} orders returned`);
    if(voidedcount > 0){ console.log('Skipped voided: '+voidedcount); }
    res.json({ orderCount: allShipments.length, rows });

  } catch (err) {
    console.error("❌ /orders daily error:", err.message);
    res.status(500).json({ error: "Failed to fetch orders", detail: err.message });
  }
});

/**
 * POST /create-orders-trll
 * Body: {
 *   orders: [
 *     {
 *       id, firstName, lastName, phone, company,
 *       address, address2, city, zip, state,
 *       items: [ { sku, quantity } ]   // one or more items per order
 *     }
 *   ]
 * }
 *
 * Creates ONE ShipStation order per entry in `orders`, with all of that
 * order's items as ShipStation line items. Returns per-order success/failure.
 *
 * Changes from the previous version:
 * - Accepts an `items` array instead of a single `sku`, so multi-item
 *   orders become one ShipStation order instead of several.
 * - Uses each item's real `quantity` instead of hardcoding 1.
 * - Weight is omitted entirely (ShipStation applies its own default);
 *   no more `NaN` from `order.weight * 16` when weight isn't supplied.
 */
app.post("/create-orders-mn", async (req, res) => {
  const { orders } = req.body;
  if (!orders || !Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json({ error: "Missing or empty 'orders' array" });
  }

  console.log(`\n📥 /create-orders-mn — received ${orders.length} orders`);
  const results = [];

  for (const order of orders) {
    try {
      if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
        throw new Error("Order has no items");
      }

      const payload = {
        orderNumber: order.id,
        orderDate: new Date().toISOString(),
        orderStatus: "awaiting_shipment",
        billTo: {
          name: `${order.firstName} ${order.lastName}`.trim(),
          company: order.company || undefined,
          phone: order.phone || undefined,
          country: "US"
        },
        shipTo: {
          name: `${order.firstName} ${order.lastName}`.trim(),
          company: order.company || "",
          phone: order.phone || "",
          street1: order.address,
          street2: order.address2 || "",
          city: order.city,
          state: order.state,
          postalCode: order.zip,
          country: "US"
        },
        items: order.items.map((item) => ({
          sku: item.sku,
          name: " ", // ShipStation requires a non-empty name; SKU is a reasonable fallback
          quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1
          // no weight field — ShipStation will use its own default
        }))
      };

      const response = await axios.post(
        "https://ssapi.shipstation.com/orders/createorder",
        payload,
        { headers: { Authorization: ssAuthHeader, "Content-Type": "application/json" } }
      );

      console.log(`   ✅ Created order ${payload.orderNumber} (ShipStation orderId: ${response.data.orderId}, ${order.items.length} item(s))`);
      results.push({ id: order.id, success: true, shipstationOrderId: response.data.orderId });
    } catch (err) {
      console.error(`   ❌ Failed order ID ${order.id}:`, err.response?.data || err.message);
      results.push({ id: order.id, success: false, error: err.response?.data?.message || err.message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(`📊 Done — ${successCount}/${orders.length} succeeded\n`);
  res.json({ results });
});

/* POST
 * Get from AppsScript address
 * send to Ship From Location
 * 
 */
app.post('/update-ship-from', async (req, res) => {
  SHIPSTATION_BASE_URL =  "https://ssapi.shipstation.com";
  try {
    const {
      locationName,
      firstName,
      lastName,
      address1,
      address2,
      city,
      state,
      zip,
      country,
    } = req.body;

    if (!locationName || !address1 || !city || !state || !zip) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields (locationName, address1, city, state, zip)',
      });
    }
    /*
    // 1. Look up the warehouse by name
    const listRes = await axios.get(`${SHIPSTATION_BASE_URL}/warehouses`, {
      headers: { Authorization: ssAuthHeader },
    });

    console.log("here: ",listRes.data);
    const warehouse = listRes.data.find(
      //(w) => w.warehouseName?.trim().toLowerCase() === locationName.trim().toLowerCase()
      (w) => w.warehouseName?.trim().toLowerCase() === "trello"
    );

    if (!warehouse) {
      const available = listRes.data.map((w) => w.warehouseName).join(', ');
      return res.status(404).json({
        success: false,
        error: `No Ship From Location named "${locationName}" found. Available: ${available}`,
      });
    }
    */
    // Dummy Object
    const warehouse = {
      warehouseId: 1831576,
      warehouseName: 'Trello',
      originAddress: {
        name: 'Angela  \tMyers ',
        company: 'Angela  \tMyers ',
        street1: '835 Locust Av Unit 214',
        street2: '',
        street3: null,
        city: 'Long Beach',
        state: 'CA',
        postalCode: '90813',
        country: 'US',
        phone: '+13144511461',
        residential: true,
        addressVerified: null
      },
      returnAddress: {
        name: 'Angela  \tMyers ',
        company: 'Angela  \tMyers ',
        street1: '835 Locust Av Unit 214',
        street2: '',
        street3: null,
        city: 'Long Beach',
        state: 'CA',
        postalCode: '90813',
        country: 'US',
        phone: '+13144511461',
        residential: null,
        addressVerified: null
      },
      createDate: '2026-03-26T11:50:08.7900000',
      isDefault: false,
      sellerIntegrationId: null,
      extInventoryIdentity: null,
      registerFedexMeter: null
    }
  
    // 2. Merge new address fields onto the existing origin address, so
    //    fields you're not sending (phone, company, etc.) are preserved
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const fullAddress = [address1, address2].filter(Boolean).join(' ');

    const mergedOriginAddress = {
      ...warehouse.originAddress,
      name: fullName || warehouse.originAddress?.name,
      company: fullName,
      street1: fullAddress || null,
      city,
      state,
      postalCode: zip,
      country:'US',
    };

    const mergedReturnAddress = {
      ...warehouse.returnAddress,
      name: fullName || warehouse.originAddress?.name,
      company: fullName,
      street1: fullAddress || null,
      city,
      state,
      postalCode: zip,
      country:'US',
    }

    const payload = {
      warehouseId: warehouse.warehouseId,
      warehouseName: warehouse.warehouseName,
      originAddress: mergedOriginAddress,
      returnAddress: mergedReturnAddress, //warehouse.returnAddress, // left untouched
      isDefault: warehouse.isDefault,
    };

    // 3. Push the update
    const updateRes = await axios.put(
      `${SHIPSTATION_BASE_URL}/warehouses/1831576`,
      payload,
      { headers: { Authorization: ssAuthHeader, 'Content-Type': 'application/json' } }
    );

    res.json({
      success: true,
      updatedLocation: updateRes.data.warehouseName,
      originAddress: updateRes.data.originAddress,
    });
    console.log("   ✅  Successfully updated Ship From Location for Trello with "+fullName);
  } catch (err) {
    console.error('   ❌ update-ship-from failed:', err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
});

/**
 * Count Page
 */
app.post("/count-inventory-start", async(req,res)=>{
  countPayloadStart = req.body;
  let resmsg = "";
  if(countPayloadStart !== null){
    //console.log(countPayloadStart);

    resmsg += "✅  Successfully got Count START table";
    res.status(200).json({ message: "OK"});
    console.log(resmsg);
  }else{
    res.status(400).json({error: err.response?.data || err.message, });
    console.log(" ❌ Count START failure");
  }
});

app.get("/count-inventory-start-pull", async(req,res)=>{
  let resmsg = "";
  if(!countPayloadStart){
    resmsg += " ❌  Data countPayloadStart undefined";
    console.log(resmsg);
    return res.status(400).send("Error occured");
  }
  res.json(countPayloadStart);        //  [data]  
  //res.json({countPayloadStart});    //  [property: {data}]
  // res.send() - error, sending response twice
  console.log(" ✅  Count START successfull Pull")
});

/* TikTok RCW 
* Enable API
* Redirect URL link
*/
// Step: kick off authorization (open this URL in a browser once)
  app.get("/tiktok/oauth/09876szsrdzv987ytxfc/start", (req, res) => {
    const authUrl = `https://services.tiktokshop.com/open/authorize?service_id=YOUR_SERVICE_ID`;
    res.send(
      `Open this in a browser while logged into your TikTok Shop seller account: <a href="${authUrl}">${authUrl}</a>` +
        ` (Find your exact service_id / authorize link in Partner Center > App > Authorization.)`
    );
  });

  // Step: TikTok redirects here after the seller approves
  app.get("/tiktokrcw/callback", async (req, res) => {
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
