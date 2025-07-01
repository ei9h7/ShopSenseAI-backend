import express from 'express';
import logger from '../utils/logger.js';

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
router.get('/', (req, res) => {
    try {
        logger.info('Fetching quotes');
        
        const allQuotes = Array.from(quotes.values())
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        res.json({
            success: true,
            quotes: allQuotes,
            count: allQuotes.length
        });
    } catch (error) {
        logger.error('Error fetching quotes:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch quotes'
        });
    }
});

// Create new quote
router.post('/', (req, res) => {
    try {
        const {
            customer_name,
            customer_phone,
            vehicle_info,
            description,
            labor_hours,
            labor_rate,
            parts_cost
        } = req.body;

        // Validation
        if (!customer_name || !customer_phone || !description) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: customer_name, customer_phone, description'
            });
        }

        const quote = {
            id: Date.now().toString(),
            customer_name,
            customer_phone,
            vehicle_info: vehicle_info || '',
            description,
            labor_hours: labor_hours || 1,
            labor_rate: labor_rate || parseInt(process.env.LABOR_RATE || '80'),
            parts_cost: parts_cost || 0,
            total_cost: (labor_hours || 1) * (labor_rate || 80) + (parts_cost || 0),
            status: 'draft',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };

        quotes.set(quote.id, quote);
        
        logger.success('Quote created', { quoteId: quote.id, customer: customer_name });
        
        res.status(201).json({
            success: true,
            quote,
            message: 'Quote created successfully'
        });
    } catch (error) {
        logger.error('Error creating quote:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create quote'
        });
    }
});

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

// Get single quote
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const quote = quotes.get(id);

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
});

export default router;