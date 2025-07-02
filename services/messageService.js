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

                // Check if this is a booking confirmation and create appointment
                if (response.action && response.action.includes('BOOKING_CONFIRMED:')) {
                    logger.info('Booking confirmation detected, creating appointment', { action: response.action });
                    await this.processBookingConfirmation(phoneNumber, response.action);
                }

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

    /**
     * Process booking confirmation and create actual appointment
     */
    async processBookingConfirmation(phoneNumber, action) {
        try {
            logger.info('Processing booking confirmation', { phoneNumber, action });

            // Parse the booking details from the action
            // Format: "BOOKING_CONFIRMED: Name | Phone | Vehicle | Service | Date | Time"
            const actionParts = action.replace('BOOKING_CONFIRMED:', '').trim().split('|');
            
            if (actionParts.length < 6) {
                logger.warn('Invalid booking confirmation format', { action });
                return { success: false, error: 'Invalid booking format' };
            }

            const bookingDetails = {
                name: actionParts[0].trim(),              // Use 'name' instead of 'customer_name'
                phone: actionParts[1].trim(),             // Use 'phone' instead of 'customer_phone'  
                vehicle: actionParts[2].trim(),           // Use 'vehicle' instead of 'vehicle_info'
                service: actionParts[3].trim(),           // Use 'service' instead of 'service_type'
                date: actionParts[4].trim(),
                time: actionParts[5].trim()
            };

            logger.info('Parsed booking details', bookingDetails);

            // Import booking controller dynamically to avoid circular imports
            const { default: bookingController } = await import('../controllers/bookingController.js');
            
            // Create the appointment using the booking controller
            const appointmentResult = await bookingController.createAppointment(bookingDetails);
            
            if (appointmentResult && appointmentResult.success !== false) {
                logger.success('Appointment created from booking confirmation', { 
                    appointmentId: appointmentResult.id,
                    customer: bookingDetails.name,
                    date: bookingDetails.date,
                    time: bookingDetails.time,
                    service: appointmentResult.service_type
                });
                
                // Verify appointment was stored in calendar service
                const { default: calendarService } = await import('./calendarService.js');
                const allAppointments = await calendarService.getAllAppointments();
                const wasStored = allAppointments.find(apt => apt.id === appointmentResult.id);
                
                logger.info('Appointment storage verification', {
                    appointmentId: appointmentResult.id,
                    wasStored: !!wasStored,
                    totalAppointments: allAppointments.length
                });
                
                // Send confirmation message
                await this.sendBookingNotification(phoneNumber, appointmentResult);
                
                return { success: true, appointmentId: appointmentResult.id };
            } else if (appointmentResult && appointmentResult.conflict) {
                logger.warn('Booking conflict detected', {
                    customer: bookingDetails.name,
                    requestedTime: `${bookingDetails.date} at ${bookingDetails.time}`,
                    conflicts: appointmentResult.conflicts
                });
                
                // Send conflict notification to customer
                await this.sendConflictNotification(phoneNumber, bookingDetails, appointmentResult);
                
                return { 
                    success: false, 
                    conflict: true, 
                    reason: appointmentResult.reason 
                };
            } else {
                logger.error('Failed to create appointment from booking confirmation');
                return { success: false, error: 'Failed to create appointment' };
            }

        } catch (error) {
            logger.error('Error processing booking confirmation:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send booking notification/confirmation
     */
    async sendBookingNotification(phoneNumber, appointment) {
        try {
            const confirmationMessage = `✅ Appointment confirmed! ${appointment.date} at ${appointment.time} for ${appointment.service_type || appointment.service || 'your service'}. We'll see you then!`;
            
            // Send via OpenPhone
            const smsResult = await openPhoneService.sendSMS(phoneNumber, confirmationMessage);
            
            if (smsResult.success) {
                // Store the confirmation message
                const confirmationMsg = this.createMessage(phoneNumber, confirmationMessage, 'outbound');
                confirmationMsg.appointment_confirmation = true;
                confirmationMsg.appointment_id = appointment.id;
                this.storeMessage(confirmationMsg);
                
                logger.success('Booking confirmation sent', { phoneNumber, appointmentId: appointment.id });
            }
        } catch (error) {
            logger.error('Error sending booking notification:', error);
        }
    }

    /**
     * Send conflict notification when appointment can't be booked
     */
    async sendConflictNotification(phoneNumber, bookingDetails, conflictInfo) {
        try {
            let conflictMessage = `Sorry ${bookingDetails.name}, ${bookingDetails.date} at ${bookingDetails.time} is not available. `;
            
            if (conflictInfo.conflicts && conflictInfo.conflicts.length > 0) {
                conflictMessage += `There's already an appointment scheduled at that time. `;
            }
            
            if (conflictInfo.suggestions && conflictInfo.suggestions.length > 0) {
                conflictMessage += '\n\nAvailable times:\n';
                conflictInfo.suggestions.slice(0, 3).forEach((suggestion, index) => {
                    conflictMessage += `${index + 1}. ${suggestion.date} at ${suggestion.time}\n`;
                });
                conflictMessage += '\nReply with the number of your preferred time!';
            } else {
                conflictMessage += 'Please suggest another time or call us to check availability.';
            }
            
            // Send conflict message
            const smsResult = await openPhoneService.sendSMS(phoneNumber, conflictMessage);
            
            if (smsResult.success) {
                // Store the conflict message
                const conflictMsg = this.createMessage(phoneNumber, conflictMessage, 'outbound');
                conflictMsg.appointment_conflict = true;
                conflictMsg.conflict_reason = conflictInfo.reason;
                this.storeMessage(conflictMsg);
                
                logger.success('Conflict notification sent', { phoneNumber });
            }
            
        } catch (error) {
            logger.error('Error sending conflict notification:', error);
        }
    }
}

export default new MessageService();