import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import webhookController from './controllers/webhookController.js';
import messageService from './services/messageService.js';

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
            'https://clinquant-starship-25fe89.netlify.app'
        ];
        
        // Check exact matches first
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        // Allow requests from the same port the server is running on
        const serverPort = process.env.PORT || 10000;
        if (origin === `http://localhost:${serverPort}` || origin === `https://localhost:${serverPort}`) {
            return callback(null, true);
        }
        
        // Check dynamic patterns including localhost and webcontainer
        const dynamicPatterns = [
            /^http:\/\/localhost:\d+$/,
            /^https:\/\/.*\.webcontainer\.io$/,
            /^https:\/\/.*\.webcontainer-api\.io$/,
            /^https:\/\/.*\.bolt\.new$/,
            /^https:\/\/bolt\.new$/,
            /^https:\/\/.*\.stackblitz\.com$/,
            /^https:\/\/stackblitz\.com$/,
            /^https:\/\/.*\.webcontainer\.dev$/,
            /^https:\/\/.*-.*\.webcontainer\.io$/,
            /^https:\/\/.*\.csb\.app$/,
            /^https:\/\/.*\.codesandbox\.io$/
        ];
        
        for (const pattern of dynamicPatterns) {
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
            techSheet: '/api/generate-tech-sheet'
        }
    });
});

// Settings API endpoint
app.get('/api/settings', (req, res) => {
    try {
        const settings = {
            openai_configured: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10),
            openphone_configured: !!(process.env.OPENPHONE_API_KEY && process.env.OPENPHONE_API_KEY.length > 10),
            business_name: process.env.BUSINESS_NAME || 'Pink Chicken Speed Shop',
            labor_rate: parseInt(process.env.LABOR_RATE || '80'),
            dnd_enabled: process.env.DND_ENABLED === 'true',
            openai_key_preview: process.env.OPENAI_API_KEY ?
                `••••••••${process.env.OPENAI_API_KEY.slice(-4)}` : undefined,
            openphone_key_preview: process.env.OPENPHONE_API_KEY ?
                `••••••••${process.env.OPENPHONE_API_KEY.slice(-4)}` : undefined
        };
        res.json(settings);
    }
    catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Customer Database API endpoint
app.get('/api/customers', async (req, res) => {
    try {
        const customers = messageService.getCustomers();
        console.log(`📊 Returning ${customers.length} customers`);
        res.json({ customers });
    }
    catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ 
            error: 'Failed to fetch customers',
            customers: []
        });
    }
});

// Quotes API endpoint
app.get('/api/quotes', async (req, res) => {
    try {
        const quotes = messageService.getQuotes();
        console.log(`📊 Returning ${quotes.length} quotes`);
        res.json({ quotes });
    }
    catch (error) {
        console.error('Error fetching quotes:', error);
        res.status(500).json({ 
            error: 'Failed to fetch quotes',
            quotes: []
        });
    }
});

// Appointments API endpoint
app.get('/api/appointments', async (req, res) => {
    try {
        const appointments = messageService.getAppointments();
        console.log(`📊 Returning ${appointments.length} appointments`);
        res.json({ appointments });
    }
    catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ 
            error: 'Failed to fetch appointments',
            appointments: []
        });
    }
});

// Tech Sheets API endpoint
app.get('/api/tech-sheets', async (req, res) => {
    try {
        const techSheets = messageService.getTechSheets();
        console.log(`📊 Returning ${techSheets.length} tech sheets`);
        res.json({ techSheets });
    }
    catch (error) {
        console.error('Error fetching tech sheets:', error);
        res.status(500).json({ 
            error: 'Failed to fetch tech sheets',
            techSheets: []
        });
    }
});

// Tech Sheet Generation API endpoint
app.post('/api/generate-tech-sheet', async (req, res) => {
    try {
        const { jobDescription, vehicleInfo, customerName } = req.body;
        
        if (!jobDescription) {
            return res.status(400).json({ error: 'Job description is required' });
        }
        
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API key not configured on server' });
        }
        
        console.log('🔧 Generating tech sheet via server API...');
        
        const prompt = vehicleInfo ? `${jobDescription} for ${vehicleInfo}` : jobDescription;
        
        // Use a specialized prompt for tech sheet generation
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                temperature: 0.7,
                max_tokens: 1500,
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert automotive technician creating detailed repair guides. Generate a comprehensive tech sheet for the given job description. Format your response as JSON with these exact fields:

{
  "title": "Brief descriptive title",
  "estimated_time": number (hours as decimal),
  "difficulty": "Easy|Medium|Hard",
  "tools_required": ["tool1", "tool2"],
  "parts_needed": ["part1", "part2"],
  "safety_warnings": ["warning1", "warning2"],
  "step_by_step": ["step1", "step2", "step3"],
  "tips": ["tip1", "tip2"]
}

Make the instructions detailed and professional for a working mechanic.`
                    },
                    {
                        role: 'user',
                        content: `Generate a detailed tech sheet for this automotive repair job: ${prompt}`
                    }
                ]
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }
        
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        
        console.log('✅ Tech sheet generated successfully via server');
        res.json({ content });
    } catch (error) {
        console.error('❌ Error generating tech sheet:', error);
        res.status(500).json({ error: 'Failed to generate tech sheet' });
    }
});

// Messages API endpoint - Fixed to handle initialization properly
app.get('/api/messages', async (req, res) => {
    try {
        // Check if getMessages method exists
        if (typeof messageService.getMessages !== 'function') {
            console.error('❌ getMessages method not found on messageService');
            return res.status(500).json({ 
                error: 'Message processor not properly initialized',
                messages: []
            });
        }
        
        const messages = messageService.getMessages();
        console.log(`📊 Returning ${messages.length} messages`);
        res.json({ messages });
    }
    catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ 
            error: 'Failed to fetch messages',
            messages: []
        });
    }
});

// Mark message as read
app.post('/api/messages/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (typeof messageService.markMessageAsRead !== 'function') {
            console.error('❌ markMessageAsRead method not found');
            return res.status(500).json({ error: 'Method not available' });
        }
        
        messageService.markMessageAsRead(id);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({ error: 'Failed to mark message as read' });
    }
});

// Send manual reply
app.post('/api/messages/reply', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        if (!phoneNumber || !message) {
            return res.status(400).json({ error: 'Phone number and message are required' });
        }
        
        if (typeof messageService.sendManualReply !== 'function') {
            console.error('❌ sendManualReply method not found');
            return res.status(500).json({ error: 'Method not available' });
        }
        
        await messageService.sendManualReply(phoneNumber, message);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error sending manual reply:', error);
        res.status(500).json({ error: 'Failed to send reply' });
    }
});

// OpenPhone webhook endpoint - FIXED PATH
app.post('/api/webhooks/openphone', webhookController.handleOpenPhoneWebhook);

// Test webhook endpoint for debugging
app.post('/webhooks/openphone', (req, res) => {
    console.log('🔔 Webhook received at /webhooks/openphone (redirecting to /api/webhooks/openphone)');
    webhookController.handleOpenPhoneWebhook(req, res);
});

// Test endpoint to verify webhook is working
app.get('/api/webhooks/openphone', (req, res) => {
    res.json({
        message: 'OpenPhone webhook endpoint is active',
        method: 'POST',
        url: '/api/webhooks/openphone',
        server: 'ShopSenseAI',
        timestamp: new Date().toISOString()
    });
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
            settings: 'GET /api/settings'
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
    console.log(`🔧 Tech Sheet API: https://torquegpt.onrender.com/api/generate-tech-sheet`);
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