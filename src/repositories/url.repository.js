const Url = require('../models/url.model');
const Counter = require('../models/counter.model');
// Auto Increment Sequence Pattern (MongoDB)
const getNextId = async () => {
    const counter = await Counter.findByIdAndUpdate(
        { _id: 'urlId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return counter.seq;
}
exports.create = async (originalUrl) => {
    /// save original URL to mongoDB
    const numericId = await getNextId();
    const doc = await Url.create({
        _id: numericId, 
        originalUrl
    });
    return numericId;
}

exports.updateCode = async (id, code) => {
    // update existing code
    return Url.updateOne({_id: id}, {shortCode: code});
}

exports.findByShortCode = async (code) => {
    // search document by shortCode, to get original URL
    return Url.findOne({shortCode: code});
} 