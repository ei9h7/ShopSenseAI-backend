# ShopSenseAI Backend

> **Built with [Bolt.new](https://bolt.new)** ⚡

AI-powered webhook server for automotive service businesses. **Instant quotes. Automated booking. More wrench time.**

## 🚀 **Live Production Server**

**Server**: https://torquegpt.onrender.com

### **🎯 Current Features**
- **🤖 AI Message Processing**: OpenAI GPT-4 powered responses
- **📱 SMS Integration**: OpenPhone webhook processing
- **💰 Smart Quote Generation**: Part price scraping + labor calculations
- **📅 Appointment Booking**: PostgreSQL-backed scheduling with conflict detection
- **🛡️ Graceful Fallbacks**: System works even when AI/APIs are down
- **🚨 Emergency Detection**: Prioritizes urgent customer messages
- **📊 PostgreSQL Database**: Persistent storage for appointments and messages
- **⚙️ Health Monitoring**: Comprehensive status checking and logging

## 🔧 **Quick Start**

### **Local Development**

1. **Clone and install**
   ```bash
   git clone <your-repo>
   cd shopsenseai-backend
   npm install
   ```

2. **Environment setup**
   ```bash
   cp .env.example .env
   ```
   
   **Required environment variables:**
   ```env
   # AI & SMS APIs
   OPENAI_API_KEY=sk-your_openai_api_key_here
   OPENPHONE_API_KEY=your_openphone_api_key_here
   OPENPHONE_PHONE_NUMBER=+15873287465
   
   # Business Configuration  
   BUSINESS_NAME=Pink Chicken Speed Shop
   LABOR_RATE=80
   DND_ENABLED=true
   
   # Database (Optional - uses in-memory if not provided)
   DATABASE_URL=postgresql://user:pass@host:port/dbname
   
   # Server
   NODE_ENV=development
   PORT=10000
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```
   Server runs on http://localhost:10000

4. **Test the installation**
   ```bash
   # Health check
   curl http://localhost:10000/health
   
   # Settings check  
   curl http://localhost:10000/api/settings
   
   # Webhook test
   curl http://localhost:10000/api/webhooks/openphone
   ```

## 🌐 **Production Deployment**

### **Option 1: Deploy to Render (Recommended)**

1. **Fork/clone this repository**

2. **Create Render services:**
   ```bash
   # The render.yaml file automatically creates:
   # - Web Service (Backend API)
   # - PostgreSQL Database (Free tier)
   ```

3. **Deploy to Render:**
   - Connect your GitHub repository  
   - Render will auto-detect `render.yaml`
   - Set environment variables in Render dashboard

4. **Environment Variables in Render:**
   ```
   OPENAI_API_KEY=sk-your_actual_openai_key
   OPENPHONE_API_KEY=your_actual_openphone_key  
   OPENPHONE_PHONE_NUMBER=+15873287465
   BUSINESS_NAME=Pink Chicken Speed Shop
   LABOR_RATE=80
   DND_ENABLED=true
   NODE_ENV=production
   ```

5. **Configure OpenPhone webhook:**
   - URL: `https://your-app.onrender.com/api/webhooks/openphone`
   - Events: "Message Received"
   - Method: POST

### **Option 2: Manual Deployment**

```bash
# Build and deploy
npm install --production
npm run build
npm start
```

## 📡 **API Endpoints**

### **Core Endpoints**
```bash
# Health & Status
GET  /health                          # Server health check
GET  /api/settings                    # Configuration status
GET  /                                # API information

# Webhooks  
POST /api/webhooks/openphone          # OpenPhone SMS webhook
GET  /api/webhooks/openphone          # Webhook verification

# Messages
GET  /api/messages                    # Get message history
POST /api/messages/reply              # Send manual reply
POST /api/messages/:id/read           # Mark message as read
GET  /api/messages/conversation/:phone # Get conversation history
GET  /api/messages/stats              # Message statistics

# Customers
GET  /api/customers                   # Get all customers
POST /api/customers                   # Create/update customer
GET  /api/customers/:id               # Get customer by ID
GET  /api/customers/phone/:phone      # Get customer by phone

# Quotes (Enhanced with AI + Scraping)
GET  /api/quotes                      # Get all quotes
POST /api/quotes                      # Generate new quote
GET  /api/quotes/:id                  # Get quote by ID
PUT  /api/quotes/:id/status           # Update quote status

# Appointments (PostgreSQL-backed)
GET  /api/appointments                # Get all appointments
POST /api/appointments                # Create new appointment
GET  /api/appointments/availability   # Check availability
PUT  /api/appointments/:id/reschedule # Reschedule appointment
DELETE /api/appointments/:id          # Cancel appointment

# Tech Sheets (AI-Generated)
GET  /api/tech-sheets                 # Get all tech sheets
POST /api/tech-sheets/generate        # Generate new tech sheet
GET  /api/tech-sheets/:id             # Get tech sheet by ID

# Notifications
POST /api/notifications/send          # Send manual notification
POST /api/notifications/business      # Send business notification
GET  /api/notifications/history       # Get notification history
GET  /api/notifications/stats         # Notification statistics

# Voice Calls (Sona Integration)
POST /api/calls/incoming              # Handle incoming call
POST /api/calls/conversation/:callId  # Process call conversation
POST /api/calls/complete/:callId      # Handle call completion
GET  /api/calls/active                # Get active calls
GET  /api/calls/stats                 # Call statistics
```

## 🤖 **AI Processing Features**

### **Intelligent Message Processing**
- **🎯 Intent Detection**: Quote requests, bookings, emergencies, general inquiries  
- **📝 Professional Responses**: Context-aware replies using GPT-4
- **⚡ Graceful Fallbacks**: Keyword-based responses when AI unavailable
- **🚨 Emergency Handling**: Automatic detection and priority response

### **Quote Generation Pipeline**
```
1. 📝 Parse customer request (AI)
2. 🔍 Scrape part prices (AutoValue, Amazon, PartSource)  
3. ⏱️ Look up labor hours (comprehensive database)
4. 💰 Calculate total cost ($80/hr + parts)
5. 📄 Generate formatted quote (AI)
6. 📱 Deliver via SMS or email
```

### **Appointment Booking System**
```
1. 📅 Parse booking request (AI)
2. ✅ Check availability (PostgreSQL + business hours)
3. ⚠️ Detect conflicts (real-time database queries)
4. 📆 Create appointment (PostgreSQL storage)
5. 📧 Send confirmations (SMS + email)
6. 🔔 Notify business owner
```

## 🗃️ **Database & Storage**

### **PostgreSQL Integration (Phase 1)**
```sql
-- Appointments Table
id, customer_name, customer_phone, customer_email,
vehicle_info, service_type, appointment_date, appointment_time,
duration, notes, status, created_at, updated_at

-- Messages Table (Future)
id, phone_number, body, direction, processed, 
intent, action, ai_response, created_at

-- Indexes for Performance
idx_appointments_date, idx_appointments_status, 
idx_messages_phone
```

### **Storage Strategy**
- **🐘 PostgreSQL**: Appointments, persistent data
- **💾 In-Memory**: Messages, temporary data (for now)
- **☁️ Google Calendar**: Coming in Phase 2
- **🔄 Auto-Migration**: Database schema updates on startup

## 🔍 **Monitoring & Health Checks**

### **Health Endpoint Response**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T20:50:00.000Z", 
  "environment": "production",
  "uptime": 3600,
  "memory": {...}
}
```

### **Settings API Response**
```json
{
  "success": true,
  "settings": {
    "openai_configured": true,
    "openphone_configured": true,
    "database_configured": true,
    "database_type": "postgresql",
    "database_status": "healthy",
    "business_name": "Pink Chicken Speed Shop",
    "labor_rate": 80,
    "dnd_enabled": true,
    "storage": "postgresql"
  }
}
```

## 🚨 **Error Handling & Fallbacks**

### **AI Fallback System**
When OpenAI API is unavailable:
- **🔍 Keyword Detection**: Service types, emergencies, bookings
- **📝 Template Responses**: Professional, context-appropriate
- **⚡ Instant Response**: No customer left hanging
- **📊 Transparent Logging**: Clear error tracking

### **Database Fallback**
When PostgreSQL is unavailable:
- **💾 In-Memory Storage**: Automatic fallback
- **🔄 Data Recovery**: Reconnection attempts
- **📝 Graceful Degradation**: Core functionality maintained
- **⚠️ Status Reporting**: Clear system status

### **SMS Delivery Resilience**
- **🔄 Multiple Auth Methods**: Different OpenPhone API formats
- **📊 Detailed Error Reporting**: Specific failure reasons
- **⏰ Retry Logic**: Automatic retry for transient failures
- **🛡️ Rate Limit Handling**: Graceful backoff

## 🔐 **Security & Best Practices**

### **API Key Management**
- ✅ Environment variable storage only
- ✅ Masked display in API responses (`••••••••sk-1234`)
- ✅ No logging of sensitive data
- ✅ HTTPS-only transmission

### **Data Protection**
- ✅ Minimal data retention by default
- ✅ Secure database connections (SSL in production)
- ✅ No persistent customer data without consent
- ✅ GDPR compliance ready

### **Network Security**  
- ✅ CORS properly configured for frontend domains
- ✅ Request validation and sanitization
- ✅ Error handling without data exposure
- ✅ Webhook payload validation

## 🧪 **Testing Your Installation**

### **1. Basic Health Checks**
```bash
# Server health
curl https://torquegpt.onrender.com/health

# API configuration
curl https://torquegpt.onrender.com/api/settings

# Database status  
curl https://torquegpt.onrender.com/api/appointments
```

### **2. Webhook Testing**
```bash
# Test webhook endpoint
curl https://torquegpt.onrender.com/api/webhooks/openphone

# Mock webhook payload
curl -X POST https://torquegpt.onrender.com/api/webhooks/openphone \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### **3. End-to-End SMS Test**
1. **Send SMS** to your OpenPhone number:
   ```
   "Hi, I need a quote for brake pads on my 2019 Honda Civic"
   ```

2. **Expected Response** (within 5 seconds):
   ```
   "Hi! I'd be happy to help with brake pads for your 2019 Honda Civic. 
   Based on $80/hr labor + parts, I estimate around $150-200. 
   When would you like to schedule the service?"
   ```

3. **Check Logs** for processing confirmation

## 📊 **Performance & Costs**

### **OpenAI Usage Optimization**
- **Model**: GPT-4o (cost-efficient)
- **Token Limits**: 600 max tokens per response
- **Fallbacks**: Reduce API calls when rate limited
- **Context Management**: Smart conversation history limiting

### **Render Resource Usage**
- **Free Tier**: 750 hours/month (adequate for small shops)
- **Sleep Mode**: 15-minute inactivity shutdown
- **Cold Starts**: 30-60 second wake-up time
- **Upgrade Path**: $7/month for always-on service

### **Database Performance**
- **Free PostgreSQL**: 1GB storage, 97 connection limit
- **Indexing**: Optimized queries for appointments/availability
- **Connection Pooling**: Efficient database connection management
- **Migration System**: Automatic schema updates

## 🔧 **Troubleshooting Guide**

### **Common Issues**

#### **❌ "Webhook Not Working"**
1. **Check OpenPhone webhook URL**: `https://your-app.onrender.com/api/webhooks/openphone`
2. **Verify webhook events**: "Message Received" selected
3. **Test webhook endpoint**: Should return 200 OK
4. **Check Render logs**: Look for incoming webhook logs
5. **Verify phone number**: OPENPHONE_PHONE_NUMBER matches your number

#### **❌ "AI Not Responding"** 
1. **Check API key**: Valid OpenAI key with credits
2. **Test settings API**: Shows `openai_configured: true`
3. **Check rate limits**: OpenAI usage within limits
4. **Verify DND setting**: `DND_ENABLED=true` 
5. **Fallback system**: Should still provide responses

#### **❌ "SMS Not Sending"**
1. **Check OpenPhone API key**: Valid and has permissions
2. **Verify phone number format**: `+15873287465`
3. **Test SMS delivery**: Send manual message via API
4. **Check OpenPhone credits**: Account has SMS credits
5. **Review API errors**: Specific error messages in logs

#### **❌ "Database Connection Failed"**
1. **Check DATABASE_URL**: Properly formatted connection string
2. **Verify PostgreSQL service**: Database service is running
3. **Test connection**: Settings API shows database status
4. **Fallback mode**: System should work with in-memory storage
5. **Check logs**: Database connection error details

#### **❌ "Appointments Not Persisting"**
1. **Database connectivity**: PostgreSQL connected and healthy
2. **Migration status**: Database tables created successfully  
3. **API testing**: POST /api/appointments returns success
4. **Storage verification**: GET /api/appointments shows data
5. **Conflict detection**: Availability checking works properly

### **Debug Commands**
```bash
# Complete system check
curl https://torquegpt.onrender.com/api/settings | jq

# Test each major component
curl https://torquegpt.onrender.com/health
curl https://torquegpt.onrender.com/api/webhooks/openphone  
curl https://torquegpt.onrender.com/api/appointments
curl https://torquegpt.onrender.com/api/messages

# Test appointment creation
curl -X POST https://torquegpt.onrender.com/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Test Customer", 
    "customer_phone": "+1234567890",
    "preferred_date": "2024-01-20",
    "preferred_time": "10:00",
    "service_type": "Oil Change"
  }'
```

## 📈 **Future Roadmap**

### **Phase 2: Google Calendar Integration** 🔜
- ✅ Real calendar events for customers
- ✅ Automatic appointment reminders  
- ✅ Calendar sharing with customers
- ✅ Integration with existing calendar systems

### **Phase 3: Advanced Features** 🚀
- 🔮 Voice call integration (Sona AI)
- 📊 Advanced analytics dashboard
- 🤖 Custom AI model training
- 📱 Mobile app for technicians
- 💳 Payment processing integration

### **Phase 4: Enterprise Features** 🏢
- 👥 Multi-location support
- 📈 Advanced reporting
- 🔗 CRM integrations
- 🎯 Marketing automation
- 📋 Inventory management

## 📄 **Environment Variables Reference**

```bash
# Required - Core Functionality
OPENAI_API_KEY=sk-your_openai_key          # OpenAI API access
OPENPHONE_API_KEY=your_openphone_key       # OpenPhone SMS API
OPENPHONE_PHONE_NUMBER=+15873287465        # Your business phone

# Required - Business Settings  
BUSINESS_NAME="Pink Chicken Speed Shop"    # Your business name
LABOR_RATE=80                             # Hourly labor rate
DND_ENABLED=true                          # Enable auto-responses

# Optional - Database
DATABASE_URL=postgresql://...              # PostgreSQL connection

# Optional - Email Integration
SMTP_HOST=smtp.gmail.com                  # Email server
SMTP_PORT=587                             # Email port
SMTP_USER=your_email@gmail.com            # Email username
SMTP_PASS=your_app_password               # Email password

# Optional - Business Notifications
BUSINESS_EMAIL=owner@yourshop.com         # Owner notification email
BUSINESS_SMS=+1234567890                  # Owner notification SMS

# Optional - Advanced
SONA_API_KEY=your_sona_key               # Voice AI integration
FRONTEND_URL=https://yourfrontend.com     # CORS configuration
NODE_ENV=production                       # Environment mode
PORT=10000                               # Server port
LOG_LEVEL=info                           # Logging level
```

## 🤝 **Support & Contributing**

### **Getting Help**
- 📖 **Documentation**: Check this README and API documentation
- 🐛 **Issues**: Report bugs via GitHub issues
- 💬 **Discussions**: Ask questions in GitHub discussions
- 📧 **Contact**: For urgent issues or business inquiries

### **Contributing**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (health checks, SMS flow, appointments)
5. Submit a pull request

### **Built With**
- **🚀 [Bolt.new](https://bolt.new)**: AI-powered development
- **🟢 Node.js**: Runtime environment
- **⚡ Express.js**: Web framework
- **🤖 OpenAI GPT-4**: AI processing
- **📱 OpenPhone**: SMS integration
- **🐘 PostgreSQL**: Database storage
- **☁️ Render**: Cloud hosting

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.

---

**🚗 ShopSenseAI Backend** - Turning automotive service into an AI-powered experience!

*Instant quotes. Automated booking. More wrench time.* ⚡

**Built with [Bolt.new](https://bolt.new)** - The future of AI-powered development.