# Ghostly Core

> Minimal library for terminal memory storage and embedding layers.

Part of the Ghostly Memory Bank ecosystem - extracted core modules for reuse.

## Install

```bash
npm install ghostly-core
```

## Usage

```javascript
import { initDatabase, insertEpisode, insertEmbedding, generateEmbedding } from 'ghostly-core';

// Initialize database
await initDatabase('./data/ghostly.db');

// Initialize OpenAI
import { initOpenAI } from 'ghostly-core';
initOpenAI(process.env.OPENAI_API_KEY);

// Store an episode with embedding
const episodeId = insertEpisode({
  project_hash: 'abc123',
  summary: 'npm build failed',
  problem: 'Module not found',
  fix: 'npm install',
  keywords: 'npm,build,error'
});

// Generate and store embedding
const embedding = await generateEmbedding('npm build failed - Module not found');
insertEmbedding(episodeId, 'text-embedding-ada-002', embedding);
```

## API

### Database (`./database.js`)

- `initDatabase(dbPath)` - Initialize SQLite database
- `insertEvent(event)` - Insert terminal event
- `insertEpisode(episode)` - Insert episode
- `getEpisodes(projectHash, limit)` - Get episodes for project
- `searchEpisodes(query, limit)` - Search episodes
- `insertEmbedding(episodeId, model, vector)` - Store embedding
- `getEmbedding(episodeId)` - Get embedding
- `upsertProject(project)` - Insert/update project
- `getProject(projectHash)` - Get project
- `getStats()` - Get statistics

### Embedding (`./embedding.js`)

- `initOpenAI(apiKey)` - Initialize OpenAI client
- `generateEmbedding(text, model)` - Generate embedding
- `generateEpisodeEmbedding(episode, model)` - Generate for episode
- `cosineSimilarity(a, b)` - Calculate similarity
- `commandSimilarity(cmd1, cmd2)` - Command similarity

## License

MIT
