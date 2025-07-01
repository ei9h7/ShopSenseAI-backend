# ShopSenseAI Backend Deployment Guide

> **Built with [Bolt.new](https://bolt.new)** ⚡

Complete deployment guide for the ShopSenseAI backend API.

## 🎯 Overview

The ShopSenseAI backend is designed to work with the frontend deployed on Netlify. This guide covers deploying the backend to Render and configuring the complete system.

## 🚀 Production Architecture

```
Frontend (Netlify) ←→ Backend API (Render) ←→ External APIs
    │                       │                    │
    │                       │                    ├── OpenAI GPT-4
    │                       │                    ├── OpenPhone SMS
    │                       │                    └── Future integrations
    │                       │
    └── React SPA           ├── Express.js API
        Vite build          ├── Message processing
        Static assets       ├── AI integration
        Environment:        ├── SMS handling
        - Netlify           └── Database ready
```

## 📋 Prerequisites

### **Required Accounts & Keys**
- [Render account](https://render.com) for backend hosting
- [OpenAI API key](https://platform.openai.com/api-keys) for AI processing
- [OpenPhone account](https://app.openphone.com) with API access
- GitHub repository with this backend code

### **Frontend Deployment**
Ensure your frontend is deployed to Netlify first:
- Frontend URL: https://your-frontend.netlify.app
- Update CORS settings in this backend if needed

## 🔧 Backend Deployment to Render

### **Step 1: Prepare Repository**

Ensure your repository has the backend structure:
```
shopsenseai-backend/
├── controllers/         # HTTP request handlers
├── services/           # Business logic
├── routes/             # API endpoint definitions
├── utils/              # Logging and utilities
├── index.js            # Main server file
├── package.json        # Dependencies
├── .env.example        # Environment template
└── README.md           # Documentation
```

### **Step 2: Create Render Service**

1. **Sign up/Login** to [Render](https://render.com)

2. **Create New Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select the backend repository

3. **Configure Service**
   - **Name**: `shopsenseai-backend`
   - **Branch**: `main`
   - **Root Directory**: Leave empty (backend is at root)
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
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

# Server Configuration
NODE_ENV=production
PORT=10000

# Frontend Configuration
FRONTEND_URL=https://your-frontend.netlify.app
```

### **Step 4: Deploy**

1. **Deploy Service**
   - Click "Create Web Service"
   - Render will automatically build and deploy
   - Monitor build logs for any issues

2. **Verify Deployment**
   ```bash
   # Test health endpoint
   curl https://your-backend.onrender.com/health
   
   # Expected response:
   {
     "status": "ok",
     "timestamp": "2024-01-15T10:30:00.000Z",
     "environment": "production"
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

## 🌐 Frontend Configuration

### **Update Frontend API URL**

Ensure your frontend is configured to use your backend:

```javascript
// In frontend .env or config
VITE_API_BASE_URL=https://your-backend.onrender.com
```

### **CORS Verification**

Verify your frontend domain is allowed in backend CORS:

```javascript
// In backend index.js
app.use(cors({
    origin: [
        'https://your-frontend.netlify.app',
        'https://shopsenseai.app',
        'https://localhost:5173' // For development
    ],
    credentials: true
}));
```

## 🔍 Verification & Testing

### **Health Checks**

1. **Backend Health**
   ```bash
   curl https://your-backend.onrender.com/health
   ```

2. **Settings API**
   ```bash
   curl https://your-backend.onrender.com/api/settings
   ```

3. **Webhook Endpoint**
   ```bash
   curl https://your-backend.onrender.com/api/webhooks/openphone
   ```

### **End-to-End Testing**

1. **Send SMS** to your OpenPhone number
2. **Check frontend** Messages page for incoming message
3. **Verify AI response** is sent back via SMS
4. **Test manual reply** from frontend
5. **Check all API endpoints** work from frontend

### **Error Monitoring**

Monitor Render logs for:
- ✅ Successful webhook processing
- ✅ AI response generation
- ✅ SMS delivery success
- ❌ API errors or failures
- ❌ Authentication issues

## 🚨 Troubleshooting

### **Common Deployment Issues**

#### **1. Build Failures**
```bash
# Check package.json structure
# Ensure all dependencies are listed
# Verify Node.js version compatibility

# Solutions:
- Check Render build logs
- Ensure package.json is correct
- Verify Node 18+ compatibility
```

#### **2. Environment Variables**
```bash
# Check all required vars are set
# Verify API keys are valid

# Solutions:
- Double-check all environment variables in Render
- Test API keys independently
- Ensure proper formatting
```

#### **3. Webhook Not Working**
```bash
# Check OpenPhone webhook configuration
# Verify endpoint is accessible

# Solutions:
- Confirm webhook URL: https://your-backend.onrender.com/api/webhooks/openphone
- Check HTTPS is working
- Verify OpenPhone webhook events
- Monitor Render logs for incoming requests
```

#### **4. CORS Issues**
```bash
# Frontend can't connect to backend

# Solutions:
- Add frontend domain to CORS whitelist
- Check browser console for CORS errors
- Verify frontend API_BASE_URL is correct
```

#### **5. API Key Issues**
```bash
# AI or SMS not working

# Solutions:
- Verify OpenAI API key has credits
- Check OpenPhone API key permissions
- Test API keys with curl commands
- Monitor API usage limits
```

### **Debug Commands**

```bash
# Test backend health
curl https://your-backend.onrender.com/health

# Test settings endpoint
curl https://your-backend.onrender.com/api/settings

# Test webhook endpoint
curl -X POST https://your-backend.onrender.com/api/webhooks/openphone \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Test message API
curl https://your-backend.onrender.com/api/messages
```

## 📈 Performance & Scaling

### **Free Tier Limitations**
- **Render Free**: Service sleeps after 15 min inactivity
- **Cold Starts**: 30-60 second wake-up time
- **Usage Limits**: 750 hours/month

### **Production Recommendations**
- **Upgrade to Paid Tier**: $7/month for always-on service
- **Database**: Add PostgreSQL for data persistence
- **Monitoring**: Set up uptime monitoring
- **Backup**: Regular data backups
- **CDN**: Consider CDN for static assets

### **Scaling Considerations**
- **Horizontal Scaling**: Multiple backend instances
- **Load Balancer**: Distribute traffic
- **Database**: Separate database server
- **Cache**: Redis for session/data caching
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
- ✅ Secure data transmission
- ✅ No persistent customer data (by default)
- ✅ Audit logging
- ✅ GDPR compliance ready

## 📊 Monitoring & Maintenance

### **Daily Checks**
- ✅ Health endpoint responding
- ✅ Webhook processing messages
- ✅ AI responses being sent
- ✅ No error spikes in logs
- ✅ API key usage within limits

### **Weekly Checks**
- ✅ Review error logs
- ✅ Check API usage trends
- ✅ Monitor performance metrics
- ✅ Verify backup systems
- ✅ Update dependencies if needed

### **Monthly Checks**
- ✅ Rotate API keys
- ✅ Review and optimize code
- ✅ Update documentation
- ✅ Plan scaling requirements
- ✅ Review security practices

## 🎯 Success Checklist

### **Deployment Complete** ✅
- [ ] Backend deployed to Render
- [ ] All environment variables configured
- [ ] Health check returns 200 OK
- [ ] Settings API shows configured keys
- [ ] OpenPhone webhook configured
- [ ] Frontend connects to backend
- [ ] SMS messages are processed
- [ ] AI responses are generated
- [ ] Manual replies work from frontend
- [ ] Error logging is working

### **Production Ready** ✅
- [ ] Monitoring setup
- [ ] Backup strategy in place
- [ ] Documentation updated
- [ ] Team trained on system
- [ ] Emergency procedures documented
- [ ] Performance baseline established
- [ ] Security review completed

## 🚀 Next Steps

### **Immediate**
1. **Monitor system** for first 24 hours
2. **Test thoroughly** with real customer messages
3. **Train team** on new system capabilities
4. **Document processes** for daily operations

### **Short Term (1-4 weeks)**
1. **Add database** for data persistence
2. **Implement monitoring** and alerting
3. **Optimize performance** based on usage
4. **Add automated tests** for reliability

### **Long Term (1-3 months)**
1. **Scale infrastructure** based on growth
2. **Add advanced features** (analytics, reporting)
3. **Integrate additional services** (calendar, CRM)
4. **Expand AI capabilities** with custom models

---

**ShopSenseAI Backend** is now deployed and ready to power your automotive service business! 🚗⚡

*Built with [Bolt.new](https://bolt.new) - The future of AI-powered development.*