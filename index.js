const express = require('express');
const ngrok = require('@ngrok/ngrok');
const path = require('path');
const fs = require('node:fs');
const ws = require('ws');
const ON_DEATH = require('death');

const serveraddr = 8080;
const app = express();
const expressWs = require('express-ws')(app);

var stringThing = "";
if (fs.existsSync("text.txt")) {
    stringThing = fs.readFileSync("text.txt", 'utf-8');
}

const insertAt = (str, sub, pos) => `${str.slice(0, pos)}${sub}${str.slice(pos)}`;
const removeAt = (str, pos) => str.slice(0, pos - 1) + str.slice(pos);

async function insertChar(char, loc) {
    try{
    stringThing = insertAt(stringThing, char, loc);
    }catch(err){console.warn(err)}
}

async function deleteChar(loc) {
    try{
    stringThing = removeAt(stringThing, loc);
    }catch(err){console.warn(err)}
}

app.ws('/socket', async (ws, req) => {
    try{
    ws.send(JSON.stringify({ messageType: "data", messageData: stringThing }))

    ws.on('message', async(msg) => {
        try{
        let data = await JSON.parse(msg);
        
        var processedData;
        if (data.messageType == 'insertChar') {
            processedData = {
                messageType: 'insertChar', 
                char: data.char[0], 
                loc: data.loc
            }
            await insertChar(processedData.char, processedData.loc);
        } else if (data.messageType == 'deleteChar') {
            processedData = {
                messageType: 'deleteChar', 
                loc: data.loc
            }
            await deleteChar(processedData.loc);
        }
        console.log(`received ${JSON.stringify(data)} and processed to : ${JSON.stringify(processedData)}`);

        if (processedData) {
            expressWs.getWss().clients.forEach(client => {
                if (client != ws) {
                    client.send(JSON.stringify(processedData));
                }
            });
        }
        }catch(err){console.warn(err)}
    });

    }catch(err){console.warn(err)}
    
});

const options = {
    root: path.join(__dirname)
};

app.get('/', async (req, res) => {
    res.sendFile("index.html", options);
});

app.get('/text', async (req, res) => {
    res.sendFile("text.txt", options);
});

app.get('/main.js',async (req, res) => {
    res.sendFile("main.js", options);
});

app.get('*',async (req, res) => {
    let errorpage = fs.readFileSync('404.html', 'utf-8').replace("${page}", req.path);
    res.status(404).send(errorpage);
})

app.use(async(err, req, res, next) => {
    if(!err) return next();
    res.err = err;
    res.status(500).json({ status: "Server error" });
    throw err;
});

app.listen(serveraddr, async() => {
    console.log(`Server running`);
});


(async function() {
    const httplistener   = await ngrok.forward({ addr: serveraddr, authtoken_from_env: true });
    console.log(`HTTPS ingress established at: ${httplistener.url()}`);
    wssAddr = httplistener.url().replace('https', 'wss') + '/socket';
    

    ON_DEATH((signal, err) => {
        fs.writeFileSync("text.txt", stringThing);
        process.exit();
    })
})();
