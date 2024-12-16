"use client";

import React, { useState, useRef } from "react";
import Profile from "../Components/profile";
import {useRouter} from "next/navigation";

export default function UsersList({ users }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const scrollRef = useRef(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleWheel = (event) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: event.deltaY < 0 ? -30 : 30,
        behavior: "smooth",
      });
    }
  };

  const scroll = (direction) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === "left" ? -200 : 200,
        behavior: "smooth",
      });
    }
  };

  const friendsEmpty = users.length === 0;
  return (
    <div className="flex flex-col justify-between ">
      <div className="bg-[#222831] h-full m-2 flex flex-row items-center relative rounded-2xl">
        {friendsEmpty ? (
          <div className="text-gray-400 w-full text-center">
            No friends to show
          </div>
        ) : (
          <>
            <button
              className="absolute left-0 z-10 bg-gray-800 p-2 rounded-full"
              onClick={() => scroll("left")}
            >
              <img
                src="./left_arrow.svg"
                alt="Left Arrow"
                className="w-10 h-10"
              />
            </button>
            <div
              ref={scrollRef}
              onWheel={handleWheel}
              className="lg:w-[87%] w-[60%] ml-10 overflow-x-auto scrollbar-thin scrollbar-thumb-[#FFD369] scrollbar-track-gray-800 flex items-center"
            >
              <div className="flex h-full space-x-4 p-2">
                {users.map((user, index) => (
                  <div
                    key={index}
                    className="flex-shrink-0 p-4 rounded cursor-pointer"
                    onClick={() => {
                      if (!open) {
                        setSelectedUser(user);
                        setOpen(true);
                      } else {
                        setSelectedUser(null);
                        setOpen(false);
                      }
                    }}
                  >
                    <img
                      src={user.image || "../user_img.svg"}
                      alt="user_img"
                      className={`w-14 h-14 md:h-20 md:w-20 rounded-full ${
                        selectedUser && selectedUser.id === user.id
                          ? "border-4 border-[#FFD369]"
                          : ""
                      }`}
                    />
                    {/* Online status dot */}
                    <div className="w-14 md:w-20 flex justify-center">
                      <div
                        className={`w-2 h-2 md:w-3 md:h-3 rounded-full  bg-${
                          user.is_online ? "green" : "red"
                        }-500 border border-[#FFD369]`}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              className="absolute right-0 z-10 bg-gray-800 p-2 rounded-full"
              onClick={() => scroll("right")}
            >
              <img
                src="./right_arrow.svg"
                alt="Right Arrow"
                className="w-10 h-10"
              />
            </button>
          </>
        )}
      </div>
      {selectedUser && router.push(`/user-profile/${selectedUser.id}`)}
    </div>
  );
}
