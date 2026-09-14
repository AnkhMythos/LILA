// backend/src/services/websocket.js

import { WebSocketServer } from 'ws';

export function setupWebSocket(server) {
    const wss = new WebSocketServer({ server, path: '/api/instances/ws' });
    // path: '/api/instances/ws'

    wss.on('connection', (ws) => {
        console.log('Nueva conexión WebSocket');

        ws.on('message', (data) => {
            // Reenviar a todos excepto al emisor
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === 1) {
                    client.send(data.toString());
                }
            });
        });

        ws.on('close', () => {
            console.log('Conexión WebSocket cerrada');
        });
    });

    return wss;
}