import { GAME_CONSTANTS } from "./GameHelper";
import { scaling } from "./GameHelper";
import { fil, leftPaddle, rightPaddle, Ball } from "./Draw";

export const defaultMap = (context, canvas) => {
  const { scaleX, scaleY } = scaling(0, 0, canvas);


  // Draw leftPaddle
  context.fillStyle = "#EEEEEE";
  context.fillRect(
    leftPaddle.x * scaleX ,
    leftPaddle.y * scaleY,
    GAME_CONSTANTS.PADDLE_WIDTH * scaleX,
    GAME_CONSTANTS.PADDLE_HEIGHT * scaleY
  );

  //Draw rightPaddle
  context.fillStyle = "#FFD369";
  context.fillRect(
    rightPaddle.x * scaleX,
    rightPaddle.y * scaleY,
    GAME_CONSTANTS.PADDLE_WIDTH * scaleX,
    GAME_CONSTANTS.PADDLE_HEIGHT * scaleY
  );

  // Draw fil
  context.fillStyle = "#000000";
  context.fillRect(fil.x * scaleX, 0, 1 * scaleX, canvas.height);
  // context.fillRect(fil.x, fil.y - canvas.height / 2, 1, canvas.height);


  // // Draw ball
  context.beginPath();
  context.arc(
    Ball.x * scaleX,
    Ball.y * scaleY,
    GAME_CONSTANTS.BALL_RADIUS * Math.min(scaleX, scaleY),
    0,
    Math.PI * 2
  );
  context.fillStyle = "#00FFD1";
  context.fill();
};
