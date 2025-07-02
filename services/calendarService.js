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
            const appointmentDate = this.parseAppointmentDateTime(date, time);
            if (!appointmentDate || isNaN(appointmentDate.getTime())) {
                logger.warn('Invalid date or time format', { date, time });
                return {
                    available: false,
                    reason: 'Invalid date or time format',
                    suggestions: await this.getNextAvailableSlots(3)
                };
            }

            // Check if date is in the past (with some tolerance for today)
            const now = new Date();
            if (appointmentDate < now && appointmentDate.toDateString() !== now.toDateString()) {
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
            const timeString = appointmentDate.toTimeString().substring(0, 5); // HH:MM format
            if (!this.isWithinBusinessHours(timeString, businessDay)) {
                return {
                    available: false,
                    reason: `Outside business hours (${businessDay.start} - ${businessDay.end})`,
                    suggestions: await this.getAvailableSlotsForDate(this.formatDateString(appointmentDate))
                };
            }

            // Check for conflicts with existing appointments
            const hasConflict = this.hasTimeConflict(this.formatDateString(appointmentDate), timeString, duration);
            
            if (hasConflict) {
                return {
                    available: false,
                    reason: 'Time slot already booked',
                    suggestions: await this.getAvailableSlotsForDate(this.formatDateString(appointmentDate))
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
     * Check for time conflicts more accurately
     */
    async checkDetailedAvailability(date, time, duration = 1) {
        try {
            logger.info('Checking detailed availability', { date, time, duration });

            // First do basic validation
            const basicCheck = await this.checkAvailability(date, time, duration);
            if (!basicCheck.available) {
                return basicCheck;
            }

            // Enhanced conflict checking for exact time slots
            const appointmentStart = this.parseAppointmentDateTime(date, time);
            if (!appointmentStart || isNaN(appointmentStart.getTime())) {
                return {
                    available: false,
                    reason: 'Invalid date/time format',
                    suggestions: await this.getNextAvailableSlots(3)
                };
            }

            const appointmentEnd = new Date(appointmentStart.getTime() + (duration * 60 * 60 * 1000));

            // Check all existing appointments
            const conflicts = [];
            for (const [appointmentId, appointment] of this.appointments) {
                if (appointment.status === 'cancelled') continue;

                try {
                    const existingStart = this.parseAppointmentDateTime(appointment.date, appointment.time);
                    if (!existingStart || isNaN(existingStart.getTime())) continue;

                    const existingEnd = new Date(existingStart.getTime() + ((appointment.duration || 1) * 60 * 60 * 1000));

                    // Check for any overlap
                    const hasConflict = (appointmentStart < existingEnd && appointmentEnd > existingStart);
                    
                    if (hasConflict) {
                        conflicts.push({
                            appointmentId,
                            customer: appointment.customer_name,
                            conflictTime: `${appointment.date} at ${appointment.time}`,
                            service: appointment.service_type
                        });
                    }
                } catch (parseError) {
                    logger.warn('Error parsing existing appointment time', { 
                        appointmentId, 
                        date: appointment.date, 
                        time: appointment.time,
                        error: parseError.message 
                    });
                    continue; // Skip this appointment if can't parse
                }
            }

            if (conflicts.length > 0) {
                logger.warn('Time conflicts detected', { 
                    requestedTime: `${date} at ${time}`,
                    conflicts: conflicts.length,
                    conflictDetails: conflicts
                });

                return {
                    available: false,
                    reason: `Time slot conflicts with existing appointment(s)`,
                    conflicts,
                    suggestions: await this.getNextAvailableSlots(3)
                };
            }

            logger.success('Time slot available - no conflicts', { date, time });
            return {
                available: true,
                date,
                time,
                duration,
                verified: true
            };

        } catch (error) {
            logger.error('Error checking detailed availability:', error);
            return {
                available: false,
                reason: 'Error checking availability',
                suggestions: []
            };
        }
    }

    /**
     * Parse appointment date and time into a proper Date object
     */
    parseAppointmentDateTime(date, time) {
        try {
            logger.debug('Parsing appointment date/time', { date, time });

            // Handle day names like "Friday"
            if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(date.toLowerCase())) {
                const today = new Date();
                const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
                const targetDay = dayMap[date.toLowerCase()];
                
                // Find next occurrence of this day
                let daysUntilTarget = targetDay - today.getDay();
                if (daysUntilTarget <= 0) {
                    daysUntilTarget += 7; // Next week
                }
                
                const appointmentDate = new Date(today);
                appointmentDate.setDate(today.getDate() + daysUntilTarget);
                
                // Parse time more accurately
                const parsedTime = this.parseTimeString(time);
                if (parsedTime) {
                    appointmentDate.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
                    logger.debug('Successfully parsed day name and time', { 
                        originalDate: date,
                        originalTime: time,
                        parsedDate: appointmentDate.toISOString()
                    });
                    return appointmentDate;
                }
            }
            
            // Handle ISO dates or other formats
            const isoDate = new Date(date + 'T' + time);
            if (!isNaN(isoDate.getTime())) {
                return isoDate;
            }

            // Try parsing as MM-DD-YYYY or similar
            const dateFormats = [
                new Date(date + ' ' + time),
                new Date(date)
            ];

            for (const testDate of dateFormats) {
                if (!isNaN(testDate.getTime())) {
                    const parsedTime = this.parseTimeString(time);
                    if (parsedTime) {
                        testDate.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
                        return testDate;
                    }
                }
            }

            logger.warn('Could not parse date/time', { date, time });
            return null;

        } catch (error) {
            logger.error('Error parsing appointment date/time', { date, time, error: error.message });
            return null;
        }
    }

    /**
     * Parse time string into hours and minutes
     */
    parseTimeString(time) {
        try {
            const timeLower = time.toLowerCase().replace(/\s+/g, '');
            
            // Handle various time formats
            const timePatterns = [
                /(\d{1,2}):(\d{2})(am|pm)/, // 2:30pm
                /(\d{1,2})(am|pm)/, // 2pm
                /(\d{1,2}):(\d{2})/, // 14:30 or 2:30
                /(\d{1,2})/ // 14 or 2
            ];

            for (const pattern of timePatterns) {
                const match = timeLower.match(pattern);
                if (match) {
                    let hours = parseInt(match[1]);
                    let minutes = parseInt(match[2] || 0);
                    const ampm = match[3];
                    
                    if (ampm === 'pm' && hours !== 12) hours += 12;
                    if (ampm === 'am' && hours === 12) hours = 0;
                    
                    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                        return { hours, minutes };
                    }
                }
            }

            logger.warn('Could not parse time string', { time });
            return null;

        } catch (error) {
            logger.error('Error parsing time string', { time, error: error.message });
            return null;
        }
    }

    /**
     * Format date as string for consistent comparison
     */
    formatDateString(date) {
        if (date instanceof Date) {
            return date.toISOString().split('T')[0]; // YYYY-MM-DD
        }
        return date;
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
                stored_in_map: this.appointments.has(eventId),
                total_appointments: this.appointments.size
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
            const appointmentDate = this.parseAppointmentDateTime(date, '12:00');
            if (!appointmentDate) {
                return {
                    date,
                    closed: true,
                    available_slots: []
                };
            }

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
        try {
            const appointmentStart = this.parseAppointmentDateTime(date, time);
            if (!appointmentStart) return false;

            const appointmentEnd = new Date(appointmentStart.getTime() + (duration * 60 * 60 * 1000));

            for (const [, appointment] of this.appointments) {
                if (appointment.status === 'cancelled') continue;
                
                try {
                    const existingStart = this.parseAppointmentDateTime(appointment.date, appointment.time);
                    if (!existingStart) continue;

                    const existingEnd = new Date(existingStart.getTime() + ((appointment.duration || 1) * 60 * 60 * 1000));

                    // Check for overlap
                    if (appointmentStart < existingEnd && appointmentEnd > existingStart) {
                        return true;
                    }
                } catch (error) {
                    logger.warn('Error parsing existing appointment for conflict check', { 
                        appointmentId: appointment.id,
                        error: error.message 
                    });
                    continue;
                }
            }

            return false;
        } catch (error) {
            logger.error('Error checking time conflict:', error);
            return false; // Default to no conflict if error
        }
    }

    /**
     * Check if time is within business hours
     */
    isWithinBusinessHours(time, businessDay) {
        try {
            const appointmentTime = this.timeToMinutes(time);
            const startTime = this.timeToMinutes(businessDay.start);
            const endTime = this.timeToMinutes(businessDay.end);

            return appointmentTime >= startTime && appointmentTime < endTime;
        } catch (error) {
            logger.error('Error checking business hours:', error);
            return false;
        }
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
        try {
            logger.info('Getting all appointments from calendar service', { 
                total_stored: this.appointments.size 
            });

            const appointments = Array.from(this.appointments.values())
                .filter(apt => apt.status !== 'cancelled') // Filter out cancelled appointments
                .sort((a, b) => {
                    // Handle different date formats
                    const dateA = this.parseAppointmentDateTime(a.date, a.time);
                    const dateB = this.parseAppointmentDateTime(b.date, b.time);
                    
                    if (!dateA || !dateB) return 0;
                    return dateA.getTime() - dateB.getTime();
                });
                
            logger.info('Retrieved all appointments', { 
                total_count: appointments.length,
                appointment_details: appointments.map(apt => ({
                    id: apt.id,
                    customer: apt.customer_name,
                    service: apt.service_type,
                    date: apt.date,
                    time: apt.time,
                    status: apt.status
                }))
            });
            
            return appointments;
        } catch (error) {
            logger.error('Error getting all appointments:', error);
            return [];
        }
    }

    /**
     * Get appointments for a specific date
     */
    async getAppointmentsForDate(date) {
        try {
            const allAppointments = await this.getAllAppointments();
            const dateAppointments = allAppointments.filter(appointment => {
                // Handle both day names and dates
                if (appointment.date.toLowerCase() === date.toLowerCase()) {
                    return true;
                }
                
                // Parse both dates and compare
                const appointmentDate = this.parseAppointmentDateTime(appointment.date, appointment.time);
                const targetDate = this.parseAppointmentDateTime(date, '00:00');
                
                if (appointmentDate && targetDate) {
                    return appointmentDate.toDateString() === targetDate.toDateString();
                }
                
                return false;
            });

            return dateAppointments.sort((a, b) => {
                const timeA = this.parseTimeString(a.time);
                const timeB = this.parseTimeString(b.time);
                
                if (!timeA || !timeB) return 0;
                
                return (timeA.hours * 60 + timeA.minutes) - (timeB.hours * 60 + timeB.minutes);
            });
        } catch (error) {
            logger.error('Error getting appointments for date:', error);
            return [];
        }
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