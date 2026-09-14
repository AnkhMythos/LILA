// backend/src/services/memoryStore.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MemoryStore {
  constructor() {
    this.dataPath = path.join(__dirname, '../../data/memory.json');
    this.data = {};
    this.load();
  }

  async load() {
    try {
      await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
      try {
        await fs.access(this.dataPath);
      } catch {
        await fs.writeFile(this.dataPath, '{}');
      }
      const raw = await fs.readFile(this.dataPath, 'utf-8');
      this.data = JSON.parse(raw);
    } catch (e) {
      console.warn('Error cargando memoria, usando objeto vacío:', e);
      this.data = {};
    }
  }

  async save() {
    try {
      await fs.writeFile(this.dataPath, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('Error guardando memoria:', e);
    }
  }

  // ----- MEMORIA DE HECHOS -----
  get(userId) {
    if (!this.data[userId]) this.data[userId] = {};
    return this.data[userId];
  }

  async set(userId, key, value) {
    if (!this.data[userId]) this.data[userId] = {};
    this.data[userId][key] = value;
    await this.save();
  }

  async delete(userId, key) {
    if (this.data[userId] && key in this.data[userId]) {
      delete this.data[userId][key];
      await this.save();
      return 1;
    }
    return 0;
  }

  // Devuelve el número de claves borradas (sin contar _history)
  async deleteAll(userId) {
    if (this.data[userId]) {
      const count = Object.keys(this.data[userId]).filter(k => k !== '_history').length;
      delete this.data[userId];
      await this.save();
      return count;
    }
    return 0;
  }

  // ----- HISTORIAL DE CONVERSACIÓN -----
  getHistory(userId) {
    if (!this.data[userId]) this.data[userId] = {};
    if (!this.data[userId]._history) this.data[userId]._history = [];
    return this.data[userId]._history;
  }

  async addToHistory(userId, role, content) {
    const history = this.getHistory(userId);
    history.push({ role, content });
    if (history.length > 15) history.shift();
    await this.save();
  }

  async clearHistory(userId) {
    if (this.data[userId]) {
      this.data[userId]._history = [];
      await this.save();
    }
  }
}

const memoryStore = new MemoryStore();
export default memoryStore;