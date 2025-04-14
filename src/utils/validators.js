class Validators {
    static isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }
  
    static isValidPhone(phone) {
      const phoneRegex = /^\+?[\d\s-]{10,}$/;
      return phoneRegex.test(phone);
    }
  
    static isValidPassword(password) {
      // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      return passwordRegex.test(password);
    }
  
    static sanitizeInput(input) {
      return input.replace(/[<>]/g, '');
    }
  }

  
module.exports = {
    backupDatabase,
    EmailService,
    CacheService,
    AnalyticsService,
    Encryption,
    Validators,
    GeocodingService
  };