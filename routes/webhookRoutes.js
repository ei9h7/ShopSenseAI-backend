import express from 'express';
import webhookController from '../controllers/webhookController.js';

const router = express.Router();

/**
 * Webhook Routes
 * 
 * Handles incoming webhook requests from external services
 */

// OpenPhone webhook endpoint
router.post('/openphone', webhookController.handleOpenPhoneWebhook);
router.get('/openphone', webhookController.handleOpenPhoneWebhook); // For webhook verification

// Get webhook information
router.get('/info', webhookController.getWebhookInfo);

export default router;