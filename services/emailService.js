import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';
import environmentConfig from '../config/environment.js';

/**
 * Email Service
 * 
 * Handles email communications including customer notifications,
 * appointment confirmations, quote delivery, and internal alerts
 */

class EmailService {
    constructor() {
        this.transporter = null;
        this.isConfigured = false;
        this.initializeTransporter();
    }

    /**
     * Initialize email transporter based on environment
     */
    initializeTransporter() {
        try {
            // Check for email configuration
            const emailConfig = {
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            };

            if (emailConfig.auth.user && emailConfig.auth.pass) {
                this.transporter = nodemailer.createTransporter(emailConfig);
                this.isConfigured = true;
                logger.success('Email service configured successfully');
            } else {
                logger.warn('Email service not configured - missing SMTP credentials');
            }
        } catch (error) {
            logger.error('Failed to initialize email service:', error);
        }
    }

    /**
     * Send email with template support
     */
    async sendEmail(to, subject, htmlContent, textContent = null) {
        try {
            if (!this.isConfigured) {
                throw new Error('Email service not configured');
            }

            const mailOptions = {
                from: `${environmentConfig.get('BUSINESS_NAME')} <${process.env.SMTP_USER}>`,
                to,
                subject,
                html: htmlContent,
                text: textContent || this.stripHtml(htmlContent)
            };

            const info = await this.transporter.sendMail(mailOptions);
            
            logger.success('Email sent successfully', {
                to,
                subject,
                messageId: info.messageId
            });

            return { success: true, messageId: info.messageId };

        } catch (error) {
            logger.error('Failed to send email:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send quote via email
     */
    async sendQuoteEmail(customerEmail, quote) {
        try {
            const subject = `Service Quote - ${quote.description}`;
            const htmlContent = this.generateQuoteTemplate(quote);

            return await this.sendEmail(customerEmail, subject, htmlContent);

        } catch (error) {
            logger.error('Failed to send quote email:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send appointment confirmation email
     */
    async sendAppointmentConfirmation(customerEmail, appointment) {
        try {
            const subject = `Appointment Confirmed - ${appointment.date} at ${appointment.time}`;
            const htmlContent = this.generateAppointmentTemplate(appointment);

            return await this.sendEmail(customerEmail, subject, htmlContent);

        } catch (error) {
            logger.error('Failed to send appointment confirmation:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send notification email to business owner
     */
    async sendBusinessNotification(type, data) {
        try {
            const ownerEmail = process.env.BUSINESS_EMAIL;
            if (!ownerEmail) {
                logger.warn('Business email not configured for notifications');
                return { success: false, error: 'Business email not configured' };
            }

            const { subject, content } = this.generateBusinessNotificationTemplate(type, data);
            
            return await this.sendEmail(ownerEmail, subject, content);

        } catch (error) {
            logger.error('Failed to send business notification:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate quote email template
     */
    generateQuoteTemplate(quote) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">${environmentConfig.get('BUSINESS_NAME')}</h2>
                <h3>Service Quote</h3>
                
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Customer:</strong> ${quote.customer_name}</p>
                    <p><strong>Vehicle:</strong> ${quote.vehicle_info || 'Not specified'}</p>
                    <p><strong>Service:</strong> ${quote.description}</p>
                    <p><strong>Labor Hours:</strong> ${quote.labor_hours}</p>
                    <p><strong>Labor Rate:</strong> $${quote.labor_rate}/hour</p>
                    <p><strong>Parts Cost:</strong> $${quote.parts_cost}</p>
                    <hr style="margin: 15px 0;">
                    <p style="font-size: 18px;"><strong>Total: $${quote.total_cost}</strong></p>
                </div>
                
                <p>This quote is valid for 7 days. Please call or text us to schedule your service.</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px;">
                        ${environmentConfig.get('BUSINESS_NAME')}<br>
                        Phone: ${process.env.OPENPHONE_PHONE_NUMBER || 'Contact us for more info'}
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Generate appointment confirmation template
     */
    generateAppointmentTemplate(appointment) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #16a34a;">${environmentConfig.get('BUSINESS_NAME')}</h2>
                <h3>Appointment Confirmed! ✅</h3>
                
                <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
                    <p><strong>Customer:</strong> ${appointment.customer_name}</p>
                    <p><strong>Date:</strong> ${appointment.date}</p>
                    <p><strong>Time:</strong> ${appointment.time}</p>
                    <p><strong>Vehicle:</strong> ${appointment.vehicle_info || 'To be determined'}</p>
                    <p><strong>Service:</strong> ${appointment.service_type}</p>
                    ${appointment.notes ? `<p><strong>Notes:</strong> ${appointment.notes}</p>` : ''}
                </div>
                
                <p>We're looking forward to seeing you! Please arrive 10 minutes early and bring:</p>
                <ul>
                    <li>Your vehicle keys</li>
                    <li>Any service records</li>
                    <li>Form of payment</li>
                </ul>
                
                <p>Need to reschedule? Just reply to this email or give us a call.</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px;">
                        ${environmentConfig.get('BUSINESS_NAME')}<br>
                        Phone: ${process.env.OPENPHONE_PHONE_NUMBER || 'Contact us for more info'}
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Generate business notification template
     */
    generateBusinessNotificationTemplate(type, data) {
        const templates = {
            'new_message': {
                subject: '📱 New Customer Message',
                content: `
                    <h3>New Message Received</h3>
                    <p><strong>From:</strong> ${data.phone_number}</p>
                    <p><strong>Message:</strong> ${data.message}</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                    ${data.intent ? `<p><strong>Intent:</strong> ${data.intent}</p>` : ''}
                `
            },
            'new_quote_request': {
                subject: '💰 New Quote Request',
                content: `
                    <h3>Quote Request</h3>
                    <p><strong>Customer:</strong> ${data.customer_name || 'Unknown'}</p>
                    <p><strong>Phone:</strong> ${data.phone_number}</p>
                    <p><strong>Request:</strong> ${data.description}</p>
                    <p><strong>Vehicle:</strong> ${data.vehicle_info || 'Not specified'}</p>
                `
            },
            'new_appointment': {
                subject: '📅 New Appointment Booked',
                content: `
                    <h3>Appointment Booked</h3>
                    <p><strong>Customer:</strong> ${data.customer_name}</p>
                    <p><strong>Phone:</strong> ${data.customer_phone}</p>
                    <p><strong>Date:</strong> ${data.date}</p>
                    <p><strong>Time:</strong> ${data.time}</p>
                    <p><strong>Service:</strong> ${data.service_type}</p>
                `
            },
            'emergency': {
                subject: '🚨 EMERGENCY MESSAGE',
                content: `
                    <h3 style="color: #dc2626;">EMERGENCY MESSAGE RECEIVED</h3>
                    <p><strong>Customer:</strong> ${data.phone_number}</p>
                    <p><strong>Message:</strong> ${data.message}</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                    <p style="background: #fef2f2; padding: 10px; border-radius: 4px; color: #dc2626;">
                        <strong>Action Required:</strong> Contact customer immediately!
                    </p>
                `
            }
        };

        return templates[type] || {
            subject: 'ShopSenseAI Notification',
            content: `<p>Notification: ${JSON.stringify(data)}</p>`
        };
    }

    /**
     * Strip HTML tags for plain text version
     */
    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Test email configuration
     */
    async testConnection() {
        try {
            if (!this.isConfigured) {
                return { success: false, error: 'Email service not configured' };
            }

            await this.transporter.verify();
            return { success: true, message: 'Email connection verified' };

        } catch (error) {
            logger.error('Email connection test failed:', error);
            return { success: false, error: error.message };
        }
    }
}

export default new EmailService();