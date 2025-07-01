import logger from '../utils/logger.js';
import environmentConfig from '../config/environment.js';

/**
 * Call Service
 * 
 * Handles Sona voice call integration and call-related business logic
 * Manages call webhooks, call routing, and voice response coordination
 */

class CallService {
    constructor() {
        this.sonaApiKey = process.env.SONA_API_KEY;
        this.sonaEndpoint = process.env.SONA_ENDPOINT || 'https://api.sona.ai';
        this.isConfigured = !!(this.sonaApiKey);
        this.activeCallSessions = new Map();
    }

    /**
     * Check if call service is configured
     */
    isServiceConfigured() {
        return this.isConfigured;
    }

    /**
     * Handle incoming call webhook from Sona
     */
    async handleIncomingCall(callData) {
        try {
            logger.info('Incoming call received', {
                callId: callData.call_id,
                from: callData.from,
                to: callData.to,
                status: callData.status
            });

            const callSession = {
                id: callData.call_id,
                from: callData.from,
                to: callData.to,
                status: callData.status,
                startTime: new Date().toISOString(),
                context: this.buildCallContext(callData.from),
                transcript: []
            };

            this.activeCallSessions.set(callData.call_id, callSession);

            // Generate initial greeting based on customer history
            const greeting = await this.generateCallGreeting(callData.from);
            
            return {
                success: true,
                callId: callData.call_id,
                response: greeting
            };

        } catch (error) {
            logger.error('Error handling incoming call:', error);
            return {
                success: false,
                error: error.message,
                response: this.getDefaultGreeting()
            };
        }
    }

    /**
     * Process call conversation and generate responses
     */
    async processCallConversation(callId, transcript, customerInput) {
        try {
            logger.info('Processing call conversation', {
                callId,
                inputLength: customerInput?.length || 0
            });

            const callSession = this.activeCallSessions.get(callId);
            if (!callSession) {
                throw new Error('Call session not found');
            }

            // Add customer input to transcript
            if (customerInput) {
                callSession.transcript.push({
                    speaker: 'customer',
                    text: customerInput,
                    timestamp: new Date().toISOString()
                });
            }

            // Generate AI response based on conversation context
            const response = await this.generateCallResponse(callSession);

            // Add AI response to transcript
            callSession.transcript.push({
                speaker: 'assistant',
                text: response.text,
                timestamp: new Date().toISOString(),
                intent: response.intent,
                action: response.action
            });

            // Update call session
            this.activeCallSessions.set(callId, callSession);

            return {
                success: true,
                response: response.text,
                intent: response.intent,
                action: response.action,
                shouldTransfer: response.shouldTransfer || false
            };

        } catch (error) {
            logger.error('Error processing call conversation:', error);
            return {
                success: false,
                error: error.message,
                response: "I apologize, but I'm having trouble processing that. Let me transfer you to someone who can help."
            };
        }
    }

    /**
     * Handle call completion
     */
    async handleCallComplete(callId, callSummary) {
        try {
            logger.info('Call completed', { callId });

            const callSession = this.activeCallSessions.get(callId);
            if (!callSession) {
                logger.warn('Call session not found for completion', { callId });
                return { success: false };
            }

            // Update call session with completion data
            callSession.endTime = new Date().toISOString();
            callSession.duration = callSummary.duration;
            callSession.outcome = callSummary.outcome;
            callSession.summary = callSummary.summary;

            // Archive the call session
            await this.archiveCallSession(callSession);

            // Clean up active session
            this.activeCallSessions.delete(callId);

            // Generate follow-up actions
            await this.processCallFollowUp(callSession);

            logger.success('Call session completed and archived', { callId });

            return { success: true };

        } catch (error) {
            logger.error('Error handling call completion:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Build context for incoming call
     */
    buildCallContext(phoneNumber) {
        // This would integrate with customer service to get history
        return {
            phoneNumber,
            isExistingCustomer: false, // Will be determined by customer service
            recentMessages: [], // SMS history
            lastServiceDate: null,
            preferredServices: []
        };
    }

    /**
     * Generate personalized call greeting
     */
    async generateCallGreeting(phoneNumber) {
        try {
            // Check if existing customer
            const context = this.buildCallContext(phoneNumber);
            
            if (context.isExistingCustomer) {
                return `Hi! Thanks for calling ${environmentConfig.get('BUSINESS_NAME')}. I see you've worked with us before. How can I help you today?`;
            } else {
                return `Hello! Thanks for calling ${environmentConfig.get('BUSINESS_NAME')}. I'm your AI assistant and I can help you with quotes, scheduling, or answer questions about our services. What can I help you with today?`;
            }

        } catch (error) {
            logger.error('Error generating call greeting:', error);
            return this.getDefaultGreeting();
        }
    }

    /**
     * Generate AI response for call conversation
     */
    async generateCallResponse(callSession) {
        try {
            // This would integrate with GPT service for call-specific prompts
            const lastCustomerMessage = callSession.transcript
                .filter(t => t.speaker === 'customer')
                .pop();

            if (!lastCustomerMessage) {
                return {
                    text: "I didn't catch that. Could you repeat what you need help with?",
                    intent: "clarification",
                    action: "ask_for_clarification"
                };
            }

            // Simple intent detection for now
            const input = lastCustomerMessage.text.toLowerCase();
            
            if (input.includes('quote') || input.includes('price') || input.includes('cost')) {
                return {
                    text: `I'd be happy to provide a quote! Can you tell me what vehicle you have and what service you need? My labor rate is $${environmentConfig.get('LABOR_RATE')} per hour.`,
                    intent: "quote_request",
                    action: "collect_quote_details"
                };
            }
            
            if (input.includes('appointment') || input.includes('schedule') || input.includes('book')) {
                return {
                    text: "Great! I can help you schedule an appointment. We're open Monday through Friday, 8 AM to 5 PM. What day and time works best for you?",
                    intent: "appointment_booking",
                    action: "collect_appointment_details"
                };
            }
            
            if (input.includes('emergency') || input.includes('urgent') || input.includes('breakdown')) {
                return {
                    text: "I understand this is urgent. Let me get you connected with our service team right away. Please hold while I transfer your call.",
                    intent: "emergency",
                    action: "transfer_to_human",
                    shouldTransfer: true
                };
            }

            // Default response
            return {
                text: `I can help you with quotes, scheduling appointments, or general questions about our automotive services. What would you like assistance with?`,
                intent: "general_inquiry",
                action: "provide_options"
            };

        } catch (error) {
            logger.error('Error generating call response:', error);
            return {
                text: "I apologize, I'm having technical difficulties. Let me transfer you to our service team.",
                intent: "error",
                action: "transfer_to_human",
                shouldTransfer: true
            };
        }
    }

    /**
     * Archive completed call session
     */
    async archiveCallSession(callSession) {
        // In production, this would save to database
        logger.info('Archiving call session', {
            callId: callSession.id,
            duration: callSession.duration,
            transcriptLength: callSession.transcript.length
        });
        
        // For now, just log the session
        logger.debug('Call session details', callSession);
    }

    /**
     * Process follow-up actions after call
     */
    async processCallFollowUp(callSession) {
        try {
            // Extract actionable items from call transcript
            const actions = this.extractCallActions(callSession);
            
            for (const action of actions) {
                await this.executeCallAction(action, callSession);
            }

        } catch (error) {
            logger.error('Error processing call follow-up:', error);
        }
    }

    /**
     * Extract actionable items from call
     */
    extractCallActions(callSession) {
        const actions = [];
        
        // Check transcript for specific intents
        callSession.transcript.forEach(entry => {
            if (entry.speaker === 'assistant' && entry.action) {
                switch (entry.action) {
                    case 'collect_quote_details':
                        actions.push({ type: 'create_quote', data: entry });
                        break;
                    case 'collect_appointment_details':
                        actions.push({ type: 'create_appointment', data: entry });
                        break;
                    case 'transfer_to_human':
                        actions.push({ type: 'notify_staff', data: entry });
                        break;
                }
            }
        });

        return actions;
    }

    /**
     * Execute specific call action
     */
    async executeCallAction(action, callSession) {
        logger.info('Executing call action', {
            type: action.type,
            callId: callSession.id
        });

        switch (action.type) {
            case 'create_quote':
                // Would integrate with quote service
                break;
            case 'create_appointment':
                // Would integrate with appointment service
                break;
            case 'notify_staff':
                // Would send notification to staff
                break;
        }
    }

    /**
     * Get default greeting
     */
    getDefaultGreeting() {
        return `Hello! Thanks for calling ${environmentConfig.get('BUSINESS_NAME')}. How can I help you today?`;
    }

    /**
     * Get call statistics
     */
    getCallStats() {
        const activeCalls = this.activeCallSessions.size;
        
        return {
            activeCalls,
            totalSessions: Array.from(this.activeCallSessions.values()).length,
            configured: this.isConfigured
        };
    }

    /**
     * Get active call sessions
     */
    getActiveCallSessions() {
        return Array.from(this.activeCallSessions.values());
    }
}

export default new CallService();