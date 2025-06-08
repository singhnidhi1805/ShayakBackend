// src/models/schedule.model.js
const mongoose = require('mongoose');

const timeBlockSchema = new mongoose.Schema({
  startTime: {
    type: String, // "09:00"
    required: true
  },
  endTime: {
    type: String, // "10:00"
    required: true
  },
  reason: {
    type: String,
    enum: ['break', 'lunch', 'personal', 'blocked', 'holiday'],
    default: 'blocked'
  },
  notes: String
});

const scheduleSchema = new mongoose.Schema({
  professional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Professional',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  dayOfWeek: {
    type: Number, // 0-6 (Sunday to Saturday)
    required: true
  },
  workingHours: {
    startTime: {
      type: String,
      default: "09:00"
    },
    endTime: {
      type: String,
      default: "18:00"
    },
    isWorkingDay: {
      type: Boolean,
      default: true
    }
  },
  blockedTimes: [timeBlockSchema],
  isHoliday: {
    type: Boolean,
    default: false
  },
  holidayReason: String,
  // Cache frequently accessed data
  appointments: [{
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    startTime: String,
    endTime: String,
    customerName: String,
    serviceType: String,
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']
    },
    address: String
  }]
}, {
  timestamps: true
});

// Compound indexes for better performance
scheduleSchema.index({ professional: 1, date: 1 }, { unique: true });
scheduleSchema.index({ date: 1, 'workingHours.isWorkingDay': 1 });

// Static method to get or create schedule for a date
scheduleSchema.statics.getOrCreateSchedule = async function(professionalId, date) {
  console.log('📅 [SCHEDULE-MODEL] Getting or creating schedule for:', { professionalId, date });
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  try {
    let schedule = await this.findOne({
      professional: professionalId,
      date: startOfDay
    });
    
    if (!schedule) {
      console.log('📅 [SCHEDULE-MODEL] Creating new schedule for date:', startOfDay);
      schedule = new this({
        professional: professionalId,
        date: startOfDay,
        dayOfWeek: startOfDay.getDay(),
        workingHours: {
          startTime: "09:00",
          endTime: "18:00",
          isWorkingDay: startOfDay.getDay() !== 0 && startOfDay.getDay() !== 6 // Not Sunday or Saturday
        }
      });
      await schedule.save();
      console.log('✅ [SCHEDULE-MODEL] New schedule created:', schedule._id);
    } else {
      console.log('✅ [SCHEDULE-MODEL] Existing schedule found:', schedule._id);
    }
    
    return schedule;
  } catch (error) {
    console.error('❌ [SCHEDULE-MODEL] Error in getOrCreateSchedule:', error);
    throw error;
  }
};

const Schedule = mongoose.model('Schedule', scheduleSchema);

module.exports = Schedule;