from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import async_to_sync
from datetime import datetime
import json
from django.contrib.auth import get_user_model
import uuid
from myapp.models import Friendship
User = get_user_model()

class NotificationConsumer(AsyncJsonWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user_room = None

    async def connect(self):
        if self.scope["user"].is_anonymous:
            print("Anonymous user connection rejected")
            await self.close()
            return

        self.user = self.scope["user"]
        self.notification_group_name = f"notifications_{self.user.username}"
        
        print(f"User {self.user.username} connecting to group {self.notification_group_name}")
        
        await self.channel_layer.group_add(
            self.notification_group_name,
            self.channel_name
        )
        
        await self.accept()
        print(f"Connection accepted for user {self.user.username}")

    async def disconnect(self, close_code):
        if self.user_room:
            await self.channel_layer.group_discard(
                self.user_room,
                self.channel_name
            )
    
    @database_sync_to_async
    def get_user_by_id(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None
        
    async def receive_json(self, content):
        """Handle incoming WebSocket messages"""
        message_type = content.get('type')
        
        handlers = {
            'send_chat_notification': self.handle_chat_notification,
            'send_game_request': self.handle_game_request,
            'send_game_response': self.handle_game_response,
            'send_friend_request': self.handle_friend_request,
            # 'send_friend_request_response': self.handle_friend_request_response
        }
        
        handler = handlers.get(message_type)
        if handler:
            await handler(content)
        else:
            print(f"Unknown message type: {message_type}")

    async def handle_chat_notification(self, content):
        """Handle chat notification messages"""
        to_user_id = content.get('to_user_id')
        message = content.get('message')
        
        to_user = await self.get_user_by_id(to_user_id)
        if not to_user:
            return
        
        notification_group = f"notifications_{to_user.username}"
        
        await self.channel_layer.group_send(
            notification_group,
            {
                "type": "notify_chat_message",
                "message": message,
                "from_user": self.user.username
            }
        )

    async def handle_game_request(self, content):
        """Handle game request messages"""
        to_user_id = content.get('to_user_id')
        
        to_user = await self.get_user_by_id(to_user_id)
        if not to_user:
            return
            
        room_name = f"room_{min(self.user.id, to_user.id)}_{max(self.user.id, to_user.id)}"
        notification_group = f"notifications_{to_user.username}"
        
        await self.channel_layer.group_send(
            notification_group,
            {
                "type": "notify_game_request",
                "from_user": self.user.username,
                "from_user_id": self.user.id,
                "notification_id": str(uuid.uuid4()),
                "timestamp": datetime.now().isoformat(),
                "room_name": room_name,
                "to_user_id": self.user.id
            }
        )

    async def handle_game_response(self, content):
        """Handle game response messages"""
        to_user_id = content.get('to_user_id')
        accepted = content.get('accepted')
        
        to_user = await self.get_user_by_id(to_user_id)
        if not to_user:
            return
            
        room_name = f"room_{min(self.user.id, to_user.id)}_{max(self.user.id, to_user.id)}"
        notification_group = f"notifications_{to_user.username}"
        
        await self.channel_layer.group_send(
            notification_group,
            {
                "type": "notify_game_response",
                "from_user": self.user.username,
                "room_name": room_name,
                "accepted": accepted
            }
        )

    async def handle_friend_request(self, content):
        """Handle friend request messages"""
        to_user_id = content.get('to_user_id')
        
        to_user = await self.get_user_by_id(to_user_id)
        if not to_user:
            return
            
        notification_group = f"notifications_{to_user.username}"
        
        # Get the actual friendship ID
        friendship = await database_sync_to_async(Friendship.objects.create)(
            from_user=self.user,
            to_user=to_user
        )

        await self.channel_layer.group_send(
            notification_group,
            {
                "type": "notify_friend_request",
                "from_user": self.user.username,
                "notification_id": friendship.id, # TODO: i should change the name of the notification_id to friend_request_id
                "timestamp": datetime.now().isoformat()
            }
        )
    
    # async def handle_friend_request_response(self, content):
    #     """Handle friend request response messages"""
    #     to_user_id = content.get('to_user_id')
    #     accepted = content.get('accepted')
        
    #     to_user = await self.get_user_by_id(to_user_id)
    #     if not to_user:
    #         return
        
    #     notification_group = f"notifications_{to_user.username}"

    #     await self.channel_layer.group_send(
    #         notification_group,
    #         {
    #             "type": "notify_friend_request_response",
    #             "from_user": self.user.username,
    #             "accepted": accepted
    #         }
    #     )

    async def notify_friend_request(self, event):
        """Handle friend request notifications"""
        print(f"Processing friend request notification: {event}")
        
        notification_data = {
            'type': 'notification',
            'notification_type': 'friend_request',
            'message': f"{event['from_user']} sent you a friend request",
            'from_user': event['from_user'],
            'notification_id': event['notification_id'],
            'timestamp': event['timestamp']
        }
        
        print(f"Sending notification to client: {notification_data}")
        
        await self.send_json(notification_data)

    async def notify_game_request(self, event):
        """Handle game request notifications"""
        print(f"Processing game request notification: {event}")
        
        notification_data = {
            'type': 'notification',
            'notification_type': 'game_request',
            'message': f"{event['from_user']} invited you to play a game",
            'from_user': event['from_user'],
            'notification_id': event['notification_id'],
            'timestamp': event['timestamp'],
            'room_name': event['room_name'],
            'to_user_id': event['to_user_id']
        }
        
        print(f"Sending game request notification to client: {notification_data}")
        
        await self.send_json(notification_data)

    async def notify_game_response(self, event):
        """Handle game response notifications"""
        print(f"Processing game response notification: {event}")
        print(f"Sending game response notification to client  EE EE EEE : {event}")
        if event['accepted']:
            message = f"{event['from_user']} accepted your game request"
        else:
            message = f"{event['from_user']} declined your game request"
        
        notification_data = {
            'type': 'notification',
            'notification_type': 'game_response',
            'message': message,
            'from_user': event['from_user'],
            # 'notification_id': event['notification_id'],
            # 'timestamp': event['timestamp'],
            'room_name': event['room_name'],
            'accepted': event['accepted']
        }

        print(f"Sending game response notification to client: {notification_data}")

        await self.send_json(notification_data)

    async def notify_chat_message(self, event):
        """Handle chat message notifications"""
        print(f"Processing chat message notification: {event}")
        await self.send_json(event)




    async def notify_friend_request(self, event):
        """Handle friend request notifications"""
        await self.send_json({
            'type': 'notification',
            'notification_type': 'friend_request',
            'message': f"{event['from_user']} sent you a friend request",
            'from_user': event['from_user'],
            'notification_id': event['notification_id'],
            'timestamp': event['timestamp']
        })
