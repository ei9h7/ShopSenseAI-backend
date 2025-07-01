import express from 'express';
import notificationService from '../services/notificationService.js';
import emailService from '../services/emailService.js';
import logger from '../utils/logger.js';
import { validateRequiredFields, validatePhoneNumberMiddleware } from '../middleware/validation.js';

const router = express.Router();

/**
 * Notification Routes
 * 
 * Handles notification management and delivery endpoints
 */

// Send manual notification
router.post('/send', validateRequiredFields(['type', 'recipient', 'data']), async (req, res) => {
    try {
        const { type, recipient, data, method } = req.body;

        logger.info('Manual notification request', {
            type,
            recipient: notificationService.maskContact(recipient),
            method
        });

        const result = await notificationService.sendNotification(type, recipient, data, method);
        
        if (result.success) {
            res.json({
                success: true,
                notificationId: result.notificationId,
                method: result.method,
                message: 'Notification sent successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        logger.error('Error sending manual notification:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send notification'
        });
    }
});

// Send business notification
router.post('/business', validateRequiredFields(['type', 'data']), async (req, res) => {
    try {
        const { type, data } = req.body;

        logger.info('Business notification request', { type });

        const result = await notificationService.sendBusinessNotification(type, data);
        
        res.json({
            success: result.success,
            message: result.message,
            results: result.results
        });

    } catch (error) {
        logger.error('Error sending business notification:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send business notification'
        });
    }
});

// Send quote notification
router.post('/quote', validateRequiredFields(['customerContact', 'quote']), async (req, res) => {
    try {
        const { customerContact, quote, method } = req.body;

        const result = await notificationService.sendQuoteNotification(customerContact, quote, method);
        
        if (result.success) {
            res.json({
                success: true,
                notificationId: result.notificationId,
                method: result.method,
                message: 'Quote notification sent successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        logger.error('Error sending quote notification:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send quote notification'
        });
    }
});

// Send appointment notification
router.post('/appointment', validateRequiredFields(['customerContact', 'appointment']), async (req, res) => {
    try {
        const { customerContact, appointment, method } = req.body;

        const result = await notificationService.sendAppointmentNotification(customerContact, appointment, method);
        
        if (result.success) {
            res.json({
                success: true,
                notificationId: result.notificationId,
                method: result.method,
                message: 'Appointment notification sent successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        logger.error('Error sending appointment notification:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send appointment notification'
        });
    }
});

// Get notification history
router.get('/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const history = notificationService.getNotificationHistory(limit);
        
        res.json({
            success: true,
            notifications: history,
            count: history.length
        });

    } catch (error) {
        logger.error('Error fetching notification history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notification history'
        });
    }
});

// Get notification statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = notificationService.getNotificationStats();
        
        res.json({
            success: true,
            stats
        });

    } catch (error) {
        logger.error('Error fetching notification stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notification statistics'
        });
    }
});

// Test email service
router.get('/test/email', async (req, res) => {
    try {
        const result = await emailService.testConnection();
        
        res.json({
            success: result.success,
            message: result.message || result.error,
            configured: emailService.isConfigured
        });

    } catch (error) {
        logger.error('Error testing email service:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test email service'
        });
    }
});

// Send test notification
router.post('/test', validateRequiredFields(['recipient']), async (req, res) => {
    try {
        const { recipient, method } = req.body;

        const testData = {
            message: 'This is a test notification from ShopSenseAI',
            timestamp: new Date().toISOString()
        };

        const result = await notificationService.sendNotification(
            'service_update', 
            recipient, 
            testData, 
            method
        );
        
        if (result.success) {
            res.json({
                success: true,
                notificationId: result.notificationId,
                method: result.method,
                message: 'Test notification sent successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        logger.error('Error sending test notification:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send test notification'
        });
    }
});

export default router;