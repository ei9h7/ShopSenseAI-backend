import express from 'express';
import logger from '../utils/logger.js';

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
router.get('/', (req, res) => {
    try {
        logger.info('Fetching appointments');
        
        const allAppointments = Array.from(appointments.values())
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        res.json({
            success: true,
            appointments: allAppointments,
            count: allAppointments.length
        });
    } catch (error) {
        logger.error('Error fetching appointments:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch appointments'
        });
    }
});

// Create new appointment
router.post('/', (req, res) => {
    try {
        const {
            customer_name,
            customer_phone,
            vehicle_info,
            service_type,
            date,
            time,
            duration,
            notes
        } = req.body;

        // Validation
        if (!customer_name || !customer_phone || !date || !time) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: customer_name, customer_phone, date, time'
            });
        }

        const appointment = {
            id: Date.now().toString(),
            customer_name,
            customer_phone,
            vehicle_info: vehicle_info || '',
            service_type: service_type || 'General Service',
            date,
            time,
            duration: duration || 1,
            status: 'scheduled',
            notes: notes || '',
            created_at: new Date().toISOString()
        };

        appointments.set(appointment.id, appointment);
        
        logger.success('Appointment created', { 
            appointmentId: appointment.id, 
            customer: customer_name,
            date,
            time
        });
        
        res.status(201).json({
            success: true,
            appointment,
            message: 'Appointment created successfully'
        });
    } catch (error) {
        logger.error('Error creating appointment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create appointment'
        });
    }
});

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