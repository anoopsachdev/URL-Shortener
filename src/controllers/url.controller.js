const urlService = require("../services/url.service");

exports.shortenUrl = async (req, res, next) => {
  try {
    const originalUrl = req.body.originalUrl;
    const result = await urlService.createShortenUrl(originalUrl);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

exports.redirectUrl = async(req, res, next) => {
    try {
        const original = await urlService.getOriginalUrl(req.params.code);
        res.redirect(original);
    } catch (error) {
        next(error);
    }
}

// The res.redirect() function in Express.js 
// is a method used to send an HTTP redirect to the client's browser, 
// instructing it to navigate to a different URL.