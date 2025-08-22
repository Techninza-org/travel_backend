// Test script for hotel booking payment flow
// This is a simple test to verify the implementation

const axios = require('axios');

const BASE_URL = 'https://eziotravels.com/api'; // Adjust as needed
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwaG9uZSI6Ijg5MjA2NTg3NDMiLCJpYXQiOjE3NTU2OTY0MDQsImV4cCI6MTc1NjMwMTIwNH0._YpD7DApeT3qp2a_MDLGkTmoUExf5Pjd8Hnr0oDcGcQ'; // Replace with actual token

// Test data
const testVendorPayload = {
  // Sample EMT payload - replace with actual structure
  hotelId: "12345",
  checkIn: "2024-01-15",
  checkOut: "2024-01-17",
  rooms: 1,
  adults: 2,
  children: 0,
  // Add other required fields based on EMT API
};

async function testPaymentFlow() {
  try {
    console.log('🚀 Starting Hotel Booking Payment Flow Test\n');

    // Step 1: Lock Price
    console.log('1. Locking hotel price...');
    const lockResponse = await axios.post(`${BASE_URL}/hotel/lockPrice`, {
      vendorPayload: testVendorPayload,
      amount: 5000.00,
      currency: 'INR',
      notes: 'Test hotel booking'
    }, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const { bookingId } = lockResponse.data.data;
    console.log(`✅ Price locked. Booking ID: ${bookingId}\n`);

    // Step 2: Create Razorpay Order
    console.log('2. Creating Razorpay order...');
    const orderResponse = await axios.post(`${BASE_URL}/payments/hotel/create-order`, {
      bookingId
    }, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const orderData = orderResponse.data.data;
    console.log(`✅ Order created. Order ID: ${orderData.order_id}\n`);

    // Step 3: Check Booking Status
    console.log('3. Checking booking status...');
    const statusResponse = await axios.get(`${BASE_URL}/payments/hotel/booking/${bookingId}/status`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    console.log(`✅ Current status: ${statusResponse.data.data.status}\n`);

    console.log('🎉 Payment flow test completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Use the order_id in Razorpay Checkout');
    console.log('2. Complete payment on frontend');
    console.log('3. Call verify endpoint with payment details');
    console.log('4. Check webhook processing');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testPaymentFlow();
