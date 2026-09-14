// backend/src/agents/control-remoto.js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Importación infalible de módulo CommonJS en entorno ESM
const usb = require('usb');
import net from 'net';
import EventEmitter from 'events';

class ControlRemoto extends EventEmitter {
    constructor() {
        super();
        this.devices = [];
        this.connections = new Map();
        this.isScanning = false;
    }

    startScanning(interval = 5000) {
        if (this.isScanning) return;
        this.isScanning = true;
        this.scanDevices();
        this._interval = setInterval(() => this.scanDevices(), interval);
        console.log('🔍 Escaneo de dispositivos iniciado.');
    }

    stopScanning() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
        this.isScanning = false;
        console.log('⏹️ Escaneo detenido.');
    }

    scanDevices() {
        try {
            // Ahora usb.getDeviceList funcionará sin errores
            const devices = usb.getDeviceList();
            const filtered = devices.filter(dev => {
                return dev.deviceDescriptor && dev.deviceDescriptor.idVendor;
            });
            this.devices = filtered;
            this.emit('devices-updated', this.devices);
            console.log(`📡 ${this.devices.length} dispositivo(s) USB encontrados.`);
        } catch (err) {
            console.error('❌ Error al escanear USB:', err);
        }
    }

    connectDevice(device, port = 8080, host = '192.168.1.100') {
        if (this.connections.has(device)) {
            console.warn(`⚠️ Ya existe conexión para el dispositivo ${device}`);
            return;
        }

        const socket = net.createConnection(port, host, () => {
            console.log(`✅ Conectado a dispositivo ${device} en ${host}:${port}`);
            this.emit('connected', { device, socket });
        });

        socket.on('data', (data) => {
            console.log(`📩 Datos de ${device}: ${data.toString()}`);
            this.emit('data', { device, data: data.toString() });
        });

        socket.on('error', (err) => {
            console.error(`❌ Error en ${device}:`, err);
            this.emit('error', { device, error: err });
        });

        socket.on('close', () => {
            console.log(`🔌 Desconectado de ${device}`);
            this.connections.delete(device);
            this.emit('disconnected', { device });
        });

        this.connections.set(device, socket);
    }

    disconnectDevice(device) {
        const socket = this.connections.get(device);
        if (socket) {
            socket.end();
            this.connections.delete(device);
            console.log(`🔌 Desconexión iniciada para ${device}`);
        } else {
            console.warn(`⚠️ No hay conexión activa para ${device}`);
        }
    }

    sendCommand(device, command) {
        const socket = this.connections.get(device);
        if (!socket) {
            console.warn(`⚠️ No hay conexión activa para ${device}`);
            return false;
        }
        socket.write(command + '\n');
        console.log(`📤 Comando enviado a ${device}: ${command}`);
        return true;
    }

    startControl(port = 8080, host = '192.168.1.100') {
        this.startScanning();
        this.on('devices-updated', (devices) => {
            for (const dev of devices) {
                const deviceId = `${dev.deviceDescriptor.idVendor}:${dev.deviceDescriptor.idProduct}`;
                if (!this.connections.has(deviceId)) {
                    this.connectDevice(deviceId, port, host);
                }
            }
        });
    }
}

export default new ControlRemoto();