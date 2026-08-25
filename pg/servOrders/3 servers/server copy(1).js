/**
 * ShipStation Packing Station Backend
 * Node.js / Express server for AWS
 */

const express = require("express");
const cors    = require("cors");
const axios   = require("axios");
require("dotenv").config();

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── API Key Auth Middleware ───────────────────────────────────────────────────
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("❌  Missing API_KEY in .env");
  process.exit(1);
}

// ShipStation webhook calls POST /webhook without an API key,
// so we skip key check for that route and require it everywhere else.
function requireApiKey(req, res, next) {
  // Allow ShipStation webhooks through without a key —
  // they are already IP-restricted at the Nginx level.
  if (req.path === "/webhook" && req.method === "POST") {
    return next();
  }

  const key = req.headers["x-api-key"];
  if (!key || key !== API_KEY) {
    console.warn(`🚫-Unauthorized-from ${req.ip} || ${req.headers["x-forwarded-for"]} at ${new Date().toLocaleString()} to ${req.method} ${req.path}`);
    return res.status(401).json({ error: "Unauthorized — missing or invalid API key" });
  }
  next();
}

app.use(requireApiKey);

// ─── In-Memory Store ──────────────────────────────────────────────────────────
// Map<trackingNumber, { orderNumber, trackingNumber, items, receivedAt }>
const shipmentsStore = new Map();

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
    const { trackingNumber, orderId, orderNumber } = shipment;
    console.log(`   🔍 order: ${orderNumber} | tracking: ${trackingNumber}`);

    if (!trackingNumber) {
      console.warn("   ⚠️  No tracking number, skipping.");
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

// ─── Routes ───────────────────────────────────────────────────────────────────

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

/**
 * GET /shipments
 * Returns all stored shipments as a flat row-per-item array for the table.
 */
app.get("/shipments", (req, res) => {
  const rows = [];
  for (const record of shipmentsStore.values()) {
    for (const item of record.items) {
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
    const date = req.query.date
      ? new Date(req.query.date)
      : (() => { const d = new Date(); d.setDate(d.getDate()); return d; })();

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
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
      const items = (record.shipmentItems && record.shipmentItems.length > 0) 
        ? record.shipmentItems
        : [{ sku: "", quantity: "", name: "", itemImg: "" }];
      for (const item of items) {
        rows.push({
          orderNumber:    record.orderNumber,
          trackingNumber: record.trackingNumber,
          sku:            item.sku || "",
          quantity:       item.quantity,
          name:           item.name || "",
          itemImg:        item.imageUrl || "",
          shipDate:       record.shipDate,
          shipToName:     record.shipTo?.name || "",
          address:        record.shipTo?.street1 || "",
          serviceCost:    record.shipmentCost,
          service:        record.serviceCode,
          isVoid:         record.voided,
        });
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
      const tracking = shipments.length > 0 ? shipments[0].trackingNumber : null;

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
    
    for (const record of allShipments) {
      const items = (record.items && record.items.length > 0) 
        ? record.items
        : [{ sku: "", quantity: ""}];
      for (const item of items) {
        rows.push({
          orderNumber:    record.orderNumber,
          trackingNumber: record.trackingNumber,
          sku:            item.fulfillmentSku || "",
          quantity:       item.quantity
        });
      }
    }

    console.log(`📊 /orders daily — ${allShipments.length} orders returned`);
    res.json({ orderCount: allShipments.length, rows });

  } catch (err) {
    console.error("❌ /orders daily error:", err.message);
    res.status(500).json({ error: "Failed to fetch orders", detail: err.message });
  }
});