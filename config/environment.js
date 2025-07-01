/**
 * Environment Configuration
 * 
 * Centralizes environment variable management and validation
 */

class EnvironmentConfig {
    constructor() {
        this.loadConfig();
        this.validateConfig();
    }

    /**
     * Load environment variables with defaults
     */
    loadConfig() {
        this.config = {
            // Server Configuration
            NODE_ENV: process.env.NODE_ENV || 'development',
            PORT: parseInt(process.env.PORT) || 10000,
            
            // API Keys
            OPENAI_API_KEY: process.env.OPENAI_API_KEY,
            OPENPHONE_API_KEY: process.env.OPENPHONE_API_KEY,
            OPENPHONE_PHONE_NUMBER: process.env.OPENPHONE_PHONE_NUMBER,
            
            // Business Settings
            BUSINESS_NAME: process.env.BUSINESS_NAME || 'Pink Chicken Speed Shop',
            LABOR_RATE: parseInt(process.env.LABOR_RATE) || 80,
            DND_ENABLED: process.env.DND_ENABLED === 'true',
            
            // Frontend Configuration
            FRONTEND_URL: process.env.FRONTEND_URL,
            
            // Database (for future use)
            DATABASE_URL: process.env.DATABASE_URL,
            
            // Logging
            LOG_LEVEL: process.env.LOG_LEVEL || 'info'
        };
    }

    /**
     * Validate required environment variables
     */
    validateConfig() {
        const requiredVars = [];
        const warnings = [];

        // Check critical API keys
        if (!this.config.OPENAI_API_KEY) {
            warnings.push('OPENAI_API_KEY not set - AI responses will not work');
        }
        
        if (!this.config.OPENPHONE_API_KEY) {
            warnings.push('OPENPHONE_API_KEY not set - SMS sending will not work');
        }
        
        if (!this.config.OPENPHONE_PHONE_NUMBER) {
            warnings.push('OPENPHONE_PHONE_NUMBER not set - SMS functionality may not work');
        }

        // Log warnings
        if (warnings.length > 0) {
            console.warn('⚠️  Configuration warnings:');
            warnings.forEach(warning => console.warn(`   - ${warning}`));
        }

        // Check for missing required vars
        if (requiredVars.length > 0) {
            console.error('❌ Missing required environment variables:');
            requiredVars.forEach(varName => console.error(`   - ${varName}`));
            process.exit(1);
        }

        console.log('✅ Environment configuration loaded successfully');
    }

    /**
     * Get configuration value
     */
    get(key) {
        return this.config[key];
    }

    /**
     * Check if service is configured
     */
    isConfigured(service) {
        switch (service) {
            case 'openai':
                return !!(this.config.OPENAI_API_KEY && this.config.OPENAI_API_KEY.length > 10);
            case 'openphone':
                return !!(this.config.OPENPHONE_API_KEY && this.config.OPENPHONE_PHONE_NUMBER);
            case 'database':
                return !!this.config.DATABASE_URL;
            default:
                return false;
        }
    }

    /**
     * Get configuration summary for API
     */
    getPublicConfig() {
        return {
            environment: this.config.NODE_ENV,
            business_name: this.config.BUSINESS_NAME,
            labor_rate: this.config.LABOR_RATE,
            dnd_enabled: this.config.DND_ENABLED,
            services: {
                openai_configured: this.isConfigured('openai'),
                openphone_configured: this.isConfigured('openphone'),
                database_configured: this.isConfigured('database')
            },
            api_keys: {
                openai_preview: this.config.OPENAI_API_KEY ? 
                    `••••••••${this.config.OPENAI_API_KEY.slice(-4)}` : undefined,
                openphone_preview: this.config.OPENPHONE_API_KEY ? 
                    `••••••••${this.config.OPENPHONE_API_KEY.slice(-4)}` : undefined
            }
        };
    }
}

export default new EnvironmentConfig();