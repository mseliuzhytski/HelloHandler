# ShipStation Packing Station — Backend Setup

## Files
- `server.js` — Express server
- `package.json` — dependencies
- `.env.example` — copy to `.env` and fill in your credentials

---

## 1. Install on your AWS Instance

```bash
# SSH into your AWS instance, then:
sudo apt update && sudo apt install -y nodejs npm   # Ubuntu/Debian
# or: sudo yum install -y nodejs npm               # Amazon Linux

# Copy files to server (from your local machine):
scp -r shipstation-backend/ ec2-user@<YOUR_AWS_IP>:~/

cd ~/shipstation-backend
npm install
```

---

## 2. Add Your ShipStation API Credentials

```bash
cp .env.example .env
nano .env
```

Fill in:
```
SS_API_KEY=your_key_here
SS_API_SECRET=your_secret_here
PORT=3000
```

**Where to find your API key:**
ShipStation → Settings (gear icon) → Account → API Settings

---

## 3. Open Port 3000 on AWS

In the AWS Console:
1. EC2 → Security Groups → your instance's security group
2. Edit Inbound Rules → Add Rule:
   - Type: Custom TCP
   - Port: 3000
   - Source: 0.0.0.0/0  (or restrict to your office IP)

---

## 4. Run the Server

**For testing:**
```bash
node server.js
```

**For production (keeps running after logout):**
```bash
# Install PM2 once:
sudo npm install -g pm2

# Start with PM2:
pm2 start server.js --name shipstation-backend
pm2 save
pm2 startup   # follow the printed command to auto-start on reboot
```

---

## 5. Configure ShipStation Webhook

1. ShipStation → Settings → Integrations → Webhooks
2. Click **Add Webhook**
3. Fill in:
   - **Name:** Packing Station Notifier
   - **URL:** `http://<YOUR_AWS_IP>:3000/webhook`
   - **Event:** `Ship Notify` (label printed / shipment created)
4. Save

**Test it:** Print a label in ShipStation — your server should log the shipment within seconds.

---

## 6. Verify It's Working

```bash
# Health check (from anywhere):
curl http://<YOUR_AWS_IP>:3000/health

# See all stored shipments:
curl http://<YOUR_AWS_IP>:3000/shipments

# Look up a specific tracking number:
curl http://<YOUR_AWS_IP>:3000/shipment/1Z999AA10123456784
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook` | Receives ShipStation SHIP_NOTIFY events |
| GET | `/shipments` | Returns all shipments (for the table) |
| GET | `/shipment/:tracking` | Returns items for one tracking number |
| GET | `/health` | Server health + shipment count |

### GET /shipments — Response
```json
[
  {
    "orderNumber": "ORDER-1001",
    "trackingNumber": "1Z999AA10123456784",
    "sku": "WIDGET-RED-L",
    "quantity": 2,
    "name": "Red Widget Large",
    "receivedAt": "2026-06-03T14:22:00.000Z"
  }
]
```

### GET /shipment/:tracking — Response
```json
{
  "orderNumber": "ORDER-1001",
  "trackingNumber": "1Z999AA10123456784",
  "items": [
    { "sku": "WIDGET-RED-L", "quantity": 2, "name": "Red Widget Large" },
    { "sku": "WIDGET-BLUE-M", "quantity": 1, "name": "Blue Widget Medium" }
  ],
  "receivedAt": "2026-06-03T14:22:00.000Z"
}
```

---

## Notes

- **In-memory storage:** Shipments are stored in RAM. If the server restarts, data is lost.
  For persistence, swap the `shipmentsStore` Map for SQLite (`better-sqlite3`) or a JSON file.
- **HTTPS:** For production, put Nginx in front of this server with a Let's Encrypt cert,
  or use an AWS Application Load Balancer with SSL termination.
