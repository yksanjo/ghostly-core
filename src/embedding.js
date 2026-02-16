/**
 * Ghostly Core - Embedding Layer
 * Handles embedding generation for terminal episodes
 */

import OpenAI from 'openai';

let openaiClient = null;

/**
 * Initialize OpenAI client
 * @param {string} apiKey - OpenAI API key
 * @returns {Object} OpenAI client
 */
export function initOpenAI(apiKey) {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

/**
 * Get OpenAI client
 * @returns {Object} OpenAI client
 */
export function getClient() {
  return openaiClient;
}

/**
 * Generate embedding for text
 * @param {string} text - Text to embed
 * @param {string} model - Embedding model (default: text-embedding-ada-002)
 * @returns {Promise<Array<number>>} Embedding vector
 */
export async function generateEmbedding(text, model = 'text-embedding-ada-002') {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized. Call initOpenAI() first.');
  }
  
  const response = await openaiClient.embeddings.create({
    model,
    input: text
  });
  
  return response.data[0].embedding;
}

/**
 * Generate embedding for an episode
 * @param {Object} episode - Episode data
 * @param {string} model - Embedding model
 * @returns {Promise<Array<number>>} Embedding vector
 */
export async function generateEpisodeEmbedding(episode, model) {
  const text = formatEpisode(episode);
  return generateEmbedding(text, model);
}

/**
 * Format episode for embedding
 * @param {Object} episode - Episode data
 * @returns {string} Formatted text
 */
export function formatEpisode(episode) {
  const parts = [];
  
  if (episode.problem) parts.push(`Problem: ${episode.problem}`);
  if (episode.environment) parts.push(`Environment: ${episode.environment}`);
  if (episode.fix) parts.push(`Fix: ${episode.fix}`);
  if (episode.keywords) parts.push(`Keywords: ${episode.keywords}`);
  if (episode.summary) parts.push(`Summary: ${episode.summary}`);
  
  return parts.join('\n');
}

/**
 * Calculate cosine similarity between two vectors
 * @param {Array<number>} a - First vector
 * @param {Array<number>} b - Second vector
 * @returns {number} Similarity score (0-1)
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (normA * normB);
}

/**
 * Calculate command similarity
 * @param {string} cmd1 - First command
 * @param {string} cmd2 - Second command
 * @returns {number} Similarity score (0-1)
 */
export function commandSimilarity(cmd1, cmd2) {
  if (!cmd1 || !cmd2) return 0;
  
  const normalize = (cmd) => cmd.toLowerCase().trim().split(/\s+/);
  const parts1 = normalize(cmd1);
  const parts2 = normalize(cmd2);
  
  const cmdName1 = parts1[0];
  const cmdName2 = parts2[0];
  
  if (cmdName1 === cmdName2) {
    if (parts1.length === 1 && parts2.length === 1) return 1.0;
    
    const args1 = parts1.slice(1).sort();
    const args2 = parts2.slice(1).sort();
    const intersection = args1.filter(arg => args2.includes(arg)).length;
    const union = new Set([...args1, ...args2]).size;
    
    return union > 0 ? intersection / union : 0;
  }
  
  return 0;
}

export default {
  initOpenAI,
  getClient,
  generateEmbedding,
  generateEpisodeEmbedding,
  formatEpisode,
  cosineSimilarity,
  commandSimilarity
};
