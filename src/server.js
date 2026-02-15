const app = require("./app");
const connectDB = require("./config/db")
const { connectRedis } = require("./config/redis");

const PORT = process.env.PORT || 3000;

connectDB()
connectRedis().catch((err) => console.error('Redis init error', err.message));
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
