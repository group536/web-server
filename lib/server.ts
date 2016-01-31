import http = require('http');
import url = require('url');
import ws = require('ws');

type Gait = "standing" | "walking" | "running" | "sprinting" | "unknown";

const server = http.createServer();
server.listen(536, function() {
    console.log((new Date()) + ' Server is listening on port 536');
});

const wss = new ws.Server({
    server: server
});

let aveFreq: number;
let aveEnergy: number;
let lastTime = new Date().getTime() / 1000;
let lastGait: Gait = "unknown";
let history = 0;
const threshold = 0.9;
const maxHistory = 1;
const maxFreq = 4; // Try swinging your hand 4 times per second

wss.on('connection', function(ws) {
    ws.on('message', function incoming(message: string) {
        var msg = JSON.parse(message);
        if (msg.type === 'gait') {
            if (update(JSON.parse(message))) {
                wss.clients.forEach(function(ws) {
                    ws.send(JSON.stringify(makeAppCommand()));
                })
            }
        } else if (msg.type === 'gesture') {
            console.log(msg);
        }
    });

    ws.send(JSON.stringify({ message: "connection opened" }));
});

function update(message: MyoStatus): boolean {
    let currentFreq = getFrequency(message);
    let currentEnergy = getEnergy(message);

    let lastFreq = aveFreq;
    let lastEnergy = aveEnergy;

    aveFreq = aveFreq
        ? Math.min(biasedAverage(aveFreq, currentFreq), maxFreq)
        : currentFreq;
    aveEnergy = aveEnergy
        ? biasedAverage(aveEnergy, currentEnergy)
        : currentEnergy;

    lastTime = message.timestamp;
    console.log(aveFreq, aveEnergy);

    let gait = getGait();
    return (gait !== "unknown") && (lastGait !== (lastGait = gait)); // true || shouldNotify(lastFreq, aveFreq) || shouldNotify(lastEnergy, aveEnergy);
}

function shouldNotify(last: number, newVal: number): boolean {
    return (Math.min(last, newVal) / Math.max(last, newVal)) < threshold;
}

function makeAppCommand(): AppCommand {
    return {
        bpm: aveFreq * 60,
        gait: getGait(),
        energy: aveEnergy
    };
}

function biasedAverage(last: number, current: number) {
    let result = (last * history + current) / (history + 1);
    history = Math.min(history + 1, maxHistory);

    return result;
}

function getFrequency(message: MyoStatus) {
    return 1 / (message.timestamp - lastTime)
}

function getEnergy(message: MyoStatus) {
    return message.peak - message.trough;
}

function getGait(): Gait {
    if (aveEnergy > 800)
        return "sprinting";
    if ((aveFreq >= 1.3) && (aveFreq < 2) && (aveEnergy >= 500))
        return "running"
    if ((aveFreq >= 0.3) && (aveFreq < 1.3) && (aveEnergy >= 100) && (aveEnergy < 500)) // dzed waves his arms around too much for this to work -> && aveEnergy < 330)
        return "walking";
    if (aveEnergy < 100)
        return "standing";
    return "unknown"
}


interface MyoStatus {
    timestamp: number;
    peak: number;
    trough: number;
}

interface AppCommand {
    bpm: number;
    gait: Gait;
    energy: number;
}

enum Gesture {
    Rest,
    Fist,
    WaveIn,
    WaveOut,
    FingersSpread,
    DoubleTap,
    Unknown
}