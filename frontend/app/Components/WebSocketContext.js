"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import toast, { Toaster } from 'react-hot-toast';
import { Bell, MessageSquare, GamepadIcon, Trophy, UserPlus } from "lucide-react";
import Axios from "../Components/axios";

// Create a context to share WebSocket state across components  
const WebSocketContext = createContext(null);

// Define different types of notifications the app can handle 
const NOTIFICATION_TYPES = {
  CHAT_MESSAGE: 'chat_message',
  GAME_REQUEST: 'game_request',
  ACHIEVEMENT: 'achievement',
  INVITATION: 'invitation',
  SYSTEM: 'system'
};

// Configuration for how each notification type should be displayed
const NOTIFICATION_CONFIG = {
  [NOTIFICATION_TYPES.CHAT_MESSAGE]: {
    icon: MessageSquare,
    style: "bg-blue-50 border-blue-200",
    title: "New Message",
    duration: 5000
  },
  [NOTIFICATION_TYPES.GAME_REQUEST]: {
    icon: GamepadIcon,
    style: "bg-purple-50 border-purple-200",
    title: "Game Request",
    duration: 30000
  },
  [NOTIFICATION_TYPES.ACHIEVEMENT]: {
    icon: Trophy,
    style: "bg-yellow-50 border-yellow-200",
    title: "Achievement Unlocked!",
    duration: 5000
  },
  [NOTIFICATION_TYPES.INVITATION]: {
    icon: UserPlus,
    style: "bg-green-50 border-green-200",
    title: "New Invitation",
    duration: 5000
  },
  [NOTIFICATION_TYPES.SYSTEM]: {
    icon: Bell,
    style: "bg-gray-50 border-gray-200",
    title: "System Notification",
    duration: 5000
  }
};

// The main WebSocket Provider component that wraps the app
export const WebSocketProviderForChat = ({ children }) => {
  // Main state object containing all WebSocket-related data
  const [state, setState] = useState({
    notifications: [],        // Array of active notifications
    messages: {},            // Object storing chat messages by user
    currentUser: null,       // Currently logged in user
    connectionStatus: "Disconnected",  // WebSocket connection status
    unreadCounts: {}  // Add unreadCounts to state
  });

  // WebSocket URLs for notifications and chat
  const notificationWsUrl = state.currentUser ? "ws://127.0.0.1:8000/ws/notifications/" : null;
  // Chat URL is only created if there's a current user
  const chatWsUrl = state.currentUser ? `ws://127.0.0.1:8000/ws/chat/${state.currentUser}/` : null;

  // Notification WebSocket
  const {
    sendMessage: sendNotification,      // Function to send notifications
    lastMessage: lastNotificationMessage, // Last received notification
    readyState: notificationReadyState   // Connection status
  } = useWebSocket(notificationWsUrl, {
    shouldReconnect: true,
    reconnectInterval: 3000,
    onOpen: () => {
      console.log("WebSocket Connection Opened"); // Debug log
      setState(prev => ({ ...prev, connectionStatus: "Connected" }));
      sendNotification(JSON.stringify({ type: 'get_notifications' }));
    },
    onMessage: (event) => {
      console.log("Raw WebSocket message received:", event.data); // Debug log
    },
    onClose: () => {
      console.log("WebSocket Connection Closed"); // Debug log
      setState(prev => ({ ...prev, connectionStatus: "Disconnected" }))
    }
  });

  // Set up chat WebSocket connection
  const {
    sendJsonMessage: sendChatMessage,  // Function to send chat messages
    readyState: chatReadyState        // Chat connection status
  } = useWebSocket(chatWsUrl, {
    enabled: !!state.currentUser,
    shouldReconnect: true,
    reconnectInterval: 3000,
    onMessage: (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'chat_message') {
            handleChatMessage(data);
        } else if (data.type === 'message_sent') {
            // Update the sent message with the server-generated ID
            setState(prev => ({
                ...prev,
                messages: {
                    ...prev.messages,
                    [data.receiver]: prev.messages[data.receiver].map(msg => 
                        msg.timestamp === data.timestamp && !msg.id
                            ? { ...msg, id: data.message_id }
                            : msg
                    )
                }
            }));
        }
    },
    onError: (error) => console.error('Chat WebSocket error:', error)
  });

  // Handle incoming chat messages
  const handleChatMessage = (data) => {
    if (data.type === 'chat_message') {
      setState(prev => {
        // Don't increment unread count if message is from current user
        if (data.sender === prev.currentUser) {
          return prev;
        }

        // Update unread counts
        const newUnreadCounts = {
          ...prev.unreadCounts,
          [data.sender]: {
            count: (prev.unreadCounts[data.sender]?.count || 0) + 1,
            user_id: data.sender_id,
            last_message: {
              content: data.message,
              timestamp: data.timestamp
            }
          }
        };

        return {
          ...prev,
          unreadCounts: newUnreadCounts,
          messages: {
            ...prev.messages,
            [data.sender]: [
              ...(prev.messages[data.sender] || []),
              {
                id: data.message_id,
                content: data.message,
                timestamp: data.timestamp,
                isUser: false,
                isRead: false,
                sender: data.sender,
                receiver: data.receiver
              }
            ]
          }
        };
      });
    }
  };

  // Handle responses to game requests
  const handleGameResponse = (notificationId, accepted) => {
    sendNotification(JSON.stringify({
      type: 'game_response',
      notification_id: notificationId,
      accepted
    }));
  };

  // Function to send a new chat message
  const sendMessage = (content, receiver, historicData = null) => {
    const timestamp = historicData?.timestamp || new Date().toISOString().slice(0, 16).replace("T", " ");
    
    // If this is a historic message, just update the state
    if (historicData?.isHistoric) {
        setState(prev => ({
            ...prev,
            messages: {
                ...prev.messages,
                [receiver]: [
                    ...(prev.messages[receiver] || []),
                    {
                        id: historicData.id,
                        content,
                        timestamp,
                        isUser: historicData.sender === state.currentUser,
                        isRead: historicData.isRead,
                        sender: historicData.sender,
                        receiver
                    }
                ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) // Sort messages by timestamp
            }
        }));
        return;
    }

    // For new messages, send through WebSocket
    if (chatReadyState === ReadyState.OPEN) {
        sendChatMessage({
            type: 'chat_message',
            message: content,
            receiver,
            sender: state.currentUser
        });

        setState(prev => ({
            ...prev,
            messages: {
                ...prev.messages,
                [receiver]: [
                    ...(prev.messages[receiver] || []),
                    {
                        content,
                        timestamp,
                        isUser: true,
                        sender: state.currentUser,
                        receiver
                    }
                ]
            }
        }));
    }
  };

  // Mark a notification as read
  const markAsRead = (notificationId) => {
    sendNotification(JSON.stringify({
      type: 'mark_read',
      notification_id: notificationId
    }));
  };

  // Set the current user
  const setUser = (username) => {
    setState(prev => ({ ...prev, currentUser: username }));
  };

  // Handle incoming notifications
  useEffect(() => {
    console.log("lastNotificationMessage changed:", lastNotificationMessage); // Debug log
    
    if (lastNotificationMessage) {
      try {
        const data = JSON.parse(lastNotificationMessage.data);
        console.log("Parsed notification data:", data); // Debug log
        handleNotification(data);
      } catch (error) {
        console.error("Failed to parse notification:", error);
        toast.error('Failed to process notification');
      }
    }
  }, [lastNotificationMessage]);

  // Process different types of notifications
  const handleNotification = (data) => {
    console.log("handleNotification called with:", data); // Debug log
    
    const notificationHandlers = {
      connection_established: () => {
        console.log("Handling connection_established"); // Debug log
        toast.success(data.message || 'Connected to notification service!', {
          icon: '🔌',
          duration: 3000
        });
      },
      notification: () => {
        // Add new notification to state and show toast
        setState(prev => ({
          ...prev,
          notifications: [...prev.notifications, data]
        }));
        showNotificationToast(data);
      },
      notification_marked_read: () => {
        // Remove notification from state when marked as read
        setState(prev => ({
          ...prev,
          notifications: prev.notifications.filter(n => n.notification_id !== data.notification_id)
        }));
        toast.success('Notification marked as read');
      },
      error: () => toast.error(data.message)
    };

    // Add console.log for debugging
    console.log("Received notification data:", data);
    
    const handler = notificationHandlers[data.type];
    if (handler) {
      handler();
    } else {
      console.log("No handler found for notification type:", data.type);
    }
  };

  // Display notification as a toast message
  const showNotificationToast = (data) => {
    const config = NOTIFICATION_CONFIG[data.notification_type];
    if (!config) return;

    const toastContent = (
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="font-medium">{config.title}</p>
          <p>{data.message}</p>
          <p className="text-sm text-gray-500 mt-1">{data.timestamp}</p>
          {data.notification_type === NOTIFICATION_TYPES.GAME_REQUEST && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleGameResponse(data.notification_id, true)}
                className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Accept
              </button>
              <button
                onClick={() => handleGameResponse(data.notification_id, false)}
                className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                Decline
              </button>
            </div>
          )}
        </div>
        {data.notification_id && data.notification_type !== NOTIFICATION_TYPES.GAME_REQUEST && (
          <button
            onClick={() => markAsRead(data.notification_id)}
            className="text-sm text-blue-500 hover:text-blue-600"
          >
            Mark as read
          </button>
        )}
      </div>
    );

    // Show the toast notification
    toast.custom(toastContent, {
      duration: config.duration,
      style: {
        background: '#ffffff',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }
    });
  };

  const sendFriendRequest = async (userId) => {
    try {
      const response = await Axios.post(`/api/friends/send_request/${userId}/`);
      // Handle success
    } catch (error) {
      if (Axios.isAxiosError(error)) {
        if (error.response?.status === 400) {
          // Handle blocked user error
          toast.error(error.response.data.error || "Cannot send friend request");
        }
      }
    }
  };
  
  const blockUser = (userToBlock) => {
    if (chatReadyState === ReadyState.OPEN) {
      sendChatMessage({
        type: 'block_user',
        blocker: state.currentUser,
        blocked: userToBlock
      });
    }
  };

  // Add function to reset unread count
  const resetUnreadCount = (username) => {
    setState(prev => ({
      ...prev,
      unreadCounts: {
        ...prev.unreadCounts,
        [username]: {
          ...prev.unreadCounts[username],
          count: 0
        }
      }
    }));
  };

  // Create the context value object with all necessary data and functions
  const contextValue = {
    ...state,
    setState,
    sendNotification,
    sendMessage,
    markAsRead,
    setUser,
    chatReadyState,
    notificationReadyState,
    sendFriendRequest,
    blockUser,
    resetUnreadCount
  };

  // Provide the context to child components
  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#333333'
          }
        }}
      />
    </WebSocketContext.Provider>
  );
};

// Custom hook to use the WebSocket context
export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  // Throw error if context is used outside of provider
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProviderForChat');
  }
  return context;
};
