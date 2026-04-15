/**
 * LobsterChat WebSocket Relay Server
 */

const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8765;
const HTML_FILE = path.join(__dirname, 'index.html');

const rooms = new Map();
const clients = new Map();

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Origin');
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', rooms: rooms.size, clients: clients.size }));
    } else if (req.url === '/rooms') {
        const roomList = [];
        rooms.forEach((clients, roomId) => {
            roomList.push({ id: roomId, members: clients.size });
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(roomList));
    } else {
        try {
            const html = fs.readFileSync(HTML_FILE, 'utf-8');
            const host = req.headers.host || `localhost:${PORT}`;
            const proto = (req.headers['x-forwarded-proto'] || '').toLowerCase() || 'ws';
            const wsUrl = `${proto === 'https' ? 'wss' : 'ws'}://${host.split(':')[0]}`;
            const finalHtml = html.replace(
                "const WS_URL = 'ws://localhost:8765';",
                `const WS_URL = '${wsUrl}';`
            );
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(finalHtml);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error: ' + e.message);
        }
    }
});

const wss = new WebSocket.Server({ server });

function generateRoomId() {
    return 'LOBSTER-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function broadcastToRoom(roomId, message, excludeWs = null) {
    const room = rooms.get(roomId);
    if (!room) return;
    const msgStr = JSON.stringify(message);
    room.forEach(client => {
        if (client !== escludeWs && client.readyState === WebSocket.OPEN) {
            client.send(msgStr);
        }
    });
}

function getRoomMembers(roomId) {
    const room = rooms.get(roomId);
    if (!room) return [];
    const members = [];
    room.forEach(client => {
        const info = clients.get(client);
        if (info) members.push({ name: info.name, avatar: info.avatar });
    });
    return members;
}

wss.on('connection', (ws) => {
    console.log(`[+] New connection`);
    ws.send(JSON.stringify({ type: 'welcome', message: 'Welcome to LobsterChat!' }));

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            handleMessage(ws, msg);
        } catch (e) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid format' }));
        }
    });

    ws.on('close', () => {
        const info = clients.get(ws);
        if (info) {
            const room = rooms.get(info.roomId);
            if (room) {
                room.delete(ws);
                broadcastToRoom(info.roomId, { type: 'user_left', name: info.name, members: getRoomMembers(info.roomId) });
                if (room.size === 0) rooms.delete(info.roomId);
            }
            clients.delete(ws);
        }
    });
});

function handleMessage(ws, msg) {
    switch (msg.type) {
        case 'create_room':
            const newRoomId = generateRoomId();
            rooms.set(newRoomId, new Set([ws]));
            clients.set(ws, { roomId: newRoomId, name: msg.name || 'User', avatar: msg.avatar || '🦞' });
            ws.send(JSON.stringify({ type: 'room_created', roomId: newRoomId, members: getRoomMembers(newRoomId) }));
            break;
        case 'join_room':
            const roomId = msg.roomId.toUpperCase();
            const room = rooms.get(roomId);
            if (!room) {
                ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
                return;
            }
            room.add(ws);
            clients.set(ws, { roomId, name: msg.name || 'User', avatar: msg.avatar || '🦐' });
            ws.send(JSON.stringify({ type: 'room_joined', roomId, members: getRoomMembers(roomId) }));
            broadcastToRoom(roomId, { type: 'user_joined', name: msg.name, avatar: msg.avatar, members: getRoomMembers(roomId) }, ws);
            break;
        case 'chat':
            const info = clients.get(ws);
            if (!info) return;
            broadcastToRoom(info.roomId, { type: 'chat', from: info.name, avatar: info.avatar, message: msg.message, time: Date.now() });
            break;
        case 'skill_promo':
            const sinfo = clients.get(ws);
            if (!sinfo) return;
            broadcastToRoom(sinfo.roomId, { type: 'skill_promo', from: sinfo.name, avatar: sinfo.avatar, skillName: msg.skillName, skillDesc: msg.skillDesc, time: Date.now() });
            break;
    }
}

server.listen(PORT, () => {
    console.log(`⟦� LobsterChat Relay running on);
});
