/**
 * ShipStation Packing Station Backend
 * Node.js / Express server for AWS
 *
 * Receives SHIP_NOTIFY webhooks from ShipStation,
 * fetches full shipment details, stores them,
 * and exposes a REST API for the packing station HTML page.
 */

const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors()); // Allow your static HTML page to call this API
app.use(express.json());

// ─── In-Memory Store ──────────────────────────────────────────────────────────
// Structure: Map<trackingNumber, ShipmentRecord>
// ShipmentRecord: { orderNumber, trackingNumber, items: [{sku, quantity}], receivedAt }
const shipmentsStore = new Map();

// ─── ShipStation API Helper ───────────────────────────────────────────────────
const SS_API_KEY    = process.env.SS_API_KEY;
const SS_API_SECRET = process.env.SS_API_SECRET;

if (!SS_API_KEY || !SS_API_SECRET) {
  console.error("❌  Missing SS_API_KEY or SS_API_SECRET in environment. Check your .env file.");
  process.exit(1);
}

// ShipStation uses HTTP Basic Auth: API Key as username, API Secret as password
const ssAuthHeader = "Basic " + Buffer.from(`${SS_API_KEY}:${SS_API_SECRET}`).toString("base64");

async function fetchShipmentFromSS(resourceUrl) {
  // ShipStation webhook sends `shipmentId` in the resource_url but the value
  // is actually the orderId. Swap the param name so the API returns results.
  const url = new URL(resourceUrl);
  if (url.searchParams.has("shipmentId")) {
    const id = url.searchParams.get("shipmentId");
    url.searchParams.delete("shipmentId");
    url.searchParams.set("orderId", id);
    console.log(`   🔄 Rewrote shipmentId → orderId: ${id}`);
  }
  url.searchParams.set("includeShipmentItems", "true");
  url.searchParams.set("pageSize", "500");
  const finalUrl = url.toString();
  console.log(`   🌐 Final ShipStation URL: ${finalUrl}`);

  const response = await axios.get(finalUrl, {
    headers: {
      Authorization: ssAuthHeader,
      "Content-Type": "application/json",
    },
  });
  return response.data;
}

/**
 * Fetch the full order from ShipStation to get item SKUs and quantities.
 * The shipment object has an orderId; we use that to pull order items.
 */
async function fetchOrderItems(orderId) {
  const response = await axios.get(
    `https://ssapi.shipstation.com/orders/${orderId}`,
    {
      headers: {
        Authorization: ssAuthHeader,
        "Content-Type": "application/json",
      },
    }
  );
  const order = response.data;
  return {
    orderNumber: order.orderNumber,
    items: (order.items || []).map((item) => ({
      sku: item.sku || "NO-SKU",
      quantity: item.quantity,
      name: item.name,
    })),
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /webhook
 * ShipStation calls this whenever a label is printed (SHIP_NOTIFY event).
 * ShipStation sends: { resource_url, resource_type }
 */
app.post("/webhook", async (req, res) => {
  const { resource_url, resource_type } = req.body;

  console.log(`\n📦 Webhook received: ${resource_type}`);

  if (resource_type !== "SHIP_NOTIFY") {
    console.log(`   ⏭  Ignoring event type: ${resource_type}`);
    return res.status(200).json({ message: "Ignored non-ship event" });
  }

  if (!resource_url) {
    console.warn("   ⚠️  No resource_url in payload");
    return res.status(400).json({ error: "Missing resource_url" });
  }

  console.log(`   🔗 resource_url: ${resource_url}`);

  try {
    // 1. Fetch the shipment details from ShipStation
    console.log("   📡 Calling ShipStation API for shipment data...");
    let shipmentData;
    try {
      shipmentData = await fetchShipmentFromSS(resource_url);
      console.log("   📦 Raw shipment response:", JSON.stringify(shipmentData, null, 2));
    } catch (apiErr) {
      console.error("   ❌ ShipStation API call failed:", apiErr.message);
      if (apiErr.response) {
        console.error("   ❌ HTTP status:", apiErr.response.status);
        console.error("   ❌ Response body:", JSON.stringify(apiErr.response.data, null, 2));
      }
      return res.status(500).json({ error: "ShipStation API call failed", detail: apiErr.message });
    }

    // resource_url may return a single shipment or a list inside `shipments`
    const shipments = shipmentData.shipments || [shipmentData];
    console.log(`   📋 Shipments to process: ${shipments.length}`);

    for (const shipment of shipments) {
      const trackingNumber = shipment.trackingNumber;
      const orderId        = shipment.orderId;
      const orderNumber    = shipment.orderNumber;

      console.log(`   🔍 Processing — order: ${orderNumber} | orderId: ${orderId} | tracking: ${trackingNumber}`);

      if (!trackingNumber) {
        console.warn("   ⚠️  Shipment has no tracking number, skipping.");
        continue;
      }

      // 2. Use shipmentItems from the response (included via includeShipmentItems=true).
      //    Fall back to fetching the order if shipmentItems is missing or empty.
      let items = [];
      if (shipment.shipmentItems && shipment.shipmentItems.length > 0) {
        console.log(`   📦 Using inline shipmentItems (${shipment.shipmentItems.length} items)`);
        items = shipment.shipmentItems.map(i => ({
          sku:      i.sku      || "NO-SKU",
          quantity: i.quantity,
          name:     i.name     || "",
        }));
      } else {
        console.log(`   📡 No inline items — falling back to GET /orders/${orderId}`);
        const fetched = await fetchOrderItems(orderId);
        items       = fetched.items;
      }

      console.log(`   📋 Items:`, items.map(i => `${i.sku} x${i.quantity}`).join(', '));

      // 3. Store in memory
      const record = {
        orderNumber,
        trackingNumber,
        items,
        receivedAt: new Date().toISOString(),
      };

      shipmentsStore.set(trackingNumber, record);
      console.log(`   ✅ Stored — Order: ${orderNumber} | Tracking: ${trackingNumber} | Items: ${items.length}`);
    }

    res.status(200).json({ message: "Webhook processed" });
  } catch (err) {
    console.error("   ❌ Error processing webhook:", err.message);
    res.status(500).json({ error: "Failed to process webhook", detail: err.message });
  }
});

/**
 * GET /shipments
 * Returns all stored shipments as a flat array for the packing station table.
 * Each row: { orderNumber, trackingNumber, sku, quantity }
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

  // Sort newest first
  rows.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

  res.json(rows);
});

/**
 * GET /shipment/:tracking
 * Returns the SKUs and quantities for a specific tracking number.
 * Used when the packing station scans a tracking barcode.
 */
app.get("/shipment/:tracking", (req, res) => {
  const tracking = req.params.tracking.trim();
  const record   = shipmentsStore.get(tracking);

  if (!record) {
    return res.status(404).json({ error: "Tracking number not found", tracking });
  }

  res.json({
    orderNumber:    record.orderNumber,
    trackingNumber: record.trackingNumber,
    items:          record.items,   // [{sku, quantity, name}]
    receivedAt:     record.receivedAt,
  });
});

/**
 * GET /health
 * Simple health check so you can confirm the server is running.
 */
app.get("/health", (req, res) => {
  res.json({
    status:          "ok",
    shipmentsStored: shipmentsStore.size,
    uptime:          process.uptime(),
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 ShipStation Packing Station backend running on port ${PORT}`);
  console.log(`   Health check : http://localhost:${PORT}/health`);
  console.log(`   All shipments: http://localhost:${PORT}/shipments`);
  console.log(`   By tracking  : http://localhost:${PORT}/shipment/:tracking`);
  console.log(`   Webhook URL  : http://<your-aws-ip>:${PORT}/webhook\n`);
});
