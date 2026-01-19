const jwt = require('jsonwebtoken');

// Attaches req.user if a valid Bearer token is provided; otherwise lets the request continue for guests.
module.exports = function optionalAuthMiddleware(req, res, next) {
    if (req.method === 'OPTIONS') {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return next();
    }

    const [, token] = authHeader.split(' ');
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        req.user = decoded;
        return next();
    } catch (e) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
};
