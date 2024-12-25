// ---------------------------------------------------------------------------------------------------------------------------------------------------
//|                                                                                                                                                   |
//|               profile should have history of user matches with details and win & loses stats and game counter and level of user                   |
//|               if he's a stranger then send friend request and block user button should be there with just his win and lose stats and game counter |
//|               if he's a friend then remove friendship and block user button should be there with all the details of his game stats                |
//|                                                                                                                                                   |
// ---------------------------------------------------------------------------------------------------------------------------------------------------
"use client";

import React, { useEffect, useState } from "react";
import "../globals.css";
import Axios from "./axios";
import toast from "react-hot-toast";
import GameData from "../user-profile/[userId]/(profileComponents)/gameData";
import {
  sendFriendRequest,
  removeFriendship,
  blockUser,
  unblockUser,
  friendshipStatusFunc,
} from "../user-profile/[userId]/(profileComponents)/profileFunctions";

import { useWebSocketContext } from "../Components/WebSocketContext";

const Profile = ({ userData, myProfile }) => {
  


  // --------------------------------------------------------------------------------------


  const userId = userData.id;
  let currentUserId;
  const [friendshipStatus, setFriendshipStatus] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { sendGameRequest, sendFriendRequest3 } = useWebSocketContext();
  const [currUser, setCurrUser] = useState(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        if (myProfile === false) {
          const userResponse = await Axios.get("/api/user_profile/");
          currentUserId = userResponse.data.id;
          setCurrUser(userResponse.data);
          const friendshipResponse = await Axios.get(
            `/api/friends/friendship_status/${userId}/`
          );
          setFriendshipStatus(friendshipResponse.data);
        } else {
          return null;
        }
          
      } catch (err) {
        setError(err.response?.data?.message || "An error occurred");
        toast.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserProfile();
  }, [userId]);

  
  
  const sendFriendRequest = async () => {
    if (myProfile) return;
    try {
      await sendFriendRequest3(userId);
      await friendshipStatusFunc(userId, setFriendshipStatus);
      toast.success("Friend request sent successfully");
    }
    catch (err) {
      if (err.response?.data?.error) {
        toast.error(err.response.data.error);
      }
      toast.error(err.response.data.error);
    }
  };


  const getUserRelationship = () => {
    if (friendshipStatus.is_blocked ) return "blocked";
    if (friendshipStatus.friendship_status === "accepted" && !friendshipStatus.can_send_request) return "friend";
    if (friendshipStatus.friendship_status === "pending" && friendshipStatus.from_user === currUser.username) return "pending";
    if (friendshipStatus.friendship_status === "pending" && friendshipStatus.from_user !== currUser.username) return "accept"; 
    if (friendshipStatus.can_send_request) return "stranger";
    return "unknown"; // Fallback case
  };

  const userRelationship = getUserRelationship();
  console.log("userRelationship", userRelationship);
  
  const renderButtons = () => {
    switch (userRelationship) {
      case "pending":
        return (
          <>
            <button
              className="bg-[#FF6347] m-2 p-2 h-[50px] w-[150px] rounded-lg"
              onClick={() =>
                removeFriendship(userId, friendshipStatus, setFriendshipStatus)
              }
              disabled={loading}
            >
              Cancel Request
            </button>
            <button
              className="bg-[#FF0000] m-2 p-2 h-[50px] w-[150px] rounded-lg"
              onClick={() =>
                blockUser(
                  userId,
                  currentUserId,
                  friendshipStatus,
                  setFriendshipStatus
                )
              }
              disabled={loading}
            >
              Block User
            </button>
          </>
        );
      case "accept":
        return (
          <>
            <button
              className="bg-green-600 m-2 p-2 h-[50px] w-[150px] rounded-lg"
              // onClick={() =>
              //   removeFriendship(userId, friendshipStatus, setFriendshipStatus)
              // }
              disabled={loading}
            >
              Accept Request
            </button>
            <button
              className="bg-[#FF0000] m-2 p-2 h-[50px] w-[150px] rounded-lg"
              onClick={() =>
                blockUser(
                  userId,
                  currentUserId,
                  friendshipStatus,
                  setFriendshipStatus
                )
              }
              disabled={loading}
            >
              Block User
            </button>
          </>
        )
      case "stranger":
        return (
          <>
            <button
              className="bg-[#FFD360] m-2 p-2 h-[50px] w-[150px] rounded-lg  text-[#131313]"
              onChange={() => console.log("sendFriendRequest3")}  
              onClick={sendFriendRequest}
              disabled={loading}
            >
              Send Request
            </button>
            <button
              className="bg-[#FF0000] m-2 p-2 h-[50px] w-[150px] rounded-lg  text-[#131313]"
              onClick={() =>
                blockUser(
                  userId,
                  currentUserId,
                  friendshipStatus,
                  setFriendshipStatus
                )
              }
              disabled={loading}
            >
              Block User
            </button>
            {/* <button
              className="bg-blue-500 m-2 text-white p-2 rounded-md"
              onClick={() => sendGameRequest(userId)}
              // disabled={loading}
            >
              Send Game Request
            </button> */}
          </>
        );
      case "friend":
        return (
          <>
            <button
              className="bg-[#FF6347] m-2 p-2 h-[50px] w-[150px] rounded-lg"
              onClick={() =>
                removeFriendship(userId, friendshipStatus, setFriendshipStatus)
              }
              disabled={loading}
            >
              Remove Friendship
            </button>
            <button
              className="bg-[#FF0000] m-2 p-2 h-[50px] w-[150px] rounded-lg"
              onClick={() =>
                blockUser(
                  userId,
                  currentUserId,
                  friendshipStatus,
                  setFriendshipStatus
                )
              }
              disabled={loading}
            >
              Block User
            </button>
            <button
              className="bg-blue-500 m-2 text-white p-2 rounded-md"
              onClick={() => sendGameRequest(userId)}
              // disabled={loading}
            >
              Send Game Request
            </button>
          </>
        );
      case "blocked":
        return (
          <button
            className="bg-blue-500 m-2 p-2 h-[50px] w-[150px] rounded-lg"
            onClick={() =>
              unblockUser(
                userId,
                currentUserId,
                friendshipStatus,
                setFriendshipStatus
              )
            }
            disabled={loading}
          >
            Unblock User
          </button>
        );
      default:
        return (
          <span className="text-red-500 m-2 p-2 h-[50px] w-[150px] rounded-lg">
            Error: Unknown relationship
          </span>
        );
    }
  };


  // --------------------------------------------------------------------------------------


    const levelPercentage = (userData.level - Math.floor(userData.level)) * 100;


    console.log("userData and friendshipStatus", userData, friendshipStatus);
    return (
      <div className="h-[1100px] flex flex-col m-2 bg-[#131313] font-semibold fade-in-globale rounded-xl border border-[#FFD369]">
        <div className="h-[30%] flex flex-col">
          <div className=" flex flex-col items-center justify-center m-4">
            {!myProfile && (
              <div className="relative">
                <div className="w-[130px] h-[130px] absolute">
                  <div
                    className={`absolute w-5 h-5 rounded-full right-20 bottom-1 bg-${
                      userData.is_online ? "green" : "red"
                    }-500 border border-[#FFD369]`}
                  ></div>
                </div>
              </div>
            )}
            <img
              src={userData.image || "../user_img.svg"}
              alt="user_img"
              className="rounded-full h-[130px] w-[130px] border-2 border-[#FFD369]"
            />
            <div className="m-2 text-lg dark:text-[#FFD369]">
              {userData.username}
            </div>
          </div>
          <div className="w-full flex justify-center">
            <div className="flex w-[95%] bg-gray-200 rounded-xl h-10 dark:bg-gray-700">
              <div
                className="bg-[#FFD369] h-10 rounded-xl"
                style={{ width: `${levelPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
        <div className="h-[3%] flex flex-col">
          <span className="text-[#FFD369] text-center font-kreon text-2xl">
            Level : {Math.floor(userData.level)}
          </span>
        </div>

        <GameData userData={userData} />

        {!myProfile && (
          <div className="h-[10%] flex  items-center justify-center">
            {renderButtons()}
          </div>
        )}
      </div>
    );
};

export default Profile;
