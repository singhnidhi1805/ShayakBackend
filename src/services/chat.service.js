const Chat = require('../models/chat.model');
const socketIO = require('socket.io');

let io;

const initializeSocket = (server) => {
  io = socketIO(server);
  
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);
    socket.join(`user_${socket.userId}`);

    socket.on('join_chat', async (chatId) => {
      const chat = await Chat.findById(chatId);
      if (chat && chat.participants.includes(socket.userId)) {
        socket.join(`chat_${chatId}`);
      }
    });

    socket.on('send_message', async (data) => {
      try {
        const { chatId, content, type, media, location } = data;
        
        const message = {
          sender: socket.userId,
          content,
          type,
          media,
          location
        };

        const chat = await Chat.findByIdAndUpdate(
          chatId,
          {
            $push: { messages: message },
            $set: { 
              lastMessage: {
                content,
                sender: socket.userId,
                createdAt: new Date()
              }
            }
          },
          { new: true }
        );

        io.to(`chat_${chatId}`).emit('new_message', {
          chatId,
          message
        });
      } catch (error) {
        socket.emit('error', error.message);
      }
    });
  });
};


module.exports = {
    backupDatabase,
    EmailService,
    CacheService,
    AnalyticsService,
    Encryption,
    Validators,
    GeocodingService
  };