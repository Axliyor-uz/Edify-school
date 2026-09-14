/**
 * Web Worker wrapper around engine.ts — keeps deep searches (difficulty 5
 * thinks for ~2.6s) completely off the UI thread. Spawned by page.tsx via
 * `new Worker(new URL('./aiWorker.ts', import.meta.url))`.
 */
import { findBestMove, SearchRequest, SearchResult } from './engine';

self.onmessage = (e: MessageEvent<SearchRequest & { requestId: number }>) => {
  const { requestId, ...request } = e.data;
  const result: SearchResult = findBestMove(request);
  (self as unknown as Worker).postMessage({ requestId, ...result });
};
