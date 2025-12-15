// Quick VPS Test Bypass - Skip Google OAuth for testing
// Run this in browser console to bypass login and test VPS directly

console.log('🚀 VPS Test Bypass - Setting up mock session...');

// Create mock user session
const mockUser = {
  name: "Test User",
  email: "test@vps.local", 
  picture: "https://via.placeholder.com/40",
  credential: "test-token-123",
  access_token: "test-access-token",
  driveToken: "test-drive-token"
};

// Set session storage
sessionStorage.setItem('user', JSON.stringify(mockUser));
sessionStorage.setItem('isAuthenticated', 'true');

console.log('✅ Mock session created!');
console.log('📍 Now navigate to: http://localhost:8080/');

// Auto-redirect if on login page
if (window.location.pathname.includes('/login')) {
  console.log('🔄 Redirecting to main app...');
  window.location.href = 'http://localhost:8080/';
} else {
  console.log('💡 Refresh the page to see the main app!');
}