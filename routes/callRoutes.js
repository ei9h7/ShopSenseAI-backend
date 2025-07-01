import express from 'express';
import callService from '../services/callService.js';
import logger from '../utils/logger.js';
import { validateRequiredFields } from '../middleware/validation.js';

const router = express.Router();

/**
 * Call Routes
 * 
 * Handles Sona voice call integration endpoints
 */

// Handle incoming call webhook from Sona
router.post('/incoming', validateRequiredFields(['call_id', 'from']), async (req, res) => {
    try {
        const callData = req.body;
        
        logger.info('Incoming call webhook received', {
            callId: callData.call_id,
            from: callData.from
        });

        const result = await callService.handleIncomingCall(callData);
        
        if (result.success) {
            res.json({
                success: true,
                callId: result.callId,
                response: result.response
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                response: result.response
            });
        }

    } catch (error) {
        logger.error('Error handling incoming call webhook:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process incoming call',
            response: 'I apologize, but I\'m having technical difficulties. Please hold while I connect you to our team.'
        });
    }
});

// Handle call conversation updates
router.post('/conversation/:callId', async (req, res) => {
    try {
        const { callId } = req.params;
        const { transcript, customer_input } = req.body;

        logger.info('Call conversation update', {
            callId,
            hasTranscript: !!transcript,
            hasInput: !!customer_input
        });

        const result = await callService.processCallConversation(
            callId,
            transcript,
            customer_input
        );

        if (result.success) {
            res.json({
                success: true,
                response: result.response,
                intent: result.intent,
                action: result.action,
                shouldTransfer: result.shouldTransfer
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                response: result.response || 'I apologize for the technical difficulty. Let me transfer you to our team.'
            });
        }

    } catch (error) {
        logger.error('Error processing call conversation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process conversation',
            response: 'I\'m experiencing technical difficulties. Let me transfer you to our service team.'
        });
    }
});

// Handle call completion
router.post('/complete/:callId', async (req, res) => {
    try {
        const { callId } = req.params;
        const callSummary = req.body;

        logger.info('Call completion webhook', {
            callId,
            duration: callSummary.duration,
            outcome: callSummary.outcome
        });

        const result = await callService.handleCallComplete(callId, callSummary);
        
        res.json({
            success: result.success,
            message: result.success ? 'Call completed successfully' : 'Error completing call'
        });

    } catch (error) {
        logger.error('Error handling call completion:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to complete call processing'
        });
    }
});

// Get active call sessions
router.get('/active', async (req, res) => {
    try {
        const activeSessions = callService.getActiveCallSessions();
        
        res.json({
            success: true,
            activeCalls: activeSessions.length,
            sessions: activeSessions.map(session => ({
                id: session.id,
                from: session.from,
                status: session.status,
                startTime: session.startTime,
                transcriptLength: session.transcript?.length || 0
            }))
        });

    } catch (error) {
        logger.error('Error fetching active calls:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch active calls'
        });
    }
});

// Get call statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = callService.getCallStats();
        
        res.json({
            success: true,
            stats
        });

    } catch (error) {
        logger.error('Error fetching call stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch call statistics'
        });
    }
});

// Test call service configuration
router.get('/test', async (req, res) => {
    try {
        const isConfigured = callService.isServiceConfigured();
        
        res.json({
            success: true,
            configured: isConfigured,
            message: isConfigured ? 'Call service is configured' : 'Call service needs configuration'
        });

    } catch (error) {
        logger.error('Error testing call service:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test call service'
        });
    }
});

export default router;