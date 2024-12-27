# tournament_manager.py
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from typing import Dict, List, Any
import asyncio
from channels.layers import get_channel_layer
import time
from .handlePlayMsg import handle_play_msg

class TournamentManager:
    def __init__(self):
        # Core tournament state
        self.waiting_players: Dict[int, dict] = {}  # {player_id: {channel, name, img}}
        self.player_join_order: List[int] = []  # [player_id]
        self.active_tournaments: Dict[str, dict] = {}  # {tournament_id: tournament_state}
        self.player_to_tournament: Dict[int, str] = {}  # {player_id: tournament_id}
        
        # Pre-match state
        self.pre_match_rooms: Dict[str, List[dict]] = {}  # {room_id: [player_info]}
        self.countdowns: Dict[str, asyncio.Task] = {}  # {room_id: countdown_task}
        
        # Tournament brackets
        self.tournament_brackets: Dict[str, dict] = {}  # {tournament_id: bracket_info}

        # Match state
        self.match_scores = {}  # {match_id: {player_id: score}}
        self.active_matches = {}  # {match_id: {player1_id, player2_id}}

        self.lock = asyncio.Lock()
        game_start_lock = asyncio.Lock()


    async def add_player(self, player_id: int, channel_name: str, player_info: dict) -> dict:
        """Add player to tournament waiting list"""
        print(f"Adding player to tournament: {player_info['name']} (ID: {player_id})")
        print(f"===> Player info: {player_info}")
        # Check if player is already in any state
        if player_id in self.waiting_players:
            players_needed = 4 - len(self.waiting_players)
            print(f"Player {player_id} already in waiting list")
            return {
                'type': 'tournament_update',
                'status': 'waiting',
                'message': 'Tournament queue...',
                'position': len(self.waiting_players),
                'players_needed': players_needed
            }

        # Check pre-match rooms
        for room_id, players in self.pre_match_rooms.items():
            if any(p['id'] == player_id for p in players):
                # Get opponent info
                player_info = next(p for p in players if p['id'] == player_id)
                opponent = next(p for p in players if p['id'] != player_id)
                return {
                    'type': 'tournament_update',
                    'status': 'pre_match',
                    'message': 'Tournament match forming...',
                    'matches': [room_id],
                    'opponent_name': opponent['name'],
                    'opponent_img': opponent['img'],
                    'players_needed': 0
                }

        # Add to waiting list
        self.waiting_players[player_id] = {
            'channel_name': channel_name,
            'id': player_id,
            'name': player_info['name'],
            'img': player_info['img']
        }

        print("waiting players ==> ", self.waiting_players)

        if player_id not in self.player_join_order:
            self.player_join_order.append(player_id)

        # Notify all waiting players of the updated count
        await self.notify_waiting_players()

        # Check if we can form new tournaments
        await self.check_waiting_list()

        players_needed = 4 - len(self.waiting_players)
        ordered_players = [
            self.waiting_players[player_id]
            for player_id in self.player_join_order
            if player_id in self.waiting_players
        ]

        return {
            'type': 'tournament_update',
            'status': 'waiting',
            'message': 'Tournament queue...',
            'position': len(self.waiting_players),
            'players_needed': players_needed,
            'current_players': [
                {
                    'id': p['id'],
                    'name': p['name'],
                    'img': p['img'],
                    'position': idx
                }
                for idx, p in enumerate(ordered_players)
            ]
        }

    async def notify_waiting_players(self):
        """Notify all waiting players of current queue status"""
        players_needed = 4 - len(self.waiting_players)
        channel_layer = get_channel_layer()

        ordered_players = [
            self.waiting_players[player_id]
            for player_id in self.player_join_order
            if player_id in self.waiting_players
        ]


        for player in self.waiting_players.values():
            await channel_layer.send(
                player['channel_name'],
                {
                    'type': 'tournament_update',
                    'status': 'waiting',
                    'players': list(self.waiting_players.values()),
                    'message': 'Tournament queue...',
                    'players_needed': players_needed,
                    'current_players': [
                        {
                            'id': p['id'],
                            'name': p['name'],
                            'img': p['img'],
                            'position': idx
                        }
                        for idx, p in enumerate(ordered_players)
                    ]
                }
            )

    async def setup_tournament(self):
        print("Setting up tournament [[111]]")
        """Create tournament brackets when we have 4 players"""
        if len(self.waiting_players) < 4:
            return False
        print("Setting up tournament [[222]]")
        # Take first 4 players from waiting list
        tournament_players = list(self.waiting_players.items())[:4]
        
        # Generate tournament ID using first player's ID
        tournament_id = f"tournament_{tournament_players[0][0]}_{int(time.time())}"

        # Fetch ranks and sort players by rank
        ranked_players = []
        for player_id, player_info in tournament_players:
            user = await self.get_user_async(player_id)
            rank = user.rank if user else 0
            ranked_players.append((player_id, player_info, rank))
        
        # Sort by rank (highest to lowest)
        ranked_players.sort(key=lambda x: -x[2])  # Sort by rank (third element)
        
        # Create tournament bracket with #1 vs #4, #2 vs #3
        bracket = {
            'round': 1,
            'matches': [
                {
                    'match_id': f"{tournament_id}_m1",
                    'players': [
                        {'id': ranked_players[0][0],'position': 'left', 'info': ranked_players[0][1]},  # #1 seed
                        {'id': ranked_players[3][0],'position': 'right', 'info': ranked_players[3][1]}   # #4 seed
                    ],
                    'winner': None
                },
                {
                    'match_id': f"{tournament_id}_m2",
                    'players': [
                        {'id': ranked_players[1][0],'position': 'left', 'info': ranked_players[1][1]},  # #2 seed
                        {'id': ranked_players[2][0],'position': 'right', 'info': ranked_players[2][1]}   # #3 seed
                    ],
                    'winner': None
                }
            ],
            'final_match': {
                'match_id': f"{tournament_id}_final",
                'players': [],
                'winner': None
            }
        }

        print("Setting up tournament [[333]]")
        
        self.tournament_brackets[tournament_id] = bracket
        
        # Remove players from waiting list
        for player_id, _ in tournament_players:
            if player_id in self.waiting_players:
                del self.waiting_players[player_id]
        
        # Create first round matches
        await self.create_round_matches(tournament_id)
        
        return True
    
    @staticmethod
    async def get_user_async(user_id):
        """Helper method to fetch user asynchronously"""
        try:
            from django.contrib.auth import get_user_model
            from channels.db import database_sync_to_async
            
            User = get_user_model()
            
            @database_sync_to_async
            def get_user(uid):
                try:
                    return User.objects.get(id=uid)
                except User.DoesNotExist:
                    return None
                
            return await get_user(user_id)
        except Exception as e:
            print(f"[get_user_async] Error fetching user {user_id}: {e}")
            return None

    async def create_round_matches(self, tournament_id: str):
        print("Creating round matches")
        """Create matches for current tournament round"""
        bracket = self.tournament_brackets[tournament_id]
        current_matches = bracket['matches']
        
        for match in current_matches:
            if not match['winner']:  # Only create matches that haven't been played
                player1, player2 = match['players']
                room_id = f"match_{match['match_id']}"

                # Store player info for match
                self.pre_match_rooms[room_id] = [
                    self.waiting_players.get(player1['id']) or player1['info'],
                    self.waiting_players.get(player2['id']) or player2['info']
                ]
                
                # Notify players
                print(f"=====> OOOOOOOO [create_round_matches] Notifying players in room {room_id}")
                await self.notify_pre_match_players(room_id)

    async def notify_pre_match_players(self, room_id: str):
        """Notify all players in a pre-match room about the game formation"""
        if room_id not in self.pre_match_rooms:
            print(f"[notify_pre_match_players] Room {room_id} not found")
            return

        players = self.pre_match_rooms[room_id]
        channel_layer = get_channel_layer()
        
        print(f"[notify_pre_match_players] Notifying players in room {room_id}")

        # Get tournament ID from room ID to find all related matches
        tournament_id = self.get_tournament_id_from_room(room_id)
        tournament_rooms = [
            r_id for r_id in self.pre_match_rooms.keys() 
            if self.get_tournament_id_from_room(r_id) == tournament_id
        ]

        all_tournament_players = []
        for t_room in tournament_rooms:
            all_tournament_players.extend(self.pre_match_rooms[t_room])

        room_players = self.pre_match_rooms[room_id]

        # notify players they're matched
        for player in players:
            opponent = next(p for p in players if p['id'] != player['id'])
            print(f"[notify_pre_match_players] Notifying player {player['id']} about opponent {opponent['id']}")
            await channel_layer.send(
                player['channel_name'],
                {
                    'type': 'tournament_update',
                    'status': 'pre_match',
                    'message': 'Tournament match forming...',
                    'opponent_name': opponent['name'],
                    'opponent_img': opponent['img'],
                    'players_needed': 0,
                    'current_players': [
                        {
                            'id': p['id'],
                            'name': p['name'],
                            'img': p['img'],
                            'position': idx
                        }
                        for idx, p in enumerate(all_tournament_players)
                    ]
                }
            )
        
        # Start countdown for this room
        print(f"[notify_pre_match_players] Starting countdown for room {room_id}")
        countdown_task = asyncio.create_task(
            self.start_pre_match_countdown(room_id)
        )
        self.countdowns[room_id] = countdown_task

    async def start_pre_match_countdown(self, room_id: str, total_time: int = 20):
        """Start countdown for a pre-match room"""
        print(f"[start_pre_match_countdown] Starting countdown for room {room_id}")
        try:
            channel_layer = get_channel_layer()
            
            # Verify room still exists
            if room_id not in self.pre_match_rooms:
                print(f"[start_pre_match_countdown] Room {room_id} no longer exists")
                return
                
            # Get tournament ID from room ID to find all related matches
            tournament_id = self.get_tournament_id_from_room(room_id)
            tournament_rooms = [
                r_id for r_id in self.pre_match_rooms.keys() 
                if self.get_tournament_id_from_room(r_id) == tournament_id
            ]

            all_tournament_players = []
            for t_room in tournament_rooms:
                all_tournament_players.extend(self.pre_match_rooms[t_room])
            
            players = self.pre_match_rooms[room_id]

            for remaining_time in range(total_time, -1, -1):
                # Check if room still exists (not cancelled)
                if room_id not in self.pre_match_rooms:
                    print(f"[start_pre_match_countdown] Room {room_id} no longer exists, stopping countdown")
                    return
                
                print(f"[start_pre_match_countdown] Room {room_id} countdown: {remaining_time}")
                
                # Send countdown update to all players in this room only
                for player in players:
                    room_players = self.pre_match_rooms[room_id]
                    await channel_layer.send(
                        player['channel_name'],
                        {
                            'type': 'tournament_update',
                            'status': 'countdown',
                            'message': "All players are ready",
                            'time_remaining': remaining_time,
                            'is_countdown': True,
                            'room_name': room_id,
                            'current_players': [
                                {
                                    'id': p['id'],
                                    'name': p['name'],
                                    'img': p['img'],
                                    'position': idx
                                }
                                for idx, p in enumerate(all_tournament_players)
                            ]
                        }
                    )
                await asyncio.sleep(1)
            
            print(f"[start_pre_match_countdown] Countdown finished for room {room_id}")

            # Get all tournament rooms that need to start games
            tournament_id = self.get_tournament_id_from_room(room_id)
            tournament_rooms = [
                r_id for r_id in self.pre_match_rooms.keys() 
                if self.get_tournament_id_from_room(r_id) == tournament_id
            ]

            # Start game for each room
            for match_room_id in tournament_rooms:
                try:
                    room_players = self.pre_match_rooms[match_room_id]
                    player1 = room_players[0]
                    player2 = room_players[1]
                    
                    print(f"[tournament_start] Starting game for room {match_room_id}")
                    print(f"[tournament_start] Players: {player1['name']} vs {player2['name']}")

                    content = {
                        'player_ready1': player1['id'],
                        'player_ready1_name': player1['name'],
                        'player_ready1_img': player1['img'],
                        'player_ready2': player2['id'],
                        'player_ready2_name': player2['name'],
                        'player_ready2_img': player2['img'],
                        'room_name': match_room_id,
                        'canvas_width': 800,
                        'canvas_height': 600,
                        'mode': 'tournament'
                    }

                    # Keep a copy of pre_match_room data
                    room_data = self.pre_match_rooms[match_room_id].copy()
                    
                    print(f"[tournament_start] Calling handle_play_msg for room {match_room_id}")
                    
                    channel_layer = get_channel_layer()
                    await channel_layer.send(player['channel_name'], {
                        'type': 'receive_json',
                        'content': {
                            'type': 'tournament_game_start',
                            'content': content
                        }
                    })
                    
                    print(f"[tournament_start] Game started for room {match_room_id}")

                except Exception as e:
                    print(f"[tournament_start] Error starting game for room {match_room_id}: {e}")

            print("[tournament_start] All games should be started")
                    
        except Exception as e:
            print(f"[start_pre_match_countdown] Error in countdown for room {room_id}: {str(e)}")
            await self.cleanup_pre_match_room(room_id)

    async def cleanup_pre_match_room(self, room_id: str):
        """Clean up a pre-match room and notify players"""
        if room_id in self.pre_match_rooms:
            players = self.pre_match_rooms[room_id]
            channel_layer = get_channel_layer()
            
            # Notify players
            for player in players:
                await channel_layer.send(
                    player['channel_name'],
                    {
                        'type': 'tournament_update',
                        'status': 'error',
                        'message': 'Match setup failed. Please try again.'
                    }
                )
            
            # Clean up room
            del self.pre_match_rooms[room_id]
            if room_id in self.countdowns:
                self.countdowns[room_id].cancel()
                del self.countdowns[room_id]

    def get_tournament_id_from_room(self, room_id: str) -> str:
        """Extract full tournament ID from room ID"""
        # Example room_id: "match_tournament_6_1733734802_m1"
        parts = room_id.split('_')
        if len(parts) >= 4 and parts[0] == "match" and parts[1] == "tournament":
            # Combine the unique tournament identifier parts
            return f"tournament_{parts[2]}_{parts[3]}"
        return None

    async def handle_pre_match_leave(self, room_id: str, player_id: int):
        """Handle player leaving during pre-match phase with improved error handling"""
        try:
            if room_id not in self.pre_match_rooms:
                print(f"[handle_pre_match_leave] Room {room_id} not found")
                return
                
            tournament_id = self.get_tournament_id_from_room(room_id)
            if not tournament_id:
                print(f"[handle_pre_match_leave] Invalid room ID format: {room_id}")
                return
            
            print(f"[handle_pre_match_leave] Processing leave for tournament {tournament_id}")
            
            # Get rooms from this specific tournament
            current_tournament_rooms = [
                r_id for r_id in self.pre_match_rooms.keys() 
                if self.get_tournament_id_from_room(r_id) == tournament_id
            ]
            
            print(f"[handle_pre_match_leave] Tournament rooms: {current_tournament_rooms}")
            print(f"[handle_pre_match_leave] Waiting players count: {len(self.waiting_players)}")

            # Cancel all countdowns first
            for tournament_room_id in current_tournament_rooms:
                if tournament_room_id in self.countdowns:
                    print(f"[handle_pre_match_leave] Cancelling countdown for room {tournament_room_id}")
                    try:
                        countdown_task = self.countdowns[tournament_room_id]
                        countdown_task.cancel()
                        await countdown_task
                    except asyncio.CancelledError:
                        print(f"[handle_pre_match_leave] Countdown cancelled for {tournament_room_id}")
                    except Exception as e:
                        print(f"[handle_pre_match_leave] Error cancelling countdown: {e}")
                    finally:
                        del self.countdowns[tournament_room_id]
            
            # Try to get replacement from waiting list
            if self.waiting_players and self.player_join_order:
                print("[handle_pre_match_leave] Found waiting players, attempting replacement")
                try:
                    # Safely get first waiting player
                    first_waiting_id = None
                    for pid in self.player_join_order:
                        if pid in self.waiting_players:
                            first_waiting_id = pid
                            break
                    
                    if first_waiting_id is None:
                        raise Exception("No valid waiting players found")
                    
                    replacement_info = self.waiting_players.pop(first_waiting_id)
                    self.player_join_order.remove(first_waiting_id)
                    replacement_id = first_waiting_id

                    # Notify remaining waiting players
                    await self.notify_waiting_players()

                    # Update the room with replacement
                    if room_id in self.pre_match_rooms:
                        current_players = self.pre_match_rooms[room_id]
                        new_players = [p for p in current_players if p['id'] != player_id]
                        new_players.append({
                            'id': replacement_id,
                            **replacement_info
                        })
                        
                        print(f"[handle_pre_match_leave] Replacing player {player_id} with {replacement_id}")
                        self.pre_match_rooms[room_id] = new_players

                        # Restart countdowns
                        for tournament_room_id in current_tournament_rooms:
                            if tournament_room_id in self.pre_match_rooms:
                                print(f"[handle_pre_match_leave] Restarting countdown for room {tournament_room_id}")
                                await self.notify_pre_match_players(tournament_room_id)
                    else:
                        raise Exception("Room no longer exists")
                    
                except Exception as e:
                    print(f"[handle_pre_match_leave] Error during replacement: {e}")
                    await self.cleanup_tournament(tournament_id, current_tournament_rooms, player_id)
            else:
                print("[handle_pre_match_leave] No waiting players available, cleaning up tournament")
                await self.cleanup_tournament(tournament_id, current_tournament_rooms, player_id)

        except Exception as e:
            print(f"[handle_pre_match_leave] Unexpected error: {e}")
            if tournament_id:
                await self.cleanup_tournament(tournament_id, current_tournament_rooms, player_id)

    async def cleanup_tournament(self, tournament_id: str, tournament_rooms: List[str], leaving_player_id: int):
        """Clean up tournament state when a player leaves"""
        try:
            # Collect affected players
            affected_players = []
            for room_id in tournament_rooms:
                if room_id in self.pre_match_rooms:
                    room_players = self.pre_match_rooms[room_id]
                    new_affected = [p for p in room_players if p['id'] != leaving_player_id]
                    affected_players.extend(new_affected)

                    # Clean up room
                    del self.pre_match_rooms[room_id]

            # Clean up tournament bracket
            if tournament_id in self.tournament_brackets:
                del self.tournament_brackets[tournament_id]

            # Reset and update waiting list
            self.player_join_order = []
            for player in affected_players:
                self.waiting_players[player['id']] = player
                self.player_join_order.append(player['id'])

            # Notify affected players
            channel_layer = get_channel_layer()
            for player in affected_players:
                try:
                    await channel_layer.send(
                        player['channel_name'],
                        {
                            'type': 'tournament_update',
                            'status': 'waiting',
                            'message': 'A player left. Returning to queue...',
                            'players_needed': 4 - len(self.waiting_players),
                            'current_players': [
                                {
                                    'id': p['id'],
                                    'name': p['name'],
                                    'img': p['img'],
                                    'position': idx
                                }
                                for idx, p in enumerate(
                                    [self.waiting_players[pid] for pid in self.player_join_order]
                                )
                            ]
                        }
                    )
                except Exception as e:
                    print(f"[cleanup_tournament] Error notifying player {player['id']}: {e}")

            # Check for new tournament formation
            if len(self.waiting_players) >= 4:
                await self.setup_tournament()

        except Exception as e:
            print(f"[cleanup_tournament] Error during cleanup: {e}")

    async def check_waiting_list(self):
        """Check if we can form new tournaments from waiting list"""
        if len(self.waiting_players) >= 4:
            await self.setup_tournament()

    async def remove_player(self, player_id: int) -> dict:
        """Remove player from any tournament state with atomic operations"""
        async with self.lock:
            try:
                # Remove from waiting list if present
                if player_id in self.waiting_players:
                    if player_id in self.player_join_order:
                        self.player_join_order.remove(player_id)
                    self.waiting_players.pop(player_id)
                    await self.notify_waiting_players()
                    await self.check_waiting_list()
                    return {
                        'type': 'tournament_update',
                        'status': 'cancelled',
                        'message': 'Successfully left tournament queue',
                        'current_players': []
                    }

                # Check pre-match rooms
                room_id = self.find_player_pre_match(player_id)
                if room_id:
                    print(f"Player {player_id} found in room {room_id}")
                    await self.handle_pre_match_leave(room_id, player_id)
                    return {
                        'type': 'tournament_update',
                        'status': 'cancelled',
                        'message': 'Successfully left pre-match',
                        'current_players': []
                    }

                return {
                    'type': 'tournament_update',
                    'status': 'error',
                    'message': 'Player not found in tournament'
                }
                
            except Exception as e:
                print(f"Error removing player {player_id}: {str(e)}")
                return {
                    'type': 'tournament_update',
                    'status': 'error',
                    'message': f'Error processing request: {str(e)}'
                }

    def find_player_pre_match(self, player_id: int) -> str:
        """Find which pre-match room a player is in"""
        for room_id, players in self.pre_match_rooms.items():
            if any(p['id'] == player_id for p in players):
                return room_id
        return None

    async def send_to_player(self, channel_name: str, message: dict):
        """Helper method to send message to a player through the channel layer"""
        channel_layer = get_channel_layer()
        await channel_layer.send(channel_name, {
            'type': 'send_json',
            'data': message
        })
    
# ************************** Handling In Game Events **************************



    # async def update_score(self, match_id: str, scorer_id: int):
    #     """Handle score updates during match"""
    #     if match_id not in self.match_scores:
    #         return None
            
    #     # Update score
    #     self.match_scores[match_id][scorer_id] += 1
    #     scores = self.match_scores[match_id]
        
    #     # Check for match completion
    #     is_complete = any(score >= 7 for score in scores.values())
    #     response = {
    #         'scores': scores,
    #         'is_complete': is_complete
    #     }
        
    #     if is_complete:
    #         winner_id = max(scores.items(), key=lambda x: x[1])[0]
    #         response['winner_id'] = winner_id
    #         await self.end_match(match_id)
            
    #     return response

    async def end_match(self, match_id: str):
        """Handle match completion"""
        scores = self.match_scores[match_id]
        players = self.active_matches[match_id]
        
        # Get winner/loser
        winner_id = max(scores.items(), key=lambda x: x[1])[0]
        loser_id = min(scores.items(), key=lambda x: x[1])[0]

        # Create game records
        from .models import GameResult
        GameResult.objects.create(
            user=winner_id,
            opponent=loser_id,
            userScore=scores[winner_id],
            opponentScore=scores[loser_id]
        )

        # Update tournament bracket
        tournament_id = '_'.join(match_id.split('_')[:-1])  # Remove match number
        if tournament_id in self.tournament_brackets:
            bracket = self.tournament_brackets[tournament_id]
            for match in bracket['matches']:
                if match['match_id'] == match_id:
                    match['winner'] = winner_id
                    break
                    
            # Check for tournament round completion
            if all(match['winner'] for match in bracket['matches']):
                await self.advance_tournament(tournament_id)
        
        # Cleanup
        del self.match_scores[match_id]
        del self.active_matches[match_id]