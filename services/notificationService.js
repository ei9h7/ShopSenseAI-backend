import emailService from './emailService.js';
import openPhoneService from './openPhoneService.js';
import logger from '../utils/logger.js';

/**
 * Notification Service
 * 
 * Centralized notification management for SMS, email, and internal alerts
 * Handles different notification types and routing based on preferences
 */

class NotificationService {
    constructor() {
        this.notificationQueue = [];
        this.notificationHistory = new Map();
        this.preferences = this.loadNotificationPreferences();
    }

    /**
     * Load notification preferences from environment
     */
    loadNotificationPreferences() {
        return {
            // Business owner notifications
            business: {
                email: process.env.BUSINESS_EMAIL,
                sms: process.env.BUSINESS_SMS,
                enableNewMessages: process.env.NOTIFY_NEW_MESSAGES === 'true',
                enableQuoteRequests: process.env.NOTIFY_QUOTE_REQUESTS === 'true',
                enableAppointments: process.env.NOTIFY_APPOINTMENTS === 'true',
                enableEmergencies: true // Always notify on emergencies
            },
            
            // Customer notification preferences
            customer: {
                defaultMethod: 'sms', // 'sms', 'email', 'both'
                appointmentReminders: true,
                quoteDelivery: true,
                serviceUpdates: true
            }
        };
    }

    /**
     * Send notification with automatic channel selection
     */
    async sendNotification(type, recipient, data, preferredMethod = null) {
        try {
            logger.info('Sending notification', {
                type,
                recipient: this.maskContact(recipient),
                method: preferredMethod
            });

            const notification = {
                id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
                type,
                recipient,
                data,
                preferredMethod,
                timestamp: new Date().toISOString(),
                status: 'pending'
            };

            // Determine notification method
            const method = preferredMethod || this.determineNotificationMethod(type, recipient);
            
            let result;
            
            switch (method) {
                case 'sms':
                    result = await this.sendSMSNotification(notification);
                    break;
                case 'email':
                    result = await this.sendEmailNotification(notification);
                    break;
                case 'both':
                    const smsResult = await this.sendSMSNotification(notification);
                    const emailResult = await this.sendEmailNotification(notification);
                    result = {
                        success: smsResult.success || emailResult.success,
                        sms: smsResult,
                        email: emailResult
                    };
                    break;
                default:
                    throw new Error(`Unsupported notification method: ${method}`);
            }

            // Update notification status
            notification.status = result.success ? 'sent' : 'failed';
            notification.result = result;
            notification.method = method;

            // Store in history
            this.notificationHistory.set(notification.id, notification);

            logger.success('Notification processed', {
                id: notification.id,
                success: result.success,
                method
            });

            return {
                success: result.success,
                notificationId: notification.id,
                method,
                result
            };

        } catch (error) {
            logger.error('Error sending notification:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send SMS notification
     */
    async sendSMSNotification(notification) {
        try {
            const message = this.generateNotificationMessage(notification);
            return await openPhoneService.sendSMS(notification.recipient, message);

        } catch (error) {
            logger.error('SMS notification failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send email notification
     */
    async sendEmailNotification(notification) {
        try {
            const { subject, content } = this.generateEmailNotification(notification);
            return await emailService.sendEmail(notification.recipient, subject, content);

        } catch (error) {
            logger.error('Email notification failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send business notification
     */
    async sendBusinessNotification(type, data) {
        try {
            logger.info('Sending business notification', { type });

            const results = [];

            // Check if this type of notification is enabled
            if (!this.isBusinessNotificationEnabled(type)) {
                logger.info('Business notification disabled for type', { type });
                return { success: true, message: 'Notification disabled' };
            }

            // Send email if configured
            if (this.preferences.business.email) {
                const emailResult = await emailService.sendBusinessNotification(type, data);
                results.push({ method: 'email', ...emailResult });
            }

            // Send SMS if configured
            if (this.preferences.business.sms) {
                const message = this.generateBusinessSMSMessage(type, data);
                const smsResult = await openPhoneService.sendSMS(this.preferences.business.sms, message);
                results.push({ method: 'sms', ...smsResult });
            }

            const anySuccess = results.some(r => r.success);

            return {
                success: anySuccess,
                results,
                message: anySuccess ? 'Business notification sent' : 'All notification methods failed'
            };

        } catch (error) {
            logger.error('Error sending business notification:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send customer quote notification
     */
    async sendQuoteNotification(customerContact, quote, method = 'sms') {
        const data = {
            customer_name: quote.customer_name,
            total_cost: quote.total_cost,
            description: quote.description,
            vehicle_info: quote.vehicle_info
        };

        return await this.sendNotification('quote_delivery', customerContact, data, method);
    }

    /**
     * Send appointment confirmation
     */
    async sendAppointmentNotification(customerContact, appointment, method = 'sms') {
        const data = {
            customer_name: appointment.customer_name,
            date: appointment.date,
            time: appointment.time,
            service_type: appointment.service_type,
            vehicle_info: appointment.vehicle_info
        };

        return await this.sendNotification('appointment_confirmation', customerContact, data, method);
    }

    /**
     * Send appointment reminder
     */
    async sendAppointmentReminder(customerContact, appointment, method = 'sms') {
        const data = {
            ...appointment,
            isReminder: true
        };

        return await this.sendNotification('appointment_reminder', customerContact, data, method);
    }

    /**
     * Determine best notification method
     */
    determineNotificationMethod(type, recipient) {
        // Phone number pattern
        const phonePattern = /^\+?[\d\s\-\(\)]+$/;
        
        // Email pattern
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        // Check recipient format
        if (phonePattern.test(recipient)) {
            return 'sms';
        } else if (emailPattern.test(recipient)) {
            return 'email';
        }

        // Default based on notification type
        const defaultMethods = {
            quote_delivery: 'sms',
            appointment_confirmation: 'sms',
            appointment_reminder: 'sms',
            service_update: 'sms',
            emergency_response: 'sms'
        };

        return defaultMethods[type] || 'sms';
    }

    /**
     * Generate notification message for SMS
     */
    generateNotificationMessage(notification) {
        const templates = {
            quote_delivery: (data) => 
                `Hi ${data.customer_name}! Your quote for ${data.description} is ready: $${data.total_cost}. Valid for 7 days. Reply YES to book or call us with questions!`,
            
            appointment_confirmation: (data) => 
                `✅ Appointment confirmed! ${data.date} at ${data.time} for ${data.service_type}. See you then! Reply if you need to reschedule.`,
            
            appointment_reminder: (data) => 
                `⏰ Reminder: Your appointment is tomorrow (${data.date}) at ${data.time} for ${data.service_type}. Please arrive 10 minutes early!`,
            
            service_update: (data) => 
                `Service update: ${data.message}. We'll keep you posted on progress.`,
            
            emergency_response: (data) => 
                `🚨 We received your emergency message and will contact you within 15 minutes. If in immediate danger, call 911.`
        };

        const template = templates[notification.type];
        if (template) {
            return template(notification.data);
        }

        return `Update from ${process.env.BUSINESS_NAME || 'your service provider'}: ${notification.data.message || 'Please contact us for details.'}`;
    }

    /**
     * Generate email notification content
     */
    generateEmailNotification(notification) {
        const subjects = {
            quote_delivery: 'Your Service Quote is Ready',
            appointment_confirmation: 'Appointment Confirmed',
            appointment_reminder: 'Appointment Reminder',
            service_update: 'Service Update',
            emergency_response: 'Emergency Response'
        };

        const subject = subjects[notification.type] || 'Notification';
        
        // Use email service templates for rich content
        let content = `<p>You have a notification from ${process.env.BUSINESS_NAME || 'your service provider'}.</p>`;
        
        if (notification.type === 'quote_delivery') {
            // Would use emailService.generateQuoteTemplate
            content = `<p>Your quote is ready: $${notification.data.total_cost} for ${notification.data.description}</p>`;
        }

        return { subject, content };
    }

    /**
     * Generate business SMS message
     */
    generateBusinessSMSMessage(type, data) {
        const templates = {
            new_message: `📱 New message from ${data.phone_number}: "${data.message.substring(0, 100)}..."`,
            new_quote_request: `💰 Quote request from ${data.phone_number} for ${data.description}`,
            new_appointment: `📅 New appointment: ${data.customer_name} on ${data.date} at ${data.time}`,
            emergency: `🚨 EMERGENCY from ${data.phone_number}: "${data.message}"`
        };

        return templates[type] || `Notification: ${JSON.stringify(data)}`;
    }

    /**
     * Check if business notification is enabled
     */
    isBusinessNotificationEnabled(type) {
        const settings = this.preferences.business;
        
        switch (type) {
            case 'new_message':
                return settings.enableNewMessages;
            case 'new_quote_request':
                return settings.enableQuoteRequests;
            case 'new_appointment':
                return settings.enableAppointments;
            case 'emergency':
                return settings.enableEmergencies;
            default:
                return false;
        }
    }

    /**
     * Mask contact information for logging
     */
    maskContact(contact) {
        if (!contact) return 'unknown';
        
        if (contact.includes('@')) {
            // Email
            const [user, domain] = contact.split('@');
            return `${user.substring(0, 2)}***@${domain}`;
        } else {
            // Phone
            const cleaned = contact.replace(/\D/g, '');
            if (cleaned.length >= 7) {
                return `***-***-${cleaned.slice(-4)}`;
            }
        }
        
        return 'masked';
    }

    /**
     * Get notification history
     */
    getNotificationHistory(limit = 50) {
        const notifications = Array.from(this.notificationHistory.values())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);

        return notifications.map(n => ({
            id: n.id,
            type: n.type,
            recipient: this.maskContact(n.recipient),
            status: n.status,
            method: n.method,
            timestamp: n.timestamp
        }));
    }

    /**
     * Get notification statistics
     */
    getNotificationStats() {
        const notifications = Array.from(this.notificationHistory.values());
        
        return {
            total: notifications.length,
            sent: notifications.filter(n => n.status === 'sent').length,
            failed: notifications.filter(n => n.status === 'failed').length,
            byType: this.getNotificationsByType(notifications),
            byMethod: this.getNotificationsByMethod(notifications)
        };
    }

    /**
     * Group notifications by type
     */
    getNotificationsByType(notifications) {
        const byType = {};
        notifications.forEach(n => {
            byType[n.type] = (byType[n.type] || 0) + 1;
        });
        return byType;
    }

    /**
     * Group notifications by method
     */
    getNotificationsByMethod(notifications) {
        const byMethod = {};
        notifications.forEach(n => {
            if (n.method) {
                byMethod[n.method] = (byMethod[n.method] || 0) + 1;
            }
        });
        return byMethod;
    }
}

export default new NotificationService();