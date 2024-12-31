"use client";

import { usePathname } from "next/navigation";
import { NavBar } from "@/app/NavBar/Nav";

export default function NavBarController() {
  const pathname = usePathname();
  const isLeaderboardPage = pathname === "/About" || pathname === "/game" || pathname === "/offlineGame";

  return !isLeaderboardPage ? <NavBar /> : null;
}
