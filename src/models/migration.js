const mongoose = require('mongoose');
const Professional = require('./models/professional.model');

async function migrateProfessionals() {
  try {
    const professionals = await Professional.find({});
    
    for (const professional of professionals) {
      // Ensure currentLocation has proper structure
      if (!professional.currentLocation || !professional.currentLocation.type) {
        professional.currentLocation = {
          type: 'Point',
          coordinates: [0, 0],
          updatedAt: new Date()
        };
      }

      // Convert old serviceArea to new serviceAreas array format
      if (professional.serviceArea && !professional.serviceAreas) {
        professional.serviceAreas = [{
          location: {
            type: 'Point',
            coordinates: professional.serviceArea.coordinates || [0, 0]
          },
          radius: professional.serviceArea.radius || 15,
          isActive: true
        }];
      }

      // Add any missing fields with defaults
      if (!professional.activeStatus) {
        professional.activeStatus = {
          isOnline: false,
          lastActiveAt: new Date()
        };
      }

      await professional.save();
      console.log(`Migrated professional: ${professional._id}`);
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}