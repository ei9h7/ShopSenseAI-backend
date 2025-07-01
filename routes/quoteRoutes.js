import express from 'express';
import quoteController from '../controllers/quoteController.js';
import logger from '../utils/logger.js';
import { validateRequiredFields } from '../middleware/validation.js';

const router = express.Router();

/**
 * Quote Routes
 * 
 * Handles quote management endpoints
 * Note: This is a placeholder implementation using in-memory storage
 * In production, this should use a proper database
 */

// In-memory storage (replace with database)
const quotes = new Map();

// Get all quotes
router.get('/', quoteController.getQuotes);

// Generate new quote with scraping and AI
router.post('/', validateRequiredFields(['customer_name', 'service_description']), quoteController.generateQuote);

// Get quote by ID
router.get('/:id', quoteController.getQuoteById);

// Update quote status
router.put('/:id/status', (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const quote = quotes.get(id);
        if (!quote) {
            return res.status(404).json({
                success: false,
                error: 'Quote not found'
            });
        }

        const validStatuses = ['draft', 'sent', 'accepted', 'declined'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            });
        }

        quote.status = status;
        quote.updated_at = new Date().toISOString();

        if (status === 'accepted') {
            quote.accepted_at = new Date().toISOString();
        }

        quotes.set(id, quote);
        
        logger.success('Quote status updated', { quoteId: id, status });
        
        res.json({
            success: true,
            quote,
            message: `Quote ${status} successfully`
        });
    } catch (error) {
        logger.error('Error updating quote status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update quote status'
        });
    }
});


export default router;