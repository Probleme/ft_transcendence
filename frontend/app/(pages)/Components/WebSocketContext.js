"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import toast, { Toaster } from "react-hot-toast";
import {
  Bell,
  MessageSquare,
  GamepadIcon,
  Trophy,
  UserPlus,
} from "lucide-react";
import Axios from "../Components/axios";
import { config } from "../Components/config";
import { useRouter } from "next/navigation";
import { useWebSocketContext as useGameWebSocket } from "../game/webSocket";
import { Task } from "../Components/task";
import { handleNotificationDisplay } from '../Components/NotificationComponents';

const formatTimestamp = (timestamp) => {
  // Check if timestamp exists and is valid
  if (!timestamp) return "";

  try {
    // Remove the microseconds and 'Z' and replace 'T' with space
    return timestamp.replace("T", " ").split(".")[0];
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return timestamp; // Return original timestamp if formatting fails
  }
};
// Create a context to share WebSocket state across components
const WebSocketContext = createContext(null);

// Define different types of notifications the app can handle
const NOTIFICATION_TYPES = {
  CHAT_MESSAGE: "notify_chat_message",
  GAME_REQUEST: "game_request",
  ACHIEVEMENT: "achievement",
  FRIEND_REQUEST: "friend_request",
  GAME_RESPONSE: "game_response",
};

// Configuration for how each notification type should be displayed
const NOTIFICATION_CONFIG = {
  [NOTIFICATION_TYPES.CHAT_MESSAGE]: {
    icon: MessageSquare,
    style: "bg-blue-50 border-blue-200",
    title: "New Message",
    duration: 4000,
  },
  [NOTIFICATION_TYPES.GAME_REQUEST]: {
    icon: GamepadIcon,
    style: "bg-purple-50 border-purple-200",
    title: "Game Request",
    duration: 30000,
  },
  [NOTIFICATION_TYPES.ACHIEVEMENT]: {
    icon: Trophy,
    style: "bg-yellow-50 border-yellow-200",
    title: "Achievement Unlocked!",
    duration: 3000,
  },
  [NOTIFICATION_TYPES.FRIEND_REQUEST]: {
    icon: UserPlus,
    style: "bg-blue-50 border-blue-200",
    title: "Friend Request",
    duration: 20000,
  },
  [NOTIFICATION_TYPES.GAME_RESPONSE]: {
    icon: GamepadIcon,
    style: "bg-purple-50 border-purple-200",
    title: "Game Response",
    duration: 20000,
  },
};

// The main WebSocket Provider component that wraps the app
export const WebSocketProviderForChat = ({ children }) => {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);


  // Main state object containing all WebSocket-related data
  const [state, setState] = useState({
    notifications: [], // Array of active notifications
    messages: {}, // Object storing chat messages by user
    currentUser: null, // Currently logged in user
    connectionStatus: "Disconnected", // WebSocket connection status
    unreadCounts: {}, // Add unreadCounts to state
    activeChat: null, // Add this to track active chat
    isLoading: true, // Add loading state
  });
  const [loggedInUser, setLoggedInUser] = useState({});

  // Fetch user on mount
  useEffect(() => {
    const task = new Task();
    const fetchUser = async () => {
      const is42Login = localStorage.getItem('is42Login');
      if (is42Login) {
        // Add a small delay for 42 login to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        localStorage.removeItem('is42Login');
      }
      try {
        const userResponse = await Axios.get("/api/user_profile/");
        setState((prev) => ({
          ...prev,
          currentUser: userResponse.data.username,
          isLoading: false,
        }));
        task.start();
        setLoggedInUser(userResponse.data);
      } catch (error) {
        console.error("Failed to fetch user profile:", error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    fetchUser();

    return () => {
      task.stop();
    }
  }, []);

    // Don't render children until initial auth check is complete
    // if (!authChecked) {
    //   return null; // or a loading spinner
    // }

  const { sendGameMessage } = useGameWebSocket();

  useEffect(() => {
    const fetchNotifications = async () => {
      if (state.currentUser) {
        try {
          const response = await Axios.get("/api/notifications/");
          console.log("Notifications: = ", response.data);
          setState((prev) => ({
            ...prev,
            notifications: response.data,
          }));
        } catch (error) {
          console.error("Failed to fetch notifications:", error);
        }
      }
    };

    fetchNotifications();
  }, [state.currentUser]);




  // WebSocket URLs for notifications and chat
  const chatWsUrl = state.currentUser
    ? `${config.wsUrl}/chat/${state.currentUser}/`
    : null;
  // console.log("Current User---", state.currentUser);

  // Set up chat WebSocket connection
  const {
    sendJsonMessage: sendChatMessage, // Function to send chat messages
    readyState: chatReadyState, // Chat connection status
  } = useWebSocket(chatWsUrl, {
    enabled: !!state.currentUser,
    shouldReconnect: (closeEvent) => {
      return closeEvent.code !== 1000; // Reconnect if close wasn't clean (code 1000)
    },
    reconnectInterval: 3000,
    onMessage: (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "chat_message") {
        handleChatMessage(data);
      } else if (data.type === "message_sent") {
        // Update the sent message with the server-generated ID
        setState((prev) => ({
          ...prev,
          messages: {
            ...prev.messages,
            [data.receiver]: prev.messages[data.receiver].map((msg) =>
              msg.timestamp === data.timestamp && !msg.id
                ? { ...msg, id: data.message_id }
                : msg
            ),
          },
        }));
      }
    },
    onError: (error) => console.error("Chat WebSocket error:", error),
  });

  // Handle incoming chat messages
  const handleChatMessage = (data) => {
    if (data.type === "chat_message") {
      setState((prev) => {
        // If we're actively chatting with this user, send read receipt to backend
        if (data.sender === prev.activeChat) {
          // mark the message as read
          Axios.post(`/chat/mark_message_as_read/${data.sender}/`, {
            message_id: data.message_id,
          }).catch((error) => {
            console.error("Failed to mark message as read:", error);
          });
        }

        // Rest of the state update logic...
        // check if the message is from the current user or the active chat
        if (
          data.sender === prev.currentUser ||
          data.sender === prev.activeChat
        ) {
          return {
            ...prev,
            messages: {
              ...prev.messages,
              [data.sender]: [
                ...(prev.messages[data.sender] || []),
                {
                  id: data.message_id,
                  content: data.message,
                  timestamp: data.timestamp,
                  isUser: false,
                  isRead: true,
                  sender: data.sender,
                  receiver: data.receiver,
                },
              ],
            },
          };
        }

        // Handle messages for non-active chats...
        const newUnreadCounts = {
          ...prev.unreadCounts,
          [data.sender]: {
            count: (prev.unreadCounts[data.sender]?.count || 0) + 1,
            user_id: data.sender_id,
            last_message: {
              content: data.message,
              timestamp: data.timestamp,
            },
          },
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
                receiver: data.receiver,
              },
            ],
          },
        };
      });
    }
  };

  // Function to send a new chat message
  const sendMessage = (content, receiver, historicData = null) => {
    const timestamp =
      historicData?.timestamp ||
      new Date().toISOString().slice(0, 16).replace("T", " ");

    // If this is a historic message, just update the state
    if (historicData?.isHistoric) {
      setState((prev) => ({
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
              receiver,
            },
          ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)), // Sort messages by timestamp
        },
      }));
      return;
    }

    // For new messages, send through WebSocket
    if (chatReadyState === ReadyState.OPEN) {
      sendChatMessage({
        type: "chat_message",
        message: content,
        receiver,
        sender: state.currentUser,
      });

      setState((prev) => ({
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
              receiver,
            },
          ],
        },
      }));
    }
  };

  // Set the current user
  const setUser = (username) => {
    setState((prev) => ({ ...prev, currentUser: username }));
  };

  // Set the users
  const setUsers = (users) => {
    setState((prev) => ({ ...prev, users }));
  };

  // Add this function to set active chat
  const setActiveChat = (username) => {
    setState((prev) => ({ ...prev, activeChat: username }));
  };

  // Process different types of notifications !!!!!!!!!!!!!!!!!!!!

  const notificationWsUrl = state.currentUser
    ? `${config.wsUrl}/notifications/`
    : null;
  // console.log("NOTIFICATION WS URL", notificationWsUrl);

  // Notification WebSocket
  const {
    sendMessage: sendNotification, // Function to send notifications
    // lastMessage: lastNotificationMessage, // Last received notification
    readyState: notificationReadyState, // Connection status
  } = useWebSocket(notificationWsUrl, {
    shouldReconnect: (closeEvent) => {
      return closeEvent.code !== 1000; // Reconnect if close wasn't clean (code 1000)
    },
    reconnectInterval: 3000,
    onOpen: () => {
      // console.log("WebSocket Connection Opened for notifications");
      // console.log("Connected to:", notificationWsUrl);
      setState((prev) => ({ ...prev, connectionStatus: "Connected" }));
      sendNotification(JSON.stringify({ type: "get_notifications" }));
    },
    onMessage: (event) => {
      console.log(
        "Raw WebSocket message received in notifications:",
        event.data
      );
      try {
        const parsedData = JSON.parse(event.data);
        console.log("Parsed notification data:", parsedData);
        handleNotification(parsedData);
      } catch (error) {
        console.error("Failed to parse notification data:", error);
      }
    },
    onClose: () => {
      console.log("WebSocket Connection Closed for notifications");
      setState((prev) => ({ ...prev, connectionStatus: "Disconnected" }));
    },
    onError: (error) => {
      console.error("WebSocket Error:", error);
    },
  });

  // Handle responses to game requests
  const handleGameResponse = async (notificationId, accepted, data) => {
    // Dismiss any existing toast notifications
    toast.dismiss();

    try {
      if (accepted) {
        // inform the other player that he has accepted the game request
        sendNotification(
          JSON.stringify({
            type: "send_game_response",
            to_user_id: data.to_user_id,
            accepted: true,
          })
        );
        window.location.assign(`./game?room_name=${data.room_name}`);

        toast.success("Joining game...", {
          duration: 2000,
        });
        // router.push(`/game`);
      } else {
        // inform the other player that he has declined the game request
        sendNotification(
          JSON.stringify({
            type: "send_game_response",
            to_user_id: data.to_user_id,
            accepted: false,
          })
        );
        toast.success("Game request declined", {
          duration: 2000,
        });
      }
    } catch (error) {
      toast.error("Failed to process game request");
      console.error("Error handling game request:", error);
    }
  };










  const handleNotification = (data) => {
    console.log("handleNotification called with:", data);
  
    // Ensure we have a notification ID
    const notificationId = data.notification_id || data.id;
  
    if (!notificationId) {
      console.error("Notification received without ID:", data);
      return;
    }
  
    // Update notifications state
    setState((prev) => ({
      ...prev,
      notifications: [
        {
          id: notificationId,
          notification_id: notificationId,
          type: data.type,
          message: data.message,
          created_at: data.timestamp,
          is_read: false,
          sender: data.from_user,
          // Additional fields for specific notification types
          ...(data.type === "notify_friend_request" && {
            friend_request_id: data.friend_request_id,
          }),
          ...(data.type === "game_response" && {
            accepted: data.accepted,
            room_name: data.room_name,
          }),
        },
        ...prev.notifications,
      ].slice(0, 50),
    }));
  
    // Skip chat notifications if user is on chat page
    if (data.type === "notify_chat_message" && window.location.pathname.includes("/chat")) {
      return;
    }
  
    // Handle game response redirection
    if (data.type === "game_response" && data.accepted) {
      window.location.assign(`./../game?room_name=${data.room_name}`);
    }
  
    // Display notification toast
    const notification = handleNotificationDisplay(data, handleGameResponse);
    if (notification) {
      toast.custom(notification.content, notification.options);
    }
  };







  const markAsRead = async (notificationId) => {
    if (!notificationId) {
      console.error("No notification ID provided");
      return;
    }

    try {
      // check if the notification is already read
      const notification = state.notifications.find(
        (notif) => notif.id === notificationId
      );
      if (notification.is_read) {
        return;
      }
      await Axios.post(`/api/notifications/${notificationId}/mark-read/`);
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((notif) => {
          // Check both notification_id and id
          return notif.id === notificationId ||
            notif.notification_id === notificationId
            ? { ...notif, is_read: true }
            : notif;
        }),
      }));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      throw error;
    }
  };

  const markAllAsRead = async () => {
    try {
      await Axios.post("/api/notifications/mark-all-read/");
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  // Display notification as a toast message
  const showNotificationToast = (data) => {
    const config = NOTIFICATION_CONFIG[data.type];

    if (data.accepted === true) {
      toast.success("Joining game...", {
        duration: 2000,
      });
      router.push(`/game`);
    }
    if (!config) return;

    const toastContent = (
      <div className="flex items-start gap-3">
        <div className="flex-1 bg-[#222831]">
          <p className="font-kreon">{config.title}</p>
          <p>{data.message}</p>
          <p className="text-sm text-gray-500 mt-1">{data.timestamp}</p>
          {data.type === NOTIFICATION_TYPES.GAME_REQUEST && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() =>
                  handleGameResponse(data.notification_id, true, data)
                }
                className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Accept
              </button>
              <button
                onClick={() =>
                  handleGameResponse(data.notification_id, false, data)
                }
                className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                Decline
              </button>
            </div>
          )}
        </div>
        {data.notification_id &&
          data.type !== NOTIFICATION_TYPES.GAME_REQUEST && (
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
      duration: 1000,
      style: {
        background: "#222831",
        padding: "16px",
        borderRadius: "8px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      },
    });
  };

  // function to send game request
  const sendGameRequest = async (userId) => {
    try {
      sendNotification(
        JSON.stringify({
          type: "send_game_request",
          to_user_id: userId,
        })
      );
      toast.success("Game request sent!");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to send game request");
    }
  };

  // end of the notification code !!!!!!!!!!!!!!!!!!!!

  const sendFriendRequest = async (userId) => {
    try {
      sendNotification(JSON.stringify({
        type: 'send_friend_request',
        to_user_id: userId
      }));
      console.log("=====> sent successfully ===");
    } catch (error) {
      if (Axios.isAxiosError(error)) {
        if (error.response?.status === 400) {
          // Handle blocked user error
          toast.error(
            error.response.data.error || "Cannot send friend request"
          );
        }
      }
    }
  };

  const blockUser = (userToBlock) => {
    if (chatReadyState === ReadyState.OPEN) {
      sendChatMessage({
        type: "block_user",
        blocker: state.currentUser,
        blocked: userToBlock,
      });
    }
  };

  // Add function to reset unread count
  const resetUnreadCount = (username) => {
    setState((prev) => ({
      ...prev,
      unreadCounts: {
        ...prev.unreadCounts,
        [username]: {
          ...prev.unreadCounts[username],
          count: 0,
        },
      },
    }));
  };

  const sendGameResponse = async (userId, accepted) => {
    const response = await Axios.post(`/api/game/response/${userId}/`, {
      accepted: accepted,
    });
    toast.success("Game response sent!");
  };

  // Create the context value object with all necessary data and functions
  const contextValue = {
    ...state, // used in chat page
    setState, // used in chat page
    sendNotification, // used in chat page and profile page
    sendMessage, // used in chat page
    resetUnreadCount, // used in chat page
    setActiveChat, // set active chat used in chat page
    sendGameRequest, // used in profile page
    markAsRead,
    setUser,
    setUsers,
    chatReadyState,
    notificationReadyState,
    sendFriendRequest,
    blockUser,
    handleGameResponse,
    loggedInUser,
    markAllAsRead,
  };

  // If still loading, you might want to show nothing or a loading indicator
  if (state.isLoading) {
    return null; // or return a loading spinner
  }

  // Provide the context to child components
  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#ffffff",
            color: "#333333",
          },
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
    throw new Error(
      "useWebSocketContext must be used within a WebSocketProviderForChat"
    );
  }
  return context;
};
