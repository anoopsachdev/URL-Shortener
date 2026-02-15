# 🔗 URL Shortener Backend 

A hands-on learning project built during the *"From Monolith to Microservices: Building Scalable Applications the Right Way"* bootcamp, held in collaboration with **Xebia**, as part of the Full Stack elective at Thapar Institute of Engineering and Technology (TIET).

This repository currently reflects **Phase 1** of the learning journey: a well-structured, scalable monolithic backend application. It is designed using clean architecture principles (Separation of Concerns) to make future decomposition into microservices seamless.

## 🎯 Project Goals

- Build a high-performance URL shortening service from scratch.
- Implement a clean, layered architecture (Routes -> Controllers -> Services -> Repositories).
- Design a custom URL generation algorithm using Base62 encoding and MongoDB auto-incrementing sequences.
- Optimize read-heavy redirection operations using distributed caching.

## 🏗️ Current Architecture (Phase 1: Layered Monolith)

While the ultimate goal of the bootcamp is a microservices architecture, this codebase represents a production-ready monolith designed with separated concerns:

- **Controllers:** Handle HTTP requests, responses, and routing logic.
- **Services:** Contain the core business logic (caching, encoding logic).
- **Repositories:** Manage direct database interactions and queries.
- **Cache Layer:** Redis integration for lightning-fast URL redirection.
- **Database:** MongoDB for persistent storage of original URLs and short codes.

[View Initial System Design Documentation](docs/system_design.jpg)

## ✨ Features Implemented

- ✅ **URL Shortening:** Generates short, unique codes using Base62 encoding.
- ✅ **Fast Redirection:** Resolves short codes back to the original URLs.
- ✅ **Redis Caching:** Best-effort caching strategy (24h TTL) to reduce database load for frequently accessed links.
- ✅ **Auto-Increment Pattern:** Uses a custom MongoDB counter sequence to guarantee unique IDs before Base62 encoding.
- ✅ **RESTful API:** Clean API design with centralized error handling.

## 🛠️ Technology Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose)
- **Cache:** Redis
- **Architecture:** Layered Monolithic (MVC-inspired)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- MongoDB (Local or Atlas)
- Redis Server (Running locally or hosted)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/anoopsachdev/URL-Shortener.git
   cd URL-Shortener
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and configure your database and Redis connections:
   ```env
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/url-shortener
   REDIS_URL=redis://127.0.0.1:6379
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## 🔌 API Documentation

### 1. Shorten a URL

**Endpoint:** `POST /api/urls/shorten`

**Body:**
```json
{
  "originalUrl": "https://example.com/very/long/url"
}
```

**Response:**
```json
{
  "shortCode": "http://localhost:3000/api/urls/1"
}
```

### 2. Redirect to Original URL

**Endpoint:** `GET /api/urls/:code`

**Description:** Automatically redirects the browser to the cached or database-stored original URL.

## 📂 Project Structure

```
URL-Shortener/
├── src/
│   ├── config/            # Database and Redis connection setups
│   ├── controllers/       # HTTP request handlers
│   ├── middlewares/       # Global error handling
│   ├── models/            # Mongoose schemas (Url, Counter)
│   ├── repositories/      # Data access layer
│   ├── routes/            # Express route definitions
│   ├── services/          # Core business logic and caching
│   ├── utils/             # Helper functions (Base62 encoder)
│   ├── app.js             # Express app configuration
│   └── server.js          # Entry point
├── docs/
│   └── system_design.jpg  # Architecture diagrams
└── package.json
```

## 🔮 Future Enhancements (Microservices Roadmap)

This monolith is structured to be easily broken down in the next phase of the bootcamp. Upcoming planned features include:

- [ ] **Service Extraction:** Splitting into an API Gateway, URL Service, and Analytics Service.
- [ ] **Analytics Implementation:** Tracking click counts (schema already prepared) and user geography.
- [ ] **Dockerization:** Adding Dockerfile and docker-compose.yml for isolated service deployment.
- [ ] **Message Queues:** Implementing RabbitMQ/Kafka for asynchronous analytics processing.
- [ ] **Custom Aliases:** Allowing users to choose their own short codes.

## 👨‍💻 Author

**Anoop Singh Sachdev**
- LinkedIn: [anoop-singh-sachdev](https://www.linkedin.com/in/anoop-singh-sachdev)
- GitHub: [@anoopsachdev](https://github.com/anoopsachdev)

## 🙏 Acknowledgments

- **Xebia** - For providing industry expertise and real-world system design insights.
- **TIET Full Stack Instructors** - For structured learning and guidance throughout the bootcamp.

---

**Documenting my passion for coding** ✍️