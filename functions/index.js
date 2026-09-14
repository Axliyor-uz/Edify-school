/**
 * Edify-Student Cloud Functions — entry point.
 *
 * Initializes Firebase Admin SDK and re-exports all function groups.
 */
const { initializeApp } = require('firebase-admin/app');

initializeApp();

// ── Hikvision face terminal bridge ──────────────────────────────────────────
const hikvision = require('./hikvision');

exports.hikPollAttendance = hikvision.hikPollAttendance;
exports.hikWebhook        = hikvision.hikWebhook;
exports.hikSaveConfig     = hikvision.hikSaveConfig;
exports.hikStatus         = hikvision.hikStatus;
exports.hikTest           = hikvision.hikTest;
exports.hikEnrollFace     = hikvision.hikEnrollFace;
exports.hikDevices        = hikvision.hikDevices;
