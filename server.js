const express = require('express');
const twilio = require('twilio');

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const BASE_URL = 'https://otp-backend-production-15fa.up.railway.app';
const TRANSFER_NUMBER = '+447878955921';
const ELEVENLABS_INBOUND_URL = 'https://api.elevenlabs.io/v1/convai/twilio/inbound_call';

app.get('/', (req, res) => {
  res.send('Server is running');
});

app.post('/incoming-call', (req, res) => {
  console.log('Incoming call received:', req.body.CallSid);

  const twiml = new twilio.twiml.VoiceResponse();

  const gather = twiml.gather({
    input: 'dtmf',
    numDigits: 1,
    timeout: 10,
    action: `${BASE_URL}/handle-keypress`,
    method: 'POST',
  });

  gather.say('Press 1 to speak to a person, or stay on the line for the assistant.');

  twiml.redirect({ method: 'POST' }, ELEVENLABS_INBOUND_URL);

  res.type('text/xml');
  res.send(twiml.toString());
});

app.post('/handle-keypress', (req, res) => {
  console.log('Keypress received:', req.body.Digits, 'CallSid:', req.body.CallSid);

  const digit = req.body.Digits;
  const twiml = new twilio.twiml.VoiceResponse();

  if (digit === '1') {
    console.log('Transferring call to:', TRANSFER_NUMBER);
    twiml.say('Please hold while I transfer your call.');
    twiml.dial(TRANSFER_NUMBER);
  } else {
    console.log('No valid digit pressed. Sending to ElevenLabs.');
    twiml.redirect({ method: 'POST' }, ELEVENLABS_INBOUND_URL);
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
