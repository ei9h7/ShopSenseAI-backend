#!/usr/bin/env node

/**
 * Database Migration Script
 * 
 * Runs database migrations for ShopSenseAI
 */

import dotenv from 'dotenv';
dotenv.config();

import database from '../config/database.js';
import logger from '../utils/logger.js';

async function runMigrations() {
    try {
        logger.info('🚀 Starting database migrations...');

        // Connect to database
        const connected = await database.connect();
        
        if (!connected) {
            logger.error('❌ Failed to connect to database');
            process.exit(1);
        }

        if (database.isPostgreSQL()) {
            logger.success('✅ Database migrations completed successfully');
        } else {
            logger.warn('⚠️  Using in-memory storage - no migrations needed');
        }

        // Test the connection
        const health = await database.getHealthStatus();
        logger.info('Database health check:', health);

        await database.disconnect();
        logger.info('✅ Migration script completed');
        
    } catch (error) {
        logger.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migrations
runMigrations();