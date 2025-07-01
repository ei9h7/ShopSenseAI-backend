import logger from '../utils/logger.js';

/**
 * Global Error Handling Middleware
 * 
 * Provides centralized error handling for all routes and middleware
 */

export const errorHandler = (err, req, res, next) => {
    // Log the error
    logger.error('Unhandled error:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Determine error type and response
    let statusCode = 500;
    let message = 'Internal server error';

    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation error';
    } else if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid data format';
    } else if (err.code === 11000) {
        statusCode = 409;
        message = 'Duplicate entry';
    } else if (err.statusCode) {
        statusCode = err.statusCode;
        message = err.message;
    }

    // Send error response
    res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
            details: err
        })
    });
};

export const notFoundHandler = (req, res) => {
    logger.warn('404 - Route not found', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip
    });

    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        method: req.method,
        path: req.originalUrl,
        availableEndpoints: {
            health: 'GET /health',
            webhook: 'POST /api/webhooks/openphone',
            messages: 'GET /api/messages',
            customers: 'GET /api/customers',
            quotes: 'GET /api/quotes',
            appointments: 'GET /api/appointments',
            techSheets: 'GET /api/tech-sheets',
            settings: 'GET /api/settings'
        }
    });
};

export default {
    errorHandler,
    notFoundHandler
};