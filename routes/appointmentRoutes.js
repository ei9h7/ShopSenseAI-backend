import express from 'express';
import bookingController from '../controllers/bookingController.js';
import calendarService from '../services/calendarService.js';
import logger from '../utils/logger.js';
import { validateRequiredFields } from '../middleware/validation.js';

const router = express.Router();

/**
 * Appointment Routes
 * 
 * Handles appointment/calendar management endpoints
 * Note: This is a placeholder implementation using in-memory storage
 * In production, this should use a proper database
 */

// In-memory storage (replace with database)
const appointments = new Map();

// Get all appointments
router.get('/', async (req, res) => {
    try {
        const appointments = await calendarService.getAllAppointments();
        res.json({
            success: true,
            appointments,
            count: appointments.length
        });
    } catch (error) {
        logger.error('Error fetching appointments:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch appointments'
        });
    }
});

// Create new appointment with availability checking
router.post('/', validateRequiredFields(['customer_name', 'customer_phone', 'preferred_date', 'preferred_time']), bookingController.createBooking);

// Check availability
router.get('/availability', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({
                success: false,
                error: 'Date parameter is required'
            });
        }

        const availability = await calendarService.getDayAvailability(date);
        res.json({
            success: true,
            availability
        });
    } catch (error) {
        logger.error('Error checking availability:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check availability'
        });
    }
});

// Cancel appointment
router.delete('/:id', bookingController.cancelAppointment);

// Reschedule appointment
router.put('/:id/reschedule', validateRequiredFields(['new_date', 'new_time']), bookingController.rescheduleAppointment);

// Update appointment status
router.put('/:id/status', (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const appointment = appointments.get(id);
        if (!appointment) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            });
        }

        appointment.status = status;
        appointment.updated_at = new Date().toISOString();

        appointments.set(id, appointment);
        
        logger.success('Appointment status updated', { appointmentId: id, status });
        
        res.json({
            success: true,
            appointment,
            message: `Appointment ${status} successfully`
        });
    } catch (error) {
        logger.error('Error updating appointment status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update appointment status'
        });
    }
});

// Get single appointment
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const appointment = appointments.get(id);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        res.json({
            success: true,
            appointment
        });
    } catch (error) {
        logger.error('Error fetching appointment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch appointment'
        });
    }
});

export default router;