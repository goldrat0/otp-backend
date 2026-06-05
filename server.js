const express = require('express');
const twilio = require('twilio');

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const TRANSFER_NUMBER = '+447878955921';

app.get('/', (req, res) => {
  res.send('Server is running');
});

app.post('/incoming-call', (req, res) => {
  console.log('Incoming call:', req.body.CallSid);

  const twiml = new twilio.twiml.VoiceResponse();

  const gather = twiml.gather({
    input: 'dtmf',
    numDigits: 1,
    timeout: 15,
    action: '/handle-keypress',
    method: 'POST',
    actionOnEmptyResult: true,
  });

  gather.say('Press 1 now to speak to a person.');

  twiml.say('No key was received. Goodbye.');
  twiml.hangup();

  res.type('text/xml');
  res.send(twiml.toString());
});

app.post('/handle-keypress', (req, res) => {
  const digit = req.body.Digits;

  console.log('Keypress received:', digit || 'nothing');

  const twiml = new twilio.twiml.VoiceResponse();

  if (digit === '1') {
    twiml.say('Please hold while I transfer your call.');
    twiml.dial(TRANSFER_NUMBER);
  } else {
    twiml.say(`I received ${digit || 'no key'}. Goodbye.`);
    twiml.hangup();
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
