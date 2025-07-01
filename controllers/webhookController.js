import messageService from '../services/messageService.js';
import openPhoneService from '../services/openPhoneService.js';
import logger from '../utils/logger.js';

/**
 * Webhook Controller
 * 
 * Handles incoming webhook requests from external services like OpenPhone.
 * Processes webhook payloads and triggers appropriate business logic.
 */

class WebhookController {
    /**
     * Handle OpenPhone webhook for incoming SMS messages
     */
    async handleOpenPhoneWebhook(req, res) {
        try {
            logger.info('OpenPhone webhook received', {
                method: req.method,
                headers: req.headers,
                body: req.body
            });

            // Handle GET requests (webhook verification)
            if (req.method === 'GET') {
                logger.info('GET request - webhook verification');
                return res.status(200).json({ 
                    message: 'OpenPhone webhook endpoint is active',
                    timestamp: new Date().toISOString(),
                    server: 'ShopSenseAI Backend'
                });
            }

            // Handle empty or malformed requests
            if (!req.body) {
                logger.warn('Empty request body received');
                return res.status(200).json({ 
                    received: true, 
                    message: 'Empty body received' 
                });
            }

            const payload = req.body;

            // Handle test webhooks
            if (payload.test || payload.ping) {
                logger.info('Test/ping webhook received');
                return res.status(200).json({ 
                    received: true, 
                    message: 'Test webhook processed successfully' 
                });
            }

            // Validate OpenPhone webhook structure
            if (!webhookController.isValidOpenPhoneWebhook(payload)) {
                logger.warn('Invalid webhook payload structure', payload);
                return res.status(200).json({ 
                    received: true, 
                    message: 'Invalid payload structure' 
                });
            }

            // Only process incoming messages
            if (payload.data.object.direction !== 'incoming') {
                logger.info('Outbound message, ignoring');
                return res.status(200).json({ received: true });
            }

            // Extract message data
            const phoneNumber = payload.data.object.from;
            // Clean up escaped quotes in message body
            let messageBody = payload.data.object.body || payload.data.object.text || '';
            
            // Remove escaped quotes that OpenPhone sometimes adds
            if (messageBody.startsWith('"') && messageBody.endsWith('"')) {
                messageBody = messageBody.slice(1, -1);
            }
            
            const phoneNumberId = payload.data.object.phoneNumberId;
            
            // Validate required fields
            if (!phoneNumber || !messageBody) {
                logger.error('Missing required fields', { phoneNumber, messageBody });
                return res.status(400).json({ 
                    error: 'Missing phone number or message body',
                    received: false 
                });
            }

            logger.info('Processing incoming message', { 
                phoneNumber, 
                messageLength: messageBody.length,
                phoneNumberId 
            });

            // Update OpenPhone service with phoneNumberId for better API calls
            if (phoneNumberId) {
                openPhoneService.setPhoneNumberId(phoneNumberId);
            }

            // Process the message through the message service
            const result = await messageService.processIncomingMessage(phoneNumber, messageBody);
            
            if (result.success) {
                logger.success('Message processed successfully', { 
                    phoneNumber, 
                    processed: true 
                });
                
                res.status(200).json({ 
                    received: true, 
                    processed: true,
                    timestamp: new Date().toISOString()
                });
            } else {
                logger.error('Message processing failed', { 
                    phoneNumber, 
                    error: result.error 
                });
                
                // Still return 200 to prevent OpenPhone retries
                res.status(200).json({ 
                    received: true, 
                    processed: false,
                    error: 'Processing failed but webhook acknowledged'
                });
            }

        } catch (error) {
            logger.error('Webhook processing error:', error);
            
            // Log the full error details for debugging
            logger.error('Full error details:', {
                message: error.message,
                stack: error.stack,
                payload: req.body
            });
            
            // Return 200 to prevent OpenPhone from retrying
            res.status(200).json({ 
                received: true,
                processed: false,
                error: 'Internal server error',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Validates OpenPhone webhook payload structure
     */
    isValidOpenPhoneWebhook(payload) {
        return payload.object === 'event' &&
               payload.data &&
               payload.data.object &&
               payload.data.object.object === 'message';
    }

    /**
     * Get webhook status and configuration info
     */
    async getWebhookInfo(req, res) {
        try {
            const webhookInfo = {
                status: 'active',
                endpoint: '/api/webhooks/openphone',
                methods: ['GET', 'POST'],
                description: 'OpenPhone SMS webhook handler',
                lastReceived: null, // Could be enhanced to track last webhook time
                configuration: {
                    events: ['message.received'],
                    format: 'OpenPhone webhook format',
                    authentication: 'None required'
                }
            };

            res.json({
                success: true,
                webhook: webhookInfo
            });
        } catch (error) {
            logger.error('Error getting webhook info:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get webhook information'
            });
        }
    }
}

const webhookController = new WebhookController();
export default webhookController;