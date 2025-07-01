import express from 'express';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Settings Routes
 * 
 * Handles server settings and configuration endpoints
 */

// Get server settings
router.get('/', (req, res) => {
    try {
        logger.info('Fetching server settings');
        
        const settings = {
            openai_configured: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10),
            openphone_configured: !!(process.env.OPENPHONE_API_KEY && process.env.OPENPHONE_API_KEY.length > 10),
            business_name: process.env.BUSINESS_NAME || 'Pink Chicken Speed Shop',
            labor_rate: parseInt(process.env.LABOR_RATE || '80'),
            dnd_enabled: process.env.DND_ENABLED === 'true',
            openai_key_preview: process.env.OPENAI_API_KEY ?
                `••••••••${process.env.OPENAI_API_KEY.slice(-4)}` : undefined,
            openphone_key_preview: process.env.OPENPHONE_API_KEY ?
                `••••••••${process.env.OPENPHONE_API_KEY.slice(-4)}` : undefined,
            phone_number: process.env.OPENPHONE_PHONE_NUMBER || undefined
        };
        
        res.json({
            success: true,
            settings
        });
    } catch (error) {
        logger.error('Error fetching settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch settings'
        });
    }
});

// Update server settings (limited to what can be changed via API)
router.post('/', (req, res) => {
    try {
        const { dnd_enabled } = req.body;
        
        // For now, only DND can be updated via API
        // Other settings should be changed via environment variables
        
        if (typeof dnd_enabled === 'boolean') {
            process.env.DND_ENABLED = dnd_enabled.toString();
            logger.info('DND setting updated', { dnd_enabled });
        }
        
        res.json({
            success: true,
            message: 'Settings updated successfully',
            updated: { dnd_enabled }
        });
    } catch (error) {
        logger.error('Error updating settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update settings'
        });
    }
});

// Health endpoint for internal use
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'settings',
        timestamp: new Date().toISOString()
    });
});

export default router;