// Quick test script for VPS connectivity
// Run this in browser console: copy and paste, then press Enter

console.log('🧪 Testing VPS Connectivity...');
console.log('================================');

const VPS_URLS = {
  'SSL Domain': 'https://api-ocr.xyz',
  'Direct IP': 'http://43.157.227.192:8000',
  'Render Backup': 'https://logistic-dokumen.onrender.com'
};

async function testAPI(name, url) {
  console.log(`\n📡 Testing ${name}: ${url}`);
  
  try {
    // Test root endpoint
    const start = Date.now();
    const response = await fetch(`${url}/`, { 
      method: 'HEAD',
      mode: 'cors'
    });
    const time = Date.now() - start;
    
    if (response.ok) {
      console.log(`✅ ${name} - OK (${time}ms)`);
      return { success: true, time };
    } else {
      console.log(`❌ ${name} - ${response.status} ${response.statusText}`);
      return { success: false, status: response.status };
    }
  } catch (error) {
    console.log(`❌ ${name} - Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test all endpoints
async function runTests() {
  const results = {};
  
  for (const [name, url] of Object.entries(VPS_URLS)) {
    results[name] = await testAPI(name, url);
  }
  
  console.log('\n📊 Test Summary:');
  console.log('================');
  
  Object.entries(results).forEach(([name, result]) => {
    const status = result.success ? 
      `✅ ${result.time}ms` : 
      `❌ ${result.status || result.error}`;
    console.log(`${name}: ${status}`);
  });
  
  const working = Object.entries(results)
    .filter(([_, r]) => r.success)
    .map(([name, _]) => name);
    
  if (working.length > 0) {
    console.log(`\n🎯 Working APIs: ${working.join(', ')}`);
  } else {
    console.log('\n⚠️ No APIs are responding!');
  }
}

// Run the test
runTests();