import axios from 'axios';
import logger from '../utils/logger.js';

/**
 * OpenPhone Service
 * 
 * Handles all OpenPhone API interactions for SMS communication.
 * Provides methods for sending SMS messages and retrieving message history.
 */

class OpenPhoneService {
    constructor() {
        this.apiKey = process.env.OPENPHONE_API_KEY;
        this.phoneNumber = process.env.OPENPHONE_PHONE_NUMBER;
        this.apiUrl = 'https://api.openphone.com/v1';
        this.phoneNumberId = null; // Updated from webhook data
        this.timeout = 15000; // 15 second timeout
    }

    /**
     * Check if OpenPhone service is properly configured
     */
    isConfigured() {
        return !!(this.apiKey && this.phoneNumber);
    }

    /**
     * Set phone number ID from webhook data for better API calls
     */
    setPhoneNumberId(phoneNumberId) {
        this.phoneNumberId = phoneNumberId;
        logger.debug('Updated phoneNumberId', { phoneNumberId });
    }

    /**
     * Send SMS message to a phone number
     */
    async sendSMS(to, message) {
        try {
            if (!this.isConfigured()) {
                throw new Error('OpenPhone API not configured');
            }

            logger.info('Sending SMS via OpenPhone', {
                to,
                messageLength: message.length,
                from: this.phoneNumber
            });

            const response = await axios.post(`${this.apiUrl}/messages`, {
                content: message,
                from: this.phoneNumber,
                to: [to]
            }, {
                headers: {
                    'Authorization': this.apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: this.timeout
            });

            const success = response.status === 200 || response.status === 201 || response.status === 202;
            
            if (success) {
                logger.success('SMS sent successfully', { to, status: response.status });
                return { success: true, response: response.data };
            } else {
                logger.error('SMS send failed', { to, status: response.status, data: response.data });
                return { success: false, error: `SMS send failed with status ${response.status}` };
            }

        } catch (error) {
            logger.error('OpenPhone SMS error:', error);
            
            let errorMessage = 'Failed to send SMS';
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                
                switch (status) {
                    case 401:
                        errorMessage = 'OpenPhone API Authentication Failed - Check API key';
                        break;
                    case 403:
                        errorMessage = 'OpenPhone API Forbidden - Check API key permissions';
                        break;
                    case 400:
                        errorMessage = 'OpenPhone API Bad Request - Check request format';
                        break;
                    default:
                        errorMessage = `OpenPhone API Error (${status}): ${data?.message || error.message}`;
                }
            }

            return { success: false, error: errorMessage };
        }
    }

    /**
     * Get messages from OpenPhone API
     */
    async getMessages(phoneNumber = null, limit = 50) {
        try {
            if (!this.isConfigured()) {
                throw new Error('OpenPhone API not configured');
            }

            logger.info('Fetching messages from OpenPhone', {
                phoneNumber: phoneNumber || 'all',
                limit,
                phoneNumberId: this.phoneNumberId
            });

            const requestParams = {
                limit: Math.min(limit, 100)
            };

            // Add phoneNumberId and participants for proper filtering
            if (this.phoneNumberId) {
                requestParams.phoneNumberId = this.phoneNumberId;
                
                if (phoneNumber) {
                    requestParams.participants = [phoneNumber];
                } else {
                    requestParams.participants = [this.phoneNumber];
                }
            } else {
                // Fallback when phoneNumberId is not available
                if (phoneNumber) {
                    requestParams.participants = [phoneNumber, this.phoneNumber];
                } else {
                    requestParams.participants = [this.phoneNumber];
                }
            }

            const response = await axios.get(`${this.apiUrl}/messages`, {
                params: requestParams,
                headers: {
                    'Authorization': this.apiKey,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: this.timeout,
                paramsSerializer: {
                    indexes: null // Proper array parameter serialization
                }
            });

            let messages = [];
            
            if (response.data?.data && Array.isArray(response.data.data)) {
                messages = response.data.data;
                logger.success('Messages retrieved from OpenPhone', { count: messages.length });
            } else if (Array.isArray(response.data)) {
                messages = response.data;
                logger.success('Messages retrieved (direct array)', { count: messages.length });
            } else {
                logger.warn('Unexpected OpenPhone API response format', response.data);
                return [];
            }

            // Additional client-side filtering if needed
            if (phoneNumber && messages.length > 0) {
                const normalizePhone = (phone) => {
                    if (!phone) return '';
                    if (Array.isArray(phone)) phone = phone[0] || '';
                    return phone.replace(/[\s\-\(\)\+]/g, '');
                };
                
                const targetPhone = normalizePhone(phoneNumber);
                messages = messages.filter(msg => {
                    const msgFrom = normalizePhone(msg.from);
                    const msgTo = normalizePhone(msg.to);
                    return msgFrom === targetPhone || msgTo === targetPhone;
                });
                
                logger.info('Filtered messages for specific number', { phoneNumber, count: messages.length });
            }

            return messages;

        } catch (error) {
            logger.error('Error fetching messages from OpenPhone:', error);
            
            if (error.response) {
                logger.error('OpenPhone API error details', {
                    status: error.response.status,
                    data: error.response.data
                });
            }
            
            return [];
        }
    }

    /**
     * Get conversation history for a specific phone number
     */
    async getConversationHistory(phoneNumber, limit = 20) {
        try {
            logger.info('Getting conversation history', { phoneNumber, limit });
            
            const allMessages = await this.getMessages(phoneNumber, limit * 2);
            
            if (allMessages.length === 0) {
                return [];
            }

            // Format messages for internal use
            const conversationMessages = allMessages
                .map(msg => {
                    const messageContent = msg.text || msg.body || msg.content || '';
                    const normalizePhone = (phone) => {
                        if (!phone) return '';
                        if (Array.isArray(phone)) phone = phone[0] || '';
                        return phone.replace(/[\s\-\(\)\+]/g, '');
                    };
                    
                    const isInbound = normalizePhone(msg.from) === normalizePhone(phoneNumber);
                    
                    return {
                        id: msg.id || Date.now().toString(),
                        phone_number: phoneNumber,
                        body: messageContent,
                        direction: isInbound ? 'inbound' : 'outbound',
                        timestamp: msg.createdAt || msg.created_at || new Date().toISOString(),
                        processed: true,
                        created_at: msg.createdAt || msg.created_at || new Date().toISOString()
                    };
                })
                .filter(msg => msg.body && msg.body.trim().length > 0)
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .slice(-limit);

            logger.success('Conversation history formatted', { phoneNumber, count: conversationMessages.length });
            return conversationMessages;

        } catch (error) {
            logger.error('Error getting conversation history:', error);
            return [];
        }
    }
}

export default new OpenPhoneService();