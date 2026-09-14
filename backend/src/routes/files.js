// src/routes/files.js

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configurar multer para subir archivos
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/plain', 'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png', 'image/gif',
      'application/json', 'text/csv'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'), false);
    }
  }
});

// ============================================
// SUBIR ARCHIVO
// ============================================
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    // Leer contenido del archivo
    const filePath = req.file.path;
    const content = await fs.readFile(filePath, 'utf-8');
    
    res.json({
      success: true,
      message: 'Archivo subido exitosamente',
      file: {
        name: req.file.originalname,
        size: req.file.size,
        path: req.file.path,
        mimetype: req.file.mimetype,
        content: content.substring(0, 1000) // Vista previa
      }
    });
  } catch (error) {
    console.error('Error subiendo archivo:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LISTAR ARCHIVOS
// ============================================
router.get('/list', async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, '../../uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    
    const files = await fs.readdir(uploadDir);
    const fileDetails = await Promise.all(
      files.map(async (file) => {
        const stat = await fs.stat(path.join(uploadDir, file));
        return {
          name: file,
          size: stat.size,
          modified: stat.mtime,
          created: stat.birthtime
        };
      })
    );
    
    res.json({ success: true, files: fileDetails });
  } catch (error) {
    console.error('Error listando archivos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ELIMINAR ARCHIVO
// ============================================
router.delete('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads', filename);
    
    // Verificar que existe
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
    await fs.unlink(filePath);
    res.json({ success: true, message: 'Archivo eliminado' });
  } catch (error) {
    console.error('Error eliminando archivo:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LEER ARCHIVO
// ============================================
router.get('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads', filename);
    
    // Verificar que existe
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({
      success: true,
      filename,
      content,
      size: content.length
    });
  } catch (error) {
    console.error('Error leyendo archivo:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;