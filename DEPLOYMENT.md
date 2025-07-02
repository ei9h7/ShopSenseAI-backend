# ShopSenseAI Backend Deployment Guide

> **Built with [Bolt.new](https://bolt.new)** ⚡

Complete deployment guide for the ShopSenseAI backend API.

## 🎯 Overview

The ShopSenseAI backend is a standalone API server with PostgreSQL database integration. This guide covers deploying to Render with automatic database provisioning.

## 🚀 Production Architecture

```
Frontend (Any Host) ←→ Backend API (Render) ←→ External APIs
    │                       │                    │
    │                       │                    ├── OpenAI GPT-4
    │                       │                    ├── OpenPhone SMS
    │                       │                    └── PostgreSQL Database
    │                       │
    └── React/Vue/Any       ├── Express.js API
        Frontend            ├── PostgreSQL Storage
        Static hosting      ├── AI Integration
        Environment:        ├── SMS Handling
        - Netlify/Vercel    └── Appointment System
```

## 📋 Prerequisites

### **Required Accounts & Keys**
- [Render account](https://render.com) for backend hosting
- [OpenAI API key](https://platform.openai.com/api-keys) for AI processing
- [OpenPhone account](https://app.openphone.com) with API access
- GitHub repository with backend code

## 🔧 Backend Deployment to Render

### **Step 1: Prepare Repository**

The repository structure:
```
shopsenseai-backend/
├── controllers/         # HTTP request handlers
├── services/           # Business logic
├── routes/             # API endpoint definitions
├── utils/              # Logging and utilities
├── config/             # Database and environment config
├── scripts/            # Migration scripts
├── index.js            # Main server file
├── package.json        # Dependencies
├── render.yaml         # Render configuration (auto-deploy)
├── .env.example        # Environment template
└── README.md           # Documentation
```

### **Step 2: Create Render Service**

1. **Sign up/Login** to [Render](https://render.com)

2. **Create New Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Render will detect `render.yaml` automatically

3. **Configure Service**
   - **Name**: `shopsenseai-backend`
   - **Branch**: `main`
   - **Root Directory**: Leave empty
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free tier (or upgrade for production)

### **Step 3: Environment Variables**

Add these environment variables in Render dashboard:

```env
# Required API Keys
OPENAI_API_KEY=sk-your_actual_openai_key_here
OPENPHONE_API_KEY=your_actual_openphone_key_here
OPENPHONE_PHONE_NUMBER=+1234567890

# Business Configuration
BUSINESS_NAME=Your Shop Name
LABOR_RATE=80
DND_ENABLED=true

# Database (Auto-configured by render.yaml)
DATABASE_URL=postgresql://...

# Server Configuration
NODE_ENV=production
PORT=10000

# Frontend Configuration (Optional)
FRONTEND_URL=https://your-frontend.netlify.app
```

### **Step 4: Deploy**

1. **Deploy Service**
   - Click "Create Web Service"
   - Render automatically creates PostgreSQL database
   - Backend connects to database on startup
   - Monitor build logs for any issues

2. **Verify Deployment**
   ```bash
   # Test health endpoint
   curl https://your-backend.onrender.com/health
   
   # Expected response:
   {
     "status": "ok",
     "timestamp": "2024-01-15T10:30:00.000Z",
     "environment": "production",
     "uptime": 3600
   }
   
   # Test database integration
   curl https://your-backend.onrender.com/api/settings
   
   # Expected response with database status:
   {
     "success": true,
     "settings": {
       "database_configured": true,
       "database_type": "postgresql",
       "database_status": "healthy"
     }
   }
   ```

3. **Get Service URL**
   - Note your service URL: `https://your-backend.onrender.com`
   - This will be your API base URL

## 📱 Configure OpenPhone Webhook

### **Step 1: Access OpenPhone Dashboard**
1. Go to [app.openphone.com](https://app.openphone.com)
2. Navigate to **Settings** → **Webhooks**

### **Step 2: Add Webhook**
1. **Click "Add Webhook"**
2. **Configure webhook**:
   - **URL**: `https://your-backend.onrender.com/api/webhooks/openphone`
   - **Events**: Select **"Message Received"**
   - **Description**: `ShopSenseAI Backend Webhook`
   - **Method**: POST
3. **Save webhook configuration**

### **Step 3: Test Webhook**
1. **Send test SMS** to your OpenPhone number
2. **Check Render logs** for incoming webhook
3. **Verify processing** in application logs
4. **Confirm SMS response** is sent back

## 🔍 Verification & Testing

### **Health Checks**

1. **Backend Health**
   ```bash
   curl https://your-backend.onrender.com/health
   ```

2. **Database Status**
   ```bash
   curl https://your-backend.onrender.com/api/settings
   ```

3. **Appointments API**
   ```bash
   curl https://your-backend.onrender.com/api/appointments
   ```

4. **Webhook Endpoint**
   ```bash
   curl https://your-backend.onrender.com/api/webhooks/openphone
   ```

### **End-to-End Testing**

1. **Send SMS** to your OpenPhone number:
   ```
   "Book Friday at 2pm for oil change - John"
   ```

2. **Expected Flow**:
   - 📱 SMS received and processed
   - 🤖 AI generates response
   - 📅 Appointment created in PostgreSQL
   - 📱 Confirmation sent back

3. **Verify Appointment Created**:
   ```bash
   curl https://your-backend.onrender.com/api/appointments
   # Should show the new appointment
   ```

4. **Test Conflict Detection**:
   ```
   Send another SMS: "Book Friday at 2pm for brake service - Jane"
   # Should detect conflict and suggest alternatives
   ```

### **Error Monitoring**

Monitor Render logs for:
- ✅ Successful webhook processing
- ✅ Database connections and migrations
- ✅ AI response generation
- ✅ SMS delivery success
- ✅ Appointment creation and conflict detection
- ❌ API errors or failures
- ❌ Authentication issues
- ❌ Database connection issues

## 🚨 Troubleshooting

### **Common Deployment Issues**

#### **1. Build Failures**
```bash
# Solutions:
- Check Render build logs
- Ensure all dependencies in package.json
- Verify Node.js 18+ compatibility
- Check for syntax errors in code
```

#### **2. Environment Variables**
```bash
# Solutions:
- Double-check all environment variables in Render
- Test API keys independently
- Verify OPENPHONE_PHONE_NUMBER format (+1234567890)
- Check OPENAI_API_KEY has credits
```

#### **3. Database Connection Issues**
```bash
# Check database status via settings API
curl https://your-backend.onrender.com/api/settings

# Solutions:
- Verify PostgreSQL service is created
- Check DATABASE_URL format in environment variables
- Monitor logs for migration errors
- System falls back to in-memory if database fails
```

#### **4. Webhook Not Working**
```bash
# Test webhook endpoint directly
curl https://your-backend.onrender.com/api/webhooks/openphone

# Solutions:
- Verify webhook URL in OpenPhone: https://your-backend.onrender.com/api/webhooks/openphone
- Check webhook events: "Message Received" selected
- Ensure HTTPS (not HTTP)
- Monitor Render logs for incoming webhooks
```

#### **5. Appointments Not Persisting**
```bash
# Test appointment creation
curl -X POST https://your-backend.onrender.com/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"Test","preferred_date":"2024-01-20","preferred_time":"10:00"}'

# Solutions:
- Check database connection status
- Verify migrations completed successfully
- Monitor logs for database errors
- Test with simple appointment data
```

### **Debug Commands**

```bash
# Test backend health
curl https://your-backend.onrender.com/health

# Test settings endpoint (includes database status)
curl https://your-backend.onrender.com/api/settings

# Test database integration
curl https://your-backend.onrender.com/api/appointments

# Test webhook
curl -X POST https://your-backend.onrender.com/api/webhooks/openphone \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Test appointment creation
curl -X POST https://your-backend.onrender.com/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Test Customer",
    "customer_phone": "+1234567890", 
    "preferred_date": "2024-01-20",
    "preferred_time": "10:00",
    "service_type": "Oil Change"
  }'
```

## 📈 Performance & Scaling

### **Free Tier Limitations**
- **Render Free**: Service sleeps after 15 min inactivity
- **PostgreSQL Free**: 1GB storage, 97 connections
- **Cold Starts**: 30-60 second wake-up time
- **Usage Limits**: 750 hours/month

### **Production Recommendations**
- **Upgrade to Paid Tier**: $7/month for always-on service
- **Database Upgrade**: More storage and connections
- **Monitoring**: Set up uptime monitoring
- **Backup**: Regular data backups

### **Scaling Considerations**
- **Database Scaling**: PostgreSQL performance optimization
- **Connection Pooling**: Optimize database connections
- **Horizontal Scaling**: Multiple server instances
- **Load Balancing**: Distribute traffic
- **Monitoring**: Application performance monitoring

## 🔐 Security Best Practices

### **API Key Management**
- ✅ Store keys as environment variables only
- ✅ Never commit keys to version control
- ✅ Rotate keys regularly
- ✅ Monitor for unauthorized usage
- ✅ Use masked display in APIs

### **Network Security**
- ✅ HTTPS only for all endpoints
- ✅ CORS properly configured
- ✅ Input validation on all endpoints
- ✅ Rate limiting (implement when needed)
- ✅ Error handling without data exposure

### **Data Protection**
- ✅ Minimal data retention
- ✅ PostgreSQL SSL connections in production
- ✅ Secure data transmission
- ✅ Proper database access controls
- ✅ Audit logging
- ✅ GDPR compliance ready

## 📊 Monitoring & Maintenance

### **Daily Checks**
- ✅ Health endpoint responding
- ✅ Database connectivity healthy
- ✅ Webhook processing messages
- ✅ AI responses being sent
- ✅ Appointments persisting correctly
- ✅ No error spikes in logs
- ✅ API key usage within limits

### **Weekly Checks**
- ✅ Review error logs
- ✅ Database performance metrics
- ✅ Check API usage trends
- ✅ Monitor performance metrics
- ✅ Verify backup systems
- ✅ Verify backup systems
- ✅ Update dependencies if needed

### **Monthly Checks**
- ✅ Rotate API keys
- ✅ Database maintenance and optimization
- ✅ Review and optimize code
- ✅ Monitor database storage usage
- ✅ Update documentation
- ✅ Plan scaling requirements
- ✅ Review security practices

## 🎯 Success Checklist

### **Deployment Complete** ✅
- [ ] Backend deployed to Render
- [ ] PostgreSQL database provisioned  
- [ ] All environment variables configured
- [ ] Health check returns 200 OK
- [ ] Settings API shows database connected
- [ ] Appointments API works (create/read)
- [ ] OpenPhone webhook configured
- [ ] SMS messages are processed
- [ ] AI responses are generated
- [ ] Appointments persist after server restart
- [ ] Conflict detection works
- [ ] Error logging is working

### **Production Ready** ✅
- [ ] Monitoring setup
- [ ] Backup strategy in place
- [ ] Database migration system working
- [ ] Documentation updated
- [ ] Team trained on system
- [ ] Emergency procedures documented
- [ ] Performance baseline established
- [ ] Security review completed

## 🚀 Next Steps

### **Immediate**
1. **Monitor system** for first 24 hours
2. **Verify database performance** with real appointments
2. **Test thoroughly** with real customer messages
3. **Test conflict detection** with overlapping bookings
4. **Document processes** for daily operations

### **Short Term (1-4 weeks)**
1. **Optimize database** queries and indexes
2. **Implement monitoring** and alerting
3. **Add message persistence** to PostgreSQL
4. **Add automated tests** for reliability

### **Long Term (1-3 months)**
1. **Google Calendar integration** (Phase 2)
1. **Scale infrastructure** based on growth
2. **Add analytics dashboard** with PostgreSQL queries
3. **Integrate additional services** (calendar, CRM)
4. **Expand AI capabilities** with custom models

---

**ShopSenseAI Backend** with PostgreSQL integration is now deployed and ready to power your automotive service business! 🚗⚡⚡

*Built with [Bolt.new](https://bolt.new) - The future of AI-powered development.*