const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const { body, validationResult } = require('express-validator'); // Import express-validator
const bodyParser = require('body-parser'); // Import body-parser
const app = express();
app.use(cors());
app.use(bodyParser.json()); // Middleware to parse JSON bodies
const server = http.createServer(app);
const io = socketIo(server);

let isAuthenticated = false;

const client = new Client({
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
      },
      restartOnAuthFail: true,
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process', // <- this one doesn't works in Windows
          '--disable-gpu'
        ],
      },
      authStrategy: new LocalAuth()
    });
client.on('qr', (qr) => {
    if (!isAuthenticated) {
        qrcode.toDataURL(qr, (err, url) => {
            if (err) {
                console.error('Failed to generate QR code:', err);
            } else {
                io.emit('qr', url);
            }
        });
    }
});



client.on('ready', () => {
    console.log('WhatsApp client is ready!');
    isAuthenticated = true;
    io.emit('authenticated', true);
});

client.on('authenticated', () => {
    console.log('Authenticated');
    isAuthenticated = true;
    io.emit('authenticated', true);
});

client.on('auth_failure', msg => {
    console.error('Authentication failure:', msg);
    isAuthenticated = false;
    io.emit('authenticated', false);
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out:', reason);
    isAuthenticated = false;
    io.emit('authenticated', false);
});

client.on('message', msg => {
    if (msg.body === 'Hi') {
        msg.reply('Hello from WhatsApp bot!');
    }
});

client.initialize();

io.on('connection', (socket) => {
    console.log('Client connected');
    socket.emit('authenticated', isAuthenticated);

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});



const PORT = process.env.PORT || 8000;

app.post('/send-message', [
    body('number').notEmpty(),
    body('message').notEmpty(),
], (req, res) => {
    const errors = validationResult(req).formatWith(({ msg }) => {
        return msg;
    });
    if (!errors.isEmpty()) {
        return res.status(422).json({
            status: false,
            message: errors.mapped()
        })
    }
    const number = req.body.number + "@c.us";
    const message = req.body.message;
    client.sendMessage(number, message).then(response => {
        res.status(200).json({
            status: true,
            response: response
        });
    }).catch(err => {
        res.status(500).json({
            status: false,
            response: err
        });
    });
});
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
