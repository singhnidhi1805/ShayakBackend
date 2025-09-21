// debug-schedule.js - Enhanced debugging for schedule API
const axios = require('axios');

const API_BASE = 'https://shayakbackend-production.up.railway.app/';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3Y2YxNzU3NzlmM2M1NmFiYTZmMGUwMSIsInVzZXJJZCI6IlBSTzI1MTc1Mjc5VElHIiwicm9sZSI6InByb2Zlc3Npb25hbCIsInBob25lIjoiKzkxODIxMDAzNjQ5NSIsImlhdCI6MTc0ODk2Njc1NSwiZXhwIjoxNzQ5NTcxNTU1fQ.G9-jwklovuayBEw2fEux1MEPVt6ktIW8xmiti7uFBv4';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000 // 10 second timeout
});

function logError(error, context) {
  console.log(`❌ ${context} failed:`);
  if (error.response) {
    console.log(`   Status: ${error.response.status}`);
    console.log(`   Message: ${error.response.data?.message || 'No message'}`);
    console.log(`   Data:`, error.response.data);
  } else if (error.request) {
    console.log(`   Network Error: No response received`);
    console.log(`   Code: ${error.code || 'Unknown'}`);
    console.log(`   Address: ${error.address || 'Unknown'}`);
    console.log(`   Port: ${error.port || 'Unknown'}`);
  } else {
    console.log(`   Error: ${error.message}`);
  }
}

async function testScheduleAPI() {
  console.log('🧪 Starting Schedule API Tests...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing server health...');
    try {
      const health = await api.get('/api/health');
      console.log('✅ Server is healthy:', health.data);
    } catch (error) {
      console.log('❌ Server health check failed:', error.message);
    }

    // Test 2: Test routes endpoint
    console.log('\n2️⃣ Testing routes registration...');
    try {
      const routes = await api.get('/api/test/routes');
      console.log('✅ Routes test passed:', routes.data);
    } catch (error) {
      console.log('❌ Routes test failed:', error.message);
    }

    // Test 3: Test schedule endpoint with debug
    console.log('\n3️⃣ Testing schedule endpoint...');
    try {
      const schedule = await api.get('/api/professional/schedule?date=2025-06-08');
      console.log('✅ Schedule API working:', {
        success: schedule.data.success,
        hasSchedule: !!schedule.data.data?.schedule,
        isWorkingDay: schedule.data.data?.schedule?.isWorkingDay,
        appointmentsCount: schedule.data.data?.appointments?.length || 0,
        markedDatesCount: schedule.data.data?.markedDates?.length || 0
      });
      
      // Log the actual schedule data for debugging
      console.log('\n📊 Schedule Details:');
      console.log('Date:', schedule.data.data?.schedule?.date);
      console.log('Is Working Day:', schedule.data.data?.schedule?.isWorkingDay);
      console.log('Working Hours:', schedule.data.data?.schedule?.workingHours);
      console.log('Is Holiday:', schedule.data.data?.schedule?.isHoliday);
      console.log('Blocked Times:', schedule.data.data?.schedule?.blockedTimes?.length || 0);
      
    } catch (error) {
      console.log('❌ Schedule API failed:', error.response?.data || error.message);
    }

    // Test 4: Test appointments endpoint
    console.log('\n4️⃣ Testing appointments endpoint...');
    try {
      const appointments = await api.get('/api/professional/schedule/appointments?startDate=2025-06-08&endDate=2025-06-08');
      console.log('✅ Appointments API working:', {
        success: appointments.data.success,
        totalCount: appointments.data.data?.totalCount || 0
      });
    } catch (error) {
      console.log('❌ Appointments API failed:', error.response?.data || error.message);
    }

    // Test 5: Test token validation
    console.log('\n5️⃣ Testing token validation...');
    try {
      const decoded = JSON.parse(Buffer.from(TOKEN.split('.')[1], 'base64').toString());
      console.log('🔍 Token payload:', {
        id: decoded.id,
        userId: decoded.userId,
        role: decoded.role,
        phone: decoded.phone,
        exp: new Date(decoded.exp * 1000).toISOString()
      });
    } catch (error) {
      console.log('❌ Token decode failed:', error.message);
    }

    // Test 6: Test working hours
    console.log('\n6️⃣ Testing working hours endpoint...');
    try {
      const workingHours = await api.get('/api/professional/schedule/working-hours');
      console.log('✅ Working hours API working:', workingHours.data);
    } catch (error) {
      console.log('❌ Working hours API failed:', error.response?.data || error.message);
    }

    // Test 7: Direct MongoDB query simulation
    console.log('\n7️⃣ Testing different date formats...');
    const testDates = [
      '2025-06-08',
      '2025-06-09', 
      '2025-06-10'
    ];
    
    for (const testDate of testDates) {
      try {
        const result = await api.get(`/api/professional/schedule?date=${testDate}`);
        console.log(`✅ Date ${testDate}:`, {
          isWorkingDay: result.data.data?.schedule?.isWorkingDay,
          dayOfWeek: new Date(testDate + 'T00:00:00.000Z').getUTCDay(),
          blockedTimes: result.data.data?.schedule?.blockedTimes?.length || 0
        });
      } catch (error) {
        console.log(`❌ Date ${testDate} failed:`, error.response?.data?.message || error.message);
      }
    }

  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
  }

  console.log('\n🏁 Test suite completed!\n');
}

// Run the tests
testScheduleAPI();

// Export for use in other files
module.exports = { testScheduleAPI };