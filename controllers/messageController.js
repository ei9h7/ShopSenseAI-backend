import messageService from '../services/messageService.js';
import logger from '../utils/logger.js';

/**
 * Message Controller
 * 
 * Handles HTTP requests related to message management and SMS communication.
 * Orchestrates the business logic between the API layer and service layer.
 */

class MessageController {
    /**
     * Get all messages
     */
    async getMessages(req, res) {
        try {
            logger.info('Fetching messages');
            const messages = await messageService.getAllMessages();
            
            res.json({
                success: true,
                messages,
                count: messages.length
            });
        } catch (error) {
            logger.error('Error fetching messages:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch messages'
            });
        }
    }

    /**
     * Send manual reply to customer
     */
    async sendReply(req, res) {
        try {
            const { phoneNumber, message } = req.body;

            if (!phoneNumber || !message) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number and message are required'
                });
            }

            logger.info('Sending manual reply', { phoneNumber, messageLength: message.length });
            
            const result = await messageService.sendManualReply(phoneNumber, message);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: 'Reply sent successfully'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error || 'Failed to send reply'
                });
            }
        } catch (error) {
            logger.error('Error sending reply:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send reply'
            });
        }
    }

    /**
     * Mark message as read
     */
    async markAsRead(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Message ID is required'
                });
            }

            logger.info('Marking message as read', { messageId: id });
            
            const result = await messageService.markAsRead(id);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: 'Message marked as read'
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Message not found'
                });
            }
        } catch (error) {
            logger.error('Error marking message as read:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to mark message as read'
            });
        }
    }

    /**
     * Get conversation history for a specific phone number
     */
    async getConversation(req, res) {
        try {
            const { phoneNumber } = req.params;

            if (!phoneNumber) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number is required'
                });
            }

            logger.info('Fetching conversation history', { phoneNumber });
            
            const messages = await messageService.getConversationHistory(phoneNumber);
            
            res.json({
                success: true,
                messages,
                phoneNumber,
                count: messages.length
            });
        } catch (error) {
            logger.error('Error fetching conversation:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch conversation'
            });
        }
    }

    /**
     * Get message statistics
     */
    async getStats(req, res) {
        try {
            logger.info('Fetching message statistics');
            const stats = await messageService.getMessageStats();
            
            res.json({
                success: true,
                stats
            });
        } catch (error) {
            logger.error('Error fetching message stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch message statistics'
            });
        }
    }
}

export default new MessageController();