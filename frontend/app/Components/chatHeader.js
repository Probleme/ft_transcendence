import React, { useState, useEffect } from 'react';
import { FiMenu } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import FriendManagement from './FriendManagement';

const ChatHeader = ({ selectedUser, toggleUserList }) => {
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [showFriendManagement, setShowFriendManagement] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-menu') && 
          !event.target.closest('.three-dots-icon') &&
          !event.target.closest('.friend-management')) {
        setIsDropdownVisible(false);
        setShowFriendManagement(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleViewProfile = () => {
    router.push('/profile');
  };

  const toggleFriendManagement = () => {
    setShowFriendManagement(!showFriendManagement);
    setIsDropdownVisible(false);
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between p-4 rounded-r-md bg-[#222831] relative">
        <div className="flex items-center">
          <div className="block lg:hidden">
            <FiMenu
              size={24}
              className="text-[#FFD369] cursor-pointer mr-2"
              onClick={toggleUserList}
            />
          </div>
          <img 
            src={selectedUser.image || "./user_img.svg"} 
            alt="user_img" 
            className="w-10 h-10 mr-4 rounded-full"
          />
          <div>
            <span className="text-lg font-kreon text-white">{selectedUser.name}</span>
            <span className={`block text-sm ${selectedUser.is_online ? 'text-[#FFD369]' : 'text-[#eb2e2e]'}`}>
              {selectedUser.is_online ? 'online' : 'offline'}
            </span>
          </div>
        </div>
        
        <div className="text-white text-2xl cursor-pointer relative three-dots-icon" onClick={() => setIsDropdownVisible(!isDropdownVisible)}>
          <img src='./3dots.svg' alt='3dots_img' />
          {isDropdownVisible && (
            <div className="dropdown-menu absolute right-0 top-12 mt-2 w-48 bg-[#222831] border border-gray-600 rounded-md shadow-lg z-10">
              <ul>
                <li className="p-2 text-lg font-kreon hover:bg-[#393E46] cursor-pointer" onClick={handleViewProfile}>
                  View Profile
                </li>
                <li className="p-2 text-lg font-kreon hover:bg-[#393E46] cursor-pointer" onClick={toggleFriendManagement}>
                  Manage Friend
                </li>
                <li className="p-2 text-lg font-kreon hover:bg-[#393E46] cursor-pointer">
                  Invite to Game
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
      
      {showFriendManagement && (
        <div className="friend-management absolute right-4 top-20 z-20 w-72">
          <FriendManagement targetUser={selectedUser} />
        </div>
      )}
    </div>
  );
};

export default ChatHeader;