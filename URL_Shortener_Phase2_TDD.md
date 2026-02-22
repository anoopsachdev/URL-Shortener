# Technical Design Document (TDD)
## URL Shortener Backend — Phase 2: Analytics, Rate Limiting & API Gateway

**Project:** URL Shortener Backend  
**Phase:** 2 (Microservices Evolution)  
**Author:** Anoop Singh Sachdev  
**Status:** Design / Pre-Implementation  
**Repository:** https://github.com/anoopsachdev/URL-Shortener  
**Built During:** From Monolith to Microservices Bootcamp — Xebia × TIET

---

## Table of Contents

1. [Overview](#1-overview)
2. [Current State (Phase 1 Recap)](#2-current-state-phase-1-recap)
3. [Goals of Phase 2](#3-goals-of-phase-2)
4. [High-Level Architecture](#4-high-level-architecture)
5. [Service Decomposition](#5-service-decomposition)
   - 5.1 [API Gateway Service](#51-api-gateway-service)
   - 5.2 [URL Service](#52-url-service)
   - 5.3 [Analytics Service](#53-analytics-service)
6. [Rate Limiting Design](#6-rate-limiting-design)
7. [Click Analytics & User Geography](#7-click-analytics--user-geography)
   - 7.1 [Click Event Schema (Cassandra)](#71-click-event-schema-cassandra)
   - 7.2 [GeoIP Lookup Flow](#72-geoip-lookup-flow)
8. [Database Strategy](#8-database-strategy)
   - 8.1 [MongoDB (URL Mappings)](#81-mongodb-url-mappings)
   - 8.2 [Redis (Cache + Rate Limiting)](#82-redis-cache--rate-limiting)
   - 8.3 [Cassandra (Analytics)](#83-cassandra-analytics)
9. [Inter-Service Communication](#9-inter-service-communication)
10. [API Contract](#10-api-contract)
11. [Data Flow Diagrams](#11-data-flow-diagrams)
    - 11.1 [URL Shortening Flow](#111-url-shortening-flow)
    - 11.2 [URL Redirect + Analytics Flow](#112-url-redirect--analytics-flow)
    - 11.3 [Rate Limiting Flow](#113-rate-limiting-flow)
12. [Project Structure](#12-project-structure)
13. [Environment Variables](#13-environment-variables)
14. [Implementation Task List](#14-implementation-task-list)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Out of Scope](#16-out-of-scope)

---

## 1. Overview

This document describes the technical design for **Phase 2** of the URL Shortener Backend project. Building upon the clean layered monolith from Phase 1, this phase evolves the architecture into a **microservices-oriented system** by:

- Introducing an **API Gateway** as the single entry point
- Extracting an **Analytics Service** with a dedicated **Cassandra** database for high-throughput click event logging
- Adding **Rate Limiting** at the gateway layer using **Redis**
- Implementing **User Geography** tracking via GeoIP lookup
- Using a **Message Queue (RabbitMQ)** for async, non-blocking analytics event delivery

The goal is to demonstrate production-grade system design skills: service isolation, polyglot persistence, asynchronous processing, and fault tolerance.

---

## 2. Current State (Phase 1 Recap)

Phase 1 delivered a monolithic Express.js backend with a clean layered architecture:

```
Client → Express App → Routes → Controllers → Services → Repositories → MongoDB
                                                     ↕
                                                   Redis (Cache)
```

**Tech stack:** Node.js, Express.js v5, MongoDB (Mongoose), Redis  
**Key Features:** Base62 URL encoding, auto-increment ID pattern, Redis caching (24h TTL), centralized error handling

**Limitations identified:**
- Analytics (click counts) stored in MongoDB — not optimized for write-heavy append-only workloads
- No rate limiting — API is open to abuse
- No user geography tracking
- All concerns in a single deployable unit

---

## 3. Goals of Phase 2

| Goal | Description |
|---|---|
| API Gateway | Single entry point; handles routing, auth, rate limiting, logging |
| Rate Limiting | Prevent abuse; 100 req/min per IP using Redis sliding window counter |
| Click Analytics | Record every redirect event (timestamp, short code, IP, user agent) |
| User Geography | Derive country/city from client IP using a GeoIP library |
| Cassandra Integration | Store click events in Cassandra — optimized for high-write, time-series data |
| Async Processing | Decouple analytics writes from the redirect critical path using RabbitMQ |
| Service Isolation | URL Service and Analytics Service run as independent processes |

---

## 4. High-Level Architecture

```
                          ┌──────────────────────────────────┐
                          │           CLIENT                 │
                          │  (Browser / API Consumer)        │
                          └────────────────┬─────────────────┘
                                           │ HTTP
                          ┌────────────────▼─────────────────┐
                          │         API GATEWAY              │
                          │  • Rate Limiting (Redis)         │
                          │  • Request Routing               │
                          │  • Logging / Monitoring          │
                          │  • IP Extraction                 │
                          └──────────┬──────────┬────────────┘
                                     │          │
               ┌─────────────────────▼──┐   ┌───▼──────────────────────┐
               │      URL SERVICE       │   │    ANALYTICS SERVICE      │
               │  • Shorten URL         │   │  • Record click events    │
               │  • Redirect URL        │   │  • GeoIP lookup           │
               │  • Base62 Encoding     │   │  • Query analytics data   │
               └──────────┬─────────────┘   └──────────────┬────────────┘
                          │                                 │
          ┌───────────────┼──────────────┐                 │
          │               │              │                  │
    ┌─────▼──────┐ ┌──────▼──────┐      │           ┌──────▼──────┐
    │  MongoDB   │ │    Redis    │  RabbitMQ ───────►│  Cassandra  │
    │ (URL Data) │ │  (Cache +   │  (Message Queue)  │ (Click Logs)│
    └────────────┘ │ Rate Limit) │                   └─────────────┘
                   └─────────────┘
```

---

## 5. Service Decomposition

### 5.1 API Gateway Service

**Port:** `3000`  
**Responsibility:** Acts as the single entry point for all clients. Enforces cross-cutting concerns before proxying requests to downstream services.

**Responsibilities:**
- Parse and forward `X-Forwarded-For` / `req.ip` to downstream services
- Enforce rate limiting using a Redis sliding window counter
- Route `POST /api/urls/shorten` → URL Service
- Route `GET /api/urls/:code` → URL Service
- Route `GET /api/analytics/:code` → Analytics Service
- Return `HTTP 429` with `Retry-After` header on limit breach
- Centralized access logging (Morgan or custom middleware)

**Technology:** Express.js + `http-proxy-middleware` (or custom proxy logic)

**Key Middleware Stack (in order):**
```
requestLogger → ipExtractor → rateLimiter → proxy → errorHandler
```

---

### 5.2 URL Service

**Port:** `3001`  
**Responsibility:** Core URL business logic — shortening and redirection.

**Changes from Phase 1:**
- Now runs as an isolated process on port `3001`
- On successful redirect, publishes a `click.event` message to RabbitMQ instead of directly updating MongoDB
- Trusts `X-Client-IP` header forwarded by the API Gateway (never reads `req.ip` directly)
- All other logic (Base62, MongoDB, Redis cache) remains identical

**Published RabbitMQ Event:**
```json
{
  "exchange": "analytics",
  "routingKey": "click.event",
  "payload": {
    "shortCode": "aB3",
    "originalUrl": "https://example.com",
    "clientIp": "203.0.113.42",
    "userAgent": "Mozilla/5.0 ...",
    "timestamp": "2025-02-22T10:30:00.000Z"
  }
}
```

---

### 5.3 Analytics Service

**Port:** `3002`  
**Responsibility:** Consumes click events from RabbitMQ, performs GeoIP lookup, and persists data to Cassandra.

**Sub-components:**

| Component | Role |
|---|---|
| RabbitMQ Consumer | Subscribes to `analytics` exchange, `click.event` routing key |
| GeoIP Resolver | Maps IP → `{ country, region, city }` using `maxmind` + GeoLite2 DB |
| Cassandra Writer | Inserts enriched click record into `click_events` table |
| Analytics API | Exposes `GET /analytics/:code` for querying stats |

---

## 6. Rate Limiting Design

**Algorithm:** Sliding Window Counter using Redis  
**Limit:** 100 requests per 60-second window per IP address  
**Storage Key Pattern:** `rate_limit:<ip_address>`

### How It Works

```
Incoming Request
       │
       ▼
Redis: INCR rate_limit:<ip>
       │
       ├── If key is NEW → SET EXPIRE 60s → Allow request
       │
       ├── count <= 100 → Allow request
       │
       └── count > 100 → Return HTTP 429
```

### Redis Commands Used

```js
// Atomic increment + set expiry on first request
const count = await client.incr(`rate_limit:${ip}`);
if (count === 1) {
  await client.expire(`rate_limit:${ip}`, 60);
}
if (count > RATE_LIMIT) {
  // reject with 429
}
```

### Response Headers on Rate Limit Hit

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: <epoch_seconds>
Retry-After: <seconds_until_reset>
Content-Type: application/json

{ "error": "Rate limit exceeded. Try again in 42 seconds." }
```

### Rate Limit Configuration

| Parameter | Value | Notes |
|---|---|---|
| Window | 60 seconds | Sliding per IP |
| Max Requests | 100 | Configurable via `RATE_LIMIT_MAX` env var |
| Key TTL | 60 seconds | Auto-expires in Redis |
| Identifier | Client IP | From `X-Forwarded-For` or `req.ip` |
| Bypass | Internal services | Gateway-to-service calls skip limiter |

---

## 7. Click Analytics & User Geography

### 7.1 Click Event Schema (Cassandra)

**Keyspace:** `url_shortener`  
**Table:** `click_events`

```cql
CREATE KEYSPACE url_shortener
  WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

USE url_shortener;

CREATE TABLE click_events (
  short_code   TEXT,
  clicked_at   TIMESTAMP,
  event_id     UUID,
  original_url TEXT,
  client_ip    TEXT,
  user_agent   TEXT,
  country      TEXT,
  region       TEXT,
  city         TEXT,
  PRIMARY KEY ((short_code), clicked_at, event_id)
) WITH CLUSTERING ORDER BY (clicked_at DESC);
```

**Partition Key:** `short_code` — all events for a given short URL are co-located  
**Clustering Key:** `clicked_at DESC, event_id` — enables efficient time-range queries and uniqueness  
**Access Pattern:** "Give me all clicks for short code `aB3`, ordered by most recent"

### 7.2 GeoIP Lookup Flow

1. Analytics Service receives click event from RabbitMQ
2. Extracts `clientIp` from the event payload
3. Calls `maxmind` (local GeoLite2-City.mmdb database — no external HTTP call):
   ```js
   const reader = await maxmind.open('./GeoLite2-City.mmdb');
   const geo = reader.get(clientIp);
   // geo.country.iso_code, geo.city.names.en, geo.subdivisions[0].names.en
   ```
4. Enriches the event with `{ country, region, city }`
5. Writes enriched event to Cassandra

**Why local GeoIP?** No external API latency, no rate limits, no network dependency. MaxMind GeoLite2 is free to download with a license key.

---

## 8. Database Strategy

### 8.1 MongoDB (URL Mappings)

**Owned by:** URL Service  
**Purpose:** Persistent storage of URL mappings and short codes  
**Schema:** Unchanged from Phase 1 (`Url`, `Counter` collections)  
**When to use:** Creating short URLs, resolving codes when cache misses

### 8.2 Redis (Cache + Rate Limiting)

**Shared by:** URL Service (cache), API Gateway (rate limiting)  
**Two logical namespaces:**

| Namespace | Key Pattern | TTL | Purpose |
|---|---|---|---|
| URL Cache | `<shortCode>` (e.g., `aB3`) | 86400s (24h) | Fast redirect resolution |
| Rate Limiter | `rate_limit:<ip>` | 60s | Request counting per IP |

> **Note:** Use separate Redis databases (DB 0 for cache, DB 1 for rate limiting) or a Redis Cluster to avoid key collision.

### 8.3 Cassandra (Analytics)

**Owned by:** Analytics Service  
**Purpose:** High-throughput, append-only storage of click event logs  
**Why Cassandra over MongoDB for this?**

| Concern | MongoDB | Cassandra |
|---|---|---|
| Write throughput | Good | Excellent (LSM tree, no locking) |
| Time-series queries | Possible but not native | Native via clustering keys |
| Scalability | Vertical + horizontal | Linear horizontal scaling |
| Fault tolerance | Replica sets | Multi-node, tunable consistency |
| Schema | Flexible | Denormalized, query-driven |

Cassandra is chosen because click events are an **append-only, write-heavy, time-series workload** — exactly the pattern Cassandra is designed for. MongoDB would become a bottleneck at scale.

---

## 9. Inter-Service Communication

### Synchronous (HTTP)

| From | To | Method | When |
|---|---|---|---|
| API Gateway | URL Service | HTTP Proxy | Every client request |
| API Gateway | Analytics Service | HTTP Proxy | Analytics query requests |

### Asynchronous (RabbitMQ)

| Publisher | Consumer | Exchange | Routing Key | When |
|---|---|---|---|---|
| URL Service | Analytics Service | `analytics` (direct) | `click.event` | Every successful redirect |

**Why async for analytics?**  
The redirect path is latency-sensitive. Blocking it on a Cassandra write would add ~5–20ms per request. By publishing to RabbitMQ and returning the redirect immediately, the user experiences no additional latency. The analytics write happens in the background.

**RabbitMQ Exchange Setup:**
```js
// URL Service (Publisher)
channel.assertExchange('analytics', 'direct', { durable: true });
channel.publish('analytics', 'click.event', Buffer.from(JSON.stringify(eventPayload)));

// Analytics Service (Consumer)
channel.assertQueue('click_events_queue', { durable: true });
channel.bindQueue('click_events_queue', 'analytics', 'click.event');
channel.consume('click_events_queue', handler, { noAck: false });
```

---

## 10. API Contract

### API Gateway Exposed Endpoints

#### POST `/api/urls/shorten`
**Proxied to:** URL Service `POST /shorten`

**Request:**
```json
{ "originalUrl": "https://example.com/very/long/url" }
```

**Response `201`:**
```json
{ "shortCode": "http://localhost:3000/api/urls/aB3" }
```

**Response `429` (Rate Limited):**
```json
{ "error": "Rate limit exceeded. Try again in 42 seconds." }
```

---

#### GET `/api/urls/:code`
**Proxied to:** URL Service `GET /:code`

**Response:** `302 Redirect` to original URL

**Response `404`:**
```json
{ "msg": "URL not found..." }
```

---

#### GET `/api/analytics/:code`
**Proxied to:** Analytics Service `GET /analytics/:code`

**Response `200`:**
```json
{
  "shortCode": "aB3",
  "totalClicks": 1523,
  "recentClicks": [
    {
      "clickedAt": "2025-02-22T10:30:00.000Z",
      "country": "IN",
      "city": "Patiala",
      "userAgent": "Mozilla/5.0 ..."
    }
  ]
}
```

---

## 11. Data Flow Diagrams

### 11.1 URL Shortening Flow

```
Client
  │
  │  POST /api/urls/shorten  { originalUrl }
  ▼
API Gateway
  ├── Rate Limiter (Redis INCR) → OK
  └── Proxy to URL Service :3001
        │
        ▼
      URL Service
        ├── Validate originalUrl
        ├── MongoDB: Counter.findByIdAndUpdate (get next ID)
        ├── Base62.encode(id) → shortCode
        ├── MongoDB: Url.create({ _id: id, originalUrl })
        ├── MongoDB: Url.updateOne({ shortCode })
        ├── Redis: SET shortCode originalUrl EX 86400
        └── Return { shortCode: "http://localhost:3000/api/urls/aB3" }
  │
  ▼
Client ← 201 { shortCode }
```

---

### 11.2 URL Redirect + Analytics Flow

```
Client
  │
  │  GET /api/urls/aB3
  ▼
API Gateway
  ├── Rate Limiter → OK
  ├── Extract client IP (X-Forwarded-For)
  └── Proxy to URL Service :3001 (with X-Client-IP header)
        │
        ▼
      URL Service
        ├── Redis GET aB3 → HIT: originalUrl
        │   (or MISS → MongoDB findOne → repopulate cache)
        ├── Publish to RabbitMQ: analytics / click.event
        │   { shortCode, originalUrl, clientIp, userAgent, timestamp }
        └── res.redirect(302, originalUrl)
  │
  ▼
Client ← 302 Redirect

        (Async, non-blocking)
              │
              ▼
         RabbitMQ Queue: click_events_queue
              │
              ▼
        Analytics Service
              ├── GeoIP Lookup (maxmind local DB)
              │   clientIp → { country: "IN", city: "Patiala" }
              └── Cassandra INSERT into click_events
```

---

### 11.3 Rate Limiting Flow

```
Incoming Request (IP: 203.0.113.42)
  │
  ▼
API Gateway: Rate Limit Middleware
  │
  ├── Redis INCR rate_limit:203.0.113.42
  │     count = 45
  │
  ├── count (45) <= MAX (100)?
  │     YES → Forward request to downstream service
  │
  └── count (101) > MAX (100)?
        YES → Return HTTP 429
              { "error": "Rate limit exceeded. Try again in 23 seconds." }
              Headers: X-RateLimit-Limit: 100
                       X-RateLimit-Remaining: 0
                       Retry-After: 23
```

---

## 12. Project Structure

```
URL-Shortener/
├── api-gateway/                    # NEW — API Gateway service
│   ├── src/
│   │   ├── middleware/
│   │   │   ├── rateLimiter.js      # Redis-based rate limiting
│   │   │   ├── ipExtractor.js      # X-Forwarded-For parsing
│   │   │   └── requestLogger.js    # Morgan / custom access logs
│   │   ├── routes/
│   │   │   └── proxy.routes.js     # Proxy routing rules
│   │   ├── config/
│   │   │   └── redis.js            # Redis client for rate limiter (DB 1)
│   │   ├── app.js
│   │   └── server.js
│   ├── package.json
│   └── .env
│
├── url-service/                    # REFACTORED from Phase 1 monolith
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js               # MongoDB connection
│   │   │   ├── redis.js            # Redis client for URL cache (DB 0)
│   │   │   └── rabbitmq.js         # NEW — RabbitMQ publisher setup
│   │   ├── controllers/
│   │   │   └── url.controller.js
│   │   ├── services/
│   │   │   └── url.service.js      # MODIFIED — publishes to RabbitMQ on redirect
│   │   ├── repositories/
│   │   │   └── url.repository.js
│   │   ├── models/
│   │   │   ├── url.model.js
│   │   │   └── counter.model.js
│   │   ├── routes/
│   │   │   └── url.routes.js
│   │   ├── utils/
│   │   │   └── base62.js
│   │   ├── middlewares/
│   │   │   └── error.middleware.js
│   │   ├── app.js
│   │   └── server.js               # Listens on PORT 3001
│   ├── package.json
│   └── .env
│
├── analytics-service/              # NEW — Analytics service
│   ├── src/
│   │   ├── config/
│   │   │   ├── cassandra.js        # Cassandra client setup
│   │   │   └── rabbitmq.js         # RabbitMQ consumer setup
│   │   ├── consumers/
│   │   │   └── clickEvent.consumer.js  # Listens to click_events_queue
│   │   ├── services/
│   │   │   ├── geoip.service.js    # MaxMind GeoLite2 lookup
│   │   │   └── analytics.service.js    # Query analytics data
│   │   ├── repositories/
│   │   │   └── clickEvent.repository.js  # Cassandra read/write
│   │   ├── controllers/
│   │   │   └── analytics.controller.js
│   │   ├── routes/
│   │   │   └── analytics.routes.js
│   │   ├── data/
│   │   │   └── GeoLite2-City.mmdb  # MaxMind GeoIP database (gitignored)
│   │   ├── middlewares/
│   │   │   └── error.middleware.js
│   │   ├── app.js
│   │   └── server.js               # Listens on PORT 3002
│   ├── package.json
│   └── .env
│
├── docker-compose.yml              # NEW — Orchestrate all services + infra
├── docs/
│   ├── system_design_phase1.jpg
│   └── system_design_phase2.jpg    # Updated architecture diagram
└── README.md
```

---

## 13. Environment Variables

### API Gateway (`api-gateway/.env`)

```env
PORT=3000
URL_SERVICE_URL=http://localhost:3001
ANALYTICS_SERVICE_URL=http://localhost:3002
REDIS_URL=redis://127.0.0.1:6379/1
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_SECONDS=60
```

### URL Service (`url-service/.env`)

```env
PORT=3001
MONGO_URI=mongodb://localhost:27017/url-shortener
REDIS_URL=redis://127.0.0.1:6379/0
RABBITMQ_URL=amqp://localhost:5672
BASE_URL=http://localhost:3000/api/urls
```

### Analytics Service (`analytics-service/.env`)

```env
PORT=3002
CASSANDRA_CONTACT_POINTS=127.0.0.1
CASSANDRA_KEYSPACE=url_shortener
CASSANDRA_DATACENTER=datacenter1
RABBITMQ_URL=amqp://localhost:5672
GEOIP_DB_PATH=./src/data/GeoLite2-City.mmdb
```

---

## 14. Implementation Task List

Use this as a checklist for your AI coding agent. Complete tasks in order — each depends on the previous.

### Phase 2.0 — Infrastructure Setup

- [ ] **T01** — Add `docker-compose.yml` with services: `mongo`, `redis`, `rabbitmq`, `cassandra`
- [ ] **T02** — Create Cassandra keyspace and `click_events` table (CQL script at `analytics-service/src/config/schema.cql`)
- [ ] **T03** — Download MaxMind GeoLite2-City.mmdb and place at `analytics-service/src/data/`

### Phase 2.1 — Refactor URL Service

- [ ] **T04** — Move Phase 1 monolith code into `url-service/` directory; update `package.json` and server port to `3001`
- [ ] **T05** — Create `url-service/src/config/rabbitmq.js` — RabbitMQ connection + channel setup with reconnect logic
- [ ] **T06** — Modify `url.service.js` `getOriginalUrl()` — after resolving URL, publish `click.event` to RabbitMQ exchange `analytics`
- [ ] **T07** — Add `X-Client-IP` header trust — replace all `req.ip` usage with `req.headers['x-client-ip'] || req.ip`

### Phase 2.2 — Build Analytics Service

- [ ] **T08** — Scaffold `analytics-service/` with Express, Cassandra (`cassandra-driver`), RabbitMQ (`amqplib`), and maxmind (`maxmind`) dependencies
- [ ] **T09** — Create `analytics-service/src/config/cassandra.js` — Cassandra client with keyspace connection
- [ ] **T10** — Create `analytics-service/src/services/geoip.service.js` — load mmdb, expose `lookup(ip)` returning `{ country, region, city }`
- [ ] **T11** — Create `analytics-service/src/consumers/clickEvent.consumer.js` — consume from `click_events_queue`, call geoip lookup, write to Cassandra
- [ ] **T12** — Create `analytics-service/src/repositories/clickEvent.repository.js` — `insert(event)` and `findByShortCode(code, limit)` Cassandra queries
- [ ] **T13** — Create `GET /analytics/:code` endpoint returning total click count + last 20 events

### Phase 2.3 — Build API Gateway

- [ ] **T14** — Scaffold `api-gateway/` with Express and `http-proxy-middleware` dependencies
- [ ] **T15** — Create `api-gateway/src/config/redis.js` — Redis client pointing to DB 1
- [ ] **T16** — Create `api-gateway/src/middleware/ipExtractor.js` — parse `X-Forwarded-For`, attach to `req.clientIp`, forward as `X-Client-IP` header
- [ ] **T17** — Create `api-gateway/src/middleware/rateLimiter.js` — Redis INCR sliding window, return 429 on breach with correct headers
- [ ] **T18** — Create `api-gateway/src/routes/proxy.routes.js` — proxy rules for URL Service and Analytics Service
- [ ] **T19** — Wire middleware in `api-gateway/src/app.js`: `requestLogger → ipExtractor → rateLimiter → proxy`

### Phase 2.4 — Integration & Testing

- [ ] **T20** — Start all services via `docker-compose up`; smoke test each endpoint manually with curl or Postman
- [ ] **T21** — Test rate limiting: send 101 requests in under 60 seconds from same IP; verify 429 on request 101
- [ ] **T22** — Test analytics pipeline: click a short URL; verify event appears in Cassandra within 2 seconds; verify GeoIP fields populated
- [ ] **T23** — Test Redis cache miss path: flush Redis, make a redirect request; verify MongoDB is queried and cache is repopulated
- [ ] **T24** — Update `README.md` with Phase 2 architecture, setup instructions, and new environment variables

---

## 15. Non-Functional Requirements

| Requirement | Target | How Achieved |
|---|---|---|
| Redirect latency (p99) | < 50ms | Redis cache hit path; async analytics write |
| Analytics write latency | < 20ms | Cassandra LSM write path; no blocking |
| Rate limiting overhead | < 2ms | Single Redis INCR operation |
| Analytics event delivery | Best-effort, eventual | RabbitMQ durable queue; consumer acks |
| Cache availability | Non-blocking degraded mode | Redis errors caught; falls back to MongoDB |
| RabbitMQ availability | Non-blocking degraded mode | Publish errors caught; analytics skipped silently |
| Cassandra availability | Non-blocking degraded mode | Consumer errors logged; message requeued |

---

## 16. Out of Scope

The following items are explicitly deferred to a future phase and should **not** be implemented during Phase 2:

- **Authentication / Authorization** — No JWT or API key validation at this stage
- **Custom short code aliases** — Users cannot choose their own short codes
- **Dashboard UI** — No frontend; API-only
- **Cassandra multi-datacenter replication** — Single datacenter (`replication_factor: 1`) for development
- **Horizontal scaling / load balancing** — Single instance of each service
- **HTTPS / SSL termination** — HTTP only for local development
- **CI/CD pipeline** — Manual deployment only
- **Analytics aggregation** — No pre-computed rollups (hourly/daily totals); raw events only

---

*Document version 1.0 — Phase 2 Pre-Implementation*  
*Last updated: February 2026*
