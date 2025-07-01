# 🔍 Webhook Debugging Guide

## **Step 1: Verify Server is Running**

Test your server health:
```bash
curl https://torquegpt.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T20:50:00.000Z",
  "environment": "production"
}
```

## **Step 2: Test Webhook Endpoint Directly**

Test the webhook endpoint:
```bash
curl https://torquegpt.onrender.com/api/webhooks/openphone
```

**Expected Response:**
```json
{
  "message": "OpenPhone webhook endpoint is active",
  "timestamp": "2024-01-15T20:50:00.000Z",
  "server": "ShopSenseAI Backend"
}
```

## **Step 3: Test Webhook with Mock Data**

Send a test webhook payload:
```bash
curl -X POST https://torquegpt.onrender.com/api/webhooks/openphone \
  -H "Content-Type: application/json" \
  -d '{
    "object": "event",
    "data": {
      "object": {
        "object": "message",
        "direction": "incoming",
        "from": "+1234567890",
        "body": "Test message",
        "phoneNumberId": "test-id"
      }
    }
  }'
```

**Expected Response:**
```json
{
  "received": true,
  "processed": true,
  "timestamp": "2024-01-15T20:50:00.000Z"
}
```

## **Step 4: Check Your OpenPhone Webhook Configuration**

In OpenPhone Dashboard:

### **Current Settings Should Be:**
- **URL**: `https://torquegpt.onrender.com/api/webhooks/openphone`
- **Events**: ✅ "Message Received"
- **Method**: POST
- **Status**: Active

### **Test Webhook in OpenPhone:**
1. Go to **Settings** → **Webhooks**
2. Find your webhook
3. Click **"Test Webhook"** button
4. Should see success response

## **Step 5: Check Render Logs**

In Render Dashboard:
1. Go to your service
2. Click **"Logs"** tab
3. Send a test SMS
4. Watch for incoming webhook logs

**Look for these log entries:**
```
[INFO] OpenPhone webhook received
[INFO] Processing incoming message
[SUCCESS] Message processed successfully
```

## **Step 6: Common Issues & Solutions**

### **Issue 1: Server Not Accessible**
**Symptoms:** Health check fails
**Solution:** 
- Check Render deployment status
- Verify environment variables are set
- Restart service if needed

### **Issue 2: Webhook URL Wrong**
**Symptoms:** OpenPhone shows webhook errors
**Fix:**
- URL should be: `https://torquegpt.onrender.com/api/webhooks/openphone`
- Make sure no trailing slash
- Verify HTTPS (not HTTP)

### **Issue 3: Webhook Not Triggered**
**Symptoms:** No logs when sending SMS
**Debug:**
- Check OpenPhone webhook status (Active?)
- Verify phone number is correct
- Test with different phone number
- Check OpenPhone webhook history

### **Issue 4: Webhook Triggered but Not Processed**
**Symptoms:** Webhook logs but no SMS response
**Check:**
- Environment variables (OPENAI_API_KEY, OPENPHONE_API_KEY)
- DND_ENABLED setting
- OpenPhone API key permissions

### **Issue 5: Wrong Phone Number**
**Symptoms:** Messages to wrong number
**Verify:**
- OPENPHONE_PHONE_NUMBER environment variable
- Test with your actual OpenPhone number

## **Step 7: Test End-to-End Flow**

### **Send Test SMS to Your OpenPhone Number:**
```
"Hi, I need a quote for brake pads on my 2019 Honda Civic"
```

### **Expected Flow:**
1. 📱 SMS sent to OpenPhone number
2. 🔗 OpenPhone triggers webhook to your server
3. 🤖 Server processes with AI
4. 📤 Server sends response via OpenPhone
5. 📱 You receive AI response

## **Step 8: Debug Commands**

```bash
# 1. Test health
curl https://torquegpt.onrender.com/health

# 2. Test webhook endpoint
curl https://torquegpt.onrender.com/api/webhooks/openphone

# 3. Test settings API
curl https://torquegpt.onrender.com/api/settings

# 4. Test messages API
curl https://torquegpt.onrender.com/api/messages

# 5. Check webhook with test data
curl -X POST https://torquegpt.onrender.com/api/webhooks/openphone \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## **Step 9: Environment Variables Check**

Make sure these are set in Render:
```
OPENAI_API_KEY=sk-your-key-here
OPENPHONE_API_KEY=your-openphone-key
OPENPHONE_PHONE_NUMBER=+1234567890
BUSINESS_NAME=Pink Chicken Speed Shop
LABOR_RATE=80
DND_ENABLED=true
NODE_ENV=production
```

## **Quick Diagnostic:**

Run this and tell me the results:

```bash
# Test 1: Health check
curl https://torquegpt.onrender.com/health

# Test 2: Webhook test
curl https://torquegpt.onrender.com/api/webhooks/openphone

# Test 3: Settings check
curl https://torquegpt.onrender.com/api/settings
```

Share the output and I'll help you identify the issue! 🔧