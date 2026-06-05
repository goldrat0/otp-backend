const express = require('express');
const twilio = require('twilio');

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server is running');
});

app.post('/incoming-call', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  twiml.say('This line is currently unavailable. Please contact official support directly.');
  twiml.hangup();

  res.type('text/xml');
  res.send(twiml.toString());
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
