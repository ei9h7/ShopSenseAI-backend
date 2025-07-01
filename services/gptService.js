import axios from 'axios';
import logger from '../utils/logger.js';

/**
 * GPT Service
 * 
 * Handles all OpenAI GPT API interactions for message processing,
 * quote generation, and tech sheet creation.
 */

class GPTService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.apiUrl = 'https://api.openai.com/v1/chat/completions';
        this.model = 'gpt-4o';
        this.timeout = 30000; // 30 second timeout
    }

    /**
     * Check if GPT service is properly configured
     */
    isConfigured() {
        return !!(this.apiKey && this.apiKey.length > 10);
    }

    /**
     * Process message with conversation context
     */
    async processMessageWithContext(messageBody, conversationHistory = [], businessName = 'Pink Chicken Speed Shop') {
        try {
            if (!this.isConfigured()) {
                throw new Error('OpenAI API key not configured');
            }

            // Clean and validate message body
            messageBody = messageBody.trim();
            if (!messageBody) {
                throw new Error('Empty message body');
            }

            logger.info('Processing message with GPT', { 
                messageLength: messageBody.length, 
                historyCount: conversationHistory.length 
            });

            const messages = this.buildConversationMessages(messageBody, conversationHistory, businessName);
            
            const response = await axios.post(this.apiUrl, {
                model: this.model,
                temperature: 0.6,
                max_tokens: 600,
                messages
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: this.timeout
            });

            const fullResponse = response.data?.choices?.[0]?.message?.content || '';
            const parsedResponse = this.parseAIResponse(fullResponse);

            logger.success('GPT response generated', { 
                intent: parsedResponse.intent,
                responseLength: parsedResponse.reply.length 
            });

            return parsedResponse;

        } catch (error) {
            logger.error('GPT processing error:', error);
            throw error;
        }
    }

    /**
     * Generate tech sheet content
     */
    async generateTechSheet(jobDescription, vehicleInfo = null) {
        try {
            if (!this.isConfigured()) {
                throw new Error('OpenAI API key not configured');
            }

            logger.info('Generating tech sheet with GPT', { jobDescription });

            const prompt = vehicleInfo ? `${jobDescription} for ${vehicleInfo}` : jobDescription;

            const messages = [
                {
                    role: 'system',
                    content: `You are an expert automotive technician creating detailed repair guides. Generate a comprehensive tech sheet for the given job description. Format your response as JSON with these exact fields:

{
  "title": "Brief descriptive title",
  "estimated_time": number (hours as decimal),
  "difficulty": "Easy|Medium|Hard",
  "tools_required": ["tool1", "tool2"],
  "parts_needed": ["part1", "part2"],
  "safety_warnings": ["warning1", "warning2"],
  "step_by_step": ["step1", "step2", "step3"],
  "tips": ["tip1", "tip2"]
}

Make the instructions detailed and professional for a working mechanic.`
                },
                {
                    role: 'user',
                    content: `Generate a detailed tech sheet for this automotive repair job: ${prompt}`
                }
            ];

            const response = await axios.post(this.apiUrl, {
                model: this.model,
                temperature: 0.7,
                max_tokens: 1500,
                messages
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: this.timeout
            });

            const content = response.data?.choices?.[0]?.message?.content || '';
            
            logger.success('Tech sheet generated', { jobDescription });
            
            return { content };

        } catch (error) {
            logger.error('Tech sheet generation error:', error);
            throw error;
        }
    }

    /**
     * Generate formatted quote text with pricing breakdown
     */
    async generateQuoteText(parsed, partResults, labourHours, totalCost) {
        try {
            if (!this.isConfigured()) {
                return this.generateFallbackQuoteText(parsed, partResults, labourHours, totalCost);
            }

            logger.info('Generating quote text with GPT', { 
                customer: parsed.name,
                service: parsed.request,
                totalCost
            });

            const laborRate = parseInt(process.env.LABOR_RATE || '80');
            const laborCost = labourHours * laborRate;
            const partsCost = partResults.reduce((sum, part) => sum + part.price, 0);

            const prompt = `You are a friendly automotive service advisor. Generate a professional quote message based on:

Customer: ${parsed.name}
Vehicle: ${parsed.vehicle || 'Not specified'}
Service Request: ${parsed.request}

PRICING BREAKDOWN:
Labor: ${labourHours} hours × $${laborRate}/hr = $${laborCost}
Parts: $${partsCost}
Total: $${totalCost}

Parts Breakdown:
${partResults.map(part => `• ${part.part}: $${part.price} (${part.vendor})`).join('\n')}

Create a friendly, professional quote message that:
1. Thanks the customer by name
2. Provides the service details
3. Shows clear pricing breakdown
4. Mentions the quote is valid for 7 days
5. Encourages them to book or ask questions
6. Keeps it under 160 characters for SMS if possible, or provide a condensed version

Provide two versions:
SMS: [Short version for text message]
EMAIL: [Detailed version for email]`;

            const response = await axios.post(this.apiUrl, {
                model: this.model,
                temperature: 0.6,
                max_tokens: 800,
                messages: [{ role: 'user', content: prompt }]
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: this.timeout
            });

            const fullResponse = response.data?.choices?.[0]?.message?.content || '';
            
            // Extract SMS and EMAIL versions or use full response
            const smsMatch = fullResponse.match(/SMS:\s*(.+?)(?=EMAIL:|$)/s);
            const emailMatch = fullResponse.match(/EMAIL:\s*(.+?)$/s);
            
            const smsVersion = smsMatch ? smsMatch[1].trim() : fullResponse;
            const emailVersion = emailMatch ? emailMatch[1].trim() : fullResponse;

            logger.success('Quote text generated', { 
                customer: parsed.name,
                smsLength: smsVersion.length,
                emailLength: emailVersion.length
            });

            return {
                sms: smsVersion,
                email: emailVersion,
                full: fullResponse
            };

        } catch (error) {
            logger.error('Quote text generation error:', error);
            return this.generateFallbackQuoteText(parsed, partResults, labourHours, totalCost);
        }
    }

    /**
     * Generate fallback quote text when AI is unavailable
     */
    generateFallbackQuoteText(parsed, partResults, labourHours, totalCost) {
        const laborRate = parseInt(process.env.LABOR_RATE || '80');
        const laborCost = labourHours * laborRate;
        const partsCost = partResults.reduce((sum, part) => sum + part.price, 0);
        
        const businessName = process.env.BUSINESS_NAME || 'Pink Chicken Speed Shop';
        
        const smsVersion = `Hi ${parsed.name}! Quote for ${parsed.request}: Labor $${laborCost} + Parts $${partsCost} = $${totalCost}. Valid 7 days. Reply YES to book! - ${businessName}`;
        
        const emailVersion = `Dear ${parsed.name},

Thank you for your service request. Here's your quote:

Service: ${parsed.request}
Vehicle: ${parsed.vehicle || 'As discussed'}

PRICING:
• Labor: ${labourHours} hrs × $${laborRate}/hr = $${laborCost}
• Parts: $${partsCost}
• Total: $${totalCost}

This quote is valid for 7 days. Please contact us to schedule your service.

Best regards,
${businessName}`;

        return {
            sms: smsVersion,
            email: emailVersion,
            full: smsVersion
        };
    }

    /**
     * Build conversation messages for GPT context
     */
    buildConversationMessages(messageBody, conversationHistory, businessName) {
        const messages = [
            {
                role: 'system',
                content: `You are a professional, friendly assistant for ${businessName}, an automotive repair shop. 

CONVERSATION STYLE:
- Be natural and conversational, not pushy or aggressive
- Take whatever information the customer gives you naturally
- Focus on helping them with their actual need first
- Collect info organically during natural conversation

APPOINTMENT BOOKING:
When customers want to schedule service or confirm appointments:
- Suggest specific days and times (Monday-Friday, 8am-5pm)
- Confirm their preferred date and time
- Get essential info: name, vehicle, service needed
- Use this EXACT format when booking is confirmed:
  "BOOKING_CONFIRMED: [Customer Name] | [Phone] | [Vehicle] | [Service] | [Date] | [Time]"

QUOTE ACCEPTANCE:
When customers accept quotes or say "yes" to pricing:
- Confirm the acceptance
- Use format: "QUOTE_ACCEPTED: [Service] | [Price] | [Vehicle]"

EMERGENCY DETECTION:
If message contains urgent keywords (emergency, urgent, breakdown, stranded, accident):
- Respond immediately with emergency protocol
- Use format: "EMERGENCY: [Brief description]"

CONVERSATION RULES:
- Use the conversation history to provide contextual responses
- If customer says "yes" or agrees, refer to what they're agreeing to based on context
- Be helpful and focus on their actual automotive needs
- Your labor rate is $80/hr with a 1-hour minimum ($20 per 15 min extra)

RESPONSE FORMAT:
Reply: [The natural, helpful message that addresses their need]
Intent: [e.g. Quote Request, Booking Confirmation, Service Inquiry, Emergency]
Action: [e.g. BOOKING_CONFIRMED: details, Provide quote, Ask for vehicle details]`
            }
        ];

        // Add conversation history for context
        if (conversationHistory && conversationHistory.length > 0) {
            const recentHistory = conversationHistory.slice(-10);
            
            messages.push({
                role: 'user',
                content: `CONVERSATION HISTORY (last ${recentHistory.length} messages, most recent last):
${recentHistory.map(msg => 
    `${msg.direction === 'inbound' ? 'CUSTOMER' : 'YOU'}: "${msg.body}"`
).join('\n')}

CURRENT MESSAGE FROM CUSTOMER: "${messageBody}"

Based on this conversation, provide a natural, helpful response that:
1. Addresses their current message appropriately
2. Focuses on their automotive service needs
3. Moves the conversation forward naturally
4. If they want to book an appointment, confirm details and use BOOKING_CONFIRMED format
5. If they're accepting a quote, use QUOTE_ACCEPTED format
6. If it's an emergency, use EMERGENCY format`
            });
        } else {
            // New conversation
            messages.push({
                role: 'user',
                content: `NEW CUSTOMER MESSAGE: "${messageBody}"

This is a new conversation. Provide a professional, natural response that:
1. Addresses their automotive inquiry helpfully
2. Focuses on their service needs first
3. Only asks for essential info if needed for their specific request
4. If they want to book, use BOOKING_CONFIRMED format
5. If emergency, use EMERGENCY format`
            });
        }

        return messages;
    }

    /**
     * Parse AI response into structured format
     */
    parseAIResponse(fullResponse) {
        const lines = fullResponse.split('\n');
        
        // Extract Reply line
        const replyLine = lines.find(line => line.toLowerCase().startsWith('reply:'));
        const reply = replyLine ? replyLine.replace(/^reply:\s*/i, '').trim() : fullResponse;
        
        // Extract Intent line
        const intentLine = lines.find(line => line.toLowerCase().startsWith('intent:'));
        const intent = intentLine ? intentLine.replace(/^intent:\s*/i, '').trim() : 'General Inquiry';
        
        // Extract Action line
        const actionLine = lines.find(line => line.toLowerCase().startsWith('action:'));
        const action = actionLine ? actionLine.replace(/^action:\s*/i, '').trim() : 'Reply sent';

        return { reply, intent, action };
    }
}

export default new GPTService();