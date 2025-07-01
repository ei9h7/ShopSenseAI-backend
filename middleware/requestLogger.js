import logger from '../utils/logger.js';

/**
 * Request Logging Middleware
 * 
 * Logs all incoming HTTP requests with timing information
 */

export const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    
    // Log incoming request
    logger.info('Incoming request', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type'),
        contentLength: req.get('Content-Length')
    });

    // Override res.end to capture response time and status
    const originalEnd = res.end;
    
    res.end = function(chunk, encoding) {
        const duration = Date.now() - startTime;
        
        // Log response
        logger.http(req.method, req.originalUrl, res.statusCode, duration);
        
        // Call original end method
        originalEnd.call(this, chunk, encoding);
    };

    next();
};

export default requestLogger;