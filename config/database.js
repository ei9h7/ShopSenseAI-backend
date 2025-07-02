import pg from 'pg';
import logger from '../utils/logger.js';

const { Pool } = pg;

/**
 * PostgreSQL Database Configuration
 * 
 * Handles database connection, migrations, and health checks
 */

class DatabaseConfig {
    constructor() {
        this.pool = null;
        this.isConnected = false;
        this.type = 'postgresql';
        this.retryCount = 0;
        this.maxRetries = 5;
    }

    /**
     * Initialize database connection
     */
    async connect() {
        try {
            // Check if DATABASE_URL is provided
            if (!process.env.DATABASE_URL) {
                logger.warn('DATABASE_URL not provided, using in-memory storage');
                this.type = 'memory';
                this.isConnected = true;
                return true;
            }

            logger.info('Connecting to PostgreSQL database...');

            // Create connection pool
            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { 
                    rejectUnauthorized: false 
                } : false,
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });

            // Test connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            this.isConnected = true;
            this.retryCount = 0;
            
            logger.success('✅ PostgreSQL connected successfully');
            
            // Run migrations
            await this.runMigrations();
            
            return true;

        } catch (error) {
            logger.error('❌ PostgreSQL connection failed:', error);
            
            this.retryCount++;
            if (this.retryCount < this.maxRetries) {
                logger.info(`Retrying connection in 5 seconds... (${this.retryCount}/${this.maxRetries})`);
                setTimeout(() => this.connect(), 5000);
            } else {
                logger.warn('Max retries reached, falling back to in-memory storage');
                this.type = 'memory';
                this.isConnected = true;
            }
            
            return false;
        }
    }

    /**
     * Run database migrations
     */
    async runMigrations() {
        if (!this.pool) return;

        try {
            logger.info('Running database migrations...');

            // Create appointments table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS appointments (
                    id VARCHAR(255) PRIMARY KEY,
                    customer_name VARCHAR(255) NOT NULL,
                    customer_phone VARCHAR(50),
                    customer_email VARCHAR(255),
                    vehicle_info TEXT,
                    service_type VARCHAR(255) NOT NULL,
                    appointment_date VARCHAR(50) NOT NULL,
                    appointment_time VARCHAR(50) NOT NULL,
                    duration INTEGER DEFAULT 1,
                    notes TEXT,
                    status VARCHAR(50) DEFAULT 'confirmed',
                    source VARCHAR(50) DEFAULT 'api',
                    google_event_id VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Create index for faster queries
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_appointments_date 
                ON appointments(appointment_date, appointment_time);
            `);

            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_appointments_status 
                ON appointments(status);
            `);

            // Create messages table for future use
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS messages (
                    id VARCHAR(255) PRIMARY KEY,
                    phone_number VARCHAR(50) NOT NULL,
                    body TEXT NOT NULL,
                    direction VARCHAR(20) NOT NULL,
                    processed BOOLEAN DEFAULT FALSE,
                    intent VARCHAR(100),
                    action TEXT,
                    ai_response TEXT,
                    emergency BOOLEAN DEFAULT FALSE,
                    manual BOOLEAN DEFAULT FALSE,
                    read_status BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_messages_phone 
                ON messages(phone_number, created_at);
            `);

            logger.success('✅ Database migrations completed');

        } catch (error) {
            logger.error('❌ Migration failed:', error);
            throw error;
        }
    }

    /**
     * Execute a query
     */
    async query(text, params = []) {
        if (!this.pool) {
            throw new Error('Database not connected');
        }

        try {
            const start = Date.now();
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            
            logger.debug('Database query executed', { 
                duration: `${duration}ms`,
                rows: result.rowCount,
                command: text.split(' ')[0]
            });
            
            return result;
        } catch (error) {
            logger.error('Database query failed:', { 
                query: text,
                params,
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Get a client from the pool
     */
    async getClient() {
        if (!this.pool) {
            throw new Error('Database not connected');
        }
        return await this.pool.connect();
    }

    /**
     * Close database connection
     */
    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }
        this.isConnected = false;
        logger.info('📊 Database connection closed');
    }

    /**
     * Get database health status
     */
    async getHealthStatus() {
        try {
            if (!this.isConnected) {
                return {
                    connected: false,
                    type: this.type,
                    status: 'disconnected'
                };
            }

            if (this.type === 'memory') {
                return {
                    connected: true,
                    type: 'memory',
                    status: 'in-memory'
                };
            }

            // Test PostgreSQL connection
            const result = await this.query('SELECT NOW() as current_time, version() as pg_version');
            
            return {
                connected: true,
                type: this.type,
                status: 'healthy',
                server_time: result.rows[0].current_time,
                version: result.rows[0].pg_version.split(' ')[0] + ' ' + result.rows[0].pg_version.split(' ')[1]
            };

        } catch (error) {
            logger.error('Database health check failed:', error);
            return {
                connected: false,
                type: this.type,
                status: 'error',
                error: error.message
            };
        }
    }

    /**
     * Check if using PostgreSQL
     */
    isPostgreSQL() {
        return this.type === 'postgresql' && this.isConnected;
    }
}

export default new DatabaseConfig();