import NavBarController from "./Components/NavBarController";
import { WebSocketProviderForChat } from "./Components/WebSocketContext";
import "../globals.css";
import { WebSocketProvider } from "./game/webSocket" 

export const metadata = {
    title: "ping-pong",
    description: "Generated by : (abberkac)",
};
export const viewport = {
    width: 'device-width',
    initialScale: 1.0,
    maximumScale: 1.0,
    userScalable: 'no'
  }
  

export default function Layout({ children }) {
    return (
        <WebSocketProvider>
        <WebSocketProviderForChat>
            <NavBarController />
            {children}
        </WebSocketProviderForChat>
        </WebSocketProvider>
    );
}
