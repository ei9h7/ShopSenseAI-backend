import calendarService from '../services/calendarService.js';
import gptService from '../services/gptService.js';
import notificationService from '../services/notificationService.js';
import logger from '../utils/logger.js';

/**
 * Booking Controller
 * 
 * Handles appointment scheduling and calendar management:
 * 1. Parse booking requests
 * 2. Check availability
 * 3. Create calendar events
 * 4. Send confirmations
 * 5. Manage appointment lifecycle
 */

class BookingController {
    /**
     * Handle booking request from webhook
     */
    async handleBookingRequest(payload) {
        try {
            logger.info('Processing booking request', { payload });

            // Parse the incoming message
            const parsed = this.parseBookingMessage(payload.message);
            
            if (!this.validateBookingRequest(parsed)) {
                throw new Error('Invalid booking request format');
            }

            logger.info('Booking request parsed', { 
                customer: parsed.name,
                date: parsed.date,
                time: parsed.time,
                service: parsed.service 
            });

            // 1️⃣ Check availability
            const availability = await calendarService.checkAvailability(parsed.date, parsed.time);
            
            if (!availability.available) {
                return await this.handleBookingConflict(parsed, availability);
            }

            // 2️⃣ Create calendar appointment
            const appointment = await this.createAppointment(parsed);

            // 3️⃣ Send confirmation
            await this.sendBookingConfirmation(parsed, appointment);

            // 4️⃣ Send business notification
            await notificationService.sendBusinessNotification('new_appointment', {
                customer_name: parsed.name,
                customer_phone: parsed.phone,
                date: parsed.date,
                time: parsed.time,
                service_type: parsed.service
            });

            logger.success('Appointment booked successfully', {
                appointmentId: appointment.id,
                customer: parsed.name,
                date: parsed.date,
                time: parsed.time
            });

            return {
                success: true,
                appointmentId: appointment.id,
                confirmed: true
            };

        } catch (error) {
            logger.error('Error handling booking request:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create appointment manually from API
     */
    async createBooking(req, res) {
        try {
            const {
                customer_name,
                customer_phone,
                customer_email,
                vehicle_info,
                service_type,
                preferred_date,
                preferred_time,
                notes
            } = req.body;

            // Validation
            if (!customer_name || !customer_phone || !preferred_date || !preferred_time) {
                return res.status(400).json({
                    success: false,
                    error: 'Customer name, phone, date, and time are required'
                });
            }

            // Create parsed object for processing
            const parsed = {
                name: customer_name,
                phone: customer_phone,
                email: customer_email,
                vehicle: vehicle_info,
                service: service_type || 'General Service',
                date: preferred_date,
                time: preferred_time,
                notes: notes
            };

            // Check availability
            const availability = await calendarService.checkAvailability(parsed.date, parsed.time);
            
            if (!availability.available) {
                return res.status(409).json({
                    success: false,
                    error: 'Time slot not available',
                    suggestions: availability.suggestions
                });
            }

            // Create the appointment
            const appointment = await this.createAppointment(parsed);

            // Send confirmations
            await this.sendBookingConfirmation(parsed, appointment);

            // Business notification
            await notificationService.sendBusinessNotification('new_appointment', {
                customer_name: parsed.name,
                customer_phone: parsed.phone,
                date: parsed.date,
                time: parsed.time,
                service_type: parsed.service
            });

            res.status(201).json({
                success: true,
                message: 'Appointment booked successfully',
                appointment: {
                    id: appointment.id,
                    customer_name: appointment.customer_name,
                    date: appointment.date,
                    time: appointment.time,
                    service_type: appointment.service_type,
                    status: appointment.status
                }
            });

        } catch (error) {
            logger.error('Error creating booking:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create booking'
            });
        }
    }

    /**
     * Parse booking message
     */
    parseBookingMessage(message) {
        try {
            const parts = message.split(',');
            const parsed = {};

            parts.forEach((part) => {
                const trimmed = part.trim();
                
                if (trimmed.includes('BOOK_APPOINTMENT:')) {
                    return; // Skip the header
                } else if (trimmed.includes('phone:')) {
                    parsed.phone = trimmed.split('phone:')[1].trim();
                } else if (trimmed.includes('email:')) {
                    parsed.email = trimmed.split('email:')[1].trim();
                } else if (trimmed.includes('date:')) {
                    parsed.date = trimmed.split('date:')[1].trim();
                } else if (trimmed.includes('time:')) {
                    parsed.time = trimmed.split('time:')[1].trim();
                } else if (trimmed.includes('service:')) {
                    parsed.service = trimmed.split('service:')[1].trim();
                } else if (trimmed.includes('vehicle:')) {
                    parsed.vehicle = trimmed.split('vehicle:')[1].trim();
                } else if (!parsed.name) {
                    parsed.name = trimmed;
                }
            });

            // Set defaults
            parsed.service = parsed.service || 'General Service';
            
            return parsed;

        } catch (error) {
            logger.error('Error parsing booking message:', error);
            throw new Error('Failed to parse booking request');
        }
    }

    /**
     * Validate booking request
     */
    validateBookingRequest(parsed) {
        if (!parsed.name || !parsed.date || !parsed.time) {
            return false;
        }

        if (!parsed.phone && !parsed.email) {
            return false;
        }

        return true;
    }

    /**
     * Create appointment in calendar
     */
    async createAppointment(parsed) {
        try {
            const appointmentData = {
                customer_name: parsed.name,
                customer_phone: parsed.phone,
                customer_email: parsed.email,
                vehicle_info: parsed.vehicle,
                service_type: parsed.service,
                date: parsed.date,
                time: parsed.time,
                duration: 1, // Default 1 hour
                notes: parsed.notes || '',
                status: 'confirmed',
                created_at: new Date().toISOString()
            };

            // Create calendar event
            const calendarEvent = await calendarService.createEvent(appointmentData);
            appointmentData.calendar_event_id = calendarEvent.id;

            // Store appointment (in production, save to database)
            const appointmentId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
            appointmentData.id = appointmentId;

            logger.info('Appointment created', {
                appointmentId,
                customer: parsed.name,
                date: parsed.date,
                time: parsed.time
            });

            return appointmentData;

        } catch (error) {
            logger.error('Error creating appointment:', error);
            throw error;
        }
    }

    /**
     * Handle booking conflict and suggest alternatives
     */
    async handleBookingConflict(parsed, availability) {
        try {
            logger.info('Handling booking conflict', {
                requestedDate: parsed.date,
                requestedTime: parsed.time
            });

            // Generate alternative suggestions
            const suggestions = availability.suggestions || [];
            
            // Send conflict notification with alternatives
            const conflictMessage = this.generateConflictMessage(parsed, suggestions);
            
            if (parsed.phone) {
                await openPhoneService.sendSMS(parsed.phone, conflictMessage);
            }

            return {
                success: false,
                error: 'Time slot not available',
                suggestions: suggestions,
                message: 'Conflict handled with alternatives provided'
            };

        } catch (error) {
            logger.error('Error handling booking conflict:', error);
            throw error;
        }
    }

    /**
     * Generate conflict message with alternatives
     */
    generateConflictMessage(parsed, suggestions) {
        let message = `Hi ${parsed.name}! Unfortunately, ${parsed.date} at ${parsed.time} is not available.`;
        
        if (suggestions.length > 0) {
            message += '\n\nAvailable times:';
            suggestions.slice(0, 3).forEach((suggestion, index) => {
                message += `\n${index + 1}. ${suggestion.date} at ${suggestion.time}`;
            });
            message += '\n\nReply with the number of your preferred time, or suggest another time!';
        } else {
            message += '\n\nPlease suggest another date and time, or call us to discuss availability.';
        }

        return message;
    }

    /**
     * Send booking confirmation
     */
    async sendBookingConfirmation(parsed, appointment) {
        try {
            // SMS confirmation
            if (parsed.phone) {
                await notificationService.sendAppointmentNotification(
                    parsed.phone, 
                    appointment, 
                    'sms'
                );
            }

            // Email confirmation
            if (parsed.email) {
                await notificationService.sendAppointmentNotification(
                    parsed.email, 
                    appointment, 
                    'email'
                );
            }

            logger.success('Booking confirmations sent', {
                appointmentId: appointment.id,
                sms: !!parsed.phone,
                email: !!parsed.email
            });

        } catch (error) {
            logger.error('Error sending booking confirmation:', error);
            // Don't throw - appointment is still created
        }
    }

    /**
     * Cancel appointment
     */
    async cancelAppointment(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            // Cancel calendar event
            await calendarService.cancelEvent(id);

            // Send cancellation notification
            // (Would fetch appointment details from database)

            res.json({
                success: true,
                message: 'Appointment cancelled successfully'
            });

        } catch (error) {
            logger.error('Error cancelling appointment:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to cancel appointment'
            });
        }
    }

    /**
     * Reschedule appointment
     */
    async rescheduleAppointment(req, res) {
        try {
            const { id } = req.params;
            const { new_date, new_time } = req.body;

            // Check new time availability
            const availability = await calendarService.checkAvailability(new_date, new_time);
            
            if (!availability.available) {
                return res.status(409).json({
                    success: false,
                    error: 'New time slot not available',
                    suggestions: availability.suggestions
                });
            }

            // Update calendar event
            await calendarService.updateEvent(id, { date: new_date, time: new_time });

            // Send update notification
            // (Would fetch appointment details from database)

            res.json({
                success: true,
                message: 'Appointment rescheduled successfully'
            });

        } catch (error) {
            logger.error('Error rescheduling appointment:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to reschedule appointment'
            });
        }
    }

    /**
     * Get availability
     */
    async getAvailability(req, res) {
        try {
            const { date } = req.query;
            
            const availability = await calendarService.getDayAvailability(date);
            
            res.json({
                success: true,
                date,
                availability
            });

        } catch (error) {
            logger.error('Error fetching availability:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch availability'
            });
        }
    }
}

export default new BookingController();