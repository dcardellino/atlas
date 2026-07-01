import { defaultCache } from "@serwist/next/worker";
import type {
  PrecacheEntry,
  RuntimeCaching,
  SerwistGlobalConfig,
} from "serwist";
import { NetworkFirst, Serwist } from "serwist";

// Service worker entry compiled by @serwist/next into public/sw.js.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Offline-tolerant reads (TASK-047, FR-011). A NetworkFirst strategy for page
 * navigations serves the last successfully loaded page from cache when the
 * network is slow/unavailable — so already-viewed data (Today etc.) stays
 * readable in airplane mode. Everything else uses Serwist's default caching.
 */
const offlineReads: RuntimeCaching[] = [
  {
    matcher: ({ request }) => request.mode === "navigate",
    handler: new NetworkFirst({
      cacheName: "pages",
      networkTimeoutSeconds: 3,
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...offlineReads, ...defaultCache],
});

serwist.addEventListeners();
