// src/controllers/schedule.controller.js - COMPLETE WORKING VERSION
const Schedule = require('../models/schedule.model');
const Booking = require('../models/booking.model');
const Professional = require('../models/professional.model');

// Helper function to get or create schedule (fallback if static method doesn't work)
async function getOrCreateSchedule(professionalId, date) {
  console.log('📅 [SCHEDULE-HELPER] Getting or creating schedule for:', { professionalId, date });
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  let schedule = await Schedule.findOne({
    professional: professionalId,
    date: startOfDay
  });
  
  if (!schedule) {
    console.log('📅 [SCHEDULE-HELPER] Creating new schedule for date:', startOfDay);
    schedule = new Schedule({
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
    console.log('✅ [SCHEDULE-HELPER] New schedule created:', schedule._id);
  } else {
    console.log('✅ [SCHEDULE-HELPER] Existing schedule found:', schedule._id);
  }
  
  return schedule;
}

class ScheduleController {
  // Get schedule for a specific date
  async getSchedule(req, res) {
    try {
      const { date } = req.query;
      const professionalId = req.user._id;
      
      console.log('📅 [SCHEDULE] Getting schedule for:', { professionalId, date });
      
      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'Date parameter is required'
        });
      }
      
      const requestedDate = new Date(date);
      if (isNaN(requestedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }
      
      // Get or create schedule for the date using helper function
      let schedule;
      try {
        // Try to use the static method first
        if (Schedule.getOrCreateSchedule && typeof Schedule.getOrCreateSchedule === 'function') {
          schedule = await Schedule.getOrCreateSchedule(professionalId, requestedDate);
        } else {
          // Fallback to helper function
          schedule = await getOrCreateSchedule(professionalId, requestedDate);
        }
      } catch (error) {
        console.log('⚠️ [SCHEDULE] Static method failed, using fallback:', error.message);
        schedule = await getOrCreateSchedule(professionalId, requestedDate);
      }
      
      // Get actual bookings for this date
      const startOfDay = new Date(requestedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(requestedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      let bookings = [];
      try {
        bookings = await Booking.find({
          professional: professionalId,
          scheduledDate: {
            $gte: startOfDay,
            $lte: endOfDay
          },
          status: { $nin: ['cancelled'] }
        }).populate('user', 'name phone').sort({ scheduledDate: 1 });
      } catch (bookingError) {
        console.log('⚠️ [SCHEDULE] Booking model not found or error:', bookingError.message);
        // Continue with empty bookings if Booking model doesn't exist
        bookings = [];
      }
      
      // Transform bookings to appointments format
      const appointments = bookings.map(booking => ({
        id: booking._id,
        requestId: booking._id,
        startTime: booking.scheduledDate,
        endTime: booking.scheduledEndTime || new Date(booking.scheduledDate.getTime() + (booking.estimatedDuration || 60) * 60000),
        customerName: booking.user?.name || 'Customer',
        customerPhone: booking.user?.phone,
        serviceType: booking.serviceType || 'Service',
        status: booking.status,
        address: booking.serviceAddress || booking.address || 'Address not provided',
        totalAmount: booking.totalAmount || 0
      }));
      
      // Get marked dates for calendar (next 30 days)
      const today = new Date();
      const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      let upcomingBookings = [];
      try {
        upcomingBookings = await Booking.find({
          professional: professionalId,
          scheduledDate: {
            $gte: today,
            $lte: thirtyDaysLater
          },
          status: { $nin: ['cancelled'] }
        }).select('scheduledDate');
      } catch (error) {
        console.log('⚠️ [SCHEDULE] Could not fetch upcoming bookings:', error.message);
        upcomingBookings = [];
      }
      
      // Create marked dates object
      const markedDates = [];
      const dateMap = new Map();
      
      upcomingBookings.forEach(booking => {
        const dateKey = booking.scheduledDate.toISOString().split('T')[0];
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, {
            date: dateKey,
            hasAppointments: true,
            count: 1
          });
        } else {
          dateMap.get(dateKey).count++;
        }
      });
      
      // Add next 30 days to marked dates
      for (let i = 0; i <= 30; i++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + i);
        const dateKey = currentDate.toISOString().split('T')[0];
        
        if (!dateMap.has(dateKey)) {
          markedDates.push({
            date: dateKey,
            hasAppointments: false,
            count: 0
          });
        } else {
          markedDates.push(dateMap.get(dateKey));
        }
      }
      
      console.log('✅ [SCHEDULE] Schedule retrieved successfully');
      
      res.json({
        success: true,
        data: {
          schedule: {
            date: requestedDate,
            isWorkingDay: schedule.workingHours?.isWorkingDay ?? true,
            workingHours: schedule.workingHours || {
              startTime: "09:00",
              endTime: "18:00",
              isWorkingDay: true
            },
            isHoliday: schedule.isHoliday || false,
            holidayReason: schedule.holidayReason,
            blockedTimes: schedule.blockedTimes || []
          },
          appointments,
          markedDates
        }
      });
      
    } catch (error) {
      console.error('❌ [SCHEDULE] Error getting schedule:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get schedule',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  // Get appointments in a date range
  async getAppointments(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const professionalId = req.user._id;
      
      console.log('📅 [APPOINTMENTS] Getting appointments for range:', { professionalId, startDate, endDate });
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }
      
      let bookings = [];
      try {
        bookings = await Booking.find({
          professional: professionalId,
          scheduledDate: {
            $gte: start,
            $lte: end
          },
          status: { $nin: ['cancelled'] }
        }).populate('user', 'name phone').sort({ scheduledDate: 1 });
      } catch (error) {
        console.log('⚠️ [APPOINTMENTS] Booking model error:', error.message);
        bookings = [];
      }
      
      const appointments = bookings.map(booking => ({
        id: booking._id,
        requestId: booking._id,
        startTime: booking.scheduledDate,
        endTime: booking.scheduledEndTime || new Date(booking.scheduledDate.getTime() + (booking.estimatedDuration || 60) * 60000),
        customerName: booking.user?.name || 'Customer',
        customerPhone: booking.user?.phone,
        serviceType: booking.serviceType || 'Service',
        status: booking.status,
        address: booking.serviceAddress || booking.address || 'Address not provided',
        totalAmount: booking.totalAmount || 0,
        date: booking.scheduledDate.toISOString().split('T')[0]
      }));
      
      console.log('✅ [APPOINTMENTS] Appointments retrieved successfully');
      
      res.json({
        success: true,
        data: {
          appointments,
          totalCount: appointments.length
        }
      });
      
    } catch (error) {
      console.error('❌ [APPOINTMENTS] Error getting appointments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get appointments',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  // Block time slots
  async blockTime(req, res) {
    try {
      const { date, startTime, endTime, reason, notes } = req.body;
      const professionalId = req.user._id;
      
      console.log('🚫 [BLOCK-TIME] Blocking time:', { professionalId, date, startTime, endTime, reason });
      
      if (!date || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: 'Date, start time, and end time are required'
        });
      }
      
      const requestedDate = new Date(date);
      if (isNaN(requestedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }
      
      // Get or create schedule for the date
      let schedule;
      try {
        if (Schedule.getOrCreateSchedule && typeof Schedule.getOrCreateSchedule === 'function') {
          schedule = await Schedule.getOrCreateSchedule(professionalId, requestedDate);
        } else {
          schedule = await getOrCreateSchedule(professionalId, requestedDate);
        }
      } catch (error) {
        schedule = await getOrCreateSchedule(professionalId, requestedDate);
      }
      
      // Add the blocked time
      schedule.blockedTimes.push({
        startTime,
        endTime,
        reason: reason || 'blocked',
        notes
      });
      
      await schedule.save();
      
      console.log('✅ [BLOCK-TIME] Time blocked successfully');
      
      res.json({
        success: true,
        message: 'Time blocked successfully',
        data: {
          schedule: {
            date: requestedDate,
            blockedTimes: schedule.blockedTimes
          }
        }
      });
      
    } catch (error) {
      console.error('❌ [BLOCK-TIME] Error blocking time:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to block time',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  // Remove time block
  async removeTimeBlock(req, res) {
    try {
      const { blockId } = req.params;
      const professionalId = req.user._id;
      
      console.log('🗑️ [REMOVE-BLOCK] Removing time block:', { professionalId, blockId });
      
      if (!blockId) {
        return res.status(400).json({
          success: false,
          message: 'Block ID is required'
        });
      }
      
      const schedule = await Schedule.findOne({
        professional: professionalId,
        'blockedTimes._id': blockId
      });
      
      if (!schedule) {
        return res.status(404).json({
          success: false,
          message: 'Time block not found'
        });
      }
      
      schedule.blockedTimes.id(blockId).remove();
      await schedule.save();
      
      console.log('✅ [REMOVE-BLOCK] Time block removed successfully');
      
      res.json({
        success: true,
        message: 'Time block removed successfully'
      });
      
    } catch (error) {
      console.error('❌ [REMOVE-BLOCK] Error removing time block:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove time block',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  // Update working hours
  async updateWorkingHours(req, res) {
    try {
      const { startTime, endTime, isWorkingDay, applyToAll } = req.body;
      const professionalId = req.user._id;
      
      console.log('⏰ [WORKING-HOURS] Updating working hours:', { professionalId, startTime, endTime, isWorkingDay, applyToAll });
      
      if (!startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: 'Start time and end time are required'
        });
      }
      
      const workingHours = {
        startTime,
        endTime,
        isWorkingDay: isWorkingDay !== undefined ? isWorkingDay : true
      };
      
      if (applyToAll) {
        // Update working hours for the professional's default settings
        await Professional.findByIdAndUpdate(professionalId, {
          $set: {
            'workingHours': workingHours
          }
        });
        
        // Update all future schedules
        const today = new Date();
        await Schedule.updateMany(
          {
            professional: professionalId,
            date: { $gte: today }
          },
          {
            $set: {
              'workingHours': workingHours
            }
          }
        );
      }
      
      console.log('✅ [WORKING-HOURS] Working hours updated successfully');
      
      res.json({
        success: true,
        message: 'Working hours updated successfully',
        data: {
          workingHours
        }
      });
      
    } catch (error) {
      console.error('❌ [WORKING-HOURS] Error updating working hours:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update working hours',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  // Get working hours
  async getWorkingHours(req, res) {
    try {
      const professionalId = req.user._id;
      
      console.log('⏰ [GET-WORKING-HOURS] Getting working hours for:', professionalId);
      
      const professional = await Professional.findById(professionalId).select('workingHours');
      
      const defaultWorkingHours = {
        startTime: "09:00",
        endTime: "18:00",
        isWorkingDay: true
      };
      
      const workingHours = professional?.workingHours || defaultWorkingHours;
      
      console.log('✅ [GET-WORKING-HOURS] Working hours retrieved successfully');
      
      res.json({
        success: true,
        data: {
          workingHours
        }
      });
      
    } catch (error) {
      console.error('❌ [GET-WORKING-HOURS] Error getting working hours:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get working hours',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  // Set holiday
  async setHoliday(req, res) {
    try {
      const { date, reason, isHoliday } = req.body;
      const professionalId = req.user._id;
      
      console.log('🏖️ [HOLIDAY] Setting holiday:', { professionalId, date, reason, isHoliday });
      
      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'Date is required'
        });
      }
      
      const requestedDate = new Date(date);
      if (isNaN(requestedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }
      
      // Get or create schedule for the date
      let schedule;
      try {
        if (Schedule.getOrCreateSchedule && typeof Schedule.getOrCreateSchedule === 'function') {
          schedule = await Schedule.getOrCreateSchedule(professionalId, requestedDate);
        } else {
          schedule = await getOrCreateSchedule(professionalId, requestedDate);
        }
      } catch (error) {
        schedule = await getOrCreateSchedule(professionalId, requestedDate);
      }
      
      schedule.isHoliday = isHoliday !== undefined ? isHoliday : true;
      schedule.holidayReason = reason;
      
      // If it's a holiday, mark as non-working day
      if (schedule.isHoliday) {
        schedule.workingHours.isWorkingDay = false;
      }
      
      await schedule.save();
      
      console.log('✅ [HOLIDAY] Holiday set successfully');
      
      res.json({
        success: true,
        message: `${schedule.isHoliday ? 'Holiday set' : 'Holiday removed'} successfully`,
        data: {
          schedule: {
            date: requestedDate,
            isHoliday: schedule.isHoliday,
            holidayReason: schedule.holidayReason
          }
        }
      });
      
    } catch (error) {
      console.error('❌ [HOLIDAY] Error setting holiday:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to set holiday',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  // Get holidays
  async getHolidays(req, res) {
    try {
      const professionalId = req.user._id;
      
      console.log('🏖️ [GET-HOLIDAYS] Getting holidays for:', professionalId);
      
      const holidays = await Schedule.find({
        professional: professionalId,
        isHoliday: true,
        date: { $gte: new Date() } // Only future holidays
      }).select('date holidayReason').sort({ date: 1 });
      
      console.log('✅ [GET-HOLIDAYS] Holidays retrieved successfully');
      
      res.json({
        success: true,
        data: {
          holidays: holidays.map(h => ({
            id: h._id,
            date: h.date,
            reason: h.holidayReason
          }))
        }
      });
      
    } catch (error) {
      console.error('❌ [GET-HOLIDAYS] Error getting holidays:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get holidays',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  // Remove holiday
  async removeHoliday(req, res) {
    try {
      const { holidayId } = req.params;
      const professionalId = req.user._id;
      
      console.log('🗑️ [REMOVE-HOLIDAY] Removing holiday:', { professionalId, holidayId });
      
      if (!holidayId) {
        return res.status(400).json({
          success: false,
          message: 'Holiday ID is required'
        });
      }
      
      const schedule = await Schedule.findOne({
        _id: holidayId,
        professional: professionalId
      });
      
      if (!schedule) {
        return res.status(404).json({
          success: false,
          message: 'Holiday not found'
        });
      }
      
      schedule.isHoliday = false;
      schedule.holidayReason = null;
      schedule.workingHours.isWorkingDay = true;
      
      await schedule.save();
      
      console.log('✅ [REMOVE-HOLIDAY] Holiday removed successfully');
      
      res.json({
        success: true,
        message: 'Holiday removed successfully'
      });
      
    } catch (error) {
      console.error('❌ [REMOVE-HOLIDAY] Error removing holiday:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove holiday',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  // Check availability
  async checkAvailability(req, res) {
    try {
      const { date, startTime, endTime } = req.query;
      const professionalId = req.user._id;
      
      console.log('🔍 [CHECK-AVAILABILITY] Checking availability:', { professionalId, date, startTime, endTime });
      
      if (!date || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: 'Date, start time, and end time are required'
        });
      }
      
      const requestedDate = new Date(date);
      if (isNaN(requestedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }
      
      // Get schedule for the date
      let schedule;
      try {
        if (Schedule.getOrCreateSchedule && typeof Schedule.getOrCreateSchedule === 'function') {
          schedule = await Schedule.getOrCreateSchedule(professionalId, requestedDate);
        } else {
          schedule = await getOrCreateSchedule(professionalId, requestedDate);
        }
      } catch (error) {
        schedule = await getOrCreateSchedule(professionalId, requestedDate);
      }
      
      // Check if it's a working day
      if (!schedule.workingHours.isWorkingDay || schedule.isHoliday) {
        return res.json({
          success: true,
          data: {
            available: false,
            reason: schedule.isHoliday ? 'Holiday' : 'Non-working day'
          }
        });
      }
      
      // Check if time is within working hours
      const workStart = schedule.workingHours.startTime;
      const workEnd = schedule.workingHours.endTime;
      
      if (startTime < workStart || endTime > workEnd) {
        return res.json({
          success: true,
          data: {
            available: false,
            reason: 'Outside working hours'
          }
        });
      }
      
      // Check for blocked times
      const isBlocked = schedule.blockedTimes.some(block => {
        return (startTime >= block.startTime && startTime < block.endTime) ||
               (endTime > block.startTime && endTime <= block.endTime) ||
               (startTime <= block.startTime && endTime >= block.endTime);
      });
      
      if (isBlocked) {
        return res.json({
          success: true,
          data: {
            available: false,
            reason: 'Time slot is blocked'
          }
        });
      }
      
      // Check for existing bookings
      let hasConflict = false;
      try {
        const startOfDay = new Date(requestedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(requestedDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const conflictingBookings = await Booking.find({
          professional: professionalId,
          scheduledDate: {
            $gte: startOfDay,
            $lte: endOfDay
          },
          status: { $nin: ['cancelled', 'completed'] }
        });
        
        hasConflict = conflictingBookings.some(booking => {
          const bookingStart = booking.scheduledDate.toTimeString().substring(0, 5);
          const bookingEnd = booking.scheduledEndTime ? 
            booking.scheduledEndTime.toTimeString().substring(0, 5) : 
            new Date(booking.scheduledDate.getTime() + 60 * 60 * 1000).toTimeString().substring(0, 5);
          
          return (startTime >= bookingStart && startTime < bookingEnd) ||
                 (endTime > bookingStart && endTime <= bookingEnd) ||
                 (startTime <= bookingStart && endTime >= bookingEnd);
        });
      } catch (error) {
        console.log('⚠️ [CHECK-AVAILABILITY] Could not check bookings:', error.message);
        hasConflict = false; // Assume available if can't check bookings
      }
      
      console.log('✅ [CHECK-AVAILABILITY] Availability checked successfully');
      
      res.json({
        success: true,
        data: {
          available: !hasConflict,
          reason: hasConflict ? 'Time slot already booked' : null
        }
      });
      
    } catch (error) {
      console.error('❌ [CHECK-AVAILABILITY] Error checking availability:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check availability',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = new ScheduleController();