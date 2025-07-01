# Frontend Compatibility Guide

## 🔍 **API Compatibility Check**

### **✅ COMPATIBLE (No Changes Needed)**

#### **1. Messages API** (`/api/messages`)
- ✅ GET `/api/messages` - Same response format
- ✅ POST `/api/messages/reply` - Same request/response
- ✅ POST `/api/messages/:id/read` - Same functionality

#### **2. Customers API** (`/api/customers`) 
- ✅ GET `/api/customers` - Same response format
- ✅ POST `/api/customers` - Same request/response
- ✅ GET `/api/customers/:id` - Same functionality

#### **3. Basic Endpoints**
- ✅ GET `/health` - Same response
- ✅ GET `/` - Same response
- ✅ Webhook endpoint - Same functionality

### **⚠️ ENHANCED (Backward Compatible, New Features Available)**

#### **1. Quotes API** (`/api/quotes`)
```javascript
// OLD: Basic quote creation
POST /api/quotes
{
  "customer_name": "John",
  "service_description": "brake pads"
}

// NEW: Enhanced with scraping + AI (backward compatible)
POST /api/quotes  
{
  "customer_name": "John",
  "customer_phone": "+1234567890",
  "customer_email": "john@email.com", 
  "vehicle_info": "2019 Honda Civic",
  "service_description": "brake pads",
  "delivery_method": "sms" // NEW: sms|email
}

// Response enhanced with scraping data:
{
  "success": true,
  "quoteId": "quote_123",
  "total": 186,
  "deliveryMethod": "sms",
  "partsSources": [...], // NEW: Scraping results
  "laborBreakdown": {...} // NEW: Labor details
}
```

#### **2. Appointments API** (`/api/appointments`)
```javascript
// OLD: Basic appointment creation
POST /api/appointments
{
  "customer_name": "Jane",
  "date": "2024-01-15",
  "time": "10:00"
}

// NEW: Enhanced with availability checking (backward compatible)
POST /api/appointments
{
  "customer_name": "Jane",
  "customer_phone": "+1234567890",
  "customer_email": "jane@email.com", // NEW
  "vehicle_info": "2020 Toyota Camry", // NEW  
  "service_type": "Oil Change", // NEW
  "preferred_date": "2024-01-15",
  "preferred_time": "10:00",
  "notes": "Customer notes" // NEW
}

// NEW: Availability checking endpoint
GET /api/appointments/availability?date=2024-01-15
{
  "success": true,
  "availability": {
    "date": "2024-01-15",
    "available_slots": [
      {"time": "08:00", "available": true},
      {"time": "09:00", "available": false},
      {"time": "10:00", "available": true}
    ]
  }
}
```

### **🔧 SETTINGS API ENHANCED**

#### **Before:**
```javascript
GET /api/settings
{
  "success": true,
  "settings": {
    "openai_configured": true,
    "openphone_configured": true
  }
}
```

#### **After (Enhanced):**
```javascript
GET /api/settings  
{
  "success": true,
  "settings": {
    "openai_configured": true,
    "openphone_configured": true,
    "business_name": "Pink Chicken Speed Shop",
    "labor_rate": 80,
    "dnd_enabled": true,
    "openai_key_preview": "••••••••sk-1234",
    "openphone_key_preview": "••••••••op-5678",
    "phone_number": "+1234567890"
  }
}
```

## 🎯 **Recommended Frontend Updates**

### **1. Enhanced Quote Form** (Optional)
If you want to leverage new quote features:

```javascript
// Add to quote form:
- Vehicle Information field
- Delivery Method selector (SMS/Email)  
- Customer phone/email fields

// Enhanced quote display:
- Show parts breakdown from scraping
- Display labor hour calculations
- Show delivery confirmation
```

### **2. Enhanced Appointment Form** (Optional)
```javascript
// Add to appointment form:
- Vehicle Information field
- Service Type selector
- Customer contact fields
- Notes field

// Add availability checker:
- Real-time availability display
- Suggest alternative times
- Show business hours
```

### **3. Settings Page Enhancement** (Recommended)
```javascript
// Add to settings display:
- Business name configuration
- Labor rate setting  
- DND toggle
- API key status indicators
- Phone number display
```

### **4. New Dashboard Widgets** (Optional)
```javascript
// Leverage new stats endpoints:
GET /api/messages/stats
GET /api/appointments/availability  
GET /api/quotes (enhanced with scraping data)

// Show:
- Quote success rate
- Appointment availability 
- Scraping service status
- Customer response metrics
```

## 🚀 **Frontend Code Examples**

### **Enhanced Quote Form Component:**
```jsx
const QuoteForm = () => {
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    vehicle_info: '',
    service_description: '',
    delivery_method: 'sms'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const response = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Show success with delivery method confirmation
      alert(`Quote sent via ${result.deliveryMethod}! Total: $${result.total}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Existing fields */}
      <input 
        type="text" 
        placeholder="Customer Name"
        value={formData.customer_name}
        onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
      />
      
      {/* NEW FIELDS */}
      <input 
        type="tel" 
        placeholder="Phone Number"
        value={formData.customer_phone}
        onChange={(e) => setFormData({...formData, customer_phone: e.target.value})}
      />
      
      <input 
        type="email" 
        placeholder="Email (optional)"
        value={formData.customer_email}
        onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
      />
      
      <input 
        type="text" 
        placeholder="Vehicle (e.g., 2019 Honda Civic)"
        value={formData.vehicle_info}
        onChange={(e) => setFormData({...formData, vehicle_info: e.target.value})}
      />
      
      <select 
        value={formData.delivery_method}
        onChange={(e) => setFormData({...formData, delivery_method: e.target.value})}
      >
        <option value="sms">Send via SMS</option>
        <option value="email">Send via Email</option>
      </select>
      
      <button type="submit">Generate & Send Quote</button>
    </form>
  );
};
```

### **Availability Checker Component:**
```jsx
const AvailabilityChecker = ({ selectedDate, onTimeSelect }) => {
  const [availability, setAvailability] = useState(null);

  useEffect(() => {
    if (selectedDate) {
      fetch(`/api/appointments/availability?date=${selectedDate}`)
        .then(res => res.json())
        .then(data => setAvailability(data.availability));
    }
  }, [selectedDate]);

  return (
    <div>
      <h3>Available Times for {selectedDate}</h3>
      {availability?.available_slots?.map(slot => (
        <button 
          key={slot.time}
          disabled={!slot.available}
          onClick={() => onTimeSelect(slot.time)}
          className={slot.available ? 'available' : 'booked'}
        >
          {slot.time} {slot.available ? '✅' : '❌'}
        </button>
      ))}
    </div>
  );
};
```

## 📋 **Action Items**

### **Immediate (Required):**
- ✅ No breaking changes - existing frontend should work as-is

### **Short Term (Recommended):**  
- 🔧 Update Settings page to show enhanced configuration
- 📊 Add quote delivery method selector to quote forms
- 📱 Display API key status indicators

### **Optional Enhancements:**
- 🚗 Add vehicle information fields to forms
- ⏰ Implement real-time availability checking  
- 📈 Add scraping results display to quote history
- 🎯 Show labor breakdown in quote details

## 🎯 **Summary**

**Good News:** Your existing frontend will continue to work without any changes! All enhancements are backward compatible.

**Opportunity:** You can gradually add new features to leverage the enhanced backend capabilities like real-time scraping, availability checking, and improved notifications.