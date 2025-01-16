import Axios from "../Components/axios";
import { NextRequest } from "next/server"; 

export class Task {
    constructor(intervalInMinutes = 1, setLoggedInUser) {
        this.intervalInMs = intervalInMinutes * 20 * 1000;
        this.isRunning = false;
        this.timerId = null;
        this.setLoggedInUser = setLoggedInUser; // Store the function
    }
  
    async makeApiRequest() {
        try {
            // console.log('=======> API Request: /api/update_user_last_active/');
            const response = await Axios.get('/api/update_user_last_active/');
            const data = response.data;
            // !!!
            const userResponse = await Axios.get("/api/user_profile/");
            this.setLoggedInUser(userResponse);

            // console.log('API Response:', data);
            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }
  
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        // Make the first call after some time 
        setTimeout(() => {
            this.makeApiRequest();
        }, 3000);
  
        this.timerId = setInterval(() => {
            this.makeApiRequest();
        }, this.intervalInMs);
    }
  
    stop() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
        this.isRunning = false;
    }
  }

