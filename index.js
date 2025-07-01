import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';

// Import route modules
import webhookRoutes from './routes/webhookRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import quoteRoutes from './routes/quoteRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import techSheetRoutes from './routes/techSheetRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import callRoutes from './routes/callRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import quoteController from './controllers/quoteController.js';
import bookingController from './controllers/bookingController.js';

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware with size limits for Render
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'https://shopsenseai.app',
            'https://shopsenseai.netlify.app',
            'https://clinquant-starship-25fe89.netlify.app',
            'http://localhost:5173',
            'http://localhost:3000',
            'http://localhost:4173',
            'http://localhost:10000'
        ];
        
        // Add frontend URL from environment variables
        if (process.env.FRONTEND_URL) {
            // Handle comma-separated URLs
            const frontendUrls = process.env.FRONTEND_URL.split(',').map(url => url.trim());
            allowedOrigins.push(...frontendUrls);
        }
        
        // Check exact matches first
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        // Check webcontainer patterns (for bolt.new previews)
        const webcontainerPatterns = [
            /^https:\/\/.*\.webcontainer\.io$/,
            /^https:\/\/.*\.webcontainer-api\.io$/
        ];
        
        for (const pattern of webcontainerPatterns) {
            if (pattern.test(origin)) {
                return callback(null, true);
            }
        }
        
        // Reject all other origins
        console.log(`🚫 CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health check endpoint - optimized for Render
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'ShopSenseAI Webhook Server',
        version: '1.0.0',
        status: 'running',
        tagline: 'Instant quotes. Automated booking. More wrench time.',
        endpoints: {
            health: '/health',
            webhook: '/api/webhooks/openphone',
            messages: '/api/messages',
            customers: '/api/customers',
            quotes: '/api/quotes',
            appointments: '/api/appointments',
            techSheets: '/api/tech-sheets',
            settings: '/api/settings',
            calls: '/api/calls',
            notifications: '/api/notifications'
        }
    });
});

// Use route modules
app.use('/api/webhooks', webhookRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/tech-sheets', techSheetRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/notifications', notificationRoutes);

// Webhook processing for quote and booking requests
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        const message = body.message || '';

        logger.info('Webhook received', { message: message.substring(0, 100) });

        if (message.includes('QUOTE_REQUEST')) {
            await quoteController.handleQuoteRequest(body);
        } else if (message.includes('BOOK_APPOINTMENT')) {
            await bookingController.handleBookingRequest(body);
        } else {
            logger.info('Unknown webhook request', { message });
        }

        res.status(200).json({ success: true, message: 'Webhook processed' });
    } catch (error) {
        logger.error('Webhook processing error:', error);
        res.status(500).json({ success: false, error: 'Webhook processing failed' });
    }
});

// Legacy webhook endpoint for backwards compatibility
app.post('/webhooks/openphone', (req, res) => {
    console.log('🔔 Webhook received at /webhooks/openphone (redirecting to /api/webhooks/openphone)');
    req.url = '/api/webhooks/openphone';
    webhookRoutes(req, res);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
    console.log(`❌ 404 - Endpoint not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
        error: 'Endpoint not found',
        method: req.method,
        path: req.originalUrl,
        availableEndpoints: {
            health: 'GET /health',
            webhook: 'POST /api/webhooks/openphone',
            messages: 'GET /api/messages',
            customers: 'GET /api/customers',
            quotes: 'GET /api/quotes',
            appointments: 'GET /api/appointments',
            techSheets: 'GET /api/tech-sheets',
            settings: 'GET /api/settings',
            calls: 'GET /api/calls',
            notifications: 'GET /api/notifications'
        }
    });
});

// Graceful shutdown handling for Render
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    process.exit(0);
});

// Start server - CRITICAL: Bind to 0.0.0.0 for Render
const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 ShopSenseAI webhook server running on port ${PORT}`);
    console.log(`📡 OpenPhone webhook URL: https://torquegpt.onrender.com/api/webhooks/openphone`);
    console.log(`🏥 Health check: https://torquegpt.onrender.com/health`);
    console.log(`📨 Messages API: https://torquegpt.onrender.com/api/messages`);
    console.log(`👥 Customers API: https://torquegpt.onrender.com/api/customers`);
    console.log(`💰 Quotes API: https://torquegpt.onrender.com/api/quotes`);
    console.log(`📅 Appointments API: https://torquegpt.onrender.com/api/appointments`);
    console.log(`🔧 Tech Sheets API: https://torquegpt.onrender.com/api/tech-sheets`);
    console.log(`⚙️  Settings API: https://torquegpt.onrender.com/api/settings`);
    console.log(`📞 Call API: https://torquegpt.onrender.com/api/calls`);
    console.log(`🔔 Notifications API: https://torquegpt.onrender.com/api/notifications`);
    console.log(`🔗 Webhook Endpoint: https://torquegpt.onrender.com/webhook`);
    console.log(`✅ ShopSenseAI webhook server deployed successfully!`);
    console.log(`🎯 Tagline: Instant quotes. Automated booking. More wrench time.`);
    console.log(`🌐 Allowed origins: shopsenseai.app, shopsenseai.netlify.app`);
});

// Handle server errors
server.on('error', (error) => {
    console.error('❌ Server error:', error);
    process.exit(1);
});

export default app;