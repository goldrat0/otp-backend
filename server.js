const twilio = require('twilio');

app.use(express.urlencoded({ extended: false }));

const TRANSFER_NUMBER = '+447878955921';
const ELEVENLABS_INBOUND_URL = 'https://api.elevenlabs.io/v1/convai/twilio/inbound_call';

app.post('/incoming-call', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  const gather = twiml.gather({
    input: 'dtmf',
    numDigits: 1,
    timeout: 5,
    action: '/handle-keypress',
    method: 'POST',
  });

  gather.say('Press 1 to speak to a person, or stay on the line for the assistant.');

  twiml.redirect({ method: 'POST' }, ELEVENLABS_INBOUND_URL);

  res.type('text/xml');
  res.send(twiml.toString());
});

app.post('/handle-keypress', (req, res) => {
  const digit = req.body.Digits;
  const twiml = new twilio.twiml.VoiceResponse();

  if (digit === '1') {
    twiml.say('Please hold while I transfer your call.');
    twiml.dial(TRANSFER_NUMBER);
  } else {
    twiml.redirect({ method: 'POST' }, ELEVENLABS_INBOUND_URL);
  }

  res.type('text/xml');
  res.send(twiml.toString());
});
