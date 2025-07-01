import logger from '../utils/logger.js';

/**
 * Customer Service
 * 
 * Handles customer data management and relationship tracking
 */

class CustomerService {
    constructor() {
        this.customers = new Map(); // In-memory storage (replace with database in production)
    }

    /**
     * Create or update customer from message interaction
     */
    async createOrUpdateFromMessage(phoneNumber, messageBody, messageIntent) {
        try {
            logger.info('Creating/updating customer from message', { phoneNumber, intent: messageIntent });

            let customer = this.findByPhoneNumber(phoneNumber);
            
            if (customer) {
                // Update existing customer
                customer.is_repeat_customer = true;
                customer.updated_at = new Date().toISOString();
                
                // Add to service history
                customer.service_history.unshift({
                    date: new Date().toISOString(),
                    inquiry: messageBody.substring(0, 100),
                    type: messageIntent || 'SMS Inquiry'
                });
                
                logger.success('Existing customer updated', { customerId: customer.id });
            } else {
                // Create new customer
                customer = {
                    id: Date.now().toString(),
                    phone_number: phoneNumber,
                    first_name: null,
                    last_name: null,
                    full_name: null,
                    address: null,
                    vehicles: [],
                    service_history: [{
                        date: new Date().toISOString(),
                        inquiry: messageBody.substring(0, 100),
                        type: messageIntent || 'SMS Inquiry'
                    }],
                    notes: [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    is_repeat_customer: false
                };
                
                this.customers.set(customer.id, customer);
                logger.success('New customer created', { customerId: customer.id });
            }
            
            return customer;
            
        } catch (error) {
            logger.error('Error creating/updating customer:', error);
            return null;
        }
    }

    /**
     * Find customer by phone number
     */
    findByPhoneNumber(phoneNumber) {
        return Array.from(this.customers.values()).find(c => c.phone_number === phoneNumber);
    }

    /**
     * Add vehicle information to customer
     */
    async addVehicle(phoneNumber, vehicleInfo) {
        try {
            const customer = this.findByPhoneNumber(phoneNumber);
            if (customer && vehicleInfo) {
                // Check if vehicle already exists
                const existingVehicle = customer.vehicles.find(v => v.details === vehicleInfo);
                if (!existingVehicle) {
                    customer.vehicles.push({
                        details: vehicleInfo,
                        added_at: new Date().toISOString()
                    });
                    customer.updated_at = new Date().toISOString();
                    logger.info('Vehicle added to customer', { customerId: customer.id, vehicleInfo });
                }
                return customer;
            }
            return null;
        } catch (error) {
            logger.error('Error adding vehicle:', error);
            return null;
        }
    }

    /**
     * Update customer name from conversation
     */
    async updateName(phoneNumber, name) {
        try {
            const customer = this.findByPhoneNumber(phoneNumber);
            if (customer && name) {
                customer.full_name = name;
                if (name.includes(' ')) {
                    const nameParts = name.split(' ');
                    customer.first_name = nameParts[0];
                    customer.last_name = nameParts.slice(1).join(' ');
                } else {
                    customer.first_name = name;
                }
                customer.updated_at = new Date().toISOString();
                logger.info('Customer name updated', { customerId: customer.id, name });
                return customer;
            }
            return null;
        } catch (error) {
            logger.error('Error updating customer name:', error);
            return null;
        }
    }

    /**
     * Get all customers
     */
    async getAllCustomers() {
        return Array.from(this.customers.values())
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }

    /**
     * Get customer statistics
     */
    async getCustomerStats() {
        const allCustomers = await this.getAllCustomers();
        
        return {
            total: allCustomers.length,
            new: allCustomers.filter(c => !c.is_repeat_customer).length,
            repeat: allCustomers.filter(c => c.is_repeat_customer).length,
            withVehicles: allCustomers.filter(c => c.vehicles.length > 0).length,
            totalVehicles: allCustomers.reduce((sum, c) => sum + c.vehicles.length, 0)
        };
    }
}

export default new CustomerService();