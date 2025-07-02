import logger from '../utils/logger.js';

/**
 * Calendar Service
 * 
 * Manages appointment scheduling and calendar integration
 * Provides availability checking, event creation, and calendar management
 * 
 * TODO: Integrate with Google Calendar API when credentials are available
 */

class CalendarService {
    constructor() {
        this.appointments = new Map(); // In-memory storage (replace with database)
        this.businessHours = this.initializeBusinessHours();
        this.googleCalendarConfigured = false;
        
        // TODO: Initialize Google Calendar API
        // this.initializeGoogleCalendar();
    }

    /**
     * Initialize business hours
     */
    initializeBusinessHours() {
        return {
            monday: { start: '08:00', end: '17:00', closed: false },
            tuesday: { start: '08:00', end: '17:00', closed: false },
            wednesday: { start: '08:00', end: '17:00', closed: false },
            thursday: { start: '08:00', end: '17:00', closed: false },
            friday: { start: '08:00', end: '17:00', closed: false },
            saturday: { start: '09:00', end: '15:00', closed: false },
            sunday: { start: '00:00', end: '00:00', closed: true }
        };
    }

    /**
     * Check availability for a specific date and time
     */
    async checkAvailability(date, time, duration = 1) {
        try {
            logger.info('Checking availability', { date, time, duration });

            // Validate date format
            const appointmentDate = new Date(date + 'T' + time);
            if (isNaN(appointmentDate.getTime())) {
                throw new Error('Invalid date or time format');
            }

            // Check if date is in the past
            if (appointmentDate < new Date()) {
                return {
                    available: false,
                    reason: 'Cannot schedule appointments in the past',
                    suggestions: await this.getNextAvailableSlots(3)
                };
            }

            // Check business hours
            const dayOfWeek = this.getDayOfWeek(appointmentDate);
            const businessDay = this.businessHours[dayOfWeek];
            
            if (businessDay.closed) {
                return {
                    available: false,
                    reason: 'We are closed on this day',
                    suggestions: await this.getNextAvailableSlots(3)
                };
            }

            // Check if time is within business hours
            if (!this.isWithinBusinessHours(time, businessDay)) {
                return {
                    available: false,
                    reason: `Outside business hours (${businessDay.start} - ${businessDay.end})`,
                    suggestions: await this.getAvailableSlotsForDate(date)
                };
            }

            // Check for conflicts with existing appointments
            const hasConflict = this.hasTimeConflict(date, time, duration);
            
            if (hasConflict) {
                return {
                    available: false,
                    reason: 'Time slot already booked',
                    suggestions: await this.getAvailableSlotsForDate(date)
                };
            }

            logger.success('Time slot available', { date, time });
            
            return {
                available: true,
                date,
                time,
                duration
            };

        } catch (error) {
            logger.error('Error checking availability:', error);
            return {
                available: false,
                reason: 'Error checking availability',
                suggestions: []
            };
        }
    }

    /**
     * Create calendar event/appointment
     */
    async createEvent(appointmentData) {
        try {
            logger.info('Creating calendar event', {
                customer: appointmentData.customer_name,
                date: appointmentData.date,
                time: appointmentData.time
            });

            const eventId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
            
            const event = {
                id: eventId,
                title: `${appointmentData.service_type} - ${appointmentData.customer_name}`,
                customer_name: appointmentData.customer_name,
                customer_phone: appointmentData.customer_phone,
                customer_email: appointmentData.customer_email,
                vehicle_info: appointmentData.vehicle_info,
                service_type: appointmentData.service_type,
                date: appointmentData.date,
                time: appointmentData.time,
                duration: appointmentData.duration || 1,
                notes: appointmentData.notes || '',
                status: 'confirmed',
                created_at: new Date().toISOString(),
                google_event_id: null, // Will be set when Google Calendar is integrated
                source: 'booking_confirmation' // Track how this was created
            };

            // Store locally
            this.appointments.set(eventId, event);

            logger.success('Calendar event created and stored', { 
                eventId, 
                customer: event.customer_name,
                service: event.service_type,
                stored_in_map: this.appointments.has(eventId)
            });

            // TODO: Create in Google Calendar
            // if (this.googleCalendarConfigured) {
            //     const googleEvent = await this.createGoogleCalendarEvent(event);
            //     event.google_event_id = googleEvent.id;
            // }

            return event;

        } catch (error) {
            logger.error('Error creating calendar event:', error);
            throw error;
        }
    }

    /**
     * Update calendar event
     */
    async updateEvent(eventId, updates) {
        try {
            logger.info('Updating calendar event', { eventId, updates });

            const event = this.appointments.get(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            // Update event data
            Object.assign(event, updates, {
                updated_at: new Date().toISOString()
            });

            this.appointments.set(eventId, event);

            // TODO: Update Google Calendar event
            // if (this.googleCalendarConfigured && event.google_event_id) {
            //     await this.updateGoogleCalendarEvent(event.google_event_id, updates);
            // }

            logger.success('Calendar event updated', { eventId });
            
            return event;

        } catch (error) {
            logger.error('Error updating calendar event:', error);
            throw error;
        }
    }

    /**
     * Cancel calendar event
     */
    async cancelEvent(eventId) {
        try {
            logger.info('Cancelling calendar event', { eventId });

            const event = this.appointments.get(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            // Update status to cancelled
            event.status = 'cancelled';
            event.cancelled_at = new Date().toISOString();

            this.appointments.set(eventId, event);

            // TODO: Cancel Google Calendar event
            // if (this.googleCalendarConfigured && event.google_event_id) {
            //     await this.cancelGoogleCalendarEvent(event.google_event_id);
            // }

            logger.success('Calendar event cancelled', { eventId });
            
            return event;

        } catch (error) {
            logger.error('Error cancelling calendar event:', error);
            throw error;
        }
    }

    /**
     * Get day availability
     */
    async getDayAvailability(date) {
        try {
            const appointmentDate = new Date(date);
            const dayOfWeek = this.getDayOfWeek(appointmentDate);
            const businessDay = this.businessHours[dayOfWeek];

            if (businessDay.closed) {
                return {
                    date,
                    closed: true,
                    available_slots: []
                };
            }

            const availableSlots = this.generateTimeSlots(date, businessDay);
            
            return {
                date,
                closed: false,
                business_hours: `${businessDay.start} - ${businessDay.end}`,
                available_slots: availableSlots
            };

        } catch (error) {
            logger.error('Error getting day availability:', error);
            return {
                date,
                closed: true,
                available_slots: []
            };
        }
    }

    /**
     * Generate available time slots for a date
     */
    generateTimeSlots(date, businessDay) {
        const slots = [];
        const startTime = this.timeToMinutes(businessDay.start);
        const endTime = this.timeToMinutes(businessDay.end);
        const slotDuration = 60; // 1 hour slots

        for (let time = startTime; time < endTime; time += slotDuration) {
            const timeString = this.minutesToTime(time);
            
            // Check if slot is available
            if (!this.hasTimeConflict(date, timeString, 1)) {
                slots.push({
                    time: timeString,
                    available: true,
                    duration: 1
                });
            }
        }

        return slots;
    }

    /**
     * Get available slots for a specific date
     */
    async getAvailableSlotsForDate(date) {
        const dayAvailability = await this.getDayAvailability(date);
        return dayAvailability.available_slots.map(slot => ({
            date,
            time: slot.time
        }));
    }

    /**
     * Get next available slots
     */
    async getNextAvailableSlots(count = 3) {
        const suggestions = [];
        const today = new Date();
        
        for (let i = 1; i <= 14 && suggestions.length < count; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() + i);
            
            const dateString = checkDate.toISOString().split('T')[0];
            const daySlots = await this.getAvailableSlotsForDate(dateString);
            
            if (daySlots.length > 0) {
                suggestions.push(daySlots[0]); // Take first available slot
            }
        }

        return suggestions;
    }

    /**
     * Check if appointment time conflicts with existing appointments
     */
    hasTimeConflict(date, time, duration) {
        const appointmentStart = new Date(date + 'T' + time);
        const appointmentEnd = new Date(appointmentStart.getTime() + (duration * 60 * 60 * 1000));

        for (const [, appointment] of this.appointments) {
            if (appointment.status === 'cancelled') continue;
            if (appointment.date !== date) continue;

            const existingStart = new Date(appointment.date + 'T' + appointment.time);
            const existingEnd = new Date(existingStart.getTime() + (appointment.duration * 60 * 60 * 1000));

            // Check for overlap
            if (appointmentStart < existingEnd && appointmentEnd > existingStart) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if time is within business hours
     */
    isWithinBusinessHours(time, businessDay) {
        const appointmentTime = this.timeToMinutes(time);
        const startTime = this.timeToMinutes(businessDay.start);
        const endTime = this.timeToMinutes(businessDay.end);

        return appointmentTime >= startTime && appointmentTime < endTime;
    }

    /**
     * Get day of week string
     */
    getDayOfWeek(date) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return days[date.getDay()];
    }

    /**
     * Convert time string to minutes
     */
    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    /**
     * Convert minutes to time string
     */
    minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    /**
     * Get all appointments
     */
    async getAllAppointments() {
        const appointments = Array.from(this.appointments.values())
            .filter(apt => apt.status !== 'cancelled') // Filter out cancelled appointments
            .sort((a, b) => {
                // Handle different date formats
                const dateA = this.parseAppointmentDate(a.date, a.time);
                const dateB = this.parseAppointmentDate(b.date, b.time);
                return dateA.getTime() - dateB.getTime();
            });
            
        logger.debug('Retrieved all appointments', { count: appointments.length });
        
        // Format appointments for frontend compatibility
        const formattedAppointments = appointments.map(apt => ({
            ...apt,
            formatted_date: this.formatDateForFrontend(apt.date),
            formatted_time: this.formatTimeForFrontend(apt.time),
            display_name: `${apt.customer_name} - ${apt.service_type}`,
            status_color: this.getStatusColor(apt.status)
        }));
        
        return appointments;
    }

    /**
     * Parse appointment date/time handling various formats
     */
    parseAppointmentDate(date, time) {
        try {
            // Handle day names like "Friday"
            if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(date.toLowerCase())) {
                const today = new Date();
                const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
                const targetDay = dayMap[date.toLowerCase()];
                const daysUntilTarget = (targetDay - today.getDay() + 7) % 7 || 7; // Next occurrence
                
                const appointmentDate = new Date(today);
                appointmentDate.setDate(today.getDate() + daysUntilTarget);
                
                // Parse time
                const timeParts = time.toLowerCase().replace(/\s+/g, '').match(/(\d{1,2}):?(\d{0,2})(am|pm)?/);
                if (timeParts) {
                    let hours = parseInt(timeParts[1]);
                    const minutes = parseInt(timeParts[2] || 0);
                    const ampm = timeParts[3];
                    
                    if (ampm === 'pm' && hours !== 12) hours += 12;
                    if (ampm === 'am' && hours === 12) hours = 0;
                    
                    appointmentDate.setHours(hours, minutes, 0, 0);
                }
                
                return appointmentDate;
            }
            
            // Handle ISO dates or other formats
            return new Date(date + 'T' + time);
        } catch (error) {
            logger.warn('Error parsing appointment date/time', { date, time, error: error.message });
            return new Date(); // Fallback to current time
        }
    }

    /**
     * Format date for frontend display
     */
    formatDateForFrontend(date) {
        const parsedDate = this.parseAppointmentDate(date, '12:00');
        return parsedDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    /**
     * Format time for frontend display
     */
    formatTimeForFrontend(time) {
        // Normalize time format
        const normalizedTime = time.toLowerCase().replace(/\s+/g, '');
        const timeParts = normalizedTime.match(/(\d{1,2}):?(\d{0,2})(am|pm)?/);
        
        if (timeParts) {
            let hours = parseInt(timeParts[1]);
            const minutes = parseInt(timeParts[2] || 0);
            const ampm = timeParts[3];
            
            if (ampm === 'pm' && hours !== 12) hours += 12;
            if (ampm === 'am' && hours === 12) hours = 0;
            
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        return time; // Return original if parsing fails
    }

    /**
     * Get status color for frontend
     */
    getStatusColor(status) {
        const colorMap = {
            confirmed: '#16a34a',   // Green
            pending: '#f59e0b',     // Amber  
            completed: '#06b6d4',   // Cyan
            cancelled: '#ef4444'    // Red
        };
        return colorMap[status] || '#6b7280'; // Default gray
    }
    /**
     * Get appointments for a specific date
     */
    async getAppointmentsForDate(date) {
        return Array.from(this.appointments.values())
            .filter(appointment => appointment.date === date && appointment.status !== 'cancelled')
            .sort((a, b) => a.time.localeCompare(b.time));
    }

    /**
     * Get calendar statistics
     */
    getCalendarStats() {
        const appointments = Array.from(this.appointments.values());
        
        return {
            total: appointments.length,
            confirmed: appointments.filter(a => a.status === 'confirmed').length,
            cancelled: appointments.filter(a => a.status === 'cancelled').length,
            completed: appointments.filter(a => a.status === 'completed').length,
            googleCalendarConfigured: this.googleCalendarConfigured
        };
    }

    // TODO: Google Calendar Integration Methods
    // async initializeGoogleCalendar() {
    //     // Initialize Google Calendar API with service account
    // }
    
    // async createGoogleCalendarEvent(event) {
    //     // Create event in Google Calendar
    // }
    
    // async updateGoogleCalendarEvent(googleEventId, updates) {
    //     // Update Google Calendar event
    // }
    
    // async cancelGoogleCalendarEvent(googleEventId) {
    //     // Cancel Google Calendar event
    // }
}

export default new CalendarService();