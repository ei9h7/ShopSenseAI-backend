import logger from '../utils/logger.js';

/**
 * Validation Middleware
 * 
 * Provides common validation functions for API endpoints
 */

/**
 * Validate phone number format
 */
export const validatePhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return false;
    
    // Remove all non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Check if it's a valid US phone number (10 digits) or international (7-15 digits)
    return cleaned.length >= 7 && cleaned.length <= 15;
};

/**
 * Validate required fields middleware
 */
export const validateRequiredFields = (requiredFields) => {
    return (req, res, next) => {
        const missingFields = [];
        
        for (const field of requiredFields) {
            if (!req.body[field]) {
                missingFields.push(field);
            }
        }
        
        if (missingFields.length > 0) {
            logger.warn('Validation failed - missing required fields', {
                missingFields,
                url: req.originalUrl,
                method: req.method
            });
            
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                missingFields,
                requiredFields
            });
        }
        
        next();
    };
};

/**
 * Validate phone number middleware
 */
export const validatePhoneNumberMiddleware = (fieldName = 'phoneNumber') => {
    return (req, res, next) => {
        const phoneNumber = req.body[fieldName] || req.params[fieldName];
        
        if (phoneNumber && !validatePhoneNumber(phoneNumber)) {
            logger.warn('Validation failed - invalid phone number', {
                phoneNumber,
                fieldName,
                url: req.originalUrl
            });
            
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format',
                field: fieldName
            });
        }
        
        next();
    };
};

/**
 * Sanitize input data
 */
export const sanitizeInput = (req, res, next) => {
    const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;
        
        return str
            .trim()
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .substring(0, 1000); // Limit length
    };

    const sanitizeObject = (obj) => {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = sanitizeString(obj[key]);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitizeObject(obj[key]);
            }
        }
    };

    if (req.body && typeof req.body === 'object') {
        sanitizeObject(req.body);
    }

    next();
};

export default {
    validatePhoneNumber,
    validateRequiredFields,
    validatePhoneNumberMiddleware,
    sanitizeInput
};