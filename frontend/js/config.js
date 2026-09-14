// frontend/js/config.js

// ============================================================
// URLs (var → expone window.API_BASE automáticamente)
// ============================================================
var API_BASE = 'http://127.0.0.1:8000';
var WS_URL   = 'ws://127.0.0.1:8000/api/instances/ws';

// ============================================================
// CONSTANTES
// ============================================================
var LILA_VERSION = '1.0.0';
var USER_ID = 'usuario_' + Math.random().toString(36).substring(2, 10);

// ============================================================
// ESTADO GLOBAL
// ============================================================
var modeloActual = 'llama3.2:3b';
var listaModelos = [];
var temperatura = 0.7;
var historialConversacion = [];
var archivosSubidos = [];
var memoriaUsuario = {};
var historialComandos = [];
var indiceComando = -1;
var dialogoActivo = false;
var ws = null;
var reconnectInterval = null;

var vozActivada = false;
var vozSeleccionada = null;
var vocesDisponibles = [];
var velocidadVoz = 1.2;
var tonoVoz = 1.2;
var volumenVoz = 1.0;

var escuchando = false;
var reconocimiento = null;

var phaseoneActivo = false;
var multiagenteActivo = false;

console.log('🧉 config.js cargado');