/**
 * Centralized Logging Utility
 * 
 * Provides structured logging for the ShopSenseAI backend with different log levels
 * and formatting for development vs production environments.
 */

class Logger {
    constructor() {
        this.isDevelopment = process.env.NODE_ENV !== 'production';
    }

    /**
     * Formats log messages with timestamp and level
     */
    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        
        if (data) {
            return `${prefix} ${message} ${JSON.stringify(data, null, this.isDevelopment ? 2 : 0)}`;
        }
        return `${prefix} ${message}`;
    }

    /**
     * Info level logging - general application flow
     */
    info(message, data = null) {
        console.log(this.formatMessage('info', message, data));
    }

    /**
     * Warning level logging - potential issues
     */
    warn(message, data = null) {
        console.warn(this.formatMessage('warn', message, data));
    }

    /**
     * Error level logging - application errors
     */
    error(message, data = null) {
        console.error(this.formatMessage('error', message, data));
    }

    /**
     * Debug level logging - detailed debugging info (dev only)
     */
    debug(message, data = null) {
        if (this.isDevelopment) {
            console.debug(this.formatMessage('debug', message, data));
        }
    }

    /**
     * Success level logging - successful operations
     */
    success(message, data = null) {
        console.log(this.formatMessage('success', message, data));
    }

    /**
     * HTTP request logging
     */
    http(method, path, statusCode, responseTime = null) {
        const message = `${method} ${path} - ${statusCode}${responseTime ? ` (${responseTime}ms)` : ''}`;
        
        if (statusCode >= 500) {
            this.error(message);
        } else if (statusCode >= 400) {
            this.warn(message);
        } else {
            this.info(message);
        }
    }

    /**
     * Database operation logging
     */
    db(operation, table, result = null) {
        this.debug(`DB ${operation} on ${table}`, result);
    }

    /**
     * API call logging
     */
    api(service, operation, result = null) {
        this.info(`API call to ${service}: ${operation}`, result);
    }

    /**
     * Business logic logging
     */
    business(operation, details = null) {
        this.info(`Business: ${operation}`, details);
    }
}

// Export singleton instance
export default new Logger();