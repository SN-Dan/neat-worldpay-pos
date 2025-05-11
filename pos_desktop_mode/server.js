const fs = require('fs');
const https = require('https');
const express = require('express');
const WebSocket = require('ws');

const app = express();
const cert = {
  key: fs.readFileSync('./cert/private-key.pem'),
  cert: fs.readFileSync('./cert/certificate.pem')
};

const server = https.createServer(cert, app);
const wss = new WebSocket.Server({ server });

const clients = new Map();
const syncMap = new Map();

function heartbeat() { this.isAlive = true; }

wss.on('connection', (ws) => {
  let deviceId = null;
  let deviceType = null;
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      console.log(data)
      if (data.type === 'register') {
        deviceId = data.deviceId;
        deviceType = data.deviceType
        if(deviceType === "master") {
            let syncedDeviceId = data.syncDeviceId
            syncMap.set(deviceId, syncedDeviceId)
            syncMap.set(syncedDeviceId, deviceId)
        }
        clients.set(deviceId, ws);
        console.log(`Registered: ${deviceId}`);
        return;
      }

      if (data.type === 'message') {
        const { msgType, msgPayload } = data;
        const msgId = `${Date.now()}-${Math.random()}`;
        const syncedDeviceId = syncMap.get(deviceId)
        const target = clients.get(syncedDeviceId);
        if (target && target.readyState === WebSocket.OPEN) {
          const fullMsg = JSON.stringify({ from: deviceId, msgType, msgPayload, msgId });
          target.send(fullMsg);

          // const timeout = setTimeout(() => {
          //   if (target.readyState === WebSocket.OPEN) {
          //     console.log(`Resending to ${syncedDeviceId} due to no ACK: ${msgId}`);
          //     target.send(fullMsg);
          //   }
          // }, 5000);

          // const ackHandler = (ackMsg) => {
          //   try {
          //     const ackData = JSON.parse(ackMsg);
          //     if (ackData.type === 'ack' && ackData.msgId === msgId) {
          //       clearTimeout(timeout);
          //       ws.removeListener('message', ackHandler);
          //     }
          //   } catch {}
          // };

          // ws.on('message', ackHandler);
        }
      }

    } catch (err) {
      console.error("Invalid JSON:", err.message);
    }
  });

  ws.on('close', () => {
    if (deviceId) {
        clients.delete(deviceId);
        let syncedDeviceId = syncMap.get(deviceId)
        if(syncedDeviceId) {
            syncMap.delete(deviceId)
            syncMap.delete(syncedDeviceId)
        }
    }
    console.log(`Disconnected: ${deviceId}`);
  });

  ws.on('error', (err) => {
    console.error(`Error from ${deviceId || 'unknown'}:`, err.message);
  });
});

// Heartbeat
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(8443, () => {
  console.log("WSS Server running at wss://<your-ip>:8443");
});