"use client";
import Axios from "../Components/axios";
import { updatePaddle, scaling } from "./Paddles";
import { useWebSocketContext } from "./webSocket";
import { rightPaddle, fil, draw, leftPaddle } from "./Draw";
import React, { useState, useEffect, useRef } from "react";
import { initialCanvas, GAME_CONSTANTS } from "./GameHelper";
import { useRouter } from "next/navigation";

export function Game() {
  const { gameState, sendGameMessage, setUser, setPlayer1Name, positionRef } =
    useWebSocketContext();
  const [playerName, setPlayerName] = useState(null);
  const [playerPic, setPlayerPic] = useState(null);
  const [mapNum, setMapNum] = useState(1);
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const divRef = useRef(null);
  const router = useRouter();
  
  useEffect(() => {
    // if (router.isReady){
      const { map } = router.query;

      if (map){
        setMapNum(map);
      }
      else {
        console.warn("Map query parameter is missing.");
      }
    // }
  }, [router.isReady, router.query])

  if (mapNum === null) {
    return <p>Loading or no map selected...</p>;
  }
  else
    console.log("........ ", mapNum)


  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await Axios.get("api/user_profile/");
        setPlayerPic(response.data.image);
        setPlayerName(response.data.first_name);
        setPlayer1Name(response.data.first_name);
        setUser(response.data.username);
      } catch (err) {
        console.error("COULDN'T FETCH THE USER FROM PROFILE 😭:", err);
      }
    };

    fetchCurrentUser();
  }, [sendGameMessage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    contextRef.current = context;

    initialCanvas(divRef, canvas, positionRef);

    const resizeCanvas = () => {
      const container = divRef.current;
      if (!canvas || !container) return;

      const containerWidth = window.innerWidth * 0.7;
      const containerHeight = window.innerHeight * 0.6;

      const aspectRatio =
        GAME_CONSTANTS.ORIGINAL_WIDTH / GAME_CONSTANTS.ORIGINAL_HEIGHT;
      let width = containerWidth;
      let height = width / aspectRatio;

      if (height > containerHeight) {
        height = containerHeight;
        width = height * aspectRatio;
      }
      canvas.width = width;
      canvas.height = height;

      //changed * scaleX/Y
      leftPaddle.x = GAME_CONSTANTS.PADDLE_WIDTH;
      rightPaddle.x =
        GAME_CONSTANTS.ORIGINAL_WIDTH - 2 * GAME_CONSTANTS.PADDLE_WIDTH;

      if (!leftPaddle.y) {
        // Only set if not already set
        leftPaddle.y =
          GAME_CONSTANTS.ORIGINAL_HEIGHT / 2 - GAME_CONSTANTS.PADDLE_HEIGHT / 2;
      }
      if (!rightPaddle.y) {
        rightPaddle.y =
          GAME_CONSTANTS.ORIGINAL_HEIGHT / 2 - GAME_CONSTANTS.PADDLE_HEIGHT / 2;
      }

      fil.x = canvas.width / 2;
      fil.y = canvas.height / 2;

      const { scaleY } = scaling(0, 0, canvas);
      leftPaddle.height = GAME_CONSTANTS.PADDLE_HEIGHT * scaleY;
      rightPaddle.height = GAME_CONSTANTS.PADDLE_HEIGHT * scaleY;

      sendGameMessage({
        type: "canvas_resize",
        canvas_width: width,
        canvas_height: height,
      });
    };
    const handleKeyDown = (event) => {
      if (event.code === "KeyW") {
        leftPaddle.dy = -7;
      }
      if (event.code === "KeyS") {
        leftPaddle.dy = 7;
      }
    };

    const handleKeyUp = (event) => {
      if (event.code === "KeyW" || event.code === "KeyS") {
        leftPaddle.dy = 0;
      }
    };
    const gameLoop = () => {
      if (!canvas || !contextRef.current) return;
      updatePaddle(canvasRef, positionRef, sendGameMessage);
      draw(contextRef, canvasRef, positionRef, gameState);
      requestAnimationFrame(gameLoop);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    if (divRef.current) {
      sendGameMessage({
        type: "play",
        canvas_width: canvas.width,
        canvas_height: canvas.height,
        ball_owner: playerName,
      });
    }
    gameLoop();

    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [gameState.playerTwoN]);

  // useEffect(() => {
  //   const lockOrientation = async () => {
  //     if ("orientation" in screen && screen.orientation.lock) {
  //       try {
  //         await screen.orientation.lock("landscape-primary");
  //         console.log("⛔️⛔️⛔️ Orientation locked to landscape");
  //       } catch (err) {
  //         console.log("⛔️⛔️⛔️ Failed to lock orientation", err);
  //       }
  //     } else {
  //       console.warn("⛔️⛔️⛔️ Screen orientation API is not supported.");
  //     }
  //     const canvas = canvasRef.current;
  //     if (canvas && canvas.requestFullscreen) {
  //       try {
  //         await canvas.requestFullscreen();
  //         console.log("⛔️⛔️⛔️ Canvas is now fullscreen");
  //       } catch {
  //         console.log("⛔️⛔️⛔️ Faild to enter the fullscreen mode")
  //       }
  //     }
  //     else{
  //       console.warn("Fullscreen API is not supported.")
  //     }
  //   };
  //   lockOrientation();
  // }, []);

  return (
    <div
      ref={divRef}
      className=" text-sm h-lvh min-h-screen"
      style={{
        backgroundColor: "#222831",
        fontFamily: "Kaisei Decol",
        color: "#FFD369",
      }}
    >
      <div className="flex w-full justify-between mb-12">
        <a href="./profile" className="flex p-6">
          <img
            src={`${playerPic}`}
            alt="avatar"
            className="w-20 h-20 rounded-full cursor-pointer border-2 z-50"
            style={{ borderColor: "#FFD369" }}
          />
          <div
            className="hidden lg:flex -ml-4 h-12 w-64  mt-5 z-2 text-black justify-center items-center rounded-lg text-lg "
            style={{ backgroundColor: "#FFD369" }}
          >
            {playerName}
          </div>
        </a>
        <a href="#" className="flex p-6">
          <div
            className="hidden lg:flex -mr-4 h-12 w-64 mt-4 z-2 text-black justify-center items-center rounded-lg text-lg"
            style={{ backgroundColor: "#FFD369" }}
          >
            {gameState.playerTwoN}
          </div>
          <img
            // src="./avatar1.jpg"
            src={`${gameState.playerTwoI}`}
            alt="avatar"
            className="w-20 h-20 rounded-full cursor-pointer border-2 z-50"
            style={{ borderColor: "#FFD369" }}
          />
        </a>
      </div>
      <div>
        <div className="flex justify-around items-center">
          <div
            className=""
            style={{
              height: "100%",
              backgroundColor: "#222831",
              color: "#FFD369",
            }}
          >
            <div className="flex text-7x justify-center mb-20">
              <h1 className="text-7xl mr-52" style={{ color: "#FFD369" }}>
                {gameState.scoreA}
              </h1>
              <span className="font-extralight text-5xl flex items-center">
                VS
              </span>
              <h1 className="text-7xl ml-52" style={{ color: "#FFD369" }}>
                {gameState.scoreB}
              </h1>
            </div>
            <div>
              {/* <canvas className="block mx-auto z-3 text-white" ref={canva} /> */}
              <canvas
                ref={canvasRef}
                className="block mx-auto z-3 bg-[#393E46] border-2 border-[#FFD369] rotate-90 sm:rotate-0 sm:w-full "
                // className="block mx-auto z-3 bg-[#2C3E50] border-2 border-[#ffffff]"
              />
              <div className="text-center mt-4"></div>
            </div>
          </div>
          <a href="#" className="absolute left-10 bottom-10">
            <img
              src="https://127.0.0.1:8001/exit.svg"
              alt="exitpoint"
              className="w-10"
            />
          </a>
        </div>
      </div>
    </div>
  );
}
