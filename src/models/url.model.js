const mongoose = require('mongoose');

const UrlSchema = new mongoose.Schema({
  _id: {
    type: Number,

  },
  originalUrl: {
    type: String,
    required: true,
  },
  shortCode: {
    type: String,
    unique: true,
    index: true,
    sparse: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  clickCount: {
    type: Number,
    default: 0,
  },
});

const Url = mongoose.model('Url', UrlSchema);

module.exports = Url;