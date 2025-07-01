import express from 'express';
import messageController from '../controllers/messageController.js';

const router = express.Router();

/**
 * Message Routes
 * 
 * Handles all message-related API endpoints
 */

// Get all messages
router.get('/', messageController.getMessages);

// Send manual reply
router.post('/reply', messageController.sendReply);

// Mark message as read
router.post('/:id/read', messageController.markAsRead);

// Get conversation history for a specific phone number
router.get('/conversation/:phoneNumber', messageController.getConversation);

// Get message statistics
router.get('/stats', messageController.getStats);

export default router;