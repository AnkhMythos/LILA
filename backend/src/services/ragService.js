// backend/src/services/ragService.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEmbeddings } from './ollama.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RAGService {
  constructor() {
    this.knowledgePath = path.join(__dirname, '../../knowledge');
    this.documents = [];          // { id, content, source, embedding }
    this.vectorIndex = [];        // mismo array, pero podemos tenerlo separado
    this.loaded = false;
    this.loadDocuments();
  }

  // ============================================
  // CARGA INICIAL
  // ============================================
  async loadDocuments() {
    try {
      await fs.mkdir(this.knowledgePath, { recursive: true });
      const files = await fs.readdir(this.knowledgePath);
      let count = 0;

      for (const file of files) {
        if (file.endsWith('.txt') || file.endsWith('.md')) {
          const filePath = path.join(this.knowledgePath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          // Generar embedding al cargar
          const embedding = await this._getEmbedding(content);
          if (embedding && embedding.length > 0) {
            this.documents.push({
              id: file,
              content,
              source: file,
              embedding
            });
            count++;
          }
        }
      }
      this.loaded = true;
      console.log(`📚 RAG: ${count} documentos cargados y vectorizados.`);
    } catch (error) {
      console.error('Error cargando documentos RAG:', error);
    }
  }

  // ============================================
  // OBTENER EMBEDDING
  // ============================================
  async _getEmbedding(text) {
    try {
      // Usar modelo de embeddings (puedes cambiarlo por 'nomic-embed-text' si lo tienes)
      const embedding = await getEmbeddings(text, 'nomic-embed-text');
      return embedding;
    } catch (error) {
      console.warn('Error generando embedding, usando fallback de palabras:', error.message);
      // Fallback: embedding simulado (no recomendado para producción)
      return null;
    }
  }

  // ============================================
  // AGREGAR DOCUMENTO (desde archivo o texto)
  // ============================================
  async addDocument(content, filename = null) {
    if (!filename) {
      filename = `doc_${Date.now()}.txt`;
    }
    // Evitar duplicados
    const existing = this.documents.find(d => d.id === filename);
    if (existing) {
      // Actualizar contenido y embedding
      const embedding = await this._getEmbedding(content);
      if (embedding && embedding.length > 0) {
        existing.content = content;
        existing.embedding = embedding;
        await fs.writeFile(path.join(this.knowledgePath, filename), content, 'utf-8');
        return { success: true, filename, updated: true };
      }
    }

    const embedding = await this._getEmbedding(content);
    if (!embedding || embedding.length === 0) {
      return { success: false, error: 'No se pudo generar embedding' };
    }

    const filePath = path.join(this.knowledgePath, filename);
    await fs.writeFile(filePath, content, 'utf-8');

    this.documents.push({
      id: filename,
      content,
      source: filename,
      embedding
    });

    console.log(`📄 Documento RAG añadido: ${filename}`);
    return { success: true, filename };
  }

  // ============================================
  // BÚSQUEDA POR SIMILITUD COSENO
  // ============================================
  async search(query, topK = 3) {
    if (this.documents.length === 0) return [];

    // Obtener embedding de la consulta
    const queryEmbedding = await this._getEmbedding(query);
    if (!queryEmbedding || queryEmbedding.length === 0) {
      // Fallback a búsqueda por palabras si falla el embedding
      return this._searchFallback(query, topK);
    }

    const results = this.documents.map(doc => {
      const score = this._cosineSimilarity(queryEmbedding, doc.embedding);
      return { ...doc, score };
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  // Fallback si no hay embeddings (búsqueda por palabras)
  _searchFallback(query, topK = 3) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const results = this.documents.map(doc => {
      let score = 0;
      const content = doc.content.toLowerCase();
      for (const word of queryWords) {
        if (content.includes(word)) score += 1;
        const count = (content.match(new RegExp(word, 'g')) || []).length;
        score += count * 0.5;
      }
      return { ...doc, score };
    });
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  // ============================================
  // SIMILITUD COSENO
  // ============================================
  _cosineSimilarity(a, b) {
    if (!a || !b || a.length === 0 || b.length === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // ============================================
  // LISTAR DOCUMENTOS
  // ============================================
  listDocuments() {
    return this.documents.map(doc => ({
      id: doc.id,
      source: doc.source,
      size: doc.content.length
    }));
  }

  // ============================================
  // ELIMINAR DOCUMENTO
  // ============================================
  async deleteDocument(filename) {
    try {
      const filePath = path.join(this.knowledgePath, filename);
      await fs.unlink(filePath);
      this.documents = this.documents.filter(doc => doc.id !== filename);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Instancia global
const ragService = new RAGService();
export default ragService;