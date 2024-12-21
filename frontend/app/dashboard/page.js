"use client"; // Client-side component

import React, { useEffect, useState } from "react";
import Axios from "../Components/axios";
import { useRouter } from "next/navigation";
import CircularProgress from "../user-profile/[userId]/(profileComponents)/circularProgress";
import DoubleLineChart from '../Components/DoubleLineChart';


const Dashboard = () => {
  const [user, setUser] = useState({
    username: "abberkac",
    achievements: [
      { name: "First Win" },
      { name: "10 Wins" },
      { name: "50 Wins" },
      { name: "100 Wins" },
    ],
    level: 0,
    wins: 0,
    winrate: 0,
    losses: 0,
  });

//  --------------------------------------------------------------------------------

  // Data for the Double Line Chart
  const chartData = {
    labels: ['Game-1', 'Game-2', 'Game-3', 'Game-4', 'Game-5', 'Game-6', 'Game-7', 'Game-8', 'Game-9', "Game-10"], // X-axis labels
    datasets: [
      {
        label: 'Wins', // Label for the first line
        data: [0, 1, 2, 2, 2, 3, 4, 4, 5, 6], // Wins data
        borderColor: '#FFD369', // Line color for Wins (Yellow)
        backgroundColor: 'rgba(255, 211, 105, 0.2)', // Light background color under the line
        fill: false, // No fill under the line
        tension: 0.4, // Smoothness of the line
        borderWidth: 2, // Line width
        pointBackgroundColor: '#FFD369', // Point color for Wins
        pointRadius: 5, // Radius of the points
      },
      {
        label: 'Losses', // Label for the second line
        data: [0, 0, 0, 1, 2, 2, 2, 3, 3, 3], // Losses data
        borderColor: '#393E46', // Line color for Losses (Dark Gray/Blue)
        backgroundColor: 'rgba(57, 62, 70, 0.2)', // Light background color under the line
        fill: false, // No fill under the line
        tension: 0.4, // Smoothness of the line
        borderWidth: 2, // Line width
        pointBackgroundColor: '#393E46', // Point color for Losses
        pointRadius: 5, // Radius of the points
      },
    ],
  };

  // Options to configure the chart
  const chartOptions = {
    responsive: true,
    animation: {
      duration: 1500, // Duration of the animation (in ms)
      easing: 'easeInOutQuad', // Easing function for the animation
      onProgress: function (animation) {
        const progress = animation.animationState ? animation.animationState.currentStep / animation.animationState.numSteps : 0;
        console.log('Progress: ', progress);
      },
      onComplete: function () {
        console.log('Animation complete');
      },
    },
    plugins: {
      legend: {
        position: 'top', // Position of the legend (top, left, etc.)
      },
      tooltip: {
        enabled: true, // Enable tooltips
      },
    },
    scales: {
      x: {
        beginAtZero: true, // Ensure the x-axis starts at zero
      },
      y: {
        beginAtZero: true, // Ensure the y-axis starts at zero
        ticks: {
          stepSize: 50,
        },
      },
    },
  };







  const [users, setUsers] = useState ([
    {
      rank: 1,
      username: "JohnDoe",
      level: 10
    },
    {
      rank: 2,
      username: "Drake",
      level: 8
    },
    {
      rank: 3,
      username: "JohnSmith",
      level: 6
    },
    {
      rank: 4,
      username: "TomSmith",
      level: 4
    },
    {
      rank: 5,
      username: "JohnJohnson",
      level: 2
    },
    {
      rank: 6,
      username: "JaneJohnson",
      level: 1
    }
  ]);

  const filteredUsers = users.filter(user => 
    user.username.toLocaleLowerCase()
  );

  const topThreeUsers = filteredUsers.slice(0, 3);

//  --------------------------------------------------------------------------------
  const [loading, setLoading] = useState(true); // Loading state
  const router = useRouter();

  // useEffect(() => {
  //   const fetchUserProfile = async () => {
  //     try {
  //       const response = await Axios.get("/api/user_profile/");
  //       console.log("User Profile::", response.data);
  //       setUser(response.data);
  //     } catch (error) {
  //       console.error("Error fetching user profile:", error);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   fetchUserProfile();
  // }, []);

  // if (loading) {
  //   return <p>Loading...</p>; // Show loading state if fetching data
  // }

  return (
    <div className="flex justify-center text-center items-center border border-[#FFD369] p-6 bg-black m-2 rounded-lg shadow-lg" >
      <div className="w-[90%] flex flex-col  justify-around ">
        <div className="bg-[#393E46] border border-[#FFD369] shadow-lg rounded-lg p-10 m-6 flex flex-col items-center" >
          <h1 className="text-2xl font-bold mb-4 text-[#FFD369]">Welcome to Ping Pong Game</h1>
          <p className="text-2xl font-bold text-[#FFD369]" > {user?.username} </p>
        </div>
        <div className="flex flex-col md:flex-row w-full justify-around shadow-lg">
          <div className="p-4 m-2  md:w-[48%] rounded-lg shadow border border-[#FFD369]">
            <h2 className="text-xl font-semibold  mb-2 text-[#FFD369]  rounded-lg ">Achievements</h2>
            <div className="flex flex-col items-center border border-[#FFD369] p-4 rounded-lg" > 
              {user?.achievements.map((achievement, index) => (
                <div key={index} className="w-full bg-[#393E46] rounded-full flex h-24 text-center justify-center items-center mb-2">
                  <p className="text-[#FFD369] text-2xl ">{achievement.name}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="md:w-[48%] p-4 m-2 text-[#FFD369] rounded-lg shadow border border-[#FFD369]  ">
            <h2 className="text-2xl  mb-2" >Top On Leaderboard</h2>
            {/* ---------------------------------------------------------------------------------- */}
            <div className=" h-[80%] w-full bg-[#222831] rounded-lg p-2 border border-[#FFD369]">
              <div className="flex items-center h-[20%] justify-between bg-[#222831] rounded-lg m-2 border border-[#FFD369]">
                <span className="text-[#FFD369] h-full flex justify-center items-center w-full mr-1 rounded-l-lg font-kreon  border-[#FFD369] border-r">Rank</span>
                <span className="text-[#FFD369] h-full flex justify-center items-center w-full mr-1 font-kreon border-[#FFD369] border">Player</span>
                <span className="text-[#FFD369] h-full flex justify-center items-center w-full mr-1 rounded-r-lg  border-[#FFD369] border-l font-kreon">Level</span>
              </div>
              {topThreeUsers.map((user, index) => (
                <div key={index} className="flex items-center h-[22%] justify-between bg-[#222831] rounded-lg m-2">
                  <span className="text-[#FFD369] h-full bg-[#393E46] w-full flex justify-center items-center mr-1 rounded-l-lg font-kreon">{user.rank}</span>
                  <span className="text-[#FFD369] h-full bg-[#393E46] w-full flex justify-center items-center mr-1 font-kreon">{user. username}</span>
                  <span className="text-[#FFD369] h-full bg-[#393E46] w-full flex justify-center items-center mr-1 rounded-r-lg font-kreon">{user.level}</span>
                </div>
              ))}
            </div>
            {/* ---------------------------------------------------------------------------------- */}
          </div>
        </div>

        <div className="flex flex-col md:flex-row w-full justify-around">
          <div className="md:w-[48%] p-4 m-2  h-[400px] flex justify-center items-center rounded-lg shadow border border-[#FFD369] " >
            {/* <h2 className="text-xl font-semibold mb-2" style={{ color: '#FFD369' }}>Wins</h2>
            <p style={{ color: '#FFD369' }}>{user?.wins}</p> */}

            <DoubleLineChart data={chartData} options={chartOptions} />
          </div>

          <div className="md:w-[48%] p-4 m-2  rounded-lg shadow text-[#393E46] border border-[#FFD369] " >
            <h2 className="text-xl font-semibold  mb-2 text-[#FFD369]">Winrate</h2>
            <div className="flex justify-center items-center ">
              <CircularProgress percentage={user?.winrate} colour="#FFD369" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;