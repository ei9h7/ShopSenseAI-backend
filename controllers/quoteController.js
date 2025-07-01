import scraperService from '../services/scraperService.js';
import labourLookupService from '../services/labourLookupService.js';
import gptService from '../services/gptService.js';
import openPhoneService from '../services/openPhoneService.js';
import emailService from '../services/emailService.js';
import notificationService from '../services/notificationService.js';
import logger from '../utils/logger.js';

/**
 * Quote Controller
 * 
 * Orchestrates the complete quote generation flow:
 * 1. Parse customer request
 * 2. Scrape part prices from multiple vendors
 * 3. Look up labor hours
 * 4. Generate formatted quote with GPT-4o
 * 5. Deliver via SMS or email
 */

class QuoteController {
    /**
     * Handle quote request from webhook
     */
    async handleQuoteRequest(payload) {
        try {
            logger.info('Processing quote request', { payload });

            // Parse the incoming message
            const parsed = this.parseMessage(payload.message);
            
            if (!this.validateQuoteRequest(parsed)) {
                throw new Error('Invalid quote request format');
            }

            logger.info('Quote request parsed', { 
                customer: parsed.name,
                vehicle: parsed.vehicle,
                request: parsed.request 
            });

            // 1️⃣ Scrape part prices from multiple vendors
            const partResults = await scraperService.getBestPrices(parsed.request, parsed.vehicle);
            
            // 2️⃣ Look up labor hours for the service
            const labourHours = labourLookupService.getHours(parsed.request);
            
            // 3️⃣ Calculate costs
            const laborRate = parseInt(process.env.LABOR_RATE || '80');
            const laborCost = labourHours * laborRate;
            const partsCost = this.calculateBestPartsCost(partResults);
            const totalCost = laborCost + partsCost;

            // 4️⃣ Generate formatted quote with GPT-4o
            const quoteData = {
                customer_name: parsed.name,
                customer_phone: parsed.phone,
                customer_email: parsed.email,
                vehicle_info: parsed.vehicle,
                description: parsed.request,
                labor_hours: labourHours,
                labor_rate: laborRate,
                labor_cost: laborCost,
                parts_cost: partsCost,
                total_cost: totalCost,
                parts_breakdown: partResults,
                created_at: new Date().toISOString()
            };

            const quoteText = await gptService.generateQuoteText(parsed, partResults, labourHours, totalCost);

            // 5️⃣ Store the quote
            const quoteId = await this.storeQuote(quoteData);
            quoteData.id = quoteId;

            // 6️⃣ Deliver quote via preferred method
            await this.deliverQuote(parsed, quoteText, quoteData);

            // 7️⃣ Send business notification
            await notificationService.sendBusinessNotification('new_quote_request', {
                customer_name: parsed.name,
                phone_number: parsed.phone,
                description: parsed.request,
                total_cost: totalCost,
                vehicle_info: parsed.vehicle
            });

            logger.success('Quote generated and delivered successfully', {
                quoteId,
                customer: parsed.name,
                total: totalCost
            });

            return {
                success: true,
                quoteId,
                total: totalCost,
                deliveryMethod: parsed.delivery
            };

        } catch (error) {
            logger.error('Error handling quote request:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate quote manually from API
     */
    async generateQuote(req, res) {
        try {
            const {
                customer_name,
                customer_phone,
                customer_email,
                vehicle_info,
                service_description,
                delivery_method = 'sms'
            } = req.body;

            // Validation
            if (!customer_name || !service_description) {
                return res.status(400).json({
                    success: false,
                    error: 'Customer name and service description are required'
                });
            }

            if (!customer_phone && !customer_email) {
                return res.status(400).json({
                    success: false,
                    error: 'Either phone number or email is required'
                });
            }

            // Create parsed object for processing
            const parsed = {
                name: customer_name,
                phone: customer_phone,
                email: customer_email,
                vehicle: vehicle_info,
                request: service_description,
                delivery: delivery_method
            };

            // Process the quote request
            const result = await this.handleQuoteRequest({
                message: `QUOTE_REQUEST: ${customer_name}, phone:${customer_phone}, email:${customer_email}, ${vehicle_info}, ${service_description}, delivery:${delivery_method}`
            });

            if (result.success) {
                res.status(201).json({
                    success: true,
                    message: 'Quote generated and sent successfully',
                    quoteId: result.quoteId,
                    total: result.total,
                    deliveryMethod: result.deliveryMethod
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }

        } catch (error) {
            logger.error('Error generating quote:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate quote'
            });
        }
    }

    /**
     * Parse incoming message for quote details
     */
    parseMessage(message) {
        try {
            const parts = message.split(',');
            const parsed = {};

            parts.forEach((part) => {
                const trimmed = part.trim();
                
                if (trimmed.includes('QUOTE_REQUEST:')) {
                    return; // Skip the header
                } else if (trimmed.includes('phone:')) {
                    parsed.phone = trimmed.split('phone:')[1].trim();
                } else if (trimmed.includes('email:')) {
                    parsed.email = trimmed.split('email:')[1].trim();
                } else if (trimmed.includes('delivery:')) {
                    parsed.delivery = trimmed.split('delivery:')[1].trim();
                } else if (!parsed.name) {
                    parsed.name = trimmed;
                } else if (!parsed.vehicle) {
                    parsed.vehicle = trimmed;
                } else if (!parsed.request) {
                    parsed.request = trimmed;
                } else {
                    // Additional parts go to request
                    parsed.request += ' ' + trimmed;
                }
            });

            // Set defaults
            parsed.delivery = parsed.delivery || 'sms';
            
            return parsed;

        } catch (error) {
            logger.error('Error parsing quote message:', error);
            throw new Error('Failed to parse quote request');
        }
    }

    /**
     * Validate quote request has required fields
     */
    validateQuoteRequest(parsed) {
        if (!parsed.name || !parsed.request) {
            return false;
        }

        if (!parsed.phone && !parsed.email) {
            return false;
        }

        return true;
    }

    /**
     * Calculate best parts cost from scraping results
     */
    calculateBestPartsCost(partResults) {
        if (!partResults || partResults.length === 0) {
            return 0;
        }

        // Group parts by name and find lowest price for each
        const partGroups = {};
        partResults.forEach(part => {
            const key = part.part.toLowerCase();
            if (!partGroups[key] || part.price < partGroups[key].price) {
                partGroups[key] = part;
            }
        });

        // Sum up the best prices
        return Object.values(partGroups).reduce((total, part) => total + part.price, 0);
    }

    /**
     * Store quote in system
     */
    async storeQuote(quoteData) {
        // In production, this would save to database
        const quoteId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
        
        // For now, just log the quote
        logger.info('Quote stored', {
            quoteId,
            customer: quoteData.customer_name,
            total: quoteData.total_cost
        });

        return quoteId;
    }

    /**
     * Deliver quote via SMS or email
     */
    async deliverQuote(parsed, quoteText, quoteData) {
        try {
            const deliveryMethod = parsed.delivery.toLowerCase();

            if (deliveryMethod === 'text' || deliveryMethod === 'sms') {
                if (!parsed.phone) {
                    throw new Error('Phone number required for SMS delivery');
                }
                
                const result = await openPhoneService.sendSMS(parsed.phone, quoteText);
                if (!result.success) {
                    throw new Error(`SMS delivery failed: ${result.error}`);
                }
                
                logger.success('Quote delivered via SMS', { phone: parsed.phone });
                
            } else if (deliveryMethod === 'email') {
                if (!parsed.email) {
                    throw new Error('Email address required for email delivery');
                }
                
                const result = await emailService.sendQuoteEmail(parsed.email, quoteData);
                if (!result.success) {
                    throw new Error(`Email delivery failed: ${result.error}`);
                }
                
                logger.success('Quote delivered via email', { email: parsed.email });
                
            } else {
                throw new Error(`Unsupported delivery method: ${deliveryMethod}`);
            }

        } catch (error) {
            logger.error('Error delivering quote:', error);
            throw error;
        }
    }

    /**
     * Get all quotes
     */
    async getQuotes(req, res) {
        try {
            // This would fetch from database in production
            const quotes = []; // Placeholder
            
            res.json({
                success: true,
                quotes,
                count: quotes.length
            });

        } catch (error) {
            logger.error('Error fetching quotes:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch quotes'
            });
        }
    }

    /**
     * Get quote by ID
     */
    async getQuoteById(req, res) {
        try {
            const { id } = req.params;
            
            // This would fetch from database in production
            const quote = null; // Placeholder
            
            if (!quote) {
                return res.status(404).json({
                    success: false,
                    error: 'Quote not found'
                });
            }

            res.json({
                success: true,
                quote
            });

        } catch (error) {
            logger.error('Error fetching quote:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch quote'
            });
        }
    }
}

export default new QuoteController();