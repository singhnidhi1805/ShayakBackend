const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('./logger');
const redisClient = require('./redis');

const initializeSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ['GET', 'POST']
    }
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        throw new Error('Authentication token missing');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;

      // Store socket connection in Redis
      await redisClient.set(`socket:${decoded.userId}`, socket.id);
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.userId}`);

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // Handle location updates for professionals
    socket.on('update_location', async (data) => {
      try {
        const { coordinates } = data;
        await redisClient.set(
          `location:${socket.userId}`,
          JSON.stringify(coordinates)
        );
        socket.to('dispatch').emit('professional_location_updated', {
          professionalId: socket.userId,
          coordinates
        });
      } catch (error) {
        logger.error('Location update error:', error);
      }
    });

    // Handle chat messages
    socket.on('send_message', async (data) => {
      try {
        const { recipientId, message } = data;
        const recipientSocket = await redisClient.get(`socket:${recipientId}`);
        
        if (recipientSocket) {
          io.to(recipientSocket).emit('new_message', {
            senderId: socket.userId,
            message
          });
        }
      } catch (error) {
        logger.error('Message sending error:', error);
      }
    });

    // Handle service status updates
    socket.on('service_status_update', async (data) => {
      try {
        const { bookingId, status } = data;
        io.to(`booking:${bookingId}`).emit('status_updated', {
          bookingId,
          status
        });
      } catch (error) {
        logger.error('Status update error:', error);
      }
    });

    socket.on('disconnect', async () => {
      try {
        await redisClient.del(`socket:${socket.userId}`);
        logger.info(`User disconnected: ${socket.userId}`);
      } catch (error) {
        logger.error('Disconnect error:', error);
      }
    });
  });

  return io;
};

module.exports = initializeSocket;