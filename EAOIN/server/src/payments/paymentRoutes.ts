/**
 * paymentRoutes — the HTTP surface the game client talks to.
 *
 * Deliberately tiny, and deliberately built on the raw `http` server the
 * multiplayer backend already runs, so payments need no extra process.
 *
 *   POST /api/payments/checkout            → create a PayPal order
 *   GET  /api/payments/checkout/:orderRef  → capture + report the outcome
 *   POST /api/payments/webhook             → PayPal server-to-server callback
 *   GET  /api/payments/config              → public config (client id, env)
 *
 * The webhook route reads the RAW body, because PayPal's signature is computed
 * over the exact bytes sent. Parsing and re-serialising would break it.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { COIN_PACKS } from '../../../shared/src/economy/CoinPacks';
import { PaymentService, PaymentValidationError } from './PaymentService';
import { PayPalClient } from './PayPalClient';

const PREFIX = '/api/payments';
/** Refuse absurd bodies rather than buffering them. */
const MAX_BODY_BYTES = 64 * 1024;

export interface PaymentRoutesOptions {
  service: PaymentService;
  paypal: PayPalClient;
  /** Public PayPal client id, safe to expose to the browser. */
  publicClientId: string;
  /**
   * Resolves the player making the request. Wire this to your real session /
   * JWT check. The default derives a stable id from the bearer token so the
   * flow is testable without an auth server.
   */
  resolvePlayerId?: (req: IncomingMessage) => string | null;
}

export function createPaymentRoutes(options: PaymentRoutesOptions) {
  const { service, paypal, publicClientId } = options;
  const resolvePlayerId = options.resolvePlayerId ?? defaultResolvePlayerId;

  /**
   * Returns true when the request was a payments route and has been answered.
   * Lets the caller fall through to its other handlers otherwise.
   */
  return async function handlePaymentRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith(PREFIX)) return false;

    const route = url.pathname.slice(PREFIX.length) || '/';

    try {
      if (req.method === 'OPTIONS') {
        writeCors(res);
        res.writeHead(204).end();
        return true;
      }

      if (req.method === 'GET' && route === '/config') {
        sendJson(res, 200, {
          clientId: publicClientId,
          environment: paypal.environment,
          live: paypal.isLive,
          currency: 'USD',
          packs: COIN_PACKS,
        });
        return true;
      }

      if (req.method === 'POST' && route === '/checkout') {
        const playerId = resolvePlayerId(req);
        if (!playerId) {
          sendJson(res, 401, { error: 'Sign in before buying coins.' });
          return true;
        }
        const body = await readJsonBody(req);
        const session = await service.createCheckout(playerId, (body as { packId?: unknown })?.packId);
        sendJson(res, session.status === 'failed' ? 502 : 200, session);
        return true;
      }

      const confirmMatch = /^\/checkout\/([A-Za-z0-9_-]+)$/.exec(route);
      if (req.method === 'GET' && confirmMatch) {
        const playerId = resolvePlayerId(req);
        if (!playerId) {
          sendJson(res, 401, { error: 'Sign in before confirming a purchase.' });
          return true;
        }
        const result = await service.confirmCheckout(playerId, confirmMatch[1]);
        sendJson(res, 200, result);
        return true;
      }

      if (req.method === 'POST' && route === '/webhook') {
        // Signature is computed over the raw bytes — do not parse first.
        const raw = await readRawBody(req);
        const verified = await paypal.verifyWebhookSignature(normalizeHeaders(req.headers), raw);
        if (!verified) {
          // Fail closed. An unverified event never credits anything.
          sendJson(res, 400, { error: 'Webhook signature verification failed.' });
          return true;
        }
        let event: unknown;
        try {
          event = JSON.parse(raw);
        } catch {
          sendJson(res, 400, { error: 'Malformed webhook body.' });
          return true;
        }
        await service.handleWebhookEvent(event as { event_type?: string; resource?: unknown });
        // PayPal retries on any non-2xx, so acknowledge as soon as we've acted.
        sendJson(res, 200, { received: true });
        return true;
      }

      sendJson(res, 404, { error: 'Unknown payments route.' });
      return true;
    } catch (error) {
      if (error instanceof PaymentValidationError) {
        sendJson(res, error.statusCode, { error: error.message });
        return true;
      }
      console.error('[Payments] Unhandled error', error);
      sendJson(res, 500, { error: 'Payment processing error.' });
      return true;
    }
  };
}

/* -------------------------------------------------------------------------- */

function defaultResolvePlayerId(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token.length > 0) return `player_${hash(token)}`;
  }
  const headerId = req.headers['x-eaoin-player'];
  if (typeof headerId === 'string' && headerId.length > 0) return headerId;
  return null;
}

function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function normalizeHeaders(headers: IncomingMessage['headers']): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }
  return out;
}

function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new PaymentValidationError('Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const raw = await readRawBody(req);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new PaymentValidationError('Malformed JSON body.');
  }
}

function writeCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-EAOIN-Player');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  writeCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export default createPaymentRoutes;
