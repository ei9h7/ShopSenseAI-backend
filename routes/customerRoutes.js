import express from 'express';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Customer Routes
 * 
 * Handles customer management endpoints
 * Note: This is a placeholder implementation using in-memory storage
 * In production, this should use a proper database
 */

// In-memory storage (replace with database)
const customers = new Map();

// Get all customers
router.get('/', (req, res) => {
    try {
        logger.info('Fetching customers');
        
        const allCustomers = Array.from(customers.values())
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        
        res.json({
            success: true,
            customers: allCustomers,
            count: allCustomers.length
        });
    } catch (error) {
        logger.error('Error fetching customers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch customers'
        });
    }
});

// Create or update customer
router.post('/', (req, res) => {
    try {
        const {
            phone_number,
            first_name,
            last_name,
            full_name,
            address,
            vehicles,
            notes
        } = req.body;

        // Validation
        if (!phone_number) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        // Check if customer exists
        let customer = Array.from(customers.values()).find(c => c.phone_number === phone_number);
        
        if (customer) {
            // Update existing customer
            customer.first_name = first_name || customer.first_name;
            customer.last_name = last_name || customer.last_name;
            customer.full_name = full_name || customer.full_name;
            customer.address = address || customer.address;
            customer.updated_at = new Date().toISOString();
            customer.is_repeat_customer = true;
            
            if (vehicles && Array.isArray(vehicles)) {
                customer.vehicles = [...customer.vehicles, ...vehicles];
            }
            
            if (notes && Array.isArray(notes)) {
                customer.notes = [...customer.notes, ...notes];
            }
            
            logger.success('Customer updated', { customerId: customer.id, phone_number });
        } else {
            // Create new customer
            customer = {
                id: Date.now().toString(),
                phone_number,
                first_name: first_name || null,
                last_name: last_name || null,
                full_name: full_name || null,
                address: address || null,
                vehicles: vehicles || [],
                service_history: [],
                notes: notes || [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_repeat_customer: false
            };
            
            logger.success('Customer created', { customerId: customer.id, phone_number });
        }
        
        customers.set(customer.id, customer);
        
        res.status(customer.is_repeat_customer ? 200 : 201).json({
            success: true,
            customer,
            message: customer.is_repeat_customer ? 'Customer updated successfully' : 'Customer created successfully'
        });
    } catch (error) {
        logger.error('Error creating/updating customer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create/update customer'
        });
    }
});

// Get single customer
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const customer = customers.get(id);

        if (!customer) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }

        res.json({
            success: true,
            customer
        });
    } catch (error) {
        logger.error('Error fetching customer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch customer'
        });
    }
});

// Get customer by phone number
router.get('/phone/:phoneNumber', (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const customer = Array.from(customers.values()).find(c => c.phone_number === phoneNumber);

        if (!customer) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }

        res.json({
            success: true,
            customer
        });
    } catch (error) {
        logger.error('Error fetching customer by phone:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch customer'
        });
    }
});

// Add service history entry
router.post('/:id/service-history', (req, res) => {
    try {
        const { id } = req.params;
        const { inquiry, type } = req.body;
        
        const customer = customers.get(id);
        if (!customer) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }

        const serviceEntry = {
            date: new Date().toISOString(),
            inquiry: inquiry || 'Service inquiry',
            type: type || 'General'
        };

        customer.service_history.unshift(serviceEntry);
        customer.updated_at = new Date().toISOString();
        
        customers.set(id, customer);
        
        logger.success('Service history added', { customerId: id, inquiry });
        
        res.json({
            success: true,
            customer,
            message: 'Service history added successfully'
        });
    } catch (error) {
        logger.error('Error adding service history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add service history'
        });
    }
});

export default router;