/**
 * KONOMI v3.1 - ε (Epsilon) Subsystem: API
 *
 * ε:api{ε1→route, ε2→validate, ε3→respond, ε4→stream}
 *
 * API:/{e}/{r}/{a}?{p}|WS:∞(▽→λ→△)
 *
 * Manages HTTP/WebSocket API with routing, validation, responses, and streaming.
 */

import { Result, success, failure, EpsilonOps, StreamMessage } from '../core/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// API PATH TYPES - /{entity}/{resource}/{action}?{params}
// ═══════════════════════════════════════════════════════════════════════════

/** HTTP methods */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

/** Parsed API path */
export interface ApiPath {
  entity: string;      // {e} - The entity type (e.g., 'equipment', 'tags')
  resource?: string;   // {r} - The resource ID
  action?: string;     // {a} - The action to perform
  params: URLSearchParams;  // {p} - Query parameters
}

/** Route definition */
export interface Route {
  method: HttpMethod;
  pattern: string;     // e.g., '/:entity/:resource?/:action?'
  handler: RouteHandler;
  middleware?: Middleware[];
  schema?: ValidationSchema;
}

/** Request context */
export interface RequestContext {
  method: HttpMethod;
  path: ApiPath;
  headers: Map<string, string>;
  body?: unknown;
  params: Map<string, string>;
  state: Map<string, unknown>;
}

/** Response structure */
export interface ApiResponse<T = unknown> {
  status: number;
  headers: Map<string, string>;
  body?: T;
}

/** Route handler */
export type RouteHandler = (ctx: RequestContext) => Promise<ApiResponse> | ApiResponse;

/** Middleware function */
export type Middleware = (
  ctx: RequestContext,
  next: () => Promise<ApiResponse>
) => Promise<ApiResponse>;

// ═══════════════════════════════════════════════════════════════════════════
// ε1: ROUTE - Request routing
// ═══════════════════════════════════════════════════════════════════════════

/** Router for managing routes */
export class Router {
  private routes: Route[] = [];

  /**
   * Add a route
   */
  add(route: Route): void {
    this.routes.push(route);
  }

  /**
   * Add GET route
   */
  get(pattern: string, handler: RouteHandler, options?: Partial<Route>): void {
    this.add({ method: 'GET', pattern, handler, ...options });
  }

  /**
   * Add POST route
   */
  post(pattern: string, handler: RouteHandler, options?: Partial<Route>): void {
    this.add({ method: 'POST', pattern, handler, ...options });
  }

  /**
   * Add PUT route
   */
  put(pattern: string, handler: RouteHandler, options?: Partial<Route>): void {
    this.add({ method: 'PUT', pattern, handler, ...options });
  }

  /**
   * Add DELETE route
   */
  delete(pattern: string, handler: RouteHandler, options?: Partial<Route>): void {
    this.add({ method: 'DELETE', pattern, handler, ...options });
  }

  /**
   * Match a request to a route
   */
  match(method: HttpMethod, path: string): { route: Route; params: Map<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const params = matchPattern(route.pattern, path);
      if (params) {
        return { route, params };
      }
    }
    return null;
  }

  /**
   * Get all routes
   */
  getRoutes(): Route[] {
    return [...this.routes];
  }
}

/**
 * ε1: Parse API path - /{e}/{r}/{a}?{p}
 */
export function parsePath(url: string): ApiPath {
  const [pathPart, queryPart] = url.split('?');
  const segments = pathPart.split('/').filter(Boolean);

  return {
    entity: segments[0] ?? '',
    resource: segments[1],
    action: segments[2],
    params: new URLSearchParams(queryPart ?? ''),
  };
}

/**
 * ε1: Match pattern against path
 */
function matchPattern(pattern: string, path: string): Map<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  const params = new Map<string, string>();

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(':')) {
      const paramName = patternPart.slice(1).replace('?', '');
      const isOptional = patternPart.endsWith('?');

      if (pathPart) {
        params.set(paramName, pathPart);
      } else if (!isOptional) {
        return null;
      }
    } else if (patternPart !== pathPart) {
      return null;
    }
  }

  // Check for extra path parts
  if (pathParts.length > patternParts.length) {
    return null;
  }

  return params;
}

// ═══════════════════════════════════════════════════════════════════════════
// ε2: VALIDATE - Request validation
// ═══════════════════════════════════════════════════════════════════════════

/** Validation schema */
export interface ValidationSchema {
  params?: Record<string, FieldSchema>;
  query?: Record<string, FieldSchema>;
  body?: Record<string, FieldSchema>;
  headers?: Record<string, FieldSchema>;
}

/** Field schema */
export interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  pattern?: RegExp;
  min?: number;
  max?: number;
  enum?: unknown[];
  validator?: (value: unknown) => boolean;
}

/** Validation error */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * ε2: Validate request against schema
 */
export function validate(
  ctx: RequestContext,
  schema: ValidationSchema
): Result<void> {
  const errors: ValidationError[] = [];

  // Validate params
  if (schema.params) {
    errors.push(...validateFields(ctx.params, schema.params, 'params'));
  }

  // Validate query
  if (schema.query) {
    const queryMap = new Map<string, unknown>();
    for (const [key, value] of ctx.path.params) {
      queryMap.set(key, value);
    }
    errors.push(...validateFields(queryMap, schema.query, 'query'));
  }

  // Validate body
  if (schema.body && ctx.body && typeof ctx.body === 'object') {
    const bodyMap = new Map(Object.entries(ctx.body as Record<string, unknown>));
    errors.push(...validateFields(bodyMap, schema.body, 'body'));
  }

  // Validate headers
  if (schema.headers) {
    errors.push(...validateFields(ctx.headers, schema.headers, 'headers'));
  }

  if (errors.length > 0) {
    return failure(new Error(`Validation failed: ${JSON.stringify(errors)}`));
  }

  return success(undefined);
}

function validateFields(
  data: Map<string, unknown>,
  schema: Record<string, FieldSchema>,
  prefix: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [field, fieldSchema] of Object.entries(schema)) {
    const value = data.get(field);
    const fieldPath = `${prefix}.${field}`;

    // Required check
    if (fieldSchema.required && (value === undefined || value === null)) {
      errors.push({ field: fieldPath, message: 'Field is required' });
      continue;
    }

    if (value === undefined || value === null) continue;

    // Type check
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== fieldSchema.type && !(fieldSchema.type === 'number' && !isNaN(Number(value)))) {
      errors.push({ field: fieldPath, message: `Expected ${fieldSchema.type}, got ${actualType}`, value });
      continue;
    }

    // Pattern check (strings)
    if (fieldSchema.pattern && typeof value === 'string') {
      if (!fieldSchema.pattern.test(value)) {
        errors.push({ field: fieldPath, message: 'Does not match pattern', value });
      }
    }

    // Min/max check
    if (fieldSchema.min !== undefined) {
      const numValue = typeof value === 'number' ? value : Number(value);
      if (numValue < fieldSchema.min) {
        errors.push({ field: fieldPath, message: `Must be at least ${fieldSchema.min}`, value });
      }
    }

    if (fieldSchema.max !== undefined) {
      const numValue = typeof value === 'number' ? value : Number(value);
      if (numValue > fieldSchema.max) {
        errors.push({ field: fieldPath, message: `Must be at most ${fieldSchema.max}`, value });
      }
    }

    // Enum check
    if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
      errors.push({ field: fieldPath, message: `Must be one of: ${fieldSchema.enum.join(', ')}`, value });
    }

    // Custom validator
    if (fieldSchema.validator && !fieldSchema.validator(value)) {
      errors.push({ field: fieldPath, message: 'Custom validation failed', value });
    }
  }

  return errors;
}

// ═══════════════════════════════════════════════════════════════════════════
// ε3: RESPOND - Response generation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ε3: Create success response
 */
export function respond<T>(body: T, status = 200): ApiResponse<T> {
  return {
    status,
    headers: new Map([['Content-Type', 'application/json']]),
    body,
  };
}

/**
 * ε3: Create error response
 */
export function error(message: string, status = 500, code?: string): ApiResponse {
  return {
    status,
    headers: new Map([['Content-Type', 'application/json']]),
    body: {
      error: {
        message,
        code: code ?? `E${status}`,
        timestamp: Date.now(),
      },
    },
  };
}

/**
 * ε3: Create redirect response
 */
export function redirect(url: string, status: 301 | 302 | 307 | 308 = 302): ApiResponse {
  return {
    status,
    headers: new Map([['Location', url]]),
  };
}

/**
 * ε3: Create no-content response
 */
export function noContent(): ApiResponse {
  return { status: 204, headers: new Map() };
}

// ═══════════════════════════════════════════════════════════════════════════
// ε4: STREAM - WebSocket streaming - ∞(▽→λ→△)
// ═══════════════════════════════════════════════════════════════════════════

/** WebSocket connection state */
export type WsState = 'connecting' | 'open' | 'closing' | 'closed';

/** WebSocket message handler */
export type WsMessageHandler<T> = (message: StreamMessage<T>) => void | Promise<void>;

/** WebSocket connection abstraction */
export interface WsConnection<T = unknown> {
  id: string;
  state: WsState;
  send(data: T): void;
  close(code?: number, reason?: string): void;
  onMessage(handler: WsMessageHandler<T>): void;
  onClose(handler: (code: number, reason: string) => void): void;
  onError(handler: (error: Error) => void): void;
}

/** Stream room for pub/sub */
export interface StreamRoom<T = unknown> {
  id: string;
  topic: string;
  connections: Set<WsConnection<T>>;
}

/**
 * Stream manager for WebSocket connections
 * Pattern: ∞(▽→λ→△) - infinite (down→transform→up)
 */
export class StreamManager<T = unknown> {
  private connections: Map<string, WsConnection<T>> = new Map();
  private rooms: Map<string, StreamRoom<T>> = new Map();
  private handlers: Map<string, WsMessageHandler<T>[]> = new Map();

  /**
   * ε4: Add connection
   */
  addConnection(conn: WsConnection<T>): void {
    this.connections.set(conn.id, conn);

    conn.onMessage(async (message) => {
      // ▽ Down: receive message
      const transformed = await this.transform(message);
      // △ Up: broadcast to room
      if (transformed) {
        this.broadcast(conn.id, transformed);
      }
    });

    conn.onClose(() => {
      this.removeConnection(conn.id);
    });
  }

  /**
   * ε4: Remove connection
   */
  removeConnection(connId: string): void {
    const conn = this.connections.get(connId);
    if (!conn) return;

    // Remove from all rooms
    for (const room of this.rooms.values()) {
      room.connections.delete(conn);
    }

    this.connections.delete(connId);
  }

  /**
   * ε4: Join a room
   */
  joinRoom(connId: string, roomId: string, topic?: string): Result<StreamRoom<T>> {
    const conn = this.connections.get(connId);
    if (!conn) {
      return failure(new Error(`Connection not found: ${connId}`));
    }

    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        topic: topic ?? roomId,
        connections: new Set(),
      };
      this.rooms.set(roomId, room);
    }

    room.connections.add(conn);
    return success(room);
  }

  /**
   * ε4: Leave a room
   */
  leaveRoom(connId: string, roomId: string): void {
    const conn = this.connections.get(connId);
    const room = this.rooms.get(roomId);

    if (conn && room) {
      room.connections.delete(conn);
      if (room.connections.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }

  /**
   * ε4: Broadcast to room
   */
  broadcast(fromConnId: string, message: StreamMessage<T>, roomId?: string): void {
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        for (const conn of room.connections) {
          if (conn.id !== fromConnId && conn.state === 'open') {
            conn.send(message.payload);
          }
        }
      }
    } else {
      // Broadcast to all connections
      for (const conn of this.connections.values()) {
        if (conn.id !== fromConnId && conn.state === 'open') {
          conn.send(message.payload);
        }
      }
    }
  }

  /**
   * ε4: Register message transformer (λ)
   */
  onTransform(handler: (message: StreamMessage<T>) => StreamMessage<T> | null | Promise<StreamMessage<T> | null>): void {
    this.transformHandler = handler;
  }

  private transformHandler?: (message: StreamMessage<T>) => StreamMessage<T> | null | Promise<StreamMessage<T> | null>;

  private async transform(message: StreamMessage<T>): Promise<StreamMessage<T> | null> {
    if (this.transformHandler) {
      return this.transformHandler(message);
    }
    // Default: pass through with direction change
    return {
      ...message,
      direction: '△',
      timestamp: Date.now(),
    };
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get room count
   */
  getRoomCount(): number {
    return this.rooms.size;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EPSILON SUBSYSTEM CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Epsilon Subsystem - API management
 */
export class EpsilonSubsystem {
  readonly id = 'ε';
  readonly name = 'api';

  private router = new Router();
  private middleware: Middleware[] = [];
  private streamManager = new StreamManager();

  /**
   * Get current operations
   */
  getOps() {
    return EpsilonOps;
  }

  /**
   * ε1: Get router for route registration
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * ε1: Add global middleware
   */
  use(middleware: Middleware): void {
    this.middleware.push(middleware);
  }

  /**
   * ε1-ε3: Handle request
   */
  async handle(
    method: HttpMethod,
    url: string,
    body?: unknown,
    headers?: Map<string, string>
  ): Promise<ApiResponse> {
    const path = parsePath(url);

    // Match route
    const matched = this.router.match(method, url.split('?')[0]);
    if (!matched) {
      return error('Not Found', 404);
    }

    const { route, params } = matched;

    // Build context
    const ctx: RequestContext = {
      method,
      path,
      headers: headers ?? new Map(),
      body,
      params,
      state: new Map(),
    };

    // ε2: Validate if schema provided
    if (route.schema) {
      const validationResult = validate(ctx, route.schema);
      if (!validationResult.ok) {
        return error(validationResult.error.message, 400, 'VALIDATION_ERROR');
      }
    }

    // Build middleware chain
    const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];

    // Execute middleware and handler
    const executeHandler = async (): Promise<ApiResponse> => {
      return route.handler(ctx);
    };

    let handler = executeHandler;
    for (const mw of allMiddleware.reverse()) {
      const next = handler;
      handler = async () => mw(ctx, next);
    }

    try {
      return await handler();
    } catch (e) {
      return error(
        e instanceof Error ? e.message : 'Internal Server Error',
        500
      );
    }
  }

  /**
   * ε4: Get stream manager
   */
  getStreamManager(): StreamManager {
    return this.streamManager;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createEpsilonSubsystem(): EpsilonSubsystem {
  return new EpsilonSubsystem();
}
