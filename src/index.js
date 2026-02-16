/**
 * Ghostly Core - Main Entry Point
 * Minimal library for terminal memory storage and embeddings
 */

export * from './database.js';
export * from './embedding.js';

export default {
  ...require('./database.js'),
  ...require('./embedding.js')
};
