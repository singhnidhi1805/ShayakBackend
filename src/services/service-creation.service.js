const Service = require('../models/service.model');
const logger = require('../config/logger');
const createError = require('http-errors');

class ServiceCreationService {
  // Standard service templates for each specialization
  static SERVICE_TEMPLATES = {
    plumbing: [
      { 
        name: 'Basic Plumbing Repair', 
        description: 'Minor fixes for leaks, pipe replacements, and basic plumbing issues',
        basePrice: 500
      },
      { 
        name: 'Bathroom Plumbing Service', 
        description: 'Comprehensive plumbing check and repair for bathrooms',
        basePrice: 1000
      }
    ],
    electrical: [
      { 
        name: 'Electrical Inspection', 
        description: 'Comprehensive home electrical system check',
        basePrice: 750
      },
      { 
        name: 'Electrical Repair', 
        description: 'Fixing electrical issues, socket replacements, wiring repairs',
        basePrice: 600
      }
    ],
    carpentry: [
      { 
        name: 'Furniture Repair', 
        description: 'Minor furniture repairs and woodwork',
        basePrice: 400
      },
      { 
        name: 'Wooden Fixture Installation', 
        description: 'Installation of shelves, cabinets, and other wooden fixtures',
        basePrice: 800
      }
    ],
    cleaning: [
      { 
        name: 'Home Deep Cleaning', 
        description: 'Comprehensive home cleaning service',
        basePrice: 1200
      },
      { 
        name: 'Office Cleaning', 
        description: 'Professional office and workspace cleaning',
        basePrice: 1500
      }
    ],
    painting: [
      { 
        name: 'Room Painting', 
        description: 'Complete painting service for a single room',
        basePrice: 2000
      },
      { 
        name: 'Wall Texture Service', 
        description: 'Decorative wall texturing and painting',
        basePrice: 2500
      }
    ],
    landscaping: [
      { 
        name: 'Garden Maintenance', 
        description: 'Regular garden cleaning and maintenance',
        basePrice: 1000
      },
      { 
        name: 'Lawn Trimming', 
        description: 'Professional lawn mowing and trimming',
        basePrice: 600
      }
    ],
    moving: [
      { 
        name: 'Local Home Shifting', 
        description: 'Professional moving services within city',
        basePrice: 2000
      },
      { 
        name: 'Office Relocation', 
        description: 'Complete office moving and setup service',
        basePrice: 5000
      }
    ],
    pest_control: [
      { 
        name: 'Home Pest Control', 
        description: 'Comprehensive pest elimination service',
        basePrice: 1500
      },
      { 
        name: 'Commercial Pest Management', 
        description: 'Professional pest control for commercial spaces',
        basePrice: 2500
      }
    ]
  };

  async createServicesForProfessional(professional) {
    try {
        const servicesToCreate = professional.specializations.flatMap(spec =>
            ServiceCreationService.SERVICE_TEMPLATES[spec].map(template => ({
                ...template,
                category: spec,
                professionalTypes: [spec],
                createdBy: professional._id,
                matchingProfessionals: [professional._id] // ✅ Now linking professionals to services
            }))
        );

        const createdServices = await Service.insertMany(servicesToCreate);
        console.log(`Services created for professional ${professional._id}`);
        return createdServices;
    } catch (error) {
        throw createError(500, 'Failed to create services');
    }
}
}

module.exports = new ServiceCreationService();