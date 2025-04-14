const loggingMiddleware = (req, res, next) => {
    console.log('Request Body:', req.body);
    console.log('Request User:', req.user);
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      console.log(`${req.method} ${req.path} - Status: ${res.statusCode} - Duration: ${duration}ms`);
    });
    
    next();
  };
  
  router.use(loggingMiddleware);