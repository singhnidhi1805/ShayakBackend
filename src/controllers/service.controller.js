const Service = require('../models/service.model');
const Joi = require('joi');

// ✅ Helper function to get full image URL
const getFullImageUrl = (imagePath, req) => {
  if (!imagePath) return null;
  
  // If already a full URL, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Remove leading slash if present
  const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
  
  // Get base URL from environment or request
  const baseUrl = process.env.BASE_URL || 
                  process.env.API_URL || 
                  `${req.protocol}://${req.get('host')}`;
  
  return `${baseUrl}/${cleanPath}`;
};

// ✅ Transform service to include full image URL
const transformServiceResponse = (service, req) => {
  if (!service) return null;
  
  const serviceObj = service.toObject ? service.toObject() : service;
  
  if (serviceObj.image) {
    serviceObj.imageUrl = getFullImageUrl(serviceObj.image, req);
  }
  
  return serviceObj;
};

// Validation schema
const serviceValidation = Joi.object({
  name: Joi.string().required(),
  category: Joi.string().required(),
  description: Joi.string().required(),
  price: Joi.number().positive().required(),
  duration: Joi.number().positive().required(),
  image: Joi.string()
});

// Create new service
const createService = async (req, res) => {
  try {
    const { error } = serviceValidation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Add image path if file was uploaded
    if (req.file) {
      req.body.image = `/uploads/services/${req.file.filename}`;
    }

    const service = new Service(req.body);
    await service.save();
    
    // ✅ Transform response with full image URL
    const transformedService = transformServiceResponse(service, req);
    res.status(201).json(transformedService);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all services with filtering and sorting
const getServices = async (req, res) => {
  try {
    const { category, minPrice, maxPrice, sort } = req.query;
    let query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let sortOption = {};
    if (sort === 'price_asc') sortOption.price = 1;
    if (sort === 'price_desc') sortOption.price = -1;
    if (sort === 'rating') sortOption.rating = -1;

    const services = await Service.find(query).sort(sortOption);
    
    // ✅ Transform all services with full image URLs
    const transformedServices = services.map(service => 
      transformServiceResponse(service, req)
    );
    
    res.json(transformedServices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get services by category
const getServicesByCategory = async (req, res) => {
  try {
    const services = await Service.find({ category: req.params.category });
    
    // ✅ Transform all services with full image URLs
    const transformedServices = services.map(service => 
      transformServiceResponse(service, req)
    );
    
    res.json(transformedServices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get service details by ID
const getServiceDetails = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    // ✅ Transform response with full image URL
    const transformedService = transformServiceResponse(service, req);
    res.json(transformedService);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get top rated services
const getTopRatedServices = async (req, res) => {
  try {
    const services = await Service.find()
      .sort({ rating: -1, numberOfRatings: -1 })
      .limit(10);
    
    // ✅ Transform all services with full image URLs
    const transformedServices = services.map(service => 
      transformServiceResponse(service, req)
    );
    
    res.json(transformedServices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Search services
const searchServices = async (req, res) => {
  try {
    const { query } = req.query;
    const services = await Service.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } }
      ]
    });
    
    // ✅ Transform all services with full image URLs
    const transformedServices = services.map(service => 
      transformServiceResponse(service, req)
    );
    
    res.json(transformedServices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update service
const updateService = async (req, res) => {
  try {
    const { error } = serviceValidation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Add image path if file was uploaded
    if (req.file) {
      req.body.image = `/uploads/services/${req.file.filename}`;
    }

    const service = await Service.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // ✅ Transform response with full image URL
    const transformedService = transformServiceResponse(service, req);
    res.json(transformedService);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete service
const deleteService = async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createService,
  getServices,
  getServicesByCategory,
  getServiceDetails,
  getTopRatedServices,
  searchServices,
  updateService,
  deleteService
};