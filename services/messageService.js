import gptService from './gptService.js';
import openPhoneService from './openPhoneService.js';
import customerService from './customerService.js';
import logger from '../utils/logger.js';

/**
 * Message Service
 * 
 * Handles all message-related business logic including:
 * - Processing incoming messages with AI
 * - Managing message storage and retrieval
 * - Coordinating with OpenPhone for SMS delivery
 * - Implementing fallback responses when AI is unavailable
 */

class MessageService {
    constructor() {
        this.messages = new Map(); // In-memory storage (replace with database in production)
        this.settings = this.loadSettings();
    }

    /**
     * Load settings from environment variables
     */
    loadSettings() {
        return {
            business_name: process.env.BUSINESS_NAME || 'Pink Chicken Speed Shop',
            labor_rate: parseInt(process.env.LABOR_RATE || '80'),
            dnd_enabled: process.env.DND_ENABLED === 'true'
        };
    }

    /**
     * Process incoming message with AI and send response
     */
    async processIncomingMessage(phoneNumber, messageBody) {
        try {
            logger.info('Processing incoming message', { phoneNumber, messageLength: messageBody.length });

            // Clean the message body
            messageBody = messageBody.trim();
            
            if (!messageBody) {
                logger.warn('Empty message body received', { phoneNumber });
                return { success: false, error: 'Empty message body' };
            }

            // Create and store the incoming message
            const message = this.createMessage(phoneNumber, messageBody, 'inbound');
            this.storeMessage(message);

            // Check if Do Not Disturb is enabled
            if (!this.settings.dnd_enabled) {
                logger.info('DND disabled, message stored only');
                return { success: true, message: 'Message stored, DND disabled' };
            }

            // Check for emergency keywords first
            const isEmergency = this.detectEmergency(messageBody);
            if (isEmergency) {
                logger.warn('Emergency message detected', { phoneNumber, messageBody });
                await this.handleEmergencyMessage(phoneNumber, messageBody);
                return { success: true, message: 'Emergency message processed' };
            }

            // Process with AI or fallback
            const response = await this.generateResponse(messageBody, phoneNumber);
            
            // Send response via SMS
            const smsResult = await openPhoneService.sendSMS(phoneNumber, response.reply);
            
            if (smsResult.success) {
                // Store the outbound message
                const outboundMessage = this.createMessage(phoneNumber, response.reply, 'outbound');
                outboundMessage.ai_response = true;
                outboundMessage.intent = response.intent;
                outboundMessage.action = response.action;
                this.storeMessage(outboundMessage);

                // Update the original message with AI data
                message.processed = true;
                message.ai_response = response.reply;
                message.intent = response.intent;
                message.action = response.action;

                logger.success('Message processed and response sent', { phoneNumber });
                return { success: true, message: 'Message processed successfully' };
            } else {
                logger.error('Failed to send SMS response', smsResult);
                return { success: false, error: 'Failed to send SMS response' };
            }

        } catch (error) {
            logger.error('Error processing incoming message:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate AI response or fallback response
     */
    async generateResponse(messageBody, phoneNumber) {
        try {
            // Try AI response first
            if (gptService.isConfigured()) {
                logger.info('Generating AI response');
                const conversationHistory = this.getConversationHistory(phoneNumber);
                return await gptService.processMessageWithContext(
                    messageBody, 
                    conversationHistory, 
                    this.settings.business_name
                );
            } else {
                logger.info('AI not configured, using fallback response');
                return this.getFallbackResponse(messageBody);
            }
        } catch (error) {
            logger.warn('AI processing failed, using fallback', error);
            return this.getFallbackResponse(messageBody);
        }
    }

    /**
     * Handle emergency messages with immediate response
     */
    async handleEmergencyMessage(phoneNumber, messageBody) {
        const emergencyResponse = {
            reply: "🚨 EMERGENCY RECEIVED! I got your urgent message and will respond immediately. If you're in immediate danger, please call 911. Otherwise, I'll contact you within 15 minutes. Stay safe!",
            intent: "Emergency",
            action: "URGENT - Contact customer immediately"
        };

        const smsResult = await openPhoneService.sendSMS(phoneNumber, emergencyResponse.reply);
        
        if (smsResult.success) {
            const outboundMessage = this.createMessage(phoneNumber, emergencyResponse.reply, 'outbound');
            outboundMessage.emergency = true;
            outboundMessage.intent = emergencyResponse.intent;
            this.storeMessage(outboundMessage);
        }

        return emergencyResponse;
    }

    /**
     * Detect emergency keywords in message
     */
    detectEmergency(messageBody) {
        const emergencyKeywords = ['emergency', 'urgent', 'breakdown', 'stranded', 'accident', 'help', 'stuck'];
        const lowerMessage = messageBody.toLowerCase();
        return emergencyKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    /**
     * Generate fallback response when AI is unavailable
     */
    getFallbackResponse(messageBody) {
        const lowerMessage = messageBody.toLowerCase();

        // Service requests
        if (lowerMessage.includes('oil change') || lowerMessage.includes('service') || lowerMessage.includes('maintenance')) {
            return {
                reply: `Hi! Thanks for reaching out about service. I'd be happy to help with your vehicle maintenance. My rate is $${this.settings.labor_rate}/hr with a 1-hour minimum. What vehicle are you bringing in and what service do you need?`,
                intent: "Service Request",
                action: "Collect vehicle and service details"
            };
        }

        // Quote requests
        if (lowerMessage.includes('quote') || lowerMessage.includes('price') || lowerMessage.includes('cost')) {
            return {
                reply: `Thanks for your quote request! I'd be happy to provide an estimate. My labor rate is $${this.settings.labor_rate}/hr with a 1-hour minimum. What vehicle and what service are you looking to get done?`,
                intent: "Quote Request",
                action: "Collect vehicle and service details for quote"
            };
        }

        // Booking requests
        if (lowerMessage.includes('appointment') || lowerMessage.includes('schedule') || lowerMessage.includes('book')) {
            return {
                reply: `I'd be happy to schedule an appointment for you! We're open Monday-Friday, 8am-5pm. What day and time works best for you?`,
                intent: "Booking Request",
                action: "Collect preferred appointment time"
            };
        }

        // Default response
        return {
            reply: `Hi! Thanks for your message. I'm ${this.settings.business_name} and I'd be happy to help with your automotive needs. My rate is $${this.settings.labor_rate}/hr. What can I help you with today?`,
            intent: "General Inquiry",
            action: "Understand customer need"
        };
    }

    /**
     * Send manual reply to customer
     */
    async sendManualReply(phoneNumber, messageText) {
        try {
            logger.info('Sending manual reply', { phoneNumber, messageLength: messageText.length });

            const smsResult = await openPhoneService.sendSMS(phoneNumber, messageText);
            
            if (smsResult.success) {
                // Store the outbound message
                const outboundMessage = this.createMessage(phoneNumber, messageText, 'outbound');
                outboundMessage.manual = true;
                this.storeMessage(outboundMessage);

                logger.success('Manual reply sent successfully', { phoneNumber });
                return { success: true, message: 'Manual reply sent successfully' };
            } else {
                return { success: false, error: smsResult.error };
            }

        } catch (error) {
            logger.error('Error sending manual reply:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create a message object
     */
    createMessage(phoneNumber, body, direction) {
        return {
            id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
            phone_number: phoneNumber,
            body,
            direction,
            timestamp: new Date().toISOString(),
            processed: false,
            created_at: new Date().toISOString(),
            read: false
        };
    }

    /**
     * Store message in memory (replace with database in production)
     */
    storeMessage(message) {
        this.messages.set(message.id, message);
        logger.debug('Message stored', { messageId: message.id, direction: message.direction });
    }

    /**
     * Get all messages
     */
    async getAllMessages() {
        const messages = Array.from(this.messages.values())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 100); // Limit to last 100 messages

        logger.debug('Retrieved messages', { count: messages.length });
        return messages;
    }

    /**
     * Get all messages for API endpoint
     */
    getMessages() {
        const messages = Array.from(this.messages.values())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 100); // Limit to last 100 messages

        logger.info('Retrieved messages via getMessages()', { count: messages.length });
        return messages;
    }

    /**
     * Get customers extracted from messages
     */
    getCustomers() {
        const customers = new Map();
        
        Array.from(this.messages.values()).forEach(message => {
            if (message.phone_number && !customers.has(message.phone_number)) {
                customers.set(message.phone_number, {
                    id: message.phone_number,
                    phone_number: message.phone_number,
                    last_contact: message.timestamp,
                    message_count: 1,
                    last_message: message.body.substring(0, 50) + '...'
                });
            } else if (customers.has(message.phone_number)) {
                const customer = customers.get(message.phone_number);
                customer.message_count++;
                if (new Date(message.timestamp) > new Date(customer.last_contact)) {
                    customer.last_contact = message.timestamp;
                    customer.last_message = message.body.substring(0, 50) + '...';
                }
            }
        });

        return Array.from(customers.values())
            .sort((a, b) => new Date(b.last_contact).getTime() - new Date(a.last_contact).getTime());
    }

    /**
     * Get quotes from messages (placeholder)
     */
    getQuotes() {
        // Extract quote-related messages
        const quoteMessages = Array.from(this.messages.values())
            .filter(msg => 
                msg.intent && (
                    msg.intent.toLowerCase().includes('quote') ||
                    msg.intent.toLowerCase().includes('price') ||
                    msg.intent.toLowerCase().includes('estimate')
                )
            );

        return quoteMessages.map(msg => ({
            id: msg.id,
            customer_phone: msg.phone_number,
            request: msg.body,
            response: msg.ai_response,
            created_at: msg.timestamp,
            status: 'sent'
        }));
    }

    /**
     * Get appointments from messages (placeholder)
     */
    getAppointments() {
        // Extract booking-related messages
        const bookingMessages = Array.from(this.messages.values())
            .filter(msg => 
                msg.intent && (
                    msg.intent.toLowerCase().includes('booking') ||
                    msg.intent.toLowerCase().includes('appointment') ||
                    msg.intent.toLowerCase().includes('schedule')
                )
            );

        return bookingMessages.map(msg => ({
            id: msg.id,
            customer_phone: msg.phone_number,
            request: msg.body,
            created_at: msg.timestamp,
            status: 'pending'
        }));
    }

    /**
     * Get tech sheets (placeholder)
     */
    getTechSheets() {
        // Placeholder - return empty array for now
        return [];
    }

    /**
     * Mark message as read (compatibility method)
     */
    markMessageAsRead(messageId) {
        const message = this.messages.get(messageId);
        if (message) {
            message.read = true;
            logger.debug('Message marked as read', { messageId });
            return true;
        }
        return false;
    }

    /**
     * Get conversation history for a specific phone number
     */
    getConversationHistory(phoneNumber) {
        const conversations = Array.from(this.messages.values())
            .filter(msg => msg.phone_number === phoneNumber)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .slice(-20); // Last 20 messages for context

        logger.debug('Retrieved conversation history', { phoneNumber, count: conversations.length });
        return conversations;
    }

    /**
     * Mark message as read
     */
    async markAsRead(messageId) {
        const message = this.messages.get(messageId);
        if (message) {
            message.read = true;
            logger.debug('Message marked as read', { messageId });
            return { success: true };
        }
        return { success: false };
    }

    /**
     * Get message statistics
     */
    async getMessageStats() {
        const messages = Array.from(this.messages.values());
        
        const stats = {
            total: messages.length,
            inbound: messages.filter(m => m.direction === 'inbound').length,
            outbound: messages.filter(m => m.direction === 'outbound').length,
            unread: messages.filter(m => m.direction === 'inbound' && !m.read).length,
            emergency: messages.filter(m => m.emergency || (m.intent && m.intent.toLowerCase().includes('emergency'))).length,
            processed: messages.filter(m => m.processed).length
        };

        logger.debug('Message statistics calculated', stats);
        return stats;
    }
}

export default new MessageService();