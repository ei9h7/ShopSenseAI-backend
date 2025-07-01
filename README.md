# ShopSenseAI Webhook Server

> **Built with [Bolt.new](https://bolt.new)** ⚡

This is the standalone webhook server for ShopSenseAI that handles OpenPhone webhooks and processes messages with AI.

## 🚀 Production Deployment

**Live Server**: https://torquegpt.onrender.com

### **Key Features**
- **OpenPhone Webhook Processing**: Receives and processes SMS messages
- **AI Message Processing**: Uses OpenAI GPT-4 for intelligent responses
- **Graceful Fallback System**: Ensures customers always get responses
- **Emergency Detection**: Prioritizes urgent messages
- **Settings API**: Provides server configuration to frontend
- **Health Monitoring**: Comprehensive health checks and logging

## 🔧 Quick Start

### Local Development

1. **Navigate to server directory**
   ```bash
   cd server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your API keys:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   OPENPHONE_API_KEY=your_openphone_api_key_here
   OPENPHONE_PHONE_NUMBER=your_openphone_number_here
   BUSINESS_NAME=Pink Chicken Speed Shop
   LABOR_RATE=80
   DND_ENABLED=true
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```
   Server will run on http://localhost:10000

### Production Build

```bash
npm run build
npm start
```

## 🌐 Deployment on Render

### 1. Prepare for Deployment

1. Create a Render account at [render.com](https://render.com)
2. Connect your GitHub repository

### 2. Deploy

1. Create a new **Web Service** on Render
2. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

### 3. Set Environment Variables

In your Render dashboard, add these environment variables:

```
OPENAI_API_KEY=your_openai_api_key_here
OPENPHONE_API_KEY=your_openphone_api_key_here
OPENPHONE_PHONE_NUMBER=your_openphone_number_here
BUSINESS_NAME=Pink Chicken Speed Shop
LABOR_RATE=80
DND_ENABLED=true
NODE_ENV=production
```

### 4. Get Your Webhook URL

After deployment, your webhook URL will be:
`https://your-app-name.onrender.com/api/webhooks/openphone`

### 5. Configure OpenPhone

1. Go to your OpenPhone dashboard
2. Navigate to Settings → Webhooks
3. Add a new webhook with your Render URL
4. Select "Message Received" as the trigger event
5. Save the configuration

## 📡 API Endpoints

### **Health Check**
```bash
GET /health
```
Returns server status and environment information.

### **Settings API**
```bash
GET /api/settings
```
Returns API key configuration status and business settings.

### **Messages API**
```bash
GET /api/messages
POST /api/messages/reply
POST /api/messages/:id/read
```
Manages message history and manual replies.

### **Webhook Endpoint**
```bash
POST /api/webhooks/openphone
```
Processes incoming OpenPhone webhook events.

## 🤖 AI Processing Features

### **Intelligent Message Processing**
- **Professional Responses**: Generates appropriate replies for automotive service inquiries
- **Quote Generation**: Calculates estimates using $80/hr labor rate
- **Intent Classification**: Identifies message types (Emergency, Quote Request, Booking, etc.)
- **Action Recommendations**: Suggests follow-up actions for staff

### **Graceful Fallback System**
When OpenAI API is unavailable, the system uses intelligent keyword-based responses:

- **Emergency Detection**: `emergency`, `urgent`, `breakdown`, `stranded`, `accident`
- **Service Requests**: `oil change`, `service`, `maintenance`, `tune up`
- **Quote Requests**: `quote`, `price`, `cost`, `estimate`
- **Repair Issues**: `problem`, `issue`, `broken`, `noise`, `leak`
- **Booking Requests**: `appointment`, `schedule`, `book`, `available`

### **Emergency Handling**
- Automatic detection of urgent messages
- Immediate response with callback promise
- Priority alerts for staff attention
- Override of Do Not Disturb settings

## 🔍 Monitoring & Debugging

### **Health Checks**
```bash
# Check server status
curl https://torquegpt.onrender.com/health

# Check settings configuration
curl https://torquegpt.onrender.com/api/settings
```

### **Webhook Testing**
```bash
# Test webhook endpoint
curl -X POST https://torquegpt.onrender.com/api/webhooks/openphone \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'
```

### **Log Monitoring**
The server provides comprehensive logging:
- 📨 Message processing events
- 🤖 AI response generation
- 📤 SMS sending status
- ⚠️ Error handling and fallbacks
- 🔍 Webhook payload validation

## 🛡️ Error Handling

### **AI Fallback Scenarios**
- **Rate Limits**: Uses intelligent keyword responses
- **No Credits**: Maintains professional communication
- **Network Issues**: Ensures customer never goes unanswered
- **Invalid API Keys**: Graceful degradation with logging

### **SMS Delivery**
- **Multiple Auth Methods**: Tries different OpenPhone API formats
- **Detailed Error Reporting**: Specific error messages for troubleshooting
- **Retry Logic**: Automatic retry for transient failures

### **Webhook Processing**
- **Payload Validation**: Ensures only valid messages are processed
- **Direction Filtering**: Ignores outbound messages to prevent loops
- **Error Recovery**: Continues processing even if individual messages fail

## 🔐 Security Features

### **API Key Management**
- Environment variable storage only
- Masked display in API responses
- No logging of sensitive data
- Secure transmission over HTTPS

### **Webhook Security**
- HTTPS-only endpoints
- Payload validation
- Request logging for monitoring
- Error handling without data exposure

## 📈 Performance Optimization

### **Cost Efficiency**
- Uses GPT-4o-mini for reduced costs
- Token limits to control usage
- Intelligent fallbacks reduce API calls
- Efficient message processing

### **Reliability**
- Multiple authentication methods
- Comprehensive error handling
- Health check endpoints
- Graceful degradation

## 🚨 Troubleshooting

### **Common Issues**

#### **Webhook Not Working**
1. Check OpenPhone webhook URL configuration
2. Verify server is running (`/health` endpoint)
3. Check Render logs for incoming requests
4. Ensure webhook URL uses HTTPS

#### **AI Not Responding**
1. Verify OpenAI API key is valid and has credits
2. Check server environment variables
3. Monitor logs for AI processing errors
4. Fallback system should still provide responses

#### **SMS Not Sending**
1. Verify OpenPhone API key and permissions
2. Check phone number format (+1234567890)
3. Monitor logs for OpenPhone API errors
4. Test with OpenPhone API directly

### **Debug Commands**
```bash
# Check environment variables
curl https://torquegpt.onrender.com/api/settings

# Monitor real-time logs
# (Available in Render dashboard)

# Test message processing
# Send SMS to your OpenPhone number
```

## 🎯 Future Enhancements

### **Planned Features**
- **Database Integration**: PostgreSQL for message persistence
- **Analytics**: Message volume and response rate tracking
- **Rate Limiting**: Protection against abuse
- **Webhook Signing**: Enhanced security validation
- **Multi-Language**: Support for different languages

### **Scalability**
- **Redis Caching**: For high-volume message handling
- **Load Balancing**: Multiple server instances
- **Database Clustering**: For enterprise use
- **Monitoring**: Advanced metrics and alerting

## 📄 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key for AI processing | ✅ | - |
| `OPENPHONE_API_KEY` | OpenPhone API key for SMS | ✅ | - |
| `OPENPHONE_PHONE_NUMBER` | Your OpenPhone number | ✅ | - |
| `BUSINESS_NAME` | Your business name | ❌ | `Pink Chicken Speed Shop` |
| `LABOR_RATE` | Hourly labor rate | ❌ | `80` |
| `DND_ENABLED` | Enable auto-responses | ❌ | `true` |
| `NODE_ENV` | Environment mode | ❌ | `production` |
| `PORT` | Server port | ❌ | `10000` |

## 🤝 Contributing

This server was built with [Bolt.new](https://bolt.new). To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

**ShopSenseAI Webhook Server** - Reliable, intelligent, and always responsive! 🚗⚡

Built with [Bolt.new](https://bolt.new) - The future of AI-powered development.