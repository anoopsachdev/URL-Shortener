# 🔗 URL Shortener - Monolith to Microservices

A hands-on learning project built during the  *"From Monolith to Microservices: Building Scalable Applications the Right Way"* bootcamp, held in collaboration with **Xebia**, as part of the Full Stack elective at my college, TIET, Patiala.

This project demonstrates the practical journey of transforming a monolithic URL shortener into a microservices architecture, exploring key concepts in distributed systems, scalability, and modern backend development.

## 📚 Learning Context

This project was developed as part of a structured bootcamp curriculum focused on:
- Understanding the evolution from monolithic to microservices architecture
- Hands-on experience with distributed system design patterns
- Practical implementation of scalability concepts
- Real-world system design principles applied to a working application

**Industry Partner:** Xebia

## 🎯 Project Goals

The primary learning objectives of this project were to:
- Build a functional URL shortening service from scratch
- Refactor a monolithic application into microservices
- Implement caching strategies for performance optimization
- Design for horizontal scalability
- Apply industry best practices in API design and system architecture

## 🏗️ Architecture Evolution

### Phase 1: Monolithic Architecture
Initial implementation with all functionality in a single service:
- Single Node.js application handling all requests
- Direct database connections
- Simple in-memory caching
- Synchronous processing

### Phase 2: Microservices Architecture
Refactored design with separated concerns:
- **API Gateway** - Entry point for all client requests
- **URL Service** - Core URL shortening and retrieval logic
- **Analytics Service** - Click tracking and statistics (if implemented)
- **Shared Database** - (Learning about database per service pattern)
- **Cache Layer** - Redis integration for performance

[View System Design Documentation](docs/system_design.pdf)

## ✨ Features Implemented

- ✅ URL shortening with unique short codes
- ✅ URL redirection
- ✅ Basic analytics (click counting)
- ✅ Redis caching layer
- ✅ RESTful API design
- ✅ Microservices communication patterns
- ✅ Error handling and validation

## 🛠️ Technology Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB / PostgreSQL
- **Cache:** Redis
- **Tools:** Docker (for containerization)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- MongoDB or PostgreSQL
- Redis
- npm

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
   ```bash
   cp .env.example .env
   # Configure your database and Redis connections
   ```

4. Start the application:
   ```bash
   npm start
   ```

## 📖 What I Learned

### System Design Concepts
- **Separation of Concerns:** Breaking down a monolith into independent services
- **Service Communication:** Inter-service communication patterns (REST APIs)
- **Data Management:** Handling data consistency across services
- **Caching Strategies:** Implementing Redis for read-heavy operations
- **Scalability Patterns:** Designing for horizontal scaling

### Technical Skills
- Building microservices with Node.js and Express
- Working with Docker for containerization
- Implementing distributed caching with Redis
- API design and versioning
- Database design and optimization
- Error handling in distributed systems

### Industry Best Practices
- Clean code architecture
- RESTful API design principles
- Configuration management
- Logging and monitoring considerations
- Documentation practices

## 📊 System Design Highlights

### URL Generation
- Base62 encoding for short, URL-safe codes
- Collision detection and handling
- Configurable short code length

### Caching Strategy
- Cache popular URLs in Redis
- Reduce database load for frequently accessed links
- Implement cache invalidation strategies

### Scalability Considerations
- Stateless service design for horizontal scaling
- Database connection pooling
- Async processing for analytics

## 🔌 API Overview

### Shorten a URL
```http
POST /api/shorten
Content-Type: application/json

{
  "longUrl": "https://example.com/very/long/url"
}
```

### Redirect to Original URL
```http
GET /:shortCode
```

### Get Basic Analytics
```http
GET /api/analytics/:shortCode
```

## 📂 Project Structure

```
URL-Shortener/
├── src/
│   ├── services/          # Microservices
│   ├── config/            # Configuration files
│   ├── models/            # Database models
│   ├── routes/            # API routes
│   └── utils/             # Helper functions
├── docs/
│   └── system_design.pdf  # Architecture diagrams
└── package.json
```

## 🎓 Bootcamp: From Monolith to Microservices

This project was part of a comprehensive bootcamp curriculum that covered:

1. **Monolithic Architecture Foundations**
   - Understanding traditional application design
   - Identifying limitations and bottlenecks

2. **Microservices Principles**
   - Service decomposition strategies
   - Communication patterns (sync/async)
   - Data management in distributed systems

3. **Practical Implementation**
   - Hands-on refactoring exercises
   - Real-world system design scenarios
   - Performance optimization techniques

4. **Industry Insights** (with Xebia)
   - Best practices from production systems
   - Common pitfalls and how to avoid them
   - Scalability patterns used in enterprise applications

## 🔮 Future Enhancements (Learning Roadmap)

Potential features to explore and implement:
- [ ] Custom URL aliases
- [ ] User authentication and personal dashboards
- [ ] Advanced analytics (geographic data, referrer tracking)
- [ ] Rate limiting per user/IP
- [ ] Database sharding for horizontal scaling
- [ ] Message queue for async processing (RabbitMQ/Kafka)
- [ ] Service mesh implementation
- [ ] Kubernetes deployment
- [ ] Monitoring and observability (Prometheus, Grafana)

## 👨‍💻 Author

**Anoop Singh Sachdev**
- LinkedIn: [anoop-singh-sachdev](https://www.linkedin.com/in/anoop-singh-sachdev)
- GitHub: [@anoopsachdev](https://github.com/anoopsachdev)

## 🙏 Acknowledgments

- **Xebia** - For providing industry expertise and real-world insights
- **Full Stack Bootcamp Instructors** - For structured learning and guidance
- Course: *"From Monolith to Microservices: Building Scalable Applications the Right Way"*

## 📝 Note

This is a learning project developed during a professional bootcamp. The implementation focuses on understanding core concepts and patterns rather than production-level features. The architecture and code reflect the learning journey from monolithic to microservices design.

---

**Learning in public** 🚀 | Feedback and suggestions welcome!
