const express = require('express');
const ngrok = require('@ngrok/ngrok');
const path = require('path');
const fs = require('node:fs');
const ws = require('ws');
const ON_DEATH = require('death');

const serveraddr = 8080;
const app = express();
const expressWs = require('express-ws')(app);

var ipCooldownMap = new Map();
const cooldownAmt = 1500;

var stringThing = "";
if (fs.existsSync("text.txt")) {
    stringThing = fs.readFileSync("text.txt", 'utf-8');
}

const insertAt = (str, sub, pos) => `${str.slice(0, pos)}${sub}${str.slice(pos)}`;
const removeAt = (str, pos) => str.slice(0, pos - 1) + str.slice(pos);

function insertChar(char, loc) {
    stringThing = insertAt(stringThing, char, loc);
}

function deleteChar(loc) {
    stringThing = removeAt(stringThing, loc);
}

function cooldown(ws, ip) {
    let newCooldown = Date.now() + cooldownAmt - 200;
    ipCooldownMap[ip] = newCooldown;
    ws.send(JSON.stringify({ messageType: "cooldown", messageData:  newCooldown}));
}

app.ws('/socket', (ws, req) => {
    ws.send(JSON.stringify({ messageType: "data", messageData: stringThing }))

    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    cooldown(ws, ip);

    ws.on('close', () => {
            
    });

    ws.on('message', (msg) => {
        if (ipCooldownMap[ip] < Date.now()) {
            let data = JSON.parse(msg);
            
            if (data.loc < 0) {
                data.loc = 0;
                ws.send(JSON.stringify({ messageType: "error", messageData: "you be having some sus bot activity!" }));
            }

            var processedData;
            if (data.messageType == 'insertChar') {
                processedData = {
                    messageType: 'insertChar', 
                    char: data.char[0], 
                    loc: data.loc
                }

                if (data.char.length > 1) {
                    ws.send(JSON.stringify({ messageType: "error", messageData: "you be having some sus bot activity!" }));
                }

                insertChar(processedData.char, processedData.loc);
            } else if (data.messageType == 'deleteChar') {
                processedData = {
                    messageType: 'deleteChar', 
                    loc: data.loc
                }

                if (data.loc < 1) {
                    data.loc = 1;
                    ws.send(JSON.stringify({ messageType: "error", messageData: "you be having some sus bot activity!" }));
                }

                deleteChar(processedData.loc);
            }
            console.log(`received ${JSON.stringify(data)} and processed to : ${JSON.stringify(processedData)}`);

            if (processedData) {
                expressWs.getWss().clients.forEach(client => {
                    if (client != ws) {
                        client.send(JSON.stringify(processedData));
                    }
                });
            }
        } else {
            ws.send(JSON.stringify({ messageType: "error", messageData: "You are typing too fast!" }));
        }
        cooldown(ws, ip);
    });
    
});

const options = {
    root: path.join(__dirname)
};

app.get('/', (req, res) => {
    res.sendFile("index.html", options);
});

app.get('/text', (req, res) => {
    res.sendFile("text.txt", options);
});

app.get('/main.js', (req, res) => {
    res.sendFile("main.js", options);
});

app.get('/constants.js', (req, res) => {
    let constantspage = `const cooldownAmt = ${cooldownAmt};`;
    res.send(constantspage);
})

app.get('*', (req, res) => {
    let errorpage = fs.readFileSync('404.html', 'utf-8').replace("${page}", req.path);
    res.status(404).send(errorpage);
})

app.use((err, req, res, next) => {
    if(!err) return next();
    res.err = err;
    res.status(500).json({ status: "Server error" });
    throw err;
});

app.listen(serveraddr, () => {
    console.log(`Server running`);
});


(async function() {
    const httplistener   = await ngrok.forward({ addr: serveraddr, authtoken_from_env: true, domain: "tortoise-helpful-minnow.ngrok-free.app" });
    console.log(`HTTPS ingress established at: ${httplistener.url()}`);
    wssAddr = httplistener.url().replace('https', 'wss') + '/socket';
    

    ON_DEATH((signal, err) => {
        fs.writeFileSync("text.txt", stringThing);
        process.exit();
    })
})();