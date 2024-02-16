const ws = new WebSocket("wss://" + location.host + "/socket");

var dataDisplay = document.getElementById("dataDisplay");
var cooldownDisplay = document.getElementById("cooldownDisplay");

const insertAt = (str, sub, pos) => `${str.slice(0, pos)}${sub}${str.slice(pos)}`;
const removeAt = (str, pos) => str.slice(0, pos - 1) + str.slice(pos);

var cooldown = Date.now();

function insertChar(char, loc) {
    var caretLoc = dataDisplay.selectionEnd;
    dataDisplay.value = insertAt(dataDisplay.value, char, loc);
    if (dataDisplay.selectionEnd >= loc) {
        dataDisplay.selectionEnd = caretLoc + 1;
    }
    updateTextbox();
}

function deleteChar(loc) {
    
    var caretLoc = dataDisplay.selectionEnd;
    dataDisplay.value = removeAt(dataDisplay.value, loc);
    if (dataDisplay.selectionEnd >= loc) {
        dataDisplay.selectionEnd = caretLoc - 1;
    }
    updateTextbox();
}

function insertCharSync(char, loc) {
    insertChar(char, loc);
    ws.send(JSON.stringify({ 
        messageType: 'insertChar', 
        char: char, 
        loc: loc
     }))
}

function deleteCharSync(loc) {
    deleteChar(loc);
    ws.send(JSON.stringify({ 
        messageType: 'deleteChar', 
        loc: loc
     }))
}

function updateTextbox() {
    dataDisplay.selectionStart = dataDisplay.selectionEnd;
    dataDisplay.style.height = 'auto';
    dataDisplay.style.height = dataDisplay.scrollHeight + "px";
}

dataDisplay.addEventListener('select', updateTextbox, false);

dataDisplay.addEventListener("beforeinput", (e) => {
    var now = Date.now();
    if (now > cooldown) {
        var caret = e.target.selectionEnd;
        if (Date.now() > cooldown) {
            if (e.inputType == "insertText") {
                insertCharSync(e.data[0], caret);
            } else if (e.inputType == "deleteContentBackward" && caret != 0) {
                deleteCharSync(caret);
            } else if (e.inputType == "insertLineBreak") {
                insertCharSync('\n', caret);
            }
        }
        cooldown = Date.now() + cooldownAmt;
    }
    e.preventDefault();
})

ws.onmessage = (event) => {
    data = JSON.parse(event.data);
    if (data.messageType == "data") {
        dataDisplay.value = data.messageData;
        updateTextbox();
    } else if (data.messageType == "insertChar") {
        insertChar(data.char, data.loc);
    } else if (data.messageType == "deleteChar") {
        deleteChar(data.loc);
    } else if (data.messageType == "cooldown") {
        cooldown = Number(data.messageData);
    } else if (data.messageType == "error") {
        alert(data.messageData);
    }
}

setInterval(() => {
    var now = Date.now();
    if (now > cooldown) {
        cooldownDisplay.textContent = 0;
        cooldownDisplay.style.color = "green";
    } else {
        cooldownDisplay.textContent = (cooldown - now)/1000;
        cooldownDisplay.style.color = "red";
    }
}, 20);